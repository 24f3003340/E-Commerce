import { OrderStatus, ReturnStatus } from '@prisma/client';
import { isPayoutEligible, orderSettlement } from './settlement';

describe('orderSettlement', () => {
  const items = [
    { unitPrice: 49900, quantity: 2, returnedQuantity: 0 },
    { unitPrice: 100000, quantity: 1, returnedQuantity: 1 },
  ];

  it('pays item value minus commission, excluding returned units', () => {
    expect(orderSettlement({ status: OrderStatus.DELIVERED, commissionPct: 10, items })).toEqual({
      itemValue: 99800,
      commission: 9980,
      payable: 89820,
    });
  });

  it('pays nothing for cancelled or unpaid orders', () => {
    expect(orderSettlement({ status: OrderStatus.CANCELLED, commissionPct: 10, items }).payable).toBe(0);
    expect(orderSettlement({ status: OrderStatus.PENDING_PAYMENT, commissionPct: 10, items }).payable).toBe(0);
  });
});

describe('isPayoutEligible', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  const base = { status: OrderStatus.DELIVERED, deliveredAt: new Date('2026-10-05T00:00:00Z'), payoutId: null, returns: [] };

  it('needs delivery plus the hold period', () => {
    expect(isPayoutEligible(base, 10, now)).toBe(true);
    expect(isPayoutEligible(base, 20, now)).toBe(false);
    expect(isPayoutEligible({ ...base, status: OrderStatus.SHIPPED }, 10, now)).toBe(false);
  });

  it('skips paid-out orders and orders with an open return', () => {
    expect(isPayoutEligible({ ...base, payoutId: 'p1' }, 10, now)).toBe(false);
    expect(isPayoutEligible({ ...base, returns: [{ status: ReturnStatus.PICKED_UP }] }, 10, now)).toBe(false);
    expect(isPayoutEligible({ ...base, returns: [{ status: ReturnStatus.REFUNDED }] }, 10, now)).toBe(true);
  });
});
