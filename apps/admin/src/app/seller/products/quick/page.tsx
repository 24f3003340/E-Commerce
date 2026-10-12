'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSeller } from '@/components/SellerShell';
import { Field, PageHeader } from '@/components/ui';
import { flattenCategories } from '@/lib/categories';
import { ApiError } from '@/lib/client';
import { sellerApi, sellerClient } from '@/lib/sellerApi';
import type { Category } from '@/lib/types';

const SIZE_PRESETS = ['S', 'M', 'L', 'XL', 'XXL'];
const list = (s: string) => [...new Set(s.split(/[,|;\n]/).map((x) => x.trim()).filter(Boolean))];

/** One-screen product creation: SKUs, description, tags, slug and tax code are generated for the seller. */
export default function QuickAddPage() {
  const { toast } = useSeller();
  const router = useRouter();
  const [tree, setTree] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [f, setF] = useState({ name: '', categoryId: '', price: '', mrp: '', colors: '', sizes: '', stock: '10', brand: '', material: '', description: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    sellerApi<Category[]>('/seller/categories').then(setTree);
  }, []);

  const upload = async (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      try {
        const url = await sellerClient.uploadImage(file);
        setImages((i) => [...i, url]);
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Upload failed', true);
      }
    }
  };

  const toggleSize = (s: string) => {
    const cur = list(f.sizes);
    setF((p) => ({ ...p, sizes: (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]).join(', ') }));
  };

  const submit = async (publish: boolean) => {
    if (!f.name.trim()) return toast('Enter the product name', true);
    if (!f.categoryId) return toast('Choose a category', true);
    const price = Math.round(Number(f.price) * 100);
    if (!(price >= 100)) return toast('Enter the price', true);
    const mrp = f.mrp ? Math.round(Number(f.mrp) * 100) : undefined;
    if (mrp !== undefined && mrp < price) return toast('MRP cannot be less than the price', true);
    if (publish && !images.length) return toast('Add at least one photo to publish', true);
    setBusy(true);
    try {
      await sellerApi('/seller/products/quick', {
        method: 'POST',
        body: {
          name: f.name,
          categoryId: f.categoryId,
          price,
          mrp,
          colors: list(f.colors),
          sizes: list(f.sizes),
          stock: Math.max(0, Math.floor(Number(f.stock) || 0)),
          images,
          brand: f.brand || undefined,
          material: f.material || undefined,
          description: f.description || undefined,
          publish,
        },
      });
      toast(publish ? 'Product submitted' : 'Saved as draft');
      router.push('/seller/products');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Quick add product"
        subtitle="Just the basics — we create the SKUs, description and search tags for you."
        actions={<Link href="/seller/products/new" className="btn-outline">Full editor</Link>}
      />
      <div className="card space-y-5 p-5">
        <div>
          <p className="mb-2 text-sm font-semibold">Photos</p>
          <div className="flex flex-wrap gap-3">
            {images.map((u, i) => (
              <div key={u} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-28 w-24 rounded border object-cover" />
                <button type="button" aria-label="Remove photo" className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-red-600 text-xs text-white" onClick={() => setImages((x) => x.filter((_, j) => j !== i))}>×</button>
                {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-[10px] text-white">Main</span>}
              </div>
            ))}
            <label className="flex h-28 w-24 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed text-xs text-gray-500 hover:bg-gray-50">
              <span className="text-2xl">＋</span>Add photos
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
        </div>

        <Field label="Product name"><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Cotton Printed Kurta" /></Field>
        <Field label="Category">
          <select className="input" value={f.categoryId} onChange={set('categoryId')}>
            <option value="">Choose…</option>
            {flattenCategories(tree).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Your price (₹)" hint="Shipping is added automatically"><input className="input" type="number" min="1" step="0.01" value={f.price} onChange={set('price')} /></Field>
          <Field label="MRP (₹)" hint="Optional — shown struck-through"><input className="input" type="number" min="1" step="0.01" value={f.mrp} onChange={set('mrp')} /></Field>
          <Field label="Stock (each size / colour)"><input className="input" type="number" min="0" value={f.stock} onChange={set('stock')} /></Field>
        </div>
        <div>
          <Field label="Sizes" hint="Leave empty if the product has no sizes">
            <input className="input" value={f.sizes} onChange={set('sizes')} placeholder="S, M, L, XL" />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            {SIZE_PRESETS.map((s) => (
              <button type="button" key={s} onClick={() => toggleSize(s)} className={`rounded border px-3 py-1 text-xs font-semibold ${list(f.sizes).includes(s) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'text-gray-600'}`}>{s}</button>
            ))}
          </div>
        </div>
        <Field label="Colours" hint="Comma separated. Leave empty if there is only one"><input className="input" value={f.colors} onChange={set('colors')} placeholder="Black, White, Navy" /></Field>

        <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setMore((m) => !m)}>{more ? '− Hide' : '+ Add'} brand, fabric &amp; description (optional)</button>
        {more && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand"><input className="input" value={f.brand} onChange={set('brand')} /></Field>
              <Field label="Material / fabric"><input className="input" value={f.material} onChange={set('material')} /></Field>
            </div>
            <Field label="Description" hint="Skip it and we write a basic one for you"><textarea className="input" rows={4} value={f.description} onChange={set('description')} /></Field>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t pt-4">
          <button className="btn-primary" disabled={busy} onClick={() => void submit(true)}>{busy ? 'Saving…' : 'Publish'}</button>
          <button className="btn-outline" disabled={busy} onClick={() => void submit(false)}>Save as draft</button>
        </div>
      </div>
    </div>
  );
}
