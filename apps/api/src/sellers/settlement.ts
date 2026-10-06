import { OrderStatus, ReturnStatus } from '@prisma/client';

/** Returns that are finished (no more money can move because of them). */
export const CLOSED_RETURN_STATUSES: ReturnStatus[] = [ReturnStatus.REJECTED, ReturnStatus.QC_FAILED, ReturnStatus.REFUNDED];

export interface SettlementOrder {
  status: OrderStatus;
  commissionPct: number;
  items: { unitPrice: number; quantity: number; returnedQuantity: number }[];
}

/**
 * What a seller earns from one order: the value of items sold (minus returned units) less the
 * marketplace commission. Coupon discounts are funded by the marketplace, and the shipping / COD
 * fees paid by the customer go to the marketplace, which arranges delivery and collects cash.
 */
export function orderSettlement(order: SettlementOrder) {
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.PENDING_PAYMENT) {
    return { itemValue: 0, commission: 0, payable: 0 };
  }
  const itemValue = order.items.reduce((s, i) => s + i.unitPrice * Math.max(0, i.quantity - i.returnedQuantity), 0);
  const commission = Math.round((itemValue * order.commissionPct) / 100);
  return { itemValue, commission, payable: itemValue - commission };
}

/**
 * Earnings can be paid once the order was delivered, the hold period (return window) has passed and
 * no return is still open.
 */
export function isPayoutEligible(
  order: { status: OrderStatus; deliveredAt: Date | null; payoutId: string | null; returns: { status: ReturnStatus }[] },
  holdDays: number,
  now = new Date(),
): boolean {
  if (order.payoutId || order.status !== OrderStatus.DELIVERED || !order.deliveredAt) return false;
  if (order.deliveredAt.getTime() + holdDays * 86_400_000 > now.getTime()) return false;
  return order.returns.every((r) => CLOSED_RETURN_STATUSES.includes(r.status));
}
