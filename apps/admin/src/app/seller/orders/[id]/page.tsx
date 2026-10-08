'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CourierBookingModal } from '@/components/CourierBooking';
import { useSeller } from '@/components/SellerShell';
import { Badge, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { ApiError } from '@/lib/client';
import { formatDate, inr, ORDER_STATUS_LABEL } from '@/lib/format';
import { sellerApi, sellerClient } from '@/lib/sellerApi';
import type { OrderStatus } from '@/lib/types';

interface SellerOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  commissionPct: number;
  deliveryMethod: string;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
  shippingAddress: Record<string, string>;
  user: { name: string };
  items: { id: string; productName: string; variantLabel: string; sku: string; imageUrl: string | null; unitPrice: number; quantity: number; total: number; returnedQuantity: number }[];
  history: { id: string; status: string; note: string | null; actor: string; createdAt: string }[];
  shipments: { id: string; carrier: string; awb: string | null; trackingUrl: string | null; labelUrl: string | null; provider: string; status: string }[];
  courierEnabled: boolean;
  returns: { id: string; returnNumber: string; status: string }[];
  allowedNextStatuses: OrderStatus[];
}

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'Accept & start processing',
  PACKED: 'Mark as packed',
};

export default function SellerOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useSeller();
  const [order, setOrder] = useState<SellerOrder | null>(null);
  const [shipOpen, setShipOpen] = useState(false);
  const [ship, setShip] = useState({ carrier: 'Delhivery', awb: '', trackingUrl: '' });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [courierOpen, setCourierOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(() => sellerApi<SellerOrder>(`/seller/orders/${id}`).then(setOrder), [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!order) return <Spinner />;
  const a = order.shippingAddress;
  const activeShipment = order.shipments.find((s) => s.status !== 'CANCELLED');
  const canBookCourier = order.courierEnabled && !activeShipment && ['CONFIRMED', 'PROCESSING', 'PACKED'].includes(order.status);
  const commission = Math.round((order.subtotal * order.commissionPct) / 100);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast(msg);
      await load();
      return true;
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed', true);
      return false;
    }
  };
  const move = (status: OrderStatus, note?: string) => run(() => sellerApi(`/seller/orders/${id}/status`, { method: 'PATCH', body: { status, note } }), status === 'CANCELLED' ? 'Order cancelled' : 'Order updated');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        subtitle={`Placed ${formatDate(order.createdAt, true)} · ${order.deliveryMethod.toLowerCase()} delivery`}
        actions={
          <>
            <Badge value={order.status} />
            <button className="btn-outline btn-sm" onClick={() => void sellerClient.openHtml(`/seller/orders/${id}/invoice`)}>Invoice / packing slip</button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Items to pack</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
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
                      <td className="font-semibold">{i.quantity}</td>
                      <td className="text-right">{inr(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span>Item value</span><span>{inr(order.subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Commission ({order.commissionPct}%)</span><span>−{inr(commission)}</span></div>
              <div className="flex justify-between border-t pt-1 font-bold"><span>You earn</span><span>{inr(order.subtotal - commission)}</span></div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">Timeline</h2>
            <ol className="space-y-3 text-sm">
              {order.history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                  <span>
                    <span className="font-semibold">{ORDER_STATUS_LABEL[h.status as OrderStatus] ?? h.status}</span>
                    {h.note && <span className="text-gray-600"> — {h.note}</span>}
                    <span className="block text-xs text-gray-500">{formatDate(h.createdAt, true)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Next step</h2>
            {order.allowedNextStatuses.length ? (
              <>
                {order.allowedNextStatuses.filter((s) => s === 'PROCESSING' || s === 'PACKED').slice(0, 1).map((s) => (
                  <button key={s} className="btn-primary w-full" onClick={() => void move(s)}>{NEXT_LABEL[s]}</button>
                ))}
                {canBookCourier && (
                  <button className="btn-dark w-full" onClick={() => setCourierOpen(true)}>Book courier pickup</button>
                )}
                {order.allowedNextStatuses.includes('SHIPPED') && activeShipment?.provider !== 'SHIPROCKET' && (
                  <button className={canBookCourier ? 'btn-outline w-full' : 'btn-dark w-full'} onClick={() => setShipOpen(true)}>
                    {canBookCourier ? 'Shipped yourself? Enter AWB' : 'Add AWB & mark shipped'}
                  </button>
                )}
                {activeShipment?.provider === 'SHIPROCKET' && order.status === 'PACKED' && (
                  <p className="rounded-md bg-brand-50 p-2 text-xs text-brand-900">Pickup booked. Stick the label on the parcel and hand it to the courier — the order turns “Shipped” on its own when the courier scans it.</p>
                )}
                {order.allowedNextStatuses.includes('CANCELLED') && (
                  <button className="btn-outline w-full text-red-600" onClick={() => setCancelOpen(true)}>Cannot fulfil — cancel order</button>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                {order.status === 'SHIPPED' || order.status === 'OUT_FOR_DELIVERY'
                  ? 'In transit. The order is marked delivered by the courier update or the marketplace team.'
                  : order.status === 'DELIVERED'
                    ? 'Delivered. Your earning is released after the return window.'
                    : 'No action needed.'}
              </p>
            )}
            {order.cancelReason && <p className="text-sm text-gray-600">Cancel reason: {order.cancelReason}</p>}
            {order.shipments.map((s) => (
              <p key={s.id} className="text-sm">
                {s.carrier} · AWB <span className="font-mono">{s.awb}</span> <Badge value={s.status} />
                {s.labelUrl && <a href={s.labelUrl} target="_blank" rel="noreferrer" className="ml-1 font-semibold text-brand-700">Label ↗</a>}
                {s.trackingUrl && <a href={s.trackingUrl} target="_blank" rel="noreferrer" className="ml-1 text-brand-700">Track ↗</a>}
              </p>
            ))}
          </section>

          <section className="card space-y-1 p-5 text-sm">
            <h2 className="mb-2 font-bold">Deliver to</h2>
            <p className="text-gray-700">
              {a.name} · {a.phone}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}{a.landmark ? `, ${a.landmark}` : ''}<br />{a.city}, {a.state} – {a.pincode}
            </p>
            {order.notes && <p className="pt-2 text-gray-600">Customer note: {order.notes}</p>}
            <h2 className="pt-3 font-bold">Payment</h2>
            <p>{order.paymentMethod === 'COD' ? 'Cash on delivery — the courier collects cash from the customer' : 'Prepaid online'} · <Badge value={order.paymentStatus} /></p>
            {order.returns.map((r) => (
              <p key={r.id} className="pt-1">Return {r.returnNumber} <Badge value={r.status} /></p>
            ))}
          </section>
        </div>
      </div>

      {courierOpen && (
        <CourierBookingModal
          onClose={() => setCourierOpen(false)}
          onBook={(size) => run(() => sellerApi(`/seller/orders/${id}/courier`, { method: 'POST', body: size }), 'Pickup booked — AWB assigned')}
        />
      )}
      {shipOpen && (
        <Modal title="Ship order" onClose={() => setShipOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => sellerApi(`/seller/orders/${id}/shipments`, { method: 'POST', body: { ...ship, trackingUrl: ship.trackingUrl || undefined } }), 'Marked as shipped').then((done) => done && setShipOpen(false));
            }}
          >
            <Field label="Courier"><input className="input" required value={ship.carrier} onChange={(e) => setShip((s) => ({ ...s, carrier: e.target.value }))} /></Field>
            <Field label="AWB / tracking number"><input className="input" required value={ship.awb} onChange={(e) => setShip((s) => ({ ...s, awb: e.target.value }))} /></Field>
            <Field label="Tracking URL (optional)"><input className="input" type="url" value={ship.trackingUrl} onChange={(e) => setShip((s) => ({ ...s, trackingUrl: e.target.value }))} /></Field>
            <p className="text-xs text-gray-500">The customer gets a “shipped” notification with these details.</p>
            <button className="btn-primary w-full">Mark as shipped</button>
          </form>
        </Modal>
      )}
      {cancelOpen && (
        <Modal title="Cancel order" onClose={() => setCancelOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void move('CANCELLED', reason).then((done) => done && setCancelOpen(false));
            }}
          >
            <p className="text-sm text-gray-600">Cancel only if you really cannot ship (e.g. out of stock). Frequent cancellations can lead to suspension.</p>
            <Field label="Reason"><input className="input" required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <button className="btn-primary w-full bg-red-600 hover:bg-red-700">Cancel order</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

