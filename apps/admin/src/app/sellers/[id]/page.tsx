'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Badge, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError, canAccess } from '@/lib/api';
import { formatDate, inr } from '@/lib/format';
import type { Earnings, Seller } from '@/lib/types';

type SellerDetail = Seller & {
  effectiveCommissionPct: number;
  products: Record<string, number>;
  earnings: Earnings;
  _count: { products: number; orders: number };
};

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-1.5 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium">{value || <span className="text-gray-400">—</span>}</span>
    </div>
  );
}

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { admin, toast } = useAdmin();
  const [seller, setSeller] = useState<SellerDetail | null>(null);
  const [note, setNote] = useState('');
  const [commission, setCommission] = useState('');
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payout, setPayout] = useState({ reference: '', note: '' });
  const isAdmin = admin.role === 'SUPER_ADMIN' || admin.role === 'ADMIN';

  const load = useCallback(
    () =>
      api<SellerDetail>(`/admin/sellers/${id}`).then((s) => {
        setSeller(s);
        setCommission(s.commissionPct === null ? '' : String(s.commissionPct));
      }),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!seller) return <Spinner />;
  const e = seller.earnings;

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

  const setStatus = (status: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => {
    if (status !== 'APPROVED' && !note.trim()) return toast('Write a reason — the seller will see it', true);
    if (status === 'SUSPENDED' && !confirm(`Suspend ${seller.storeName}? Their products disappear from the store right away.`)) return;
    void run(() => api(`/admin/sellers/${id}/status`, { method: 'PATCH', body: { status, note: note || undefined } }), `Seller ${status.toLowerCase()}`).then(() => setNote(''));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={seller.storeName}
        subtitle={`Joined ${formatDate(seller.createdAt)}${seller.approvedAt ? ` · approved ${formatDate(seller.approvedAt)}` : ''}`}
        actions={
          <>
            <Badge value={seller.status} />
            {canAccess(admin.role, 'products') && <Link href={`/products?sellerId=${seller.id}`} className="btn-outline btn-sm">Products ({seller._count.products})</Link>}
            {canAccess(admin.role, 'orders') && <Link href={`/orders?sellerId=${seller.id}`} className="btn-outline btn-sm">Orders ({seller._count.orders})</Link>}
          </>
        }
      />

      {isAdmin && (
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Account status</h2>
          {seller.statusNote && <p className="text-sm text-gray-600">Last note to seller: {seller.statusNote}</p>}
          <p className="text-sm text-gray-600">
            {seller.status === 'PENDING'
              ? 'Verify the GSTIN, PAN and bank details below before approving. Approved sellers can receive orders; their products still need product approval.'
              : seller.status === 'APPROVED'
                ? 'This seller is live. Suspending hides all their products immediately.'
                : 'This seller cannot sell right now.'}
          </p>
          <input className="input" placeholder="Reason (required to reject or suspend — emailed to the seller)" value={note} onChange={(ev) => setNote(ev.target.value)} />
          <div className="flex flex-wrap gap-2">
            {seller.status !== 'APPROVED' && <button className="btn-primary" onClick={() => setStatus('APPROVED')}>Approve seller</button>}
            {seller.status === 'PENDING' && <button className="btn-outline text-red-600" onClick={() => setStatus('REJECTED')}>Reject</button>}
            {seller.status === 'APPROVED' && <button className="btn-outline text-red-600" onClick={() => setStatus('SUSPENDED')}>Suspend</button>}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-2 font-bold">Business</h2>
          <Row label="Owner" value={seller.name} />
          <Row label="Email" value={seller.email} />
          <Row label="Phone" value={seller.phone} />
          <Row label="GSTIN" value={seller.gstin} />
          <Row label="PAN" value={seller.pan} />
          {seller.description && <p className="pt-2 text-sm text-gray-600">{seller.description}</p>}
        </section>
        <section className="card p-5">
          <h2 className="mb-2 font-bold">Pickup address</h2>
          <p className="text-sm leading-6">
            {seller.addressLine1}
            {seller.addressLine2 ? <>, {seller.addressLine2}</> : null}
            <br />
            {seller.city}, {seller.state} – {seller.pincode}
          </p>
          <h2 className="mb-2 mt-4 font-bold">Payout details</h2>
          <Row label="Account holder" value={seller.bankAccountName} />
          <Row label="Account number" value={seller.bankAccountNumber} />
          <Row label="IFSC" value={seller.bankIfsc} />
          <Row label="UPI ID" value={seller.upiId} />
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="font-bold">Commission</h2>
          <p className="text-sm text-gray-600">
            Currently <span className="font-semibold text-gray-900">{seller.effectiveCommissionPct}%</span> of item value
            {seller.commissionPct === null ? ' (store default)' : ' (custom rate)'}. Changes apply to new orders only.
          </p>
          {isAdmin && (
            <form
              className="flex gap-2"
              onSubmit={(ev) => {
                ev.preventDefault();
                void run(() => api(`/admin/sellers/${id}/commission`, { method: 'PATCH', body: { commissionPct: commission === '' ? null : Number(commission) } }), 'Commission updated');
              }}
            >
              <input className="input" type="number" min={0} max={100} step="0.5" placeholder="Store default" value={commission} onChange={(ev) => setCommission(ev.target.value)} aria-label="Commission %" />
              <button className="btn-outline">Save</button>
            </form>
          )}
          <h2 className="pt-2 font-bold">Products</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(seller.products).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1"><Badge value={status} /> {count}</span>
            ))}
            {!Object.keys(seller.products).length && <span className="text-gray-500">No products yet</span>}
          </div>
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Earnings & payouts</h2>
            <p className="text-xs text-gray-500">Seller earns item value minus commission. Earnings are released {e.holdDays} days after delivery when no return is open.</p>
          </div>
          {isAdmin && e.totals.readyForPayout > 0 && <button className="btn-primary" onClick={() => setPayoutOpen(true)}>Record payout of {inr(e.totals.readyForPayout)}</button>}
        </div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Ready for payout</p><p className="text-xl font-bold text-emerald-900">{inr(e.totals.readyForPayout)}</p></div>
          <div className="rounded-md bg-amber-50 p-3"><p className="text-xs text-amber-800">On hold</p><p className="text-xl font-bold text-amber-900">{inr(e.totals.onHold)}</p></div>
          <div className="rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-600">Paid so far ({e.totals.payouts} payouts)</p><p className="text-xl font-bold">{inr(e.totals.paidOut)}</p></div>
        </div>
        {e.orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th>Status</th><th className="text-right">Item value</th><th className="text-right">Commission</th><th className="text-right">Seller gets</th><th>Payout</th></tr></thead>
              <tbody>
                {e.orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/orders/${o.id}`} className="text-brand-700">{o.orderNumber}</Link></td>
                    <td><Badge value={o.status} /></td>
                    <td className="text-right">{inr(o.itemValue)}</td>
                    <td className="text-right text-gray-600">−{inr(o.commission)} <span className="text-xs">({o.commissionPct}%)</span></td>
                    <td className="text-right font-semibold">{inr(o.payable)}</td>
                    <td className="text-xs">{o.eligible ? <span className="font-semibold text-emerald-700">Ready</span> : o.releaseOn ? `After ${formatDate(o.releaseOn)}` : 'After delivery'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isAdmin && <Link href={`/payouts?sellerId=${seller.id}`} className="mt-3 inline-block text-sm font-semibold text-brand-700">Payout history →</Link>}
      </section>

      {payoutOpen && (
        <Modal title={`Pay ${seller.storeName}`} onClose={() => setPayoutOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              void run(() => api(`/admin/sellers/${id}/payouts`, { method: 'POST', body: { reference: payout.reference, note: payout.note || undefined } }), 'Payout recorded').then((done) => {
                if (done) {
                  setPayoutOpen(false);
                  setPayout({ reference: '', note: '' });
                }
              });
            }}
          >
            <p className="rounded-md bg-gray-50 p-3 text-sm">
              First transfer <span className="font-bold">{inr(e.totals.readyForPayout)}</span> to{' '}
              {seller.bankAccountNumber ? `${seller.bankAccountName ?? seller.name} · A/C ${seller.bankAccountNumber} · ${seller.bankIfsc}` : seller.upiId ? `UPI ${seller.upiId}` : 'the seller (no bank details yet — ask them to add them in their profile)'}
              , then record it here. The seller gets an email.
            </p>
            <Field label="Bank UTR / UPI reference"><input className="input" required value={payout.reference} onChange={(ev) => setPayout((p) => ({ ...p, reference: ev.target.value }))} /></Field>
            <Field label="Note (optional)"><input className="input" value={payout.note} onChange={(ev) => setPayout((p) => ({ ...p, note: ev.target.value }))} /></Field>
            <button className="btn-primary w-full">Record payout</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
