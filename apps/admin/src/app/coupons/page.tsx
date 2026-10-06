'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Empty, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { flattenCategories } from '@/lib/categories';
import { formatDate, inr } from '@/lib/format';
import type { Category, Paginated } from '@/lib/types';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FLAT';
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  applicableCategoryIds: string[];
  firstOrderOnly: boolean;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

interface Draft {
  id?: string;
  code: string;
  description: string;
  type: 'PERCENT' | 'FLAT';
  value: string;
  maxDiscount: string;
  minOrderValue: string;
  applicableCategoryIds: string[];
  firstOrderOnly: boolean;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const blank: Draft = { code: '', description: '', type: 'PERCENT', value: '', maxDiscount: '', minOrderValue: '', applicableCategoryIds: [], firstOrderOnly: false, usageLimit: '', perUserLimit: '1', startsAt: '', endsAt: '', isActive: true };
const r = (p: number | null) => (p == null ? '' : String(p / 100));
const toDraft = (c: Coupon): Draft => ({
  id: c.id,
  code: c.code,
  description: c.description ?? '',
  type: c.type,
  value: c.type === 'FLAT' ? r(c.value) : String(c.value),
  maxDiscount: r(c.maxDiscount),
  minOrderValue: r(c.minOrderValue),
  applicableCategoryIds: c.applicableCategoryIds,
  firstOrderOnly: c.firstOrderOnly,
  usageLimit: c.usageLimit?.toString() ?? '',
  perUserLimit: c.perUserLimit?.toString() ?? '',
  startsAt: c.startsAt?.slice(0, 10) ?? '',
  endsAt: c.endsAt?.slice(0, 10) ?? '',
  isActive: c.isActive,
});

export default function CouponsPage() {
  const { toast } = useAdmin();
  const [data, setData] = useState<Paginated<Coupon> | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(() => api<Paginated<Coupon>>('/admin/coupons?limit=100').then(setData), []);
  useEffect(() => {
    void load();
    api<Category[]>('/admin/categories').then(setCats);
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const paise = (v: string) => (v === '' ? null : Math.round(Number(v) * 100));
    const body = {
      code: draft.code,
      description: draft.description || undefined,
      type: draft.type,
      value: draft.type === 'FLAT' ? paise(draft.value) : Number(draft.value),
      maxDiscount: paise(draft.maxDiscount),
      minOrderValue: paise(draft.minOrderValue) ?? 0,
      applicableCategoryIds: draft.applicableCategoryIds,
      firstOrderOnly: draft.firstOrderOnly,
      usageLimit: draft.usageLimit ? Number(draft.usageLimit) : null,
      perUserLimit: draft.perUserLimit ? Number(draft.perUserLimit) : null,
      startsAt: draft.startsAt ? new Date(`${draft.startsAt}T00:00:00+05:30`).toISOString() : null,
      endsAt: draft.endsAt ? new Date(`${draft.endsAt}T23:59:59+05:30`).toISOString() : null,
      isActive: draft.isActive,
    };
    try {
      await api(draft.id ? `/admin/coupons/${draft.id}` : '/admin/coupons', { method: draft.id ? 'PUT' : 'POST', body });
      toast('Coupon saved');
      setDraft(null);
      void load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', true);
    }
  };

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => d && { ...d, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });
  const catName = new Map(flattenCategories(cats).map((c) => [c.id, c.category.name]));

  return (
    <div>
      <PageHeader title="Coupons" actions={<button className="btn-primary" onClick={() => setDraft({ ...blank })}>+ New coupon</button>} />
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No coupons yet." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th>Used</th><th>Validity</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td><span className="font-mono font-bold">{c.code}</span><span className="block text-xs text-gray-500">{c.description}</span></td>
                  <td>{c.type === 'PERCENT' ? `${c.value}%${c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : ''}` : inr(c.value)}</td>
                  <td className="text-xs text-gray-600">
                    {c.minOrderValue > 0 && <span className="block">Min order {inr(c.minOrderValue)}</span>}
                    {c.firstOrderOnly && <span className="block">First order only</span>}
                    {c.applicableCategoryIds.length > 0 && <span className="block">Only: {c.applicableCategoryIds.map((id) => catName.get(id)).join(', ')}</span>}
                    {c.perUserLimit && <span className="block">{c.perUserLimit}× per customer</span>}
                  </td>
                  <td>{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td className="text-xs">{c.startsAt ? formatDate(c.startsAt) : 'Now'} → {c.endsAt ? formatDate(c.endsAt) : 'No expiry'}</td>
                  <td>{c.isActive ? <span className="text-emerald-700">Active</span> : <span className="text-gray-400">Inactive</span>}</td>
                  <td className="whitespace-nowrap text-right text-xs font-semibold">
                    <button className="mr-3 text-brand-700" onClick={() => setDraft(toDraft(c))}>Edit</button>
                    <button className="text-red-600" onClick={async () => { if (confirm(`Delete ${c.code}?`)) { await api(`/admin/coupons/${c.id}`, { method: 'DELETE' }); void load(); } }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal title={draft.id ? 'Edit coupon' : 'New coupon'} onClose={() => setDraft(null)} wide>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
            <Field label="Code"><input className="input font-mono uppercase" required value={draft.code} onChange={set('code')} /></Field>
            <Field label="Description"><input className="input" value={draft.description} onChange={set('description')} /></Field>
            <Field label="Type">
              <select className="input" value={draft.type} onChange={set('type')}>
                <option value="PERCENT">Percentage off</option>
                <option value="FLAT">Flat amount off</option>
              </select>
            </Field>
            <Field label={draft.type === 'PERCENT' ? 'Percent (%)' : 'Amount (₹)'}><input className="input" type="number" min="1" required value={draft.value} onChange={set('value')} /></Field>
            {draft.type === 'PERCENT' && <Field label="Maximum discount (₹)"><input className="input" type="number" min="1" value={draft.maxDiscount} onChange={set('maxDiscount')} /></Field>}
            <Field label="Minimum order value (₹)"><input className="input" type="number" min="0" value={draft.minOrderValue} onChange={set('minOrderValue')} /></Field>
            <Field label="Total usage limit"><input className="input" type="number" min="1" placeholder="Unlimited" value={draft.usageLimit} onChange={set('usageLimit')} /></Field>
            <Field label="Uses per customer"><input className="input" type="number" min="1" placeholder="Unlimited" value={draft.perUserLimit} onChange={set('perUserLimit')} /></Field>
            <Field label="Starts on"><input className="input" type="date" value={draft.startsAt} onChange={set('startsAt')} /></Field>
            <Field label="Ends on"><input className="input" type="date" value={draft.endsAt} onChange={set('endsAt')} /></Field>
            <div className="sm:col-span-2">
              <Field label="Only for categories (optional)" hint="Ctrl/Cmd-click to select several. Empty = whole cart.">
                <select multiple className="input h-32" value={draft.applicableCategoryIds} onChange={(e) => setDraft({ ...draft, applicableCategoryIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
                  {flattenCategories(cats).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.firstOrderOnly} onChange={set('firstOrderOnly')} /> First order only</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={set('isActive')} /> Active</label>
            <button className="btn-primary sm:col-span-2">Save coupon</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
