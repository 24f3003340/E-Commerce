import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition } from '../orders/order-state';

/** Maps aggregator (Shiprocket etc.) statuses onto our order statuses. */
const STATUS_MAP: Record<string, OrderStatus | undefined> = {
  PICKED_UP: OrderStatus.SHIPPED,
  SHIPPED: OrderStatus.SHIPPED,
  IN_TRANSIT: OrderStatus.SHIPPED,
  OUT_FOR_DELIVERY: OrderStatus.OUT_FOR_DELIVERY,
  DELIVERED: OrderStatus.DELIVERED,
};

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async create(orderId: string, dto: { carrier: string; awb: string; trackingUrl?: string }, actor: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
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
