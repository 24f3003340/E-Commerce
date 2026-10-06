'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError, uploadImage } from '@/lib/api';
import { flattenCategories } from '@/lib/categories';
import type { Category } from '@/lib/types';

type Draft = Partial<Category> & { name: string };

export default function CategoriesPage() {
  const { toast } = useAdmin();
  const [tree, setTree] = useState<Category[] | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(() => api<Category[]>('/admin/categories').then(setTree), []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!tree) return <Spinner />;
  const flat = flattenCategories(tree);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const body = {
      name: editing.name,
      slug: editing.slug || undefined,
      description: editing.description || undefined,
      imageUrl: editing.imageUrl || undefined,
      parentId: editing.parentId || null,
      sortOrder: Number(editing.sortOrder ?? 0),
      isActive: editing.isActive ?? true,
      isReturnable: editing.isReturnable ?? null,
      returnWindowDays: editing.returnWindowDays === undefined || editing.returnWindowDays === null || String(editing.returnWindowDays) === '' ? null : Number(editing.returnWindowDays),
    };
    try {
      await api(editing.id ? `/admin/categories/${editing.id}` : '/admin/categories', { method: editing.id ? 'PUT' : 'POST', body });
      toast('Category saved');
      setEditing(null);
      void load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', true);
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await api(`/admin/categories/${c.id}`, { method: 'DELETE' });
      toast('Category deleted');
      void load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete', true);
    }
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Unlimited nesting — add new departments (e.g. Home, Beauty) any time without code changes."
        actions={<button className="btn-primary" onClick={() => setEditing({ name: '', isActive: true })}>+ Add category</button>}
      />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Slug</th><th>Returns</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {flat.map(({ id, category: c, depth }) => (
              <tr key={id}>
                <td style={{ paddingLeft: `${12 + depth * 24}px` }} className={depth === 0 ? 'font-semibold' : ''}>{depth > 0 && '└ '}{c.name}</td>
                <td className="font-mono text-xs text-gray-500">{c.slug}</td>
                <td className="text-xs">
                  {c.isReturnable === false ? 'Not returnable' : c.returnWindowDays != null ? `${c.returnWindowDays} days` : <span className="text-gray-400">inherit</span>}
                </td>
                <td>{c.isActive ? <span className="text-emerald-700">Active</span> : <span className="text-gray-400">Hidden</span>}</td>
                <td className="whitespace-nowrap text-right text-xs font-semibold">
                  <button className="mr-3 text-brand-700" onClick={() => setEditing({ name: '', parentId: c.id, isActive: true })}>+ Sub-category</button>
                  <button className="mr-3 text-brand-700" onClick={() => setEditing({ ...c })}>Edit</button>
                  <button className="text-red-600" onClick={() => void remove(c)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Edit category' : 'Add category'} onClose={() => setEditing(null)}>
          <form className="space-y-3" onSubmit={save}>
            <Field label="Name"><input className="input" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Parent">
              <select className="input" value={editing.parentId ?? ''} onChange={(e) => setEditing({ ...editing, parentId: e.target.value || null })}>
                <option value="">— Top level —</option>
                {flat.filter((o) => o.id !== editing.id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Slug"><input className="input" value={editing.slug ?? ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="auto" /></Field>
              <Field label="Sort order"><input className="input" type="number" value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Description"><textarea className="input" rows={2} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Image">
              <div className="flex gap-2">
                <input className="input" value={editing.imageUrl ?? ''} onChange={(e) => setEditing({ ...editing, imageUrl: e.target.value })} placeholder="URL" />
                <label className="btn-outline cursor-pointer">Upload<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setEditing({ ...editing, imageUrl: await uploadImage(f) }); } catch (err) { toast((err as Error).message, true); } } }} /></label>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Returnable">
                <select className="input" value={editing.isReturnable === null || editing.isReturnable === undefined ? '' : String(editing.isReturnable)} onChange={(e) => setEditing({ ...editing, isReturnable: e.target.value === '' ? null : e.target.value === 'true' })}>
                  <option value="">Inherit</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
              <Field label="Return window (days)"><input className="input" type="number" min={0} max={90} placeholder="inherit" value={editing.returnWindowDays ?? ''} onChange={(e) => setEditing({ ...editing, returnWindowDays: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Visible in store</label>
            <button className="btn-primary w-full">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
