'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError, uploadImage } from '@/lib/api';

interface Banner {
  id?: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  ctaText: string | null;
  position: 'HERO' | 'OFFER';
  sortOrder: number;
  isActive: boolean;
}

const blank: Banner = { title: '', subtitle: '', imageUrl: '', linkUrl: '', ctaText: 'Shop now', position: 'HERO', sortOrder: 0, isActive: true };

export default function BannersPage() {
  const { toast } = useAdmin();
  const [list, setList] = useState<Banner[] | null>(null);
  const [draft, setDraft] = useState<Banner | null>(null);
  const load = useCallback(() => api<Banner[]>('/admin/banners').then(setList), []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const { id, ...rest } = draft;
    const body = { ...rest, subtitle: rest.subtitle || undefined, linkUrl: rest.linkUrl || undefined, ctaText: rest.ctaText || undefined, sortOrder: Number(rest.sortOrder) };
    delete (body as Record<string, unknown>).createdAt;
    delete (body as Record<string, unknown>).updatedAt;
    delete (body as Record<string, unknown>).startsAt;
    delete (body as Record<string, unknown>).endsAt;
    try {
      await api(id ? `/admin/banners/${id}` : '/admin/banners', { method: id ? 'PUT' : 'POST', body });
      toast('Banner saved');
      setDraft(null);
      void load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', true);
    }
  };

  if (!list) return <Spinner />;
  return (
    <div>
      <PageHeader title="Banners" subtitle="Hero slider and offer banners on the home page" actions={<button className="btn-primary" onClick={() => setDraft({ ...blank })}>+ New banner</button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {list.map((b) => (
          <div key={b.id} className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt="" className="h-36 w-full object-cover" />
            <div className="flex items-start justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold">{b.title}</p>
                <p className="text-gray-500">{b.subtitle}</p>
                <p className="mt-1 text-xs text-gray-500">{b.position} · order {b.sortOrder} · {b.isActive ? 'Active' : 'Hidden'} · {b.linkUrl}</p>
              </div>
              <div className="flex shrink-0 gap-3 text-xs font-semibold">
                <button className="text-brand-700" onClick={() => setDraft(b)}>Edit</button>
                <button className="text-red-600" onClick={async () => { if (confirm('Delete banner?')) { await api(`/admin/banners/${b.id}`, { method: 'DELETE' }); void load(); } }}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {draft && (
        <Modal title={draft.id ? 'Edit banner' : 'New banner'} onClose={() => setDraft(null)}>
          <form className="space-y-3" onSubmit={save}>
            <Field label="Title"><input className="input" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Subtitle"><input className="input" value={draft.subtitle ?? ''} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} /></Field>
            <Field label="Image" hint="Recommended 1600 × 600">
              <div className="flex gap-2">
                <input className="input" required value={draft.imageUrl} onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })} placeholder="URL" />
                <label className="btn-outline cursor-pointer">Upload<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setDraft({ ...draft, imageUrl: await uploadImage(f) }); } catch (err) { toast((err as Error).message, true); } } }} /></label>
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Link" hint="e.g. /c/men"><input className="input" value={draft.linkUrl ?? ''} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} /></Field>
              <Field label="Button text"><input className="input" value={draft.ctaText ?? ''} onChange={(e) => setDraft({ ...draft, ctaText: e.target.value })} /></Field>
              <Field label="Position">
                <select className="input" value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value as Banner['position'] })}>
                  <option value="HERO">Hero slider</option>
                  <option value="OFFER">Offer strip</option>
                </select>
              </Field>
              <Field label="Sort order"><input className="input" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label>
            <button className="btn-primary w-full">Save</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
