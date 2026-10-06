'use client';

import { useEffect, useState } from 'react';
import { Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface Log {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  data: unknown;
  createdAt: string;
  admin: { name: string; email: string } | null;
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [data, setData] = useState<Paginated<Log> | null>(null);
  useEffect(() => {
    api<Paginated<Log>>(`/admin/audit-logs?page=${page}${entity ? `&entity=${entity}` : ''}`).then(setData);
  }, [page, entity]);

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Every change made from the admin panel" />
      <select className="input mb-4 max-w-[200px]" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Entity">
        <option value="">All entities</option>
        {['product', 'category', 'variant', 'order', 'shipment', 'return', 'coupon', 'banner', 'customer', 'admin', 'settings', 'review'].map((e) => <option key={e}>{e}</option>)}
      </select>
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No log entries." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-xs">{formatDate(l.createdAt, true)}</td>
                  <td>{l.admin?.name ?? 'system'}</td>
                  <td>{l.action}</td>
                  <td>{l.entity} <span className="font-mono text-xs text-gray-400">{l.entityId?.slice(-8)}</span></td>
                  <td className="max-w-md truncate font-mono text-xs text-gray-500" title={JSON.stringify(l.data)}>{l.data ? JSON.stringify(l.data) : ''}</td>
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
