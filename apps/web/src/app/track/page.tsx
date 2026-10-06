'use client';

import { useState } from 'react';
import { OrderTimeline } from '@/components/OrderTimeline';
import { StatusBadge } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDate, humanize, inr, ORDER_STATUS_LABEL } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';

interface Tracking {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  items: { productName: string; variantLabel: string; quantity: number }[];
  history: { status: OrderStatus; note: string | null; createdAt: string }[];
  shipments: { carrier: string; awb: string | null; trackingUrl: string | null; events: { status: string; location: string | null; occurredAt: string }[] }[];
}

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [result, setResult] = useState<Tracking | null>(null);
  const [error, setError] = useState('');

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="text-2xl font-bold">Track your order</h1>
      <p className="mt-1 text-sm text-ink-500">Enter your order ID and the email or mobile number used while ordering.</p>
      <form
        className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setResult(null);
          try {
            setResult(await api<Tracking>('/orders/track', { method: 'POST', body: { orderNumber, contact }, auth: false }));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not find the order');
          }
        }}
      >
        <input required className="input" placeholder="ORD-20261006-000123" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} aria-label="Order ID" />
        <input required className="input" placeholder="Email or mobile" value={contact} onChange={(e) => setContact(e.target.value)} aria-label="Email or mobile" />
        <button className="btn-primary">Track</button>
      </form>
      {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="card mt-8 space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{result.orderNumber}</p>
              <p className="text-xs text-ink-500">
                Placed {formatDate(result.createdAt)} · {inr(result.total)}
              </p>
            </div>
            <StatusBadge status={result.status} label={ORDER_STATUS_LABEL[result.status]} />
          </div>
          <OrderTimeline status={result.status} history={result.history} />
          {result.shipments.map((s, i) => (
            <div key={i} className="rounded-md bg-ink-50 p-3 text-sm">
              <p className="font-semibold">
                {s.carrier} · AWB {s.awb}
              </p>
              <ul className="mt-1 text-xs text-ink-500">
                {s.events.map((e, j) => (
                  <li key={j}>
                    {formatDate(e.occurredAt, true)} — {humanize(e.status)}
                    {e.location ? `, ${e.location}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <ul className="text-sm text-ink-700">
            {result.items.map((i, k) => (
              <li key={k}>
                {i.productName} ({i.variantLabel}) × {i.quantity}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
