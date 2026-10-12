import { CouponType } from '@prisma/client';
import { couponDiscount, eligibleSubtotal, PricedLine } from './coupon-math';

const lines: PricedLine[] = [
  { productId: 'tee', categoryIds: ['men-tees'], unitPrice: 50000, quantity: 2 },
  { productId: 'shoe', categoryIds: ['shoes'], unitPrice: 200000, quantity: 1 },
];

describe('coupon math', () => {
  it('applies percent discount with cap', () => {
    expect(couponDiscount({ type: CouponType.PERCENT, value: 10, maxDiscount: null, eligibleCategoryIds: [] }, lines)).toBe(30000);
    expect(couponDiscount({ type: CouponType.PERCENT, value: 10, maxDiscount: 25000, eligibleCategoryIds: [] }, lines)).toBe(25000);
  });

  it('restricts discount to eligible categories', () => {
    const coupon = { type: CouponType.PERCENT, value: 15, maxDiscount: null, eligibleCategoryIds: ['shoes'] };
    expect(eligibleSubtotal(coupon, lines)).toBe(200000);
    expect(couponDiscount(coupon, lines)).toBe(30000);
  });

  it('never discounts more than the eligible subtotal', () => {
    expect(couponDiscount({ type: CouponType.FLAT, value: 999999, maxDiscount: null, eligibleCategoryIds: ['men-tees'] }, lines)).toBe(100000);
    expect(couponDiscount({ type: CouponType.FLAT, value: 5000, maxDiscount: null, eligibleCategoryIds: ['none'] }, lines)).toBe(0);
  });

});
