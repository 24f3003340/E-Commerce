'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, inr, ORDER_STATUS_LABEL } from '@/lib/format';
import type { OrderSummary, Paginated } from '@/lib/types';

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<OrderSummary> | null>(null);

  useEffect(() => {
    api<Paginated<OrderSummary>>(`/orders?page=${page}`).then(setData);
  }, [page]);

  if (!data) return <Spinner />;
  if (!data.items.length) return <EmptyState title="No orders yet" text="When you place an order it will appear here." action={<Link href="/" className="btn-primary">Start shopping</Link>} />;

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">My orders</h1>
      <ul className="space-y-4">
        {data.items.map((o) => (
          <li key={o.id}>
            <Link href={`/account/orders/${o.orderNumber}`} className="card block p-4 transition hover:border-ink-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{o.orderNumber}</p>
                  <p className="text-xs text-ink-500">Placed on {formatDate(o.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.status} label={ORDER_STATUS_LABEL[o.status]} />
                  <span className="font-semibold">{inr(o.total)}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {o.items.slice(0, 5).map((i, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={idx} src={i.imageUrl ?? ''} alt={i.productName} className="h-16 w-12 rounded bg-ink-100 object-cover" />
                ))}
                {o.items.length > 5 && <span className="self-center text-sm text-ink-500">+{o.items.length - 5} more</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {data.pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <button className="btn-outline" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
