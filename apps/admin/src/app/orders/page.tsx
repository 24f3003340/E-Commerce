'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Badge, Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, inr, ORDER_STATUS_LABEL } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  user: { name: string; email: string };
  _count: { items: number };
}

function Orders() {
  const params = useSearchParams();
  const [filters, setFilters] = useState({ q: '', status: params.get('status') ?? '', paymentStatus: '', paymentMethod: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<OrderRow> | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    const t = setTimeout(() => api<Paginated<OrderRow>>(`/admin/orders?${qs}`).then(setData), 250);
    return () => clearTimeout(t);
  }, [filters, page]);

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: e.target.value }));
  };

  return (
    <div>
      <PageHeader title="Orders" subtitle={data ? `${data.total} orders` : undefined} />
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-6">
        <input className="input md:col-span-2" placeholder="Order ID, customer name, email, phone" value={filters.q} onChange={set('q')} aria-label="Search orders" />
        <select className="input" value={filters.status} onChange={set('status')} aria-label="Order status">
          <option value="">All statuses</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="input" value={filters.paymentStatus} onChange={set('paymentStatus')} aria-label="Payment status">
          <option value="">Any payment</option>
          {['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'].map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
          ))}
        </select>
        <input type="date" className="input" value={filters.from} onChange={set('from')} aria-label="From date" />
        <input type="date" className="input" value={filters.to} onChange={set('to')} aria-label="To date" />
      </div>
      {!data ? (
        <Spinner />
      ) : !data.items.length ? (
        <Empty text="No orders match these filters." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td><Link href={`/orders/${o.id}`} className="font-semibold text-brand-700">{o.orderNumber}</Link></td>
                  <td className="whitespace-nowrap">{formatDate(o.createdAt, true)}</td>
                  <td>{o.user.name}<span className="block text-xs text-gray-500">{o.user.email}</span></td>
                  <td>{o._count.items}</td>
                  <td>
                    <span className="mr-1 text-xs text-gray-500">{o.paymentMethod}</span>
                    <Badge value={o.paymentStatus} />
                  </td>
                  <td><Badge value={o.status} /></td>
                  <td className="text-right font-semibold">{inr(o.total)}</td>
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

export default function OrdersPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Orders />
    </Suspense>
  );
}
