'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Notification } from '@/lib/types';

export default function NotificationsPage() {
  const [data, setData] = useState<{ items: Notification[]; unread: number } | null>(null);
  useEffect(() => {
    api<{ items: Notification[]; unread: number }>('/notifications').then((d) => {
      setData(d);
      if (d.unread) void api('/notifications/read-all', { method: 'POST' });
    });
  }, []);

  if (!data) return <Spinner />;
  if (!data.items.length) return <EmptyState title="No notifications" text="Order and refund updates will show up here." />;
  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">Notifications</h1>
      <ul className="card divide-y">
        {data.items.map((n) => (
          <li key={n.id} className={`p-4 text-sm ${n.readAt ? '' : 'bg-brand-50/50'}`}>
            <p className="font-semibold">{n.title}</p>
            <p className="text-ink-700">{n.body}</p>
            <p className="mt-1 text-xs text-ink-500">
              {formatDate(n.createdAt, true)}
              {n.data?.orderNumber && (
                <>
                  {' · '}
                  <Link href={`/account/orders/${n.data.orderNumber}`} className="text-brand-700 underline">
                    View order
                  </Link>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
