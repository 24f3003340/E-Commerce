'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminRole } from '@/lib/types';

interface AdminRow {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
}

const ROLES: { value: AdminRole; text: string }[] = [
  { value: 'SUPER_ADMIN', text: 'Super admin — everything incl. admin users' },
  { value: 'ADMIN', text: 'Admin — everything except admin users' },
  { value: 'PRODUCT_MANAGER', text: 'Product manager — products, categories, inventory' },
  { value: 'ORDER_MANAGER', text: 'Order manager — orders, shipping, returns' },
  { value: 'SUPPORT_MANAGER', text: 'Support manager — customers, orders (view), returns' },
  { value: 'MARKETING_MANAGER', text: 'Marketing manager — coupons, banners, reports' },
];

export default function AdminsPage() {
  const { admin: me, toast } = useAdmin();
  const [list, setList] = useState<AdminRow[] | null>(null);
  const [draft, setDraft] = useState<{ id?: string; name: string; email: string; password: string; role: AdminRole; isActive: boolean } | null>(null);
  const load = useCallback(() => api<AdminRow[]>('/admin/admins').then(setList), []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!list) return <Spinner />;

  return (
    <div>
      <PageHeader title="Admin users" subtitle="Role-based access for your team" actions={<button className="btn-primary" onClick={() => setDraft({ name: '', email: '', password: '', role: 'ORDER_MANAGER', isActive: true })}>+ Add admin</button>} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>2FA</th><th>Last login</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td className="font-semibold">{a.name}{a.id === me.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}</td>
                <td>{a.email}</td>
                <td className="text-xs">{a.role.replace(/_/g, ' ').toLowerCase()}</td>
                <td>{a.twoFactorEnabled ? '✓' : '—'}</td>
                <td className="text-xs">{a.lastLoginAt ? formatDate(a.lastLoginAt, true) : 'Never'}</td>
                <td>{a.isActive ? <span className="text-emerald-700">Active</span> : <span className="text-red-600">Disabled</span>}</td>
                <td className="text-right text-xs font-semibold"><button className="text-brand-700" onClick={() => setDraft({ ...a, password: '' })}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {draft && (
        <Modal title={draft.id ? 'Edit admin' : 'Add admin'} onClose={() => setDraft(null)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (draft.id) {
                  await api(`/admin/admins/${draft.id}`, { method: 'PUT', body: { name: draft.name, role: draft.role, isActive: draft.isActive, password: draft.password || undefined } });
                } else {
                  await api('/admin/admins', { method: 'POST', body: { name: draft.name, email: draft.email, password: draft.password, role: draft.role } });
                }
                toast('Saved');
                setDraft(null);
                void load();
              } catch (err) {
                toast(err instanceof ApiError ? err.message : 'Failed', true);
              }
            }}
          >
            <Field label="Name"><input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" required disabled={!!draft.id} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
            <Field label={draft.id ? 'New password (leave empty to keep)' : 'Password'} hint="At least 10 characters with letters and numbers">
              <input className="input" type="password" minLength={10} required={!draft.id} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="new-password" />
            </Field>
            <Field label="Role">
              <select className="input" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as AdminRole })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.text}</option>)}
              </select>
            </Field>
            {draft.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label>}
            <button className="btn-primary w-full">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
