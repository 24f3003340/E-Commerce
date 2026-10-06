'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { api } from './api';
import { inr } from './format';
import type { GatewayPayment } from './types';

type PaymentResult = 'paid' | 'pending' | 'dismissed' | 'failed';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: (r: unknown) => void): void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load payment gateway'));
    document.body.appendChild(s);
  });
}

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';

/**
 * Opens Razorpay Checkout (or a mock dialog in development) for a gateway order created by the
 * API. The order is only confirmed after the API verifies the payment signature / webhook.
 */
export function usePayment(): { pay: (p: GatewayPayment) => Promise<PaymentResult>; dialog: ReactNode } {
  const [mock, setMock] = useState<{ payment: GatewayPayment; resolve: (r: PaymentResult) => void } | null>(null);

  const pay = useCallback(async (payment: GatewayPayment): Promise<PaymentResult> => {
    if (payment.provider === 'MOCK') {
      return new Promise((resolve) => setMock({ payment, resolve }));
    }
    await loadRazorpay();
    return new Promise((resolve) => {
      const rzp = new window.Razorpay!({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        order_id: payment.providerOrderId,
        name: STORE_NAME,
        description: `Order ${payment.orderNumber}`,
        prefill: payment.prefill,
        theme: { color: '#4f46e5' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const res = await api<{ ok: boolean; pending?: boolean }>('/payments/razorpay/verify', { method: 'POST', body: response });
            resolve(res.pending ? 'pending' : 'paid');
          } catch {
            // The webhook may still confirm it; the order page shows the live status.
            resolve('pending');
          }
        },
        modal: { ondismiss: () => resolve('dismissed') },
      });
      rzp.open();
    });
  }, []);

  const finishMock = async (success: boolean) => {
    if (!mock) return;
    const { payment, resolve } = mock;
    setMock(null);
    try {
      await api('/payments/mock/complete', { method: 'POST', body: { providerOrderId: payment.providerOrderId, success } });
      resolve(success ? 'paid' : 'failed');
    } catch {
      resolve('failed');
    }
  };

  const dialog = mock ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Test mode — mock gateway</p>
        <h2 className="mt-2 text-lg font-bold">Pay {inr(mock.payment.amount)}</h2>
        <p className="mt-1 text-sm text-ink-500">Order {mock.payment.orderNumber}</p>
        <p className="mt-3 text-xs text-ink-500">Add Razorpay keys to the API .env to use the real Razorpay checkout (UPI, cards, net banking, wallets).</p>
        <div className="mt-5 flex gap-3">
          <button className="btn-outline flex-1" onClick={() => void finishMock(false)}>
            Fail payment
          </button>
          <button className="btn-primary flex-1" onClick={() => void finishMock(true)}>
            Pay successfully
          </button>
        </div>
        <button
          className="mt-3 text-xs text-ink-500 underline"
          onClick={() => {
            mock.resolve('dismissed');
            setMock(null);
          }}
        >
          Close
        </button>
      </div>
    </div>
  ) : null;

  return { pay, dialog };
}
