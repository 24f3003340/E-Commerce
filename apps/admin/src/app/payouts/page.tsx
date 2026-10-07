'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, inr } from '@/lib/format';
import type { Paginated, Payout } from '@/lib/types';

function Payouts() {
  const params = useSearchParams();
  const sellerId = params.get('sellerId') ?? '';
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Payout> | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page) });
    if (sellerId) qs.set('sellerId', sellerId);
    api<Paginated<Payout>>(`/admin/payouts?${qs}`).then(setData);
  }, [page, sellerId]);

  return (
    <div>
      <PageHeader
        title="Seller payouts"
        subtitle="Transfers recorded for delivered seller orders. To pay a seller, open them from Sellers → “Record payout”."
        actions={sellerId ? <Link href="/payouts" className="btn-outline btn-sm">All sellers</Link> : undefined}
      />
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No payouts recorded yet." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Payout</th><th>Date</th><th>Seller</th><th>Orders</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.payoutNumber}</td>
                  <td className="whitespace-nowrap">{formatDate(p.createdAt, true)}</td>
                  <td><Link href={`/sellers/${p.seller.id}`} className="text-brand-700">{p.seller.storeName}</Link></td>
                  <td className="text-xs">{p.orders.map((o) => o.orderNumber).join(', ')}</td>
                  <td className="text-xs">{p.reference}{p.note ? <span className="block text-gray-500">{p.note}</span> : null}</td>
                  <td className="text-right font-semibold">{inr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}

export default function PayoutsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Payouts />
    </Suspense>
  );
}
