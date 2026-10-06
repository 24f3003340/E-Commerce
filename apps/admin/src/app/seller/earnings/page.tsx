'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Empty, PageHeader, Spinner } from '@/components/ui';
import { formatDate, inr } from '@/lib/format';
import { sellerApi } from '@/lib/sellerApi';
import type { Earnings, Paginated, Payout } from '@/lib/types';

export default function SellerEarningsPage() {
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [payouts, setPayouts] = useState<Paginated<Payout> | null>(null);

  useEffect(() => {
    sellerApi<Earnings>('/seller/earnings').then(setEarnings);
    sellerApi<Paginated<Payout>>('/seller/payouts').then(setPayouts);
  }, []);
  if (!earnings || !payouts) return <Spinner />;
  const t = earnings.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Earnings & payouts" subtitle={`You earn the item price minus the marketplace commission. Earnings are released ${earnings.holdDays} days after delivery (after the return window) and transferred to your bank / UPI.`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card bg-emerald-50 p-4"><p className="text-xs text-emerald-800">Ready for payout</p><p className="text-2xl font-bold text-emerald-900">{inr(t.readyForPayout)}</p></div>
        <div className="card bg-amber-50 p-4"><p className="text-xs text-amber-800">On hold</p><p className="text-2xl font-bold text-amber-900">{inr(t.onHold)}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-600">Paid to you ({t.payouts} payouts)</p><p className="text-2xl font-bold">{inr(t.paidOut)}</p></div>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Unpaid orders</h2>
        {!earnings.orders.length ? <Empty text="No unpaid orders." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th>Date</th><th>Status</th><th className="text-right">Item value</th><th className="text-right">Commission</th><th className="text-right">You get</th><th>Release</th></tr></thead>
              <tbody>
                {earnings.orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/seller/orders/${o.id}`} className="text-brand-700">{o.orderNumber}</Link></td>
                    <td className="whitespace-nowrap text-xs">{formatDate(o.createdAt)}</td>
                    <td><Badge value={o.status} /></td>
                    <td className="text-right">{inr(o.itemValue)}</td>
                    <td className="text-right text-gray-600">−{inr(o.commission)} <span className="text-xs">({o.commissionPct}%)</span></td>
                    <td className="text-right font-semibold">{inr(o.payable)}</td>
                    <td className="text-xs">{o.eligible ? <span className="font-semibold text-emerald-700">In next payout</span> : o.releaseOn ? formatDate(o.releaseOn) : 'After delivery'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Payout history</h2>
        {!payouts.items.length ? <Empty text="No payouts yet." /> : (
          <table className="table">
            <thead><tr><th>Payout</th><th>Date</th><th>Orders</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {payouts.items.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.payoutNumber}</td>
                  <td>{formatDate(p.createdAt)}</td>
                  <td className="text-xs">{p.orders.map((o) => o.orderNumber).join(', ')}</td>
                  <td className="text-xs">{p.reference}</td>
                  <td className="text-right font-semibold">{inr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
