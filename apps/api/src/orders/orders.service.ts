import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  InventoryReason,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentRecordStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { CartService, cartItemIssue, toPricedLines, variantImage, variantLabel } from '../cart/cart.service';
import { ProductsService } from '../catalog/products.service';
import { CacheService } from '../common/cache.service';
import { config } from '../common/config';
import { SettingsService } from '../common/settings.service';
import { nextSequenceNumber, paginate, paginated } from '../common/utils';
import { shippingFee, subtotalOf } from '../coupons/coupon-math';
import { CouponsService } from '../coupons/coupons.service';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';
import { GatewayOrder, RazorpayGateway } from '../payments/razorpay.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOrderQueryDto, CheckoutDto } from './orders.dto';
import { canTransition, CUSTOMER_CANCELLABLE, STATUS_NOTIFICATIONS } from './order-state';

export const orderDetailInclude = {
  items: true,
  history: { orderBy: { createdAt: 'asc' } },
  shipments: { include: { events: { orderBy: { occurredAt: 'desc' } } }, orderBy: { createdAt: 'desc' } },
  payments: {
    orderBy: { createdAt: 'desc' },
    select: { id: true, provider: true, status: true, amount: true, method: true, providerPaymentId: true, createdAt: true },
  },
  returns: { include: { items: true }, orderBy: { createdAt: 'desc' } },
  refunds: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

type Tx = Prisma.TransactionClient;

export interface PaymentConfirmation {
  providerOrderId: string;
  providerPaymentId: string;
  amount?: number;
  method?: string;
  raw?: unknown;
}

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private expiryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly coupons: CouponsService,
    private readonly settings: SettingsService,
    private readonly products: ProductsService,
    private readonly gateway: RazorpayGateway,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.expiryTimer = setInterval(() => void this.expireStalePayments(), 5 * 60 * 1000);
    this.expiryTimer.unref();
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  // ───────────── Checkout ─────────────

  async checkout(userId: string, dto: CheckoutDto) {
    const settings = await this.settings.get();
    const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');
    const serviceability = await this.products.serviceability(address.pincode);
    if (!serviceability.serviceable) throw new BadRequestException('Sorry, we do not deliver to this pincode yet');

    const order = await this.prisma.$transaction(
      async (tx) => {
        const items = await this.cart.items(userId, tx);
        if (!items.length) throw new BadRequestException('Your cart is empty');
        const problem = items.find((i) => cartItemIssue(i));
        if (problem) {
          throw new BadRequestException(
            `${problem.variant.product.name} (${variantLabel(problem.variant)}) is no longer available in the requested quantity`,
          );
        }

        const lines = toPricedLines(items);
        const subtotal = subtotalOf(lines);
        let discount = 0;
        let couponId: string | undefined;
        let couponCode: string | undefined;
        if (dto.couponCode) {
          const result = await this.coupons.evaluate(dto.couponCode, userId, lines, tx);
          discount = result.discount;
          couponId = result.coupon.id;
          couponCode = result.coupon.code;
          const claimed = await tx.coupon.updateMany({
            where: {
              id: couponId,
              OR: [{ usageLimit: null }, { usedCount: { lt: result.coupon.usageLimit ?? 0 } }],
            },
            data: { usedCount: { increment: 1 } },
          });
          if (claimed.count === 0) throw new BadRequestException('Coupon usage limit reached');
        }
        const deliveryMethod = dto.deliveryMethod ?? 'STANDARD';
        const shipping = shippingFee(subtotal - discount, deliveryMethod, settings);
        const isCod = dto.paymentMethod === PaymentMethod.COD;
        const codFee = isCod ? settings.codFee : 0;
        const total = subtotal - discount + shipping + codFee;
        if (isCod && (!settings.codEnabled || !serviceability.codAvailable)) {
          throw new BadRequestException('Cash on delivery is not available');
        }
        if (isCod && total > settings.codMaxOrderValue) {
          throw new BadRequestException('Cash on delivery is not available for this order value');
        }

        // Reserve stock atomically. The conditional update fails if someone else bought the
        // last units between reading the cart and now.
        for (const item of items) {
          const reserved = await tx.productVariant.updateMany({
            where: { id: item.variantId, isActive: true, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity }, reserved: { increment: item.quantity } },
          });
          if (reserved.count === 0) {
            throw new BadRequestException(`${item.variant.product.name} (${variantLabel(item.variant)}) just went out of stock`);
          }
        }

        const orderNumber = await nextSequenceNumber(tx, 'ORD');
        const created = await tx.order.create({
          data: {
            orderNumber,
            userId,
            status: OrderStatus.PENDING_PAYMENT,
            paymentMethod: dto.paymentMethod,
            subtotal,
            discount,
            shippingFee: shipping,
            codFee,
            total,
            couponId,
            couponCode,
            deliveryMethod,
            notes: dto.notes,
            shippingAddress: {
              name: address.name,
              phone: address.phone,
              line1: address.line1,
              line2: address.line2,
              landmark: address.landmark,
              city: address.city,
              state: address.state,
              pincode: address.pincode,
              country: address.country,
            },
            items: {
              create: items.map((i) => ({
                productId: i.variant.productId,
                variantId: i.variantId,
                productName: i.variant.product.name,
                productSlug: i.variant.product.slug,
                variantLabel: variantLabel(i.variant),
                sku: i.variant.sku,
                imageUrl: variantImage(i),
                unitPrice: i.variant.price,
                mrp: i.variant.mrp,
                quantity: i.quantity,
                total: i.variant.price * i.quantity,
              })),
            },
            history: { create: { status: OrderStatus.PENDING_PAYMENT, actor: 'customer', note: 'Order placed' } },
          },
        });
        await tx.inventoryMovement.createMany({
          data: items.map((i) => ({
            variantId: i.variantId,
            change: -i.quantity,
            reason: InventoryReason.ORDER_RESERVED,
            reference: orderNumber,
          })),
        });
        if (couponId) {
          await tx.couponUsage.create({ data: { couponId, userId, orderId: created.id, discount } });
        }
        await this.cart.clear(userId, tx);

        if (isCod) {
          await tx.payment.create({
            data: { orderId: created.id, provider: PaymentProvider.COD, amount: total, status: PaymentRecordStatus.CREATED },
          });
          await this.confirmInTx(tx, created.id, 'system', 'Cash on delivery order confirmed');
        }
        return created;
      },
      { timeout: 20_000 },
    );
    await this.cache.delByPrefix('catalog:');

    await this.notify(order.userId, 'ORDER_PLACED', 'Order placed', `Your order ${order.orderNumber} has been placed.`, order.orderNumber);

    if (order.paymentMethod === PaymentMethod.ONLINE) {
      const payment = await this.createGatewayPayment(order.id);
      return { order: await this.customerOrder(userId, order.orderNumber), payment };
    }
    return { order: await this.customerOrder(userId, order.orderNumber), payment: null };
  }

  /** Creates a gateway order for a pending online order (also used for "retry payment"). */
  async createGatewayPayment(orderId: string): Promise<GatewayOrder & { orderNumber: string; prefill: Record<string, string> }> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: true } });
    if (order.status !== OrderStatus.PENDING_PAYMENT || order.paymentMethod !== PaymentMethod.ONLINE) {
      throw new BadRequestException('This order is not awaiting payment');
    }
    const gatewayOrder = await this.gateway.createOrder(order.total, order.orderNumber, { orderNumber: order.orderNumber });
    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: gatewayOrder.provider === 'MOCK' ? PaymentProvider.MOCK : PaymentProvider.RAZORPAY,
        providerOrderId: gatewayOrder.providerOrderId,
        amount: order.total,
        currency: gatewayOrder.currency,
      },
    });
    return {
      ...gatewayOrder,
      orderNumber: order.orderNumber,
      prefill: { name: order.user.name, email: order.user.email, contact: order.user.phone ?? '' },
    };
  }

  // ───────────── Payment outcomes (called from verified gateway callbacks / webhooks) ─────────────

  /** Idempotent: safe to call from both the browser callback and the webhook. */
  async markPaid(confirmation: PaymentConfirmation, source: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { providerOrderId: confirmation.providerOrderId },
        include: { order: true },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === PaymentRecordStatus.CAPTURED) return { order: payment.order, changed: false, lateRefund: false };
      if (confirmation.amount !== undefined && confirmation.amount !== payment.amount) {
        this.logger.error(`Amount mismatch for ${payment.providerOrderId}: ${confirmation.amount} != ${payment.amount}`);
        throw new BadRequestException('Payment amount mismatch');
      }
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentRecordStatus.CAPTURED } },
        data: {
          status: PaymentRecordStatus.CAPTURED,
          providerPaymentId: confirmation.providerPaymentId,
          method: confirmation.method,
          rawPayload: (confirmation.raw ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      if (claimed.count === 0) return { order: payment.order, changed: false, lateRefund: false };

      if (payment.order.status !== OrderStatus.PENDING_PAYMENT) {
        // Paid after the order was cancelled/expired (or paid twice) — refund automatically.
        await tx.refund.create({
          data: { orderId: payment.orderId, paymentId: payment.id, amount: payment.amount, status: RefundStatus.PENDING },
        });
        return { order: payment.order, changed: false, lateRefund: true, paymentId: payment.id };
      }
      await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: PaymentStatus.PAID } });
      await this.confirmInTx(tx, payment.orderId, source, `Payment received via ${confirmation.method ?? 'online payment'}`);
      return { order: payment.order, changed: true, lateRefund: false };
    });

    if (result.changed) {
      await this.notify(result.order.userId, 'PAYMENT_SUCCESS', 'Payment successful', `We received your payment for order ${result.order.orderNumber}.`, result.order.orderNumber);
    }
    if (result.lateRefund) await this.processPendingRefunds(result.order.id);
    return result.order;
  }

  async markPaymentFailed(providerOrderId: string, reason: string, raw?: unknown) {
    const payment = await this.prisma.payment.findUnique({ where: { providerOrderId }, include: { order: true } });
    if (!payment || payment.status !== PaymentRecordStatus.CREATED) return;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentRecordStatus.FAILED, rawPayload: (raw ?? { reason }) as Prisma.InputJsonValue },
    });
    // The order stays PENDING_PAYMENT so the customer can retry; it expires automatically.
    await this.notify(payment.order.userId, 'PAYMENT_FAILED', 'Payment failed', `Payment for order ${payment.order.orderNumber} failed. You can retry from your orders page.`, payment.order.orderNumber);
  }

  // ───────────── Status changes ─────────────

  private async confirmInTx(tx: Tx, orderId: string, actor: string, note: string) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { reserved: { decrement: item.quantity } },
      });
      await tx.product.update({ where: { id: item.productId }, data: { soldCount: { increment: item.quantity } } });
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CONFIRMED, confirmedAt: new Date() },
    });
    await tx.orderStatusHistory.create({ data: { orderId, status: OrderStatus.CONFIRMED, actor, note } });
  }

  /** Admin / shipping-webhook status change along the fulfilment pipeline. */
  async transition(orderId: string, to: OrderStatus, actor: string, note?: string) {
    if (to === OrderStatus.CANCELLED) return this.cancel(orderId, actor, note ?? 'Cancelled by store');
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!canTransition(order.status, to)) {
      throw new BadRequestException(`Cannot change order from ${order.status} to ${to}`);
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: to,
          ...(to === OrderStatus.DELIVERED
            ? {
                deliveredAt: new Date(),
                // Cash collected on delivery
                ...(order.paymentMethod === PaymentMethod.COD ? { paymentStatus: PaymentStatus.PAID } : {}),
              }
            : {}),
        },
      });
      if (updated.count === 0) throw new BadRequestException('Order was modified concurrently, please retry');
      if (to === OrderStatus.DELIVERED && order.paymentMethod === PaymentMethod.COD) {
        await tx.payment.updateMany({
          where: { orderId, provider: PaymentProvider.COD },
          data: { status: PaymentRecordStatus.CAPTURED },
        });
      }
      await tx.orderStatusHistory.create({ data: { orderId, status: to, actor, note } });
    });
    const message = STATUS_NOTIFICATIONS[to];
    if (message) {
      await this.notify(order.userId, message.type as NotificationType, message.title, message.body(order.orderNumber), order.orderNumber);
    }
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderDetailInclude });
  }

  /** Cancels an order, releases stock, restores coupon usage and refunds any captured payment. */
  async cancel(orderId: string, actor: string, reason: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, payments: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (!canTransition(order.status, OrderStatus.CANCELLED)) {
        throw new BadRequestException(`Order cannot be cancelled once it is ${order.status.toLowerCase().replace(/_/g, ' ')}`);
      }
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
      });
      if (updated.count === 0) throw new BadRequestException('Order was modified concurrently, please retry');

      const wasReserved = order.status === OrderStatus.PENDING_PAYMENT;
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stock: { increment: item.quantity },
            ...(wasReserved ? { reserved: { decrement: item.quantity } } : {}),
          },
        });
        if (!wasReserved) {
          await tx.product.update({ where: { id: item.productId }, data: { soldCount: { decrement: item.quantity } } });
        }
      }
      await tx.inventoryMovement.createMany({
        data: order.items.map((i) => ({
          variantId: i.variantId,
          change: i.quantity,
          reason: InventoryReason.ORDER_RELEASED,
          reference: order.orderNumber,
        })),
      });
      if (order.couponId) {
        await tx.couponUsage.deleteMany({ where: { orderId } });
        await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { decrement: 1 } } });
      }
      const captured = order.payments.find(
        (p) => p.status === PaymentRecordStatus.CAPTURED && p.provider !== PaymentProvider.COD,
      );
      if (captured) {
        await tx.refund.create({
          data: { orderId, paymentId: captured.id, amount: captured.amount, status: RefundStatus.PENDING },
        });
      }
      await tx.orderStatusHistory.create({ data: { orderId, status: OrderStatus.CANCELLED, actor, note: reason } });
      return order;
    });
    await this.cache.delByPrefix('catalog:');
    await this.processPendingRefunds(orderId);
    await this.notify(order.userId, 'ORDER_CANCELLED', 'Order cancelled', `Your order ${order.orderNumber} has been cancelled.`, order.orderNumber);
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderDetailInclude });
  }

  /** Sends pending refunds of an order to the gateway (original payment method). */
  async processPendingRefunds(orderId: string) {
    const refunds = await this.prisma.refund.findMany({
      where: { orderId, status: RefundStatus.PENDING, paymentId: { not: null } },
      include: { payment: true, order: true },
    });
    for (const refund of refunds) {
      if (!refund.payment?.providerPaymentId) continue;
      try {
        const result = await this.gateway.refund(refund.payment.providerPaymentId, refund.amount);
        await this.prisma.refund.update({
          where: { id: refund.id },
          data: { status: RefundStatus.PROCESSED, providerRefundId: result.id },
        });
        await this.syncRefundedPaymentStatus(orderId);
        await this.notify(refund.order.userId, 'REFUND_PROCESSED', 'Refund processed', `₹${(refund.amount / 100).toFixed(2)} has been refunded for order ${refund.order.orderNumber}.`, refund.order.orderNumber);
      } catch (err) {
        this.logger.error(`Refund ${refund.id} failed: ${(err as Error).message}`);
        await this.prisma.refund.update({ where: { id: refund.id }, data: { status: RefundStatus.FAILED } });
      }
    }
  }

  async syncRefundedPaymentStatus(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { refunds: true } });
    const refunded = order.refunds.filter((r) => r.status === RefundStatus.PROCESSED).reduce((s, r) => s + r.amount, 0);
    if (refunded <= 0) return;
    await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: refunded >= order.total ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED },
    });
  }

  /** Cancels online orders that were never paid so their stock goes back on sale. */
  async expireStalePayments() {
    const cutoff = new Date(Date.now() - config.pendingPaymentTimeoutMinutes * 60 * 1000);
    const stale = await this.prisma.order.findMany({
      where: { status: OrderStatus.PENDING_PAYMENT, createdAt: { lt: cutoff } },
      select: { id: true, orderNumber: true },
      take: 100,
    });
    for (const order of stale) {
      try {
        await this.cancel(order.id, 'system', 'Payment not completed in time');
      } catch (err) {
        this.logger.warn(`Could not expire ${order.orderNumber}: ${(err as Error).message}`);
      }
    }
    return stale.length;
  }

  // ───────────── Queries ─────────────

  async customerOrders(userId: string, page?: number, limit?: number) {
    const p = paginate(page, limit, 50);
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { items: { select: { productName: true, imageUrl: true, quantity: true, variantLabel: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginated(items, total, p.page, p.limit);
  }

  async customerOrder(userId: string, orderNumber: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: orderDetailInclude });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    return this.withCustomerFlags(order);
  }

  async customerCancel(userId: string, orderNumber: string, reason?: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber } });
    if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw new ForbiddenException('This order can no longer be cancelled. Please request a return after delivery.');
    }
    await this.cancel(order.id, 'customer', reason || 'Cancelled by customer');
    return this.customerOrder(userId, orderNumber);
  }

  /** Public order tracking by order number + email or phone used on the order. */
  async track(orderNumber: string, contact: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: orderNumber.trim().toUpperCase() },
      include: {
        user: { select: { email: true, phone: true } },
        history: { orderBy: { createdAt: 'asc' } },
        shipments: { include: { events: { orderBy: { occurredAt: 'desc' } } } },
        items: { select: { productName: true, variantLabel: true, quantity: true, imageUrl: true } },
      },
    });
    const c = contact.trim().toLowerCase();
    const address = order?.shippingAddress as { phone?: string } | undefined;
    const matches =
      order &&
      (order.user.email.toLowerCase() === c || order.user.phone === c || address?.phone === c);
    if (!order || !matches) throw new NotFoundException('No order found with these details');
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt,
      total: order.total,
      items: order.items,
      history: order.history.map((h) => ({ status: h.status, note: h.note, createdAt: h.createdAt })),
      shipments: order.shipments.map((s) => ({
        carrier: s.carrier,
        awb: s.awb,
        trackingUrl: s.trackingUrl,
        status: s.status,
        events: s.events,
      })),
    };
  }

  async adminList(query: AdminOrderQueryDto) {
    const p = paginate(query.page, query.limit);
    const q = query.q?.trim();
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999+05:30`) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q, mode: 'insensitive' } },
              { user: { email: { contains: q, mode: 'insensitive' } } },
              { user: { name: { contains: q, mode: 'insensitive' } } },
              { user: { phone: { contains: q } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { items: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginated(items, total, p.page, p.limit);
  }

  async adminGet(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { ...orderDetailInclude, user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findForInvoice(where: Prisma.OrderWhereUniqueInput) {
    const order = await this.prisma.order.findUnique({ where, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private withCustomerFlags<T extends { status: OrderStatus; deliveredAt: Date | null }>(order: T) {
    return {
      ...order,
      canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
      canReturn: order.status === OrderStatus.DELIVERED,
    };
  }

  private async notify(userId: string, type: NotificationType, title: string, body: string, orderNumber: string) {
    await this.notifications.notify(userId, type, title, body, { orderNumber });
  }
}
