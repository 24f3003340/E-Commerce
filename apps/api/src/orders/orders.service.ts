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
import { randomUUID } from 'crypto';
import { CartService, cartItemIssue, toPricedLines, variantImage, variantLabel } from '../cart/cart.service';
import { ProductsService } from '../catalog/products.service';
import { CacheService } from '../common/cache.service';
import { config } from '../common/config';
import { EmailService, escapeHtml } from '../common/email.service';
import { SettingsService } from '../common/settings.service';
import { nextSequenceNumber, paginate, paginated } from '../common/utils';
import { shippingFee, subtotalOf } from '../coupons/coupon-math';
import { CouponsService } from '../coupons/coupons.service';
import { NotificationsService, NotificationType } from '../notifications/notifications.service';
import { GatewayOrder, RazorpayGateway } from '../payments/razorpay.gateway';
import { ShiprocketClient } from '../shipping/shiprocket.client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOrderQueryDto, CheckoutDto } from './orders.dto';
import { canTransition, CUSTOMER_CANCELLABLE, STATUS_NOTIFICATIONS } from './order-state';
import { allocate, groupBySeller } from './split';

export const orderDetailInclude = {
  items: true,
  seller: { select: { id: true, storeName: true, slug: true } },
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
    private readonly email: EmailService,
    private readonly courier: ShiprocketClient,
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

  /**
   * Places the cart as orders. Marketplace carts become one order per seller (sharing a checkoutId)
   * so each seller sees and fulfils only their own items; the coupon discount, shipping and COD fee
   * are shared between those orders in proportion to their value.
   */
  async checkout(userId: string, dto: CheckoutDto) {
    if (dto.paymentMethod === PaymentMethod.ONLINE && !config.onlinePaymentsEnabled) {
      throw new BadRequestException('Online payment is coming soon. Please choose Cash on Delivery.');
    }
    const settings = await this.settings.get();
    const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');
    const serviceability = await this.products.serviceability(address.pincode);
    if (!serviceability.serviceable) throw new BadRequestException('Sorry, we do not deliver to this pincode yet');

    const orders = await this.prisma.$transaction(
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

        const groups = groupBySeller(items, (i) => i.variant.product.sellerId);
        const sellerIds = groups.map((g) => g.sellerId).filter((id): id is string => !!id);
        const sellers = await tx.seller.findMany({ where: { id: { in: sellerIds } }, select: { id: true, commissionPct: true } });
        const groupSubtotals = groups.map((g) => subtotalOf(toPricedLines(g.items)));
        const discounts = allocate(discount, groupSubtotals);
        const shippings = allocate(shipping, groupSubtotals);
        const codFees = allocate(codFee, groupSubtotals);
        const checkoutId = groups.length > 1 ? randomUUID() : null;
        const shippingAddress = {
          name: address.name,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          landmark: address.landmark,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          country: address.country,
        };

        const created = [];
        for (const [idx, group] of groups.entries()) {
          const seller = sellers.find((s) => s.id === group.sellerId);
          const orderNumber = await nextSequenceNumber(tx, 'ORD');
          const orderTotal = groupSubtotals[idx] - discounts[idx] + shippings[idx] + codFees[idx];
          const order = await tx.order.create({
            data: {
              orderNumber,
              userId,
              sellerId: group.sellerId,
              checkoutId,
              commissionPct: seller ? (seller.commissionPct ?? settings.defaultCommissionPct) : 0,
              status: OrderStatus.PENDING_PAYMENT,
              paymentMethod: dto.paymentMethod,
              subtotal: groupSubtotals[idx],
              discount: discounts[idx],
              shippingFee: shippings[idx],
              codFee: codFees[idx],
              total: orderTotal,
              couponId,
              couponCode,
              deliveryMethod,
              notes: dto.notes,
              shippingAddress,
              items: {
                create: group.items.map((i) => ({
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
            data: group.items.map((i) => ({
              variantId: i.variantId,
              change: -i.quantity,
              reason: InventoryReason.ORDER_RESERVED,
              reference: orderNumber,
            })),
          });
          // One coupon use per checkout, recorded on its first order
          if (couponId && idx === 0) {
            await tx.couponUsage.create({ data: { couponId, userId, orderId: order.id, discount } });
          }
          if (isCod) {
            await tx.payment.create({
              data: { orderId: order.id, provider: PaymentProvider.COD, amount: orderTotal, status: PaymentRecordStatus.CREATED },
            });
            await this.confirmInTx(tx, order.id, 'system', 'Cash on delivery order confirmed');
          }
          created.push(order);
        }
        await this.cart.clear(userId, tx);
        return created;
      },
      { timeout: 20_000 },
    );
    await this.cache.delByPrefix('catalog:');

    const numbers = orders.map((o) => o.orderNumber);
    const summaries = await Promise.all(orders.map((o) => this.orderSummaryHtml(o.id)));
    await this.notifications.notify(
      userId,
      'ORDER_PLACED',
      'Order placed',
      orders.length === 1
        ? `Thanks for shopping with us! Your order ${numbers[0]} has been placed.`
        : `Thanks for shopping with us! Your items come from ${orders.length} sellers, so they were placed as ${orders.length} orders: ${numbers.join(', ')}.`,
      { orderNumber: numbers[0], orderNumbers: numbers },
      summaries.join('<hr style="border:none;border-top:1px solid #eee;margin:20px 0">'),
    );
    if (dto.paymentMethod === PaymentMethod.COD) for (const o of orders) void this.alertStore(o.id);

    const placed = await Promise.all(numbers.map((n) => this.customerOrder(userId, n)));
    const payment = dto.paymentMethod === PaymentMethod.ONLINE ? await this.createGatewayPayment(orders[0].id) : null;
    return { order: placed[0], orders: placed, payment };
  }

  /**
   * Creates one gateway order paying for every still-unpaid online order of the same checkout (the
   * per-seller orders of one cart). Also used for "retry payment".
   */
  async createGatewayPayment(orderId: string): Promise<GatewayOrder & { orderNumber: string; prefill: Record<string, string> }> {
    if (!config.onlinePaymentsEnabled) throw new BadRequestException('Online payment is coming soon');
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { user: true } });
    if (order.status !== OrderStatus.PENDING_PAYMENT || order.paymentMethod !== PaymentMethod.ONLINE) {
      throw new BadRequestException('This order is not awaiting payment');
    }
    const group = order.checkoutId
      ? await this.prisma.order.findMany({
          where: { checkoutId: order.checkoutId, status: OrderStatus.PENDING_PAYMENT, paymentMethod: PaymentMethod.ONLINE },
          orderBy: { createdAt: 'asc' },
        })
      : [order];
    const amount = group.reduce((s, o) => s + o.total, 0);
    const numbers = group.map((o) => o.orderNumber);
    const gatewayOrder = await this.gateway.createOrder(amount, numbers[0], { orderNumbers: numbers.join(',').slice(0, 250) });
    await this.prisma.payment.createMany({
      data: group.map((o) => ({
        orderId: o.id,
        provider: gatewayOrder.provider === 'MOCK' ? PaymentProvider.MOCK : PaymentProvider.RAZORPAY,
        providerOrderId: gatewayOrder.providerOrderId,
        amount: o.total,
        currency: gatewayOrder.currency,
      })),
    });
    return {
      ...gatewayOrder,
      orderNumber: order.orderNumber,
      prefill: { name: order.user.name, email: order.user.email, contact: order.user.phone ?? '' },
    };
  }

  // ───────────── Payment outcomes (called from verified gateway callbacks / webhooks) ─────────────

  /**
   * Idempotent: safe to call from both the browser callback and the webhook. One gateway payment
   * can cover several orders of the same checkout; each of them is confirmed.
   */
  async markPaid(confirmation: PaymentConfirmation, source: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payments = await tx.payment.findMany({
        where: { providerOrderId: confirmation.providerOrderId },
        include: { order: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!payments.length) throw new NotFoundException('Payment not found');
      const first = payments[0].order;
      if (payments.every((p) => p.status === PaymentRecordStatus.CAPTURED)) return { orders: [first], confirmed: [], lateRefunds: [] };
      const expected = payments.reduce((s, p) => s + p.amount, 0);
      if (confirmation.amount !== undefined && confirmation.amount !== expected) {
        this.logger.error(`Amount mismatch for ${confirmation.providerOrderId}: ${confirmation.amount} != ${expected}`);
        throw new BadRequestException('Payment amount mismatch');
      }
      const confirmed: typeof first[] = [];
      const lateRefunds: string[] = [];
      for (const payment of payments) {
        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: { not: PaymentRecordStatus.CAPTURED } },
          data: {
            status: PaymentRecordStatus.CAPTURED,
            providerPaymentId: confirmation.providerPaymentId,
            method: confirmation.method,
            rawPayload: (confirmation.raw ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
        if (claimed.count === 0) continue;
        if (payment.order.status !== OrderStatus.PENDING_PAYMENT) {
          // Paid after the order was cancelled/expired (or paid twice) — refund automatically.
          await tx.refund.create({
            data: { orderId: payment.orderId, paymentId: payment.id, amount: payment.amount, status: RefundStatus.PENDING },
          });
          lateRefunds.push(payment.orderId);
          continue;
        }
        await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: PaymentStatus.PAID } });
        await this.confirmInTx(tx, payment.orderId, source, `Payment received via ${confirmation.method ?? 'online payment'}`);
        confirmed.push(payment.order);
      }
      return { orders: [first], confirmed, lateRefunds };
    });

    if (result.confirmed.length) {
      const numbers = result.confirmed.map((o) => o.orderNumber).join(', ');
      await this.notify(result.confirmed[0].userId, 'PAYMENT_SUCCESS', 'Payment successful', `We received your payment for order ${numbers}.`, result.confirmed[0].orderNumber);
      for (const o of result.confirmed) void this.alertStore(o.id);
    }
    for (const orderId of result.lateRefunds) await this.processPendingRefunds(orderId);
    return result.orders[0];
  }

  async markPaymentFailed(providerOrderId: string, reason: string, raw?: unknown) {
    const payments = await this.prisma.payment.findMany({
      where: { providerOrderId, status: PaymentRecordStatus.CREATED },
      include: { order: true },
    });
    if (!payments.length) return;
    await this.prisma.payment.updateMany({
      where: { id: { in: payments.map((p) => p.id) }, status: PaymentRecordStatus.CREATED },
      data: { status: PaymentRecordStatus.FAILED, rawPayload: (raw ?? { reason }) as Prisma.InputJsonValue },
    });
    // The orders stay PENDING_PAYMENT so the customer can retry; they expire automatically.
    const order = payments[0].order;
    await this.notify(order.userId, 'PAYMENT_FAILED', 'Payment failed', `Payment for order ${payments.map((p) => p.order.orderNumber).join(', ')} failed. You can retry from your orders page.`, order.orderNumber);
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
      // The coupon is used once per checkout, so give it back only when every order of the
      // checkout (one per seller) has been cancelled.
      if (order.couponId) {
        const checkout = order.checkoutId ? { checkoutId: order.checkoutId } : { id: orderId };
        const live = await tx.order.count({ where: { ...checkout, status: { not: OrderStatus.CANCELLED } } });
        if (live === 0) {
          const removed = await tx.couponUsage.deleteMany({ where: { order: checkout } });
          if (removed.count) await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { decrement: 1 } } });
        }
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
    await this.cancelCourierBooking(orderId);
    await this.processPendingRefunds(orderId);
    await this.notify(order.userId, 'ORDER_CANCELLED', 'Order cancelled', `Your order ${order.orderNumber} has been cancelled.`, order.orderNumber);
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderDetailInclude });
  }

  /** A packed order may already be booked with the courier; call the pickup off there too. */
  private async cancelCourierBooking(orderId: string) {
    const booked = await this.prisma.shipment.findMany({
      where: { orderId, provider: 'SHIPROCKET', providerOrderId: { not: null }, status: { not: 'CANCELLED' } },
    });
    for (const s of booked) {
      try {
        await this.courier.cancelOrders([s.providerOrderId!]);
        await this.prisma.shipment.update({
          where: { id: s.id },
          data: { status: 'CANCELLED', events: { create: { status: 'CANCELLED', note: 'Courier booking cancelled' } } },
        });
      } catch (err) {
        this.logger.error(`Could not cancel courier booking ${s.awb} of order ${orderId}: ${(err as Error).message} — cancel it in Shiprocket`);
      }
    }
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
    // Customers are matched first (trigram indexes on users) so the order query can use plain
    // indexes instead of joining users for every order row.
    const customerIds = q
      ? (
          await this.prisma.user.findMany({
            where: {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            },
            select: { id: true },
            take: 500,
          })
        ).map((u) => u.id)
      : [];
    const where: Prisma.OrderWhereInput = {
      ...(query.sellerId ? { sellerId: query.sellerId === 'store' ? null : query.sellerId } : {}),
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
              ...(customerIds.length ? [{ userId: { in: customerIds } }] : []),
            ],
          }
        : {}),
    };
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: {
          user: { select: { id: true, name: true, email: true } },
          seller: { select: { id: true, storeName: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    // Item counts for this page only (an `_count` include groups the whole order_items table)
    const counts = await this.prisma.orderItem.groupBy({
      by: ['orderId'],
      where: { orderId: { in: orders.map((o) => o.id) } },
      _count: { _all: true },
    });
    const countBy = new Map(counts.map((c) => [c.orderId, c._count._all]));
    const items = orders.map((o) => ({ ...o, _count: { items: countBy.get(o.id) ?? 0 } }));
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

  // ───────────── Marketplace seller views ─────────────

  /** A seller's own orders (never other sellers' or the store's). */
  async sellerOrders(sellerId: string, query: AdminOrderQueryDto) {
    return this.adminList({ ...query, sellerId });
  }

  async sellerOrder(sellerId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, sellerId },
      include: { ...orderDetailInclude, user: { select: { name: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findForInvoice(where: Prisma.OrderWhereUniqueInput) {
    const order = await this.prisma.order.findUnique({
      where,
      include: {
        items: { include: { variant: { select: { product: { select: { hsnCode: true } } } } } },
        seller: { select: { storeName: true, gstin: true, addressLine1: true, addressLine2: true, city: true, state: true, pincode: true, email: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return { ...order, items: order.items.map((i) => ({ ...i, hsn: i.variant.product.hsnCode })) };
  }

  private withCustomerFlags<T extends { status: OrderStatus; deliveredAt: Date | null }>(order: T) {
    return {
      ...order,
      canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
      canReturn: order.status === OrderStatus.DELIVERED,
    };
  }

  /** Items + totals table used in the order confirmation email. */
  private async orderSummaryHtml(orderId: string) {
    const o = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const rupee = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
    const a = o.shippingAddress as Record<string, string>;
    const rows = o.items
      .map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(i.productName)}<br><span style="color:#777;font-size:12px">${escapeHtml(i.variantLabel)} × ${i.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${rupee(i.total)}</td></tr>`)
      .join('');
    const line = (label: string, value: string, bold = false) =>
      `<tr><td style="padding:4px 0;${bold ? 'font-weight:bold' : ''}">${label}</td><td style="padding:4px 0;text-align:right;${bold ? 'font-weight:bold' : ''}">${value}</td></tr>`;
    return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-top:12px">${rows}
${line('Subtotal', rupee(o.subtotal))}${o.discount ? line(`Discount${o.couponCode ? ` (${escapeHtml(o.couponCode)})` : ''}`, `-${rupee(o.discount)}`) : ''}
${line('Shipping', o.shippingFee ? rupee(o.shippingFee) : 'FREE')}${o.codFee ? line('COD fee', rupee(o.codFee)) : ''}${line('Total', rupee(o.total), true)}</table>
<p style="margin-top:16px;font-size:13px;color:#555"><b>Delivering to:</b> ${escapeHtml(a.name)}, ${escapeHtml(a.line1)}, ${escapeHtml(a.city)}, ${escapeHtml(a.state)} – ${escapeHtml(a.pincode)}<br><b>Payment:</b> ${o.paymentMethod === PaymentMethod.COD ? 'Cash on delivery' : 'Paid online'}</p>`;
  }

  /**
   * Emails the store team — and the marketplace seller, if the order is theirs — when an order is
   * confirmed (COD placed or online payment received).
   */
  private async alertStore(orderId: string) {
    try {
      const settings = await this.settings.get();
      const o = await this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { user: { select: { name: true } }, seller: { select: { email: true, storeName: true } } },
      });
      const summary = await this.orderSummaryHtml(orderId);
      const payment = o.paymentMethod === PaymentMethod.COD ? 'COD' : 'paid online';
      const subject = `🛍 New order ${o.orderNumber} — ₹${(o.total / 100).toFixed(2)}`;
      if (settings.orderAlertEmail) {
        const html = await this.email.layout(
          `New order ${o.orderNumber}`,
          `<p>${escapeHtml(o.user.name)} placed an order (${payment})${o.seller ? ` from seller <b>${escapeHtml(o.seller.storeName)}</b>` : ''}.</p>${summary}`,
        );
        await this.email.send(settings.orderAlertEmail, subject, html, `New order ${o.orderNumber}`);
      }
      if (o.seller) {
        const html = await this.email.layout(
          `New order ${o.orderNumber}`,
          `<p>Hi ${escapeHtml(o.seller.storeName)}, you have a new order (${payment}). Please pack it and add the shipment details from your seller panel.</p>${summary}`,
          { label: 'Open seller panel', url: `${config.sellerPanelUrl}/orders/${o.id}` },
        );
        await this.email.send(o.seller.email, subject, html, `New order ${o.orderNumber}: ${config.sellerPanelUrl}/orders/${o.id}`);
      }
    } catch (err) {
      this.logger.warn(`Store alert failed for ${orderId}: ${(err as Error).message}`);
    }
  }

  private async notify(userId: string, type: NotificationType, title: string, body: string, orderNumber: string) {
    await this.notifications.notify(userId, type, title, body, { orderNumber });
  }
}
