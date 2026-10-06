'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Badge, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError, openHtml } from '@/lib/api';
import { formatDate, humanize, inr, ORDER_STATUS_LABEL } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  couponCode: string | null;
  deliveryMethod: string;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  shippingAddress: Record<string, string>;
  user: { id: string; name: string; email: string; phone: string | null };
  items: { id: string; productName: string; variantLabel: string; sku: string; imageUrl: string | null; unitPrice: number; quantity: number; total: number; returnedQuantity: number }[];
  history: { id: string; status: string; note: string | null; actor: string; createdAt: string }[];
  payments: { id: string; provider: string; status: string; amount: number; method: string | null; providerPaymentId: string | null; createdAt: string }[];
  shipments: { id: string; carrier: string; awb: string | null; trackingUrl: string | null; status: string; events: { id: string; status: string; location: string | null; occurredAt: string }[] }[];
  refunds: { id: string; amount: number; status: string; mode: string; createdAt: string }[];
  returns: { id: string; returnNumber: string; status: string }[];
  allowedNextStatuses: OrderStatus[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useAdmin();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [shipOpen, setShipOpen] = useState(false);
  const [ship, setShip] = useState({ carrier: 'Delhivery', awb: '', trackingUrl: '' });

  const load = useCallback(() => api<OrderDetail>(`/admin/orders/${id}`).then(setOrder), [id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!order) return <Spinner />;
  const a = order.shippingAddress;

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed', true);
    }
  };

  const updateStatus = () => {
    if (!status) return;
    if (status === 'CANCELLED' && !confirm('Cancel this order? Stock will be released and any online payment refunded.')) return;
    void run(() => api(`/admin/orders/${id}/status`, { method: 'PATCH', body: { status, note: note || undefined } }), 'Status updated').then(() => {
      setStatus('');
      setNote('');
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        subtitle={`Placed ${formatDate(order.createdAt, true)} · ${order.deliveryMethod.toLowerCase()} delivery`}
        actions={
          <>
            <Badge value={order.status} />
            <button className="btn-outline btn-sm" onClick={() => void openHtml(`/admin/orders/${id}/invoice`)}>
              Invoice
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Items</h2>
            <table className="table">
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Price</th><th>Qty</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.imageUrl ?? ''} alt="" className="h-12 w-10 rounded bg-gray-100 object-cover" />
                        <span>{i.productName}<span className="block text-xs text-gray-500">{i.variantLabel}{i.returnedQuantity ? ` · ${i.returnedQuantity} returned` : ''}</span></span>
                      </div>
                    </td>
                    <td className="font-mono text-xs">{i.sku}</td>
                    <td>{inr(i.unitPrice)}</td>
                    <td>{i.quantity}</td>
                    <td className="text-right">{inr(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{inr(order.subtotal)}</span></div>
              {order.discount > 0 && <div className="flex justify-between"><span>Discount ({order.couponCode})</span><span>−{inr(order.discount)}</span></div>}
              <div className="flex justify-between"><span>Shipping</span><span>{inr(order.shippingFee)}</span></div>
              {order.codFee > 0 && <div className="flex justify-between"><span>COD fee</span><span>{inr(order.codFee)}</span></div>}
              <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{inr(order.total)}</span></div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">Status history</h2>
            <ol className="space-y-3 text-sm">
              {order.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                  <span>
                    <span className="font-semibold">{ORDER_STATUS_LABEL[h.status as OrderStatus] ?? h.status}</span>
                    {h.note && <span className="text-gray-600"> — {h.note}</span>}
                    <span className="block text-xs text-gray-500">{formatDate(h.createdAt, true)} · by {h.actor.startsWith('admin:') ? 'admin' : h.actor}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {order.shipments.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 font-bold">Shipments</h2>
              {order.shipments.map((s) => (
                <div key={s.id} className="mb-3 text-sm">
                  <p className="font-semibold">{s.carrier} · AWB {s.awb} <Badge value={s.status} /></p>
                  <ul className="mt-1 text-xs text-gray-600">
                    {s.events.map((e) => (
                      <li key={e.id}>{formatDate(e.occurredAt, true)} — {humanize(e.status)}{e.location ? `, ${e.location}` : ''}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Update order</h2>
            {order.allowedNextStatuses.length ? (
              <>
                <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} aria-label="New status">
                  <option value="">Choose next status…</option>
                  {order.allowedNextStatuses.filter((s) => s !== 'SHIPPED').map((s) => (
                    <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn-primary w-full" disabled={!status} onClick={updateStatus}>Update status</button>
                {order.allowedNextStatuses.includes('SHIPPED') && (
                  <button className="btn-dark w-full" onClick={() => setShipOpen(true)}>Create shipment & mark shipped</button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                {order.status === 'PENDING_PAYMENT' ? 'Waiting for the customer to pay.' : 'No further status changes possible.'}
              </p>
            )}
            {order.cancelReason && <p className="text-sm text-gray-600">Cancel reason: {order.cancelReason}</p>}
          </section>

          <section className="card space-y-1 p-5 text-sm">
            <h2 className="mb-2 font-bold">Customer</h2>
            <Link href={`/customers/${order.user.id}`} className="font-semibold text-brand-700">{order.user.name}</Link>
            <p>{order.user.email}</p>
            {order.user.phone && <p>{order.user.phone}</p>}
            <h3 className="pt-3 font-semibold">Ship to</h3>
            <p className="text-gray-700">
              {a.name} · {a.phone}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} – {a.pincode}
            </p>
            {order.notes && <p className="pt-2 text-gray-600">Note: {order.notes}</p>}
          </section>

          <section className="card space-y-2 p-5 text-sm">
            <h2 className="mb-1 font-bold">Payment</h2>
            <p>{order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Online'} · <Badge value={order.paymentStatus} /></p>
            {order.payments.map((p) => (
              <p key={p.id} className="text-xs text-gray-600">
                {p.provider} {p.method ? `(${p.method})` : ''} · {inr(p.amount)} · {p.status.toLowerCase()} {p.providerPaymentId && <span className="font-mono">{p.providerPaymentId}</span>}
              </p>
            ))}
            {order.refunds.length > 0 && (
              <>
                <h3 className="pt-2 font-semibold">Refunds</h3>
                {order.refunds.map((r) => (
                  <p key={r.id} className="text-xs">{inr(r.amount)} · {r.mode.toLowerCase()} · <Badge value={r.status} /></p>
                ))}
                {order.refunds.some((r) => r.status === 'FAILED' || r.status === 'PENDING') && (
                  <button className="btn-outline btn-sm" onClick={() => void run(() => api(`/admin/orders/${id}/refunds/retry`, { method: 'POST' }), 'Refund retried')}>
                    Retry pending refunds
                  </button>
                )}
              </>
            )}
            {order.returns.map((r) => (
              <p key={r.id}><Link href={`/returns/${r.id}`} className="text-brand-700">{r.returnNumber}</Link> <Badge value={r.status} /></p>
            ))}
          </section>
        </div>
      </div>

      {shipOpen && (
        <Modal title="Create shipment" onClose={() => setShipOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api(`/admin/orders/${id}/shipments`, { method: 'POST', body: { ...ship, trackingUrl: ship.trackingUrl || undefined } }), 'Shipment created').then(() => setShipOpen(false));
            }}
          >
            <Field label="Courier">
              <input className="input" required value={ship.carrier} onChange={(e) => setShip((s) => ({ ...s, carrier: e.target.value }))} />
            </Field>
            <Field label="AWB / tracking number">
              <input className="input" required value={ship.awb} onChange={(e) => setShip((s) => ({ ...s, awb: e.target.value }))} />
            </Field>
            <Field label="Tracking URL (optional)">
              <input className="input" type="url" value={ship.trackingUrl} onChange={(e) => setShip((s) => ({ ...s, trackingUrl: e.target.value }))} />
            </Field>
            <button className="btn-primary w-full">Mark as shipped</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
