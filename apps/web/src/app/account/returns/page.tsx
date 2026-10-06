'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, Spinner, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, inr, RETURN_REASONS } from '@/lib/format';
import type { ReturnRequest } from '@/lib/types';

const STEPS = ['REQUESTED', 'APPROVED', 'PICKED_UP', 'RECEIVED', 'QC_PASSED', 'REFUNDED'];

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[] | null>(null);
  useEffect(() => {
    api<ReturnRequest[]>('/returns').then(setReturns);
  }, []);

  if (!returns) return <Spinner />;
  if (!returns.length) {
    return <EmptyState title="No returns" text="You can request a return from a delivered order within the return window." action={<Link href="/account/orders" className="btn-outline">View orders</Link>} />;
  }
  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">Returns & refunds</h1>
      <ul className="space-y-4">
        {returns.map((r) => {
          const idx = STEPS.indexOf(r.status);
          return (
            <li key={r.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.returnNumber}</p>
                  <p className="text-xs text-ink-500">
                    Order{' '}
                    <Link href={`/account/orders/${r.order?.orderNumber}`} className="underline">
                      {r.order?.orderNumber}
                    </Link>{' '}
                    · {formatDate(r.createdAt)} · {RETURN_REASONS[r.reason]}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <ul className="mt-3 text-ink-700">
                {r.items.map((i) => (
                  <li key={i.id}>
                    {i.orderItem?.productName} ({i.orderItem?.variantLabel}) × {i.quantity}
                  </li>
                ))}
              </ul>
              {idx >= 0 && (
                <div className="mt-3 flex gap-1">
                  {STEPS.map((s, i) => (
                    <div key={s} className={`h-1.5 flex-1 rounded ${i <= idx ? 'bg-emerald-500' : 'bg-ink-100'}`} title={s} />
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-ink-500">Refund amount: {inr(r.refundAmount)}</p>
              {r.adminNote && <p className="mt-1 text-xs text-ink-500">Note from store: {r.adminNote}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
