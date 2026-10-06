'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useSeller } from '@/components/SellerShell';
import { Badge, Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { cn, formatDate, inr } from '@/lib/format';
import { sellerApi } from '@/lib/sellerApi';
import type { Paginated } from '@/lib/types';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  subtotal: number;
  createdAt: string;
  user: { name: string };
  _count: { items: number };
}

const TABS = [
  ['CONFIRMED', 'New'],
  ['PROCESSING', 'Processing'],
  ['PACKED', 'Packed'],
  ['SHIPPED', 'Shipped'],
  ['DELIVERED', 'Delivered'],
  ['CANCELLED', 'Cancelled'],
  ['', 'All'],
] as const;

function Orders() {
  const { seller } = useSeller();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? 'CONFIRMED');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<OrderRow> | null>(null);

  useEffect(() => {
    if (seller.status !== 'APPROVED') return;
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    const t = setTimeout(() => sellerApi<Paginated<OrderRow>>(`/seller/orders?${qs}`).then(setData), 250);
    return () => clearTimeout(t);
  }, [status, q, page, seller.status]);

  if (seller.status !== 'APPROVED') {
    return (
      <div>
        <PageHeader title="Orders" />
        <Empty text="You will start receiving orders once your seller account is approved." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle="Pack each order, then add the courier AWB to mark it shipped." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <button key={value} onClick={() => { setStatus(value); setPage(1); }} className={cn('btn-sm rounded-full border px-3', status === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white')}>
            {label}
          </button>
        ))}
      </div>
      <div className="card mb-4 p-4">
        <input className="input max-w-sm" placeholder="Order ID or customer name" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search orders" />
      </div>
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No orders here." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th className="text-right">Item value</th></tr></thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td><Link href={`/seller/orders/${o.id}`} className="font-semibold text-brand-700">{o.orderNumber}</Link></td>
                  <td className="whitespace-nowrap">{formatDate(o.createdAt, true)}</td>
                  <td>{o.user.name}</td>
                  <td>{o._count.items}</td>
                  <td className="text-xs">{o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Prepaid'}</td>
                  <td><Badge value={o.status} /></td>
                  <td className="text-right font-semibold">{inr(o.subtotal)}</td>
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

export default function SellerOrdersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Orders />
    </Suspense>
  );
}
