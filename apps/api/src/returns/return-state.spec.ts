import { ReturnStatus } from '@prisma/client';
import { RETURN_TRANSITIONS, returnRefundAmount } from './return-state';

describe('returns', () => {
  it('shares the order discount proportionally', () => {
    // ₹1,000 + ₹500 order with ₹150 coupon discount; returning the ₹1,000 item refunds ₹900
    expect(returnRefundAmount([{ unitPrice: 100000, quantity: 1 }], { subtotal: 150000, discount: 15000 })).toBe(90000);
    expect(returnRefundAmount([{ unitPrice: 50000, quantity: 2 }], { subtotal: 100000, discount: 0 })).toBe(100000);
  });

  it('requires QC before refund', () => {
    expect(RETURN_TRANSITIONS[ReturnStatus.RECEIVED]).not.toContain(ReturnStatus.REFUNDED);
    expect(RETURN_TRANSITIONS[ReturnStatus.QC_PASSED]).toEqual([ReturnStatus.REFUNDED]);
    expect(RETURN_TRANSITIONS[ReturnStatus.REFUNDED]).toEqual([]);
  });
});
