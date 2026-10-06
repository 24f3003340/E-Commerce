'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { OrderTimeline } from '@/components/OrderTimeline';
import { Spinner, StatusBadge } from '@/components/ui';
import { useStore } from '@/context/StoreProvider';
import { api, ApiError, openAuthedHtml } from '@/lib/api';
import { formatDate, humanize, inr, ORDER_STATUS_LABEL, RETURN_REASONS } from '@/lib/format';
import type { GatewayPayment, Order, OrderItem } from '@/lib/types';
import { usePayment } from '@/lib/usePayment';

interface Eligibility {
  eligible: boolean;
  reason?: string;
  items: { orderItemId: string; productName: string; variantLabel: string; returnableQuantity: number; returnBy: string; policyNote?: string }[];
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReturnModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const { toast } = useStore();
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('WRONG_SIZE');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Eligibility>(`/returns/eligibility/${order.orderNumber}`).then(setElig);
  }, [order.orderNumber]);

  const items = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

  return (
    <Modal title="Request a return" onClose={onClose}>
      {!elig ? (
        <Spinner />
      ) : !elig.eligible ? (
        <p className="text-sm text-gray-600">{elig.reason ?? 'The return window for this order has closed.'}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!items.length) return toast('Select at least one item', 'error');
            setBusy(true);
            try {
              await api('/returns', { method: 'POST', body: { orderNumber: order.orderNumber, items, reason, comment: comment || undefined } });
              toast('Return requested');
              onDone();
            } catch (err) {
              toast(err instanceof ApiError ? err.message : 'Could not request return', 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <ul className="space-y-3">
            {elig.items.map((i) => (
              <li key={i.orderItemId} className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
                <span>
                  <span className="font-medium">{i.productName}</span>
                  <span className="block text-xs text-gray-500">
                    {i.variantLabel} · {i.returnableQuantity > 0 ? `return by ${formatDate(i.returnBy)}` : (i.policyNote ?? 'Not returnable')}
                  </span>
                </span>
                <select
                  disabled={i.returnableQuantity === 0}
                  value={qty[i.orderItemId] ?? 0}
                  onChange={(e) => setQty((q) => ({ ...q, [i.orderItemId]: Number(e.target.value) }))}
                  className="rounded border px-2 py-1"
                  aria-label={`Quantity to return for ${i.productName}`}
                >
                  {Array.from({ length: i.returnableQuantity + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <div>
            <label className="label">Reason</label>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {Object.entries(RETURN_REASONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Comments (optional)</label>
            <textarea className="input" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            Submit return request
          </button>
        </form>
      )}
    </Modal>
  );
}

function ReviewModal({ item, onClose }: { item: OrderItem; onClose: () => void }) {
  const { toast } = useStore();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  return (
    <Modal title={`Review ${item.productName}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api(`/products/${item.productId}/reviews`, { method: 'POST', body: { rating, title: title || undefined, comment: comment || undefined } });
            toast('Thanks for your review!');
            onClose();
          } catch (err) {
            toast(err instanceof ApiError ? err.message : 'Could not save review', 'error');
          }
        }}
      >
        <div className="flex gap-1 text-3xl" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className={n <= rating ? 'text-amber-500' : 'text-gray-300'}>
              ★
            </button>
          ))}
        </div>
        <input className="input" placeholder="Title (optional)" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input" rows={4} placeholder="What did you like or dislike?" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
        <button className="btn-primary w-full">Submit review</button>
      </form>
    </Modal>
  );
}

function OrderDetail() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const params = useSearchParams();
  const { toast } = useStore();
  const { pay, dialog } = usePayment();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await api<Order>(`/orders/${orderNumber}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load order');
    }
  }, [orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!order) return <Spinner />;
  const a = order.shippingAddress;

  const cancel = async () => {
    const reason = prompt('Reason for cancellation (optional)') ?? undefined;
    try {
      setOrder(await api<Order>(`/orders/${order.orderNumber}/cancel`, { method: 'POST', body: { reason } }));
      toast('Order cancelled');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not cancel', 'error');
    }
  };

  const retryPayment = async () => {
    try {
      const payment = await api<GatewayPayment>(`/orders/${order.orderNumber}/pay`, { method: 'POST' });
      const result = await pay(payment);
      if (result === 'failed') toast('Payment failed', 'error');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not start payment', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {params.get('placed') && order.status !== 'PENDING_PAYMENT' && (
        <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">
          <p className="font-bold">🎉 Thank you! Your order has been placed.</p>
          <p className="text-sm">We&apos;ll send you updates as it moves along.</p>
        </div>
      )}
      {order.status === 'PENDING_PAYMENT' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-4 text-amber-900">
          <p className="text-sm">
            <span className="font-bold">Payment pending.</span> Complete the payment to confirm your order — unpaid orders are cancelled automatically after 30 minutes.
          </p>
          <button className="btn-primary" onClick={() => void retryPayment()}>
            Pay {inr(order.total)}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Order {order.orderNumber}</h1>
          <p className="text-sm text-gray-500">Placed on {formatDate(order.createdAt, true)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={order.status} label={ORDER_STATUS_LABEL[order.status]} />
          {order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED' && (
            <button className="btn-outline py-1.5" onClick={() => void openAuthedHtml(`/orders/${order.orderNumber}/invoice`)}>
              Invoice
            </button>
          )}
          {order.canCancel && (
            <button className="btn-outline py-1.5 text-red-600" onClick={() => void cancel()}>
              Cancel order
            </button>
          )}
          {order.canReturn && (
            <button className="btn-outline py-1.5" onClick={() => setShowReturn(true)}>
              Return items
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Tracking</h2>
          <OrderTimeline status={order.status} history={order.history} />
          {order.shipments.map((s) => (
            <div key={s.id} className="mt-4 rounded-md bg-gray-50 p-3 text-sm">
              <p>
                <span className="font-semibold">{s.carrier}</span> · AWB {s.awb}
              </p>
              {s.trackingUrl && (
                <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">
                  Track on courier website
                </a>
              )}
              <ul className="mt-2 space-y-1 text-xs text-gray-600">
                {s.events.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    {formatDate(e.occurredAt, true)} — {humanize(e.status)}
                    {e.location ? `, ${e.location}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="card space-y-4 p-5 text-sm">
          <div>
            <h2 className="mb-2 font-bold">Delivery address</h2>
            <p className="text-gray-700">
              {a.name} · {a.phone}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              <br />
              {a.city}, {a.state} – {a.pincode}
            </p>
          </div>
          <div>
            <h2 className="mb-2 font-bold">Payment</h2>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Method</span>
                <span>{order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Online'}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span>{humanize(order.paymentStatus)}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{inr(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount {order.couponCode && `(${order.couponCode})`}</span>
                  <span>−{inr(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{order.shippingFee ? inr(order.shippingFee) : 'FREE'}</span>
              </div>
              {order.codFee > 0 && (
                <div className="flex justify-between">
                  <span>COD fee</span>
                  <span>{inr(order.codFee)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>Total</span>
                <span>{inr(order.total)}</span>
              </div>
            </div>
            {order.refunds.map((r) => (
              <p key={r.id} className="mt-2 rounded bg-emerald-50 p-2 text-xs text-emerald-800">
                Refund of {inr(r.amount)} — {humanize(r.status)}
              </p>
            ))}
          </div>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-bold">Items</h2>
        <ul className="divide-y">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.imageUrl ?? ''} alt="" className="h-20 w-16 rounded bg-gray-100 object-cover" />
              <div className="flex-1 text-sm">
                <Link href={`/p/${i.productSlug}`} className="font-medium hover:underline">
                  {i.productName}
                </Link>
                <p className="text-gray-500">
                  {i.variantLabel} · Qty {i.quantity}
                </p>
                {i.returnedQuantity > 0 && <p className="text-xs text-amber-700">{i.returnedQuantity} returned / return requested</p>}
                {order.status === 'DELIVERED' && (
                  <button className="mt-1 text-xs font-semibold text-brand-700" onClick={() => setReviewItem(i)}>
                    Rate & review
                  </button>
                )}
              </div>
              <span className="text-sm font-semibold">{inr(i.total)}</span>
            </li>
          ))}
        </ul>
      </section>

      {order.returns.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Returns</h2>
          {order.returns.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
              <span>
                {r.returnNumber} · {RETURN_REASONS[r.reason]}
              </span>
              <StatusBadge status={r.status} />
            </div>
          ))}
        </section>
      )}

      {showReturn && (
        <ReturnModal
          order={order}
          onClose={() => setShowReturn(false)}
          onDone={() => {
            setShowReturn(false);
            void load();
          }}
        />
      )}
      {reviewItem && <ReviewModal item={reviewItem} onClose={() => setReviewItem(null)} />}
      {dialog}
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <OrderDetail />
    </Suspense>
  );
}
