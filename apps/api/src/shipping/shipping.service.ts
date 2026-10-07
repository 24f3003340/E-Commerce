import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { config } from '../common/config';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition } from '../orders/order-state';
import { ShiprocketClient } from './shiprocket.client';
import { buildShiprocketOrder, PackageSize, sellerPickupName } from './shiprocket.mapper';

/** Orders that can still be handed to a courier (nothing has left yet). */
const BOOKABLE: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED];

/** Maps aggregator (Shiprocket etc.) statuses onto our order statuses. */
const STATUS_MAP: Record<string, OrderStatus | undefined> = {
  PICKED_UP: OrderStatus.SHIPPED,
  SHIPPED: OrderStatus.SHIPPED,
  IN_TRANSIT: OrderStatus.SHIPPED,
  REACHED_AT_DESTINATION_HUB: OrderStatus.SHIPPED,
  OUT_FOR_DELIVERY: OrderStatus.OUT_FOR_DELIVERY,
  DELIVERED: OrderStatus.DELIVERED,
};

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly courier: ShiprocketClient,
  ) {}

  get courierEnabled() {
    return this.courier.enabled;
  }

  /**
   * Books the order with Shiprocket: creates the courier order from the seller's (or the store's)
   * pickup address, assigns an AWB with the recommended courier, schedules the pickup and fetches
   * the shipping label. The order becomes PACKED; courier tracking moves it to SHIPPED/DELIVERED.
   */
  async bookCourier(orderId: string, size: PackageSize, actor: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true } },
        seller: true,
        shipments: true,
        items: { include: { variant: { select: { product: { select: { hsnCode: true } } } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!BOOKABLE.includes(order.status)) throw new BadRequestException(`An order that is ${order.status.toLowerCase().replace(/_/g, ' ')} cannot be booked with a courier`);
    if (order.shipments.some((s) => s.status !== 'CANCELLED')) throw new BadRequestException('This order already has a shipment');

    let pickup = config.shiprocket.pickupLocation;
    if (order.seller) {
      pickup = order.seller.courierPickup ?? sellerPickupName(order.seller.slug);
      if (!order.seller.courierPickup) {
        await this.courier.addPickupLocation({
          nickname: pickup,
          name: order.seller.name,
          email: order.seller.email,
          phone: order.seller.phone,
          address: order.seller.addressLine1,
          address2: order.seller.addressLine2 ?? undefined,
          city: order.seller.city,
          state: order.seller.state,
          pincode: order.seller.pincode,
        });
        await this.prisma.seller.update({ where: { id: order.seller.id }, data: { courierPickup: pickup } });
      }
    }

    const payload = buildShiprocketOrder(
      { ...order, customerEmail: order.user.email, items: order.items.map((i) => ({ ...i, hsn: i.variant.product.hsnCode })) },
      pickup,
      size,
    );
    const created = await this.courier.createOrder(payload);
    let awb: { awb: string; courier: string };
    try {
      awb = await this.courier.assignAwb(created.shipmentId);
    } catch (err) {
      // Don't leave a half-booked order behind in Shiprocket
      await this.courier.cancelOrders([created.orderId]).catch(() => undefined);
      throw err;
    }
    // Pickup and label are conveniences: the booking stands even if either call fails
    await this.courier.schedulePickup(created.shipmentId).catch((err) => this.logger.warn(`Pickup request failed for ${order.orderNumber}: ${(err as Error).message}`));
    const labelUrl = await this.courier.label(created.shipmentId).catch(() => undefined);

    const shipment = await this.prisma.shipment.create({
      data: {
        orderId,
        carrier: awb.courier,
        awb: awb.awb,
        trackingUrl: `https://shiprocket.co/tracking/${awb.awb}`,
        status: 'PICKUP_SCHEDULED',
        provider: 'SHIPROCKET',
        providerOrderId: created.orderId,
        providerShipmentId: created.shipmentId,
        labelUrl,
        events: { create: { status: 'PICKUP_SCHEDULED', note: `Booked with ${awb.courier} via Shiprocket` } },
      },
    });
    const note = `Courier booked: ${awb.courier} AWB ${awb.awb}`;
    if (order.status !== OrderStatus.PACKED) await this.orders.transition(orderId, OrderStatus.PACKED, actor, note);
    else await this.prisma.orderStatusHistory.create({ data: { orderId, status: OrderStatus.PACKED, actor, note } });
    return shipment;
  }

  async create(orderId: string, dto: { carrier: string; awb: string; trackingUrl?: string }, actor: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { shipments: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.shipments.some((s) => s.provider === 'SHIPROCKET' && s.status !== 'CANCELLED')) {
      throw new BadRequestException('This order is booked with the courier; tracking updates mark it shipped automatically');
    }
    if (!canTransition(order.status, OrderStatus.SHIPPED)) {
      throw new BadRequestException(`Order in status ${order.status} cannot be shipped`);
    }
    const shipment = await this.prisma.shipment.create({
      data: {
        orderId,
        carrier: dto.carrier,
        awb: dto.awb,
        trackingUrl: dto.trackingUrl,
        status: 'SHIPPED',
        shippedAt: new Date(),
        events: { create: { status: 'SHIPPED', note: `Handed over to ${dto.carrier}` } },
      },
      include: { events: true },
    });
    await this.orders.transition(orderId, OrderStatus.SHIPPED, actor, `${dto.carrier} AWB ${dto.awb}`);
    return shipment;
  }

  /** Applies a tracking update received from the shipping aggregator webhook. */
  async applyUpdate(update: { awb: string; status: string; location?: string; note?: string; occurredAt?: string }) {
    const shipment = await this.prisma.shipment.findUnique({ where: { awb: update.awb }, include: { order: true } });
    if (!shipment) {
      this.logger.warn(`Shipping update for unknown AWB ${update.awb}`);
      return { ok: true, ignored: true };
    }
    const status = update.status.toUpperCase().replace(/[\s-]+/g, '_');
    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(!shipment.shippedAt && STATUS_MAP[status] === OrderStatus.SHIPPED ? { shippedAt: new Date() } : {}),
        events: {
          create: {
            status,
            location: update.location,
            note: update.note,
            occurredAt: update.occurredAt ? new Date(update.occurredAt) : new Date(),
          },
        },
      },
    });
    const target = STATUS_MAP[status];
    if (target && canTransition(shipment.order.status, target)) {
      await this.orders.transition(shipment.orderId, target, 'shipping-webhook', update.note);
    }
    return { ok: true };
  }
}
