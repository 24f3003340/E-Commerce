import { OrderStatus } from '@prisma/client';

/** Fulfilment pipeline in order. An order can only move forward along it. */
export const FULFILMENT_FLOW: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

/** Statuses from which an order can still be cancelled (nothing has left the warehouse). */
export const CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.PACKED,
];

/** Customers may cancel until the order is packed. */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
];

/**
 * Whether an admin / shipping webhook may move an order from `from` to `to`.
 * PENDING_PAYMENT → CONFIRMED is intentionally not allowed here: it only happens after the
 * payment gateway confirms the payment.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (to === OrderStatus.CANCELLED) return CANCELLABLE.includes(from);
  const i = FULFILMENT_FLOW.indexOf(from);
  const j = FULFILMENT_FLOW.indexOf(to);
  return i !== -1 && j !== -1 && j > i;
}

export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return [...FULFILMENT_FLOW, OrderStatus.CANCELLED].filter((to) => canTransition(from, to));
}

export const STATUS_NOTIFICATIONS: Partial<
  Record<OrderStatus, { type: string; title: string; body: (orderNumber: string) => string }>
> = {
  CONFIRMED: {
    type: 'ORDER_CONFIRMED',
    title: 'Order confirmed',
    body: (n) => `Your order ${n} has been confirmed.`,
  },
  PACKED: { type: 'ORDER_PACKED', title: 'Order packed', body: (n) => `Your order ${n} has been packed.` },
  SHIPPED: { type: 'ORDER_SHIPPED', title: 'Order shipped', body: (n) => `Your order ${n} is on its way.` },
  OUT_FOR_DELIVERY: {
    type: 'ORDER_OUT_FOR_DELIVERY',
    title: 'Out for delivery',
    body: (n) => `Your order ${n} is out for delivery today.`,
  },
  DELIVERED: { type: 'ORDER_DELIVERED', title: 'Delivered', body: (n) => `Your order ${n} has been delivered.` },
  CANCELLED: { type: 'ORDER_CANCELLED', title: 'Order cancelled', body: (n) => `Your order ${n} has been cancelled.` },
};
