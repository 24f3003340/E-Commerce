'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Badge, Field, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDate, humanize, inr, RETURN_REASONS } from '@/lib/format';

interface ReturnDetail {
  id: string;
  returnNumber: string;
  status: string;
  reason: string;
  comment: string | null;
  adminNote: string | null;
  refundAmount: number;
  createdAt: string;
  order: { id: string; orderNumber: string; paymentMethod: string; total: number; deliveredAt: string | null };
  user: { name: string; email: string; phone: string | null };
  items: { id: string; quantity: number; orderItem: { productName: string; variantLabel: string; sku: string; imageUrl: string | null; unitPrice: number } }[];
  refunds: { id: string; amount: number; status: string; mode: string }[];
  allowedNextStatuses: string[];
}

const ACTION_LABEL: Record<string, string> = {
  APPROVED: 'Approve',
  REJECTED: 'Reject',
  PICKUP_SCHEDULED: 'Pickup scheduled',
  PICKED_UP: 'Mark picked up',
  RECEIVED: 'Mark received at warehouse',
  QC_PASSED: 'QC passed (restock)',
  QC_FAILED: 'QC failed',
  REFUNDED: 'Issue refund',
};

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useAdmin();
  const [ret, setRet] = useState<ReturnDetail | null>(null);
  const [note, setNote] = useState('');
  const [refundMode, setRefundMode] = useState('BANK');
  const load = useCallback(() => api<ReturnDetail>(`/admin/returns/${id}`).then(setRet), [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!ret) return <Spinner />;

  const act = async (status: string) => {
    if (status === 'REFUNDED' && !confirm(`Refund ${inr(ret.refundAmount)} to the customer?`)) return;
    try {
      setRet(await api<ReturnDetail>(`/admin/returns/${id}/status`, { method: 'PATCH', body: { status, note: note || undefined, refundMode: ret.order.paymentMethod === 'COD' ? refundMode : undefined } }));
      setNote('');
      toast('Return updated');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed', true);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Return ${ret.returnNumber}`} subtitle={`Requested ${formatDate(ret.createdAt, true)}`} actions={<Badge value={ret.status} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">Items</h2>
          <ul className="divide-y">
            {ret.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.orderItem.imageUrl ?? ''} alt="" className="h-14 w-11 rounded bg-gray-100 object-cover" />
                <span className="flex-1">{i.orderItem.productName}<span className="block text-xs text-gray-500">{i.orderItem.variantLabel} · {i.orderItem.sku}</span></span>
                <span>{i.quantity} × {inr(i.orderItem.unitPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm">
            <p><span className="font-semibold">Reason:</span> {RETURN_REASONS[ret.reason]}</p>
            {ret.comment && <p className="mt-1"><span className="font-semibold">Customer says:</span> {ret.comment}</p>}
            {ret.adminNote && <p className="mt-1"><span className="font-semibold">Note:</span> {ret.adminNote}</p>}
          </div>
        </section>
        <div className="space-y-6">
          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Actions</h2>
            <p className="text-sm">Refund amount: <span className="font-bold">{inr(ret.refundAmount)}</span></p>
            {ret.allowedNextStatuses.length ? (
              <>
                <Field label="Note (shared with customer when rejecting)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                {ret.allowedNextStatuses.includes('REFUNDED') && ret.order.paymentMethod === 'COD' && (
                  <Field label="COD refund paid via">
                    <select className="input" value={refundMode} onChange={(e) => setRefundMode(e.target.value)}>
                      <option value="BANK">Bank transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="STORE_CREDIT">Store credit</option>
                    </select>
                  </Field>
                )}
                <div className="flex flex-wrap gap-2">
                  {ret.allowedNextStatuses.map((s) => (
                    <button key={s} className={s === 'REJECTED' || s === 'QC_FAILED' ? 'btn-outline btn-sm text-red-600' : 'btn-primary btn-sm'} onClick={() => void act(s)}>
                      {ACTION_LABEL[s] ?? humanize(s)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">This return is closed.</p>
            )}
            {ret.refunds.map((r) => (
              <p key={r.id} className="text-xs">Refund {inr(r.amount)} · {r.mode.toLowerCase()} · <Badge value={r.status} /></p>
            ))}
          </section>
          <section className="card space-y-1 p-5 text-sm">
            <h2 className="mb-2 font-bold">Order</h2>
            <Link href={`/orders/${ret.order.id}`} className="font-semibold text-brand-700">{ret.order.orderNumber}</Link>
            <p>{ret.order.paymentMethod} · {inr(ret.order.total)}</p>
            {ret.order.deliveredAt && <p>Delivered {formatDate(ret.order.deliveredAt)}</p>}
            <p className="pt-2">{ret.user.name}<br />{ret.user.email}<br />{ret.user.phone}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
