import { OrderStatus } from '@prisma/client';
import { allowedNextStatuses, canTransition } from './order-state';

describe('order state machine', () => {
  it('moves forward along the fulfilment pipeline', () => {
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true);
    expect(canTransition(OrderStatus.PACKED, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it('never moves backwards or out of a final state', () => {
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.PACKED)).toBe(false);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
    expect(allowedNextStatuses(OrderStatus.CANCELLED)).toEqual([]);
  });

  it('only confirms unpaid orders through the payment flow', () => {
    expect(canTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.CONFIRMED)).toBe(false);
    expect(allowedNextStatuses(OrderStatus.PENDING_PAYMENT)).toEqual([OrderStatus.CANCELLED]);
  });

  it('allows cancellation until shipped', () => {
    expect(canTransition(OrderStatus.PACKED, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(false);
  });
});
