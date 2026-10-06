'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, inr } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
  totalSpend: number;
}

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<CustomerRow> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => api<Paginated<CustomerRow>>(`/admin/customers?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(setData), 250);
    return () => clearTimeout(t);
  }, [q, page]);

  return (
    <div>
      <PageHeader title="Customers" subtitle={data ? `${data.total} customers` : undefined} />
      <input className="input mb-4 max-w-sm" placeholder="Search name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search customers" />
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No customers found." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th><th>Total spend</th><th>Joined</th><th>Status</th></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td><Link href={`/customers/${c.id}`} className="font-semibold text-brand-700">{c.name}</Link></td>
                  <td>{c.email}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>{c.orderCount}</td>
                  <td>{inr(c.totalSpend)}</td>
                  <td className="text-xs">{formatDate(c.createdAt)}</td>
                  <td>{c.isActive ? <span className="text-emerald-700">Active</span> : <span className="text-red-600">Blocked</span>}</td>
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
