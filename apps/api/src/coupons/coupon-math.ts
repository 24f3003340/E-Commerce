import { CouponType } from '@prisma/client';
import { StoreSettings } from '../common/settings.service';

export interface PricedLine {
  productId: string;
  categoryIds: string[];
  unitPrice: number;
  quantity: number;
}

export interface CouponLike {
  type: CouponType;
  value: number;
  maxDiscount: number | null;
  /** Category ids (already expanded to include descendants). Empty = whole cart. */
  eligibleCategoryIds: string[];
}

export const lineTotal = (l: PricedLine) => l.unitPrice * l.quantity;

export function subtotalOf(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function eligibleSubtotal(coupon: Pick<CouponLike, 'eligibleCategoryIds'>, lines: PricedLine[]): number {
  if (!coupon.eligibleCategoryIds.length) return subtotalOf(lines);
  const eligible = new Set(coupon.eligibleCategoryIds);
  return subtotalOf(lines.filter((l) => l.categoryIds.some((c) => eligible.has(c))));
}

/** Discount in paise. Never exceeds the eligible subtotal. */
export function couponDiscount(coupon: CouponLike, lines: PricedLine[]): number {
  const base = eligibleSubtotal(coupon, lines);
  if (base <= 0) return 0;
  let discount =
    coupon.type === CouponType.PERCENT ? Math.floor((base * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  return Math.max(0, Math.min(discount, base));
}

export type DeliveryMethod = 'STANDARD' | 'EXPRESS';

export function shippingFee(
  amountAfterDiscount: number,
  method: DeliveryMethod,
  settings: Pick<StoreSettings, 'freeShippingThreshold' | 'standardShippingFee' | 'expressShippingFee'>,
): number {
  if (amountAfterDiscount <= 0) return 0;
  if (method === 'EXPRESS') return settings.expressShippingFee;
  return amountAfterDiscount >= settings.freeShippingThreshold ? 0 : settings.standardShippingFee;
}
