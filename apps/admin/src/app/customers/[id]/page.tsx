'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Badge, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDate, inr } from '@/lib/format';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  addresses: { id: string; name: string; line1: string; city: string; state: string; pincode: string; phone: string }[];
  orders: { id: string; orderNumber: string; status: string; total: number; createdAt: string }[];
  returns: { id: string; returnNumber: string; status: string; createdAt: string }[];
}

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const { toast, admin } = useAdmin();
  const [c, setC] = useState<Customer | null>(null);
  const load = useCallback(() => api<Customer>(`/admin/customers/${id}`).then(setC), [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!c) return <Spinner />;

  const canBlock = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT_MANAGER'].includes(admin.role);
  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        subtitle={`${c.email}${c.phone ? ` · ${c.phone}` : ''} · joined ${formatDate(c.createdAt)}`}
        actions={canBlock && (
          <button
            className={c.isActive ? 'btn-outline text-red-600' : 'btn-primary'}
            onClick={async () => {
              if (c.isActive && !confirm('Block this customer? They will be logged out everywhere.')) return;
              try {
                await api(`/admin/customers/${id}/status`, { method: 'PATCH', body: { isActive: !c.isActive } });
                toast(c.isActive ? 'Customer blocked' : 'Customer unblocked');
                void load();
              } catch (err) {
                toast(err instanceof ApiError ? err.message : 'Failed', true);
              }
            }}
          >
            {c.isActive ? 'Block customer' : 'Unblock customer'}
          </button>
        )}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-bold">Orders</h2>
          <table className="table">
            <thead><tr><th>Order</th><th>Date</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {c.orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/orders/${o.id}`} className="text-brand-700">{o.orderNumber}</Link></td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td><Badge value={o.status} /></td>
                  <td className="text-right">{inr(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="space-y-6">
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-bold">Addresses</h2>
            {c.addresses.map((a) => (
              <p key={a.id} className="mb-3 text-gray-700">{a.name} · {a.phone}<br />{a.line1}, {a.city}, {a.state} – {a.pincode}</p>
            ))}
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-bold">Returns</h2>
            {c.returns.length ? c.returns.map((r) => (
              <p key={r.id} className="mb-2"><Link href={`/returns/${r.id}`} className="text-brand-700">{r.returnNumber}</Link> <Badge value={r.status} /></p>
            )) : <p className="text-gray-500">None</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
