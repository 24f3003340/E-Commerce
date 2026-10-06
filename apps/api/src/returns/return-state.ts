import { ReturnStatus } from '@prisma/client';

export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: [ReturnStatus.APPROVED, ReturnStatus.REJECTED],
  APPROVED: [ReturnStatus.PICKUP_SCHEDULED, ReturnStatus.PICKED_UP, ReturnStatus.RECEIVED],
  REJECTED: [],
  PICKUP_SCHEDULED: [ReturnStatus.PICKED_UP],
  PICKED_UP: [ReturnStatus.RECEIVED],
  RECEIVED: [ReturnStatus.QC_PASSED, ReturnStatus.QC_FAILED],
  QC_PASSED: [ReturnStatus.REFUNDED],
  QC_FAILED: [],
  REFUNDED: [],
};

/** Refund for returned items, sharing any order-level coupon discount proportionally. */
export function returnRefundAmount(
  items: { unitPrice: number; quantity: number }[],
  order: { subtotal: number; discount: number },
): number {
  const gross = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  if (!order.subtotal) return gross;
  return Math.max(0, Math.round(gross - (gross * order.discount) / order.subtotal));
}
