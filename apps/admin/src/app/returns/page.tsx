'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, inr, RETURN_REASONS } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface ReturnRow {
  id: string;
  returnNumber: string;
  status: string;
  reason: string;
  refundAmount: number;
  createdAt: string;
  order: { id: string; orderNumber: string; paymentMethod: string };
  user: { name: string; email: string };
  items: { quantity: number }[];
}

const STATUSES = ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED', 'QC_PASSED', 'QC_FAILED', 'REFUNDED', 'REJECTED'];

export default function ReturnsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ReturnRow> | null>(null);

  useEffect(() => {
    api<Paginated<ReturnRow>>(`/admin/returns?page=${page}${status ? `&status=${status}` : ''}`).then(setData);
  }, [status, page]);

  return (
    <div>
      <PageHeader title="Returns & refunds" />
      <div className="mb-4 flex flex-wrap gap-2">
        {['', ...STATUSES].map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`chip ${status === s ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white'}`}>
            {s ? s.replace(/_/g, ' ').toLowerCase() : 'all'}
          </button>
        ))}
      </div>
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No returns." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Return</th><th>Order</th><th>Customer</th><th>Reason</th><th>Items</th><th>Refund</th><th>Status</th><th>Requested</th></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td><Link href={`/returns/${r.id}`} className="font-semibold text-brand-700">{r.returnNumber}</Link></td>
                  <td><Link href={`/orders/${r.order.id}`} className="text-brand-700">{r.order.orderNumber}</Link><span className="block text-xs text-gray-500">{r.order.paymentMethod}</span></td>
                  <td>{r.user.name}</td>
                  <td>{RETURN_REASONS[r.reason]}</td>
                  <td>{r.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td>{inr(r.refundAmount)}</td>
                  <td><Badge value={r.status} /></td>
                  <td className="text-xs">{formatDate(r.createdAt)}</td>
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
