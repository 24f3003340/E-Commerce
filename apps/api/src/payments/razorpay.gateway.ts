import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { config } from '../common/config';

export interface GatewayOrder {
  provider: 'RAZORPAY' | 'MOCK';
  providerOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hmacSha256(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Thin Razorpay REST client. When Razorpay keys are not configured (local development / CI) it
 * runs in MOCK mode so the full checkout flow can be exercised without a gateway account.
 */
@Injectable()
export class RazorpayGateway {
  private readonly logger = new Logger(RazorpayGateway.name);
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  get isMock(): boolean {
    return !config.razorpay.enabled;
  }

  async createOrder(amount: number, receipt: string, notes: Record<string, string>): Promise<GatewayOrder> {
    if (this.isMock) {
      return {
        provider: 'MOCK',
        providerOrderId: `mock_order_${randomBytes(8).toString('hex')}`,
        amount,
        currency: 'INR',
      };
    }
    const res = await this.request('/orders', { amount, currency: 'INR', receipt, notes });
    return {
      provider: 'RAZORPAY',
      providerOrderId: res.id as string,
      amount: res.amount as number,
      currency: res.currency as string,
      keyId: config.razorpay.keyId,
    };
  }

  /** Signature returned to the browser by Razorpay Checkout after a successful payment. */
  verifyPaymentSignature(providerOrderId: string, providerPaymentId: string, signature: string): boolean {
    if (this.isMock) return false;
    const expected = hmacSha256(config.razorpay.keySecret, `${providerOrderId}|${providerPaymentId}`);
    return safeEqualHex(expected, signature);
  }

  /** Signature header (X-Razorpay-Signature) sent with every webhook, computed over the raw body. */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!config.razorpay.webhookSecret || !signature) return false;
    return safeEqualHex(hmacSha256(config.razorpay.webhookSecret, rawBody), signature);
  }

  async fetchPayment(providerPaymentId: string): Promise<{ status: string; amount: number; order_id: string; method?: string }> {
    return (await this.request(`/payments/${providerPaymentId}`, undefined, 'GET')) as any;
  }

  async refund(providerPaymentId: string, amount: number): Promise<{ id: string }> {
    if (this.isMock || providerPaymentId.startsWith('mock_')) {
      return { id: `mock_refund_${randomBytes(6).toString('hex')}` };
    }
    const res = await this.request(`/payments/${providerPaymentId}/refund`, { amount });
    return { id: res.id as string };
  }

  private async request(path: string, body?: unknown, method = 'POST'): Promise<Record<string, unknown>> {
    const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.error(`Razorpay ${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`);
      throw new BadGatewayException('Payment gateway error. Please try again.');
    }
    return json;
  }
}
