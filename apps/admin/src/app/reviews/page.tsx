'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isApproved: boolean;
  verifiedPurchase: boolean;
  createdAt: string;
  user: { name: string; email: string };
  product: { name: string; slug: string };
}

export default function ReviewsPage() {
  const { toast } = useAdmin();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ReviewRow> | null>(null);
  const load = useCallback(() => api<Paginated<ReviewRow>>(`/admin/reviews?page=${page}`).then(setData), [page]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Hide inappropriate reviews; ratings are recalculated automatically." />
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No reviews yet." /> : (
        <div className="card divide-y">
          {data.items.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
              <div className="max-w-2xl">
                <p><span className="font-bold text-amber-600">{'★'.repeat(r.rating)}</span><span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span> <span className="font-semibold">{r.title}</span></p>
                <p className="mt-1 text-gray-700">{r.comment}</p>
                <p className="mt-1 text-xs text-gray-500">{r.product.name} · {r.user.name} ({r.user.email}) · {formatDate(r.createdAt)} {r.verifiedPurchase && '· verified'}</p>
              </div>
              <div className="flex gap-3 text-xs font-semibold">
                <button className={r.isApproved ? 'text-amber-700' : 'text-emerald-700'} onClick={async () => { await api(`/admin/reviews/${r.id}`, { method: 'PATCH', body: { isApproved: !r.isApproved } }); toast(r.isApproved ? 'Review hidden' : 'Review published'); void load(); }}>
                  {r.isApproved ? 'Hide' : 'Publish'}
                </button>
                <button className="text-red-600" onClick={async () => { if (confirm('Delete review?')) { await api(`/admin/reviews/${r.id}`, { method: 'DELETE' }); void load(); } }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}
