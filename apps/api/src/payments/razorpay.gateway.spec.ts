import { hmacSha256 } from './razorpay.gateway';

describe('Razorpay signatures', () => {
  it('computes the checkout signature as HMAC-SHA256(order_id|payment_id)', () => {
    const sig = hmacSha256('secret', 'order_123|pay_456');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(sig).not.toBe(hmacSha256('secret', 'order_123|pay_457'));
  });
});
