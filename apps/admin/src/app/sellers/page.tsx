'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Badge, Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/format';
import type { Paginated, Seller } from '@/lib/types';

type SellerRow = Seller & { _count: { products: number; orders: number } };

const TABS = [
  ['', 'All'],
  ['PENDING', 'Waiting for approval'],
  ['APPROVED', 'Approved'],
  ['SUSPENDED', 'Suspended'],
  ['REJECTED', 'Rejected'],
] as const;

function Sellers() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<SellerRow> | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    const t = setTimeout(() => api<Paginated<SellerRow>>(`/admin/sellers?${qs}`).then(setData), 250);
    return () => clearTimeout(t);
  }, [status, q, page]);

  return (
    <div>
      <PageHeader title="Sellers" subtitle="Outside businesses selling on your marketplace" />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <button key={value} onClick={() => { setStatus(value); setPage(1); }} className={cn('btn-sm rounded-full border px-3', status === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white')}>
            {label}
          </button>
        ))}
      </div>
      <div className="card mb-4 p-4">
        <input className="input max-w-md" placeholder="Search store, owner, email, phone or GSTIN" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search sellers" />
      </div>
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No sellers here yet. Share your seller sign-up link to get started." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Store</th><th>Owner</th><th>Location</th><th>GSTIN</th><th>Products</th><th>Orders</th><th>Status</th><th>Joined</th></tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td><Link href={`/sellers/${s.id}`} className="font-semibold text-brand-700">{s.storeName}</Link></td>
                  <td>{s.name}<span className="block text-xs text-gray-500">{s.email} · {s.phone}</span></td>
                  <td className="text-xs">{s.city}, {s.state}</td>
                  <td className="font-mono text-xs">{s.gstin ?? <span className="text-gray-400">—</span>}</td>
                  <td>{s._count.products}</td>
                  <td>{s._count.orders}</td>
                  <td><Badge value={s.status} /></td>
                  <td className="whitespace-nowrap text-xs">{formatDate(s.createdAt)}</td>
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

export default function SellersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Sellers />
    </Suspense>
  );
}
