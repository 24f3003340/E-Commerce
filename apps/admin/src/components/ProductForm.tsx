'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminClient } from '@/lib/api';
import { flattenCategories } from '@/lib/categories';
import { ApiError, type ApiClient } from '@/lib/client';
import type { Category } from '@/lib/types';
import { Field } from './ui';

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? 'http://localhost:3000';

interface VariantRow {
  id?: string;
  sku: string;
  barcode: string;
  color: string;
  colorHex: string;
  size: string;
  price: string; // rupees in the form
  mrp: string;
  stock: string;
  isActive: boolean;
  currentStock?: number;
}

interface ImageRow {
  url: string;
  alt: string;
  color: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  brand: string | null;
  material: string | null;
  specifications: Record<string, string> | null;
  sizeChart: Record<string, string>[] | null;
  videoUrl: string | null;
  hsnCode: string | null;
  tags: string[];
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED';
  reviewNote?: string | null;
  sellerId?: string | null;
  seller?: { id: string; storeName: string; status: string } | null;
  isFeatured: boolean;
  categories: { categoryId: string; isPrimary: boolean }[];
  images: { url: string; alt: string | null; color: string | null }[];
  variants: { id: string; sku: string; barcode: string | null; color: string | null; colorHex: string | null; size: string | null; price: number; mrp: number; stock: number; isActive: boolean }[];
}

const toRupees = (p: number) => String(p / 100);
const toPaise = (r: string) => Math.round(Number(r) * 100);

/**
 * Product editor shared by the admin panel and the marketplace seller panel. Sellers cannot feature
 * products, and "Publish" sends their product for review when the marketplace requires approval.
 */
export function ProductForm({
  product,
  toast,
  mode = 'admin',
  client = adminClient,
}: {
  product?: ProductRecord;
  toast: (text: string, error?: boolean) => void;
  mode?: 'admin' | 'seller';
  client?: ApiClient;
}) {
  const router = useRouter();
  const { api, uploadImage } = client;
  const seller = mode === 'seller';
  const apiBase = seller ? '/seller' : '/admin';
  const pageBase = seller ? '/seller/products' : '/products';
  // Sellers ask to "publish"; whether that means live or "in review" is decided by the API
  const initialStatus = seller && (product?.status === 'PENDING_APPROVAL' || product?.status === 'REJECTED') ? 'ACTIVE' : (product?.status ?? 'DRAFT');
  const [tree, setTree] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    description: product?.description ?? '',
    brand: product?.brand ?? '',
    material: product?.material ?? '',
    videoUrl: product?.videoUrl ?? '',
    hsnCode: product?.hsnCode ?? '',
    tags: product?.tags.join(', ') ?? '',
    status: initialStatus,
    isFeatured: product?.isFeatured ?? false,
    specs: Object.entries(product?.specifications ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n'),
    sizeChart: product?.sizeChart ? JSON.stringify(product.sizeChart, null, 2) : '',
  });
  const [primaryCategory, setPrimaryCategory] = useState(product?.categories.find((c) => c.isPrimary)?.categoryId ?? product?.categories[0]?.categoryId ?? '');
  const [extraCategories, setExtraCategories] = useState<string[]>(product?.categories.filter((c) => !c.isPrimary).map((c) => c.categoryId) ?? []);
  const [images, setImages] = useState<ImageRow[]>(product?.images.map((i) => ({ url: i.url, alt: i.alt ?? '', color: i.color ?? '' })) ?? []);
  const [variants, setVariants] = useState<VariantRow[]>(
    product?.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode ?? '',
      color: v.color ?? '',
      colorHex: v.colorHex ?? '#000000',
      size: v.size ?? '',
      price: toRupees(v.price),
      mrp: toRupees(v.mrp),
      stock: '',
      isActive: v.isActive,
      currentStock: v.stock,
    })) ?? [],
  );
  const [gen, setGen] = useState({ colors: '', sizes: 'S, M, L, XL', price: '', mrp: '', stock: '10', skuPrefix: '' });

  useEffect(() => {
    api<Category[]>(`${apiBase}/categories`).then(setTree);
  }, [api, apiBase]);
  const options = flattenCategories(tree);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const updateVariant = (i: number, patch: Partial<VariantRow>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  /** Builds every colour × size combination (e.g. Black / S … White / XL). */
  const generate = () => {
    const colors = gen.colors.split(',').map((s) => s.trim()).filter(Boolean);
    const sizes = gen.sizes.split(',').map((s) => s.trim()).filter(Boolean);
    if (!gen.price || !gen.mrp) return toast('Enter price and MRP for the generator', true);
    // SKUs are unique across the whole marketplace, so the default prefix gets a short random tag
    const prefix = (gen.skuPrefix || `${form.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'SKU'}${Math.random().toString(36).slice(2, 5)}`).toUpperCase();
    const rows: VariantRow[] = [];
    for (const c of colors.length ? colors : ['']) {
      const [name, hex] = c.split(':').map((s) => s.trim());
      for (const s of sizes.length ? sizes : ['']) {
        const exists = variants.some((v) => v.color.toLowerCase() === (name ?? '').toLowerCase() && v.size.toLowerCase() === s.toLowerCase());
        if (exists) continue;
        rows.push({
          sku: [prefix, name?.replace(/\s+/g, '').slice(0, 3).toUpperCase(), s.replace(/[^A-Za-z0-9]/g, '').toUpperCase()].filter(Boolean).join('-'),
          barcode: '',
          color: name ?? '',
          colorHex: hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000',
          size: s,
          price: gen.price,
          mrp: gen.mrp,
          stock: gen.stock,
          isActive: true,
        });
      }
    }
    setVariants((v) => [...v, ...rows]);
  };

  const onUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const url = await uploadImage(file);
        setImages((imgs) => [...imgs, { url, alt: '', color: '' }]);
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Upload failed', true);
      }
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryCategory) return toast('Choose a primary category', true);
    if (!variants.length) return toast('Add at least one variant', true);
    let sizeChart: unknown;
    if (form.sizeChart.trim()) {
      try {
        sizeChart = JSON.parse(form.sizeChart);
        if (!Array.isArray(sizeChart)) throw new Error();
      } catch {
        return toast('Size chart must be a JSON array of rows', true);
      }
    }
    const specifications = Object.fromEntries(
      form.specs.split('\n').map((l) => l.split(':')).filter((p) => p.length >= 2 && p[0].trim()).map(([k, ...v]) => [k.trim(), v.join(':').trim()]),
    );
    const body = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description,
      brand: form.brand || undefined,
      material: form.material || undefined,
      videoUrl: form.videoUrl || undefined,
      hsnCode: form.hsnCode || undefined,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status: form.status,
      isFeatured: form.isFeatured,
      specifications,
      sizeChart,
      categoryIds: [primaryCategory, ...extraCategories.filter((c) => c !== primaryCategory)],
      images: images.map((i) => ({ url: i.url, alt: i.alt || undefined, color: i.color || undefined })),
      variants: variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        barcode: v.barcode || undefined,
        color: v.color || undefined,
        colorHex: v.color ? v.colorHex : undefined,
        size: v.size || undefined,
        price: toPaise(v.price),
        mrp: toPaise(v.mrp),
        stock: v.id ? undefined : Number(v.stock || 0),
        isActive: v.isActive,
      })),
    };
    setBusy(true);
    try {
      const saved = await api<ProductRecord>(product ? `${apiBase}/products/${product.id}` : `${apiBase}/products`, { method: product ? 'PUT' : 'POST', body });
      toast(saved.status === 'PENDING_APPROVAL' ? 'Saved and sent for review' : 'Product saved');
      if (!product) router.replace(`${pageBase}/${saved.id}`);
      else window.location.reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', true);
    } finally {
      setBusy(false);
    }
  };

  const colorsInVariants = [...new Set(variants.map((v) => v.color).filter(Boolean))];

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card space-y-4 p-5 xl:col-span-2">
          <h2 className="font-bold">Basic information</h2>
          <Field label="Product name"><input className="input" required value={form.name} onChange={set('name')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand"><input className="input" value={form.brand} onChange={set('brand')} /></Field>
            <Field label="Material / fabric"><input className="input" value={form.material} onChange={set('material')} /></Field>
          </div>
          <Field label="Description"><textarea className="input" rows={5} required value={form.description} onChange={set('description')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Specifications" hint="One per line, e.g. Fit: Regular"><textarea className="input font-mono text-xs" rows={5} value={form.specs} onChange={set('specs')} /></Field>
            <Field label="Size chart (JSON, optional)" hint='[{"size":"M","chest":"40"}]'><textarea className="input font-mono text-xs" rows={5} value={form.sizeChart} onChange={set('sizeChart')} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tags" hint="Comma separated, used by search"><input className="input" value={form.tags} onChange={set('tags')} /></Field>
            <Field label="Product video URL (optional)"><input className="input" type="url" value={form.videoUrl} onChange={set('videoUrl')} /></Field>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Organisation</h2>
          {product && product.status !== 'DRAFT' && product.status !== 'ARCHIVED' && product.status !== 'ACTIVE' && (
            <p className={`rounded-md p-3 text-sm ${product.status === 'REJECTED' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
              {product.status === 'REJECTED' ? <>Not approved{product.reviewNote ? `: ${product.reviewNote}` : ''}. {seller ? 'Fix it and save with “Publish” to send it again.' : ''}</> : 'Waiting for review by the marketplace team.'}
            </p>
          )}
          <Field label="Status" hint={seller ? 'Changing name, description, photos or category sends a live product for review again. Price and stock changes go live immediately.' : undefined}>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="DRAFT">Draft (hidden)</option>
              {seller ? (
                <option value="ACTIVE">Publish (goes live after approval)</option>
              ) : (
                <>
                  <option value="ACTIVE">Active (visible in store)</option>
                  {(product?.status === 'PENDING_APPROVAL' || product?.status === 'REJECTED') && <option value={product.status}>{product.status === 'REJECTED' ? 'Rejected' : 'Waiting for approval'}</option>}
                </>
              )}
              <option value="ARCHIVED">Archived</option>
            </select>
          </Field>
          {!seller && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} /> Featured / trending</label>}
          <Field label="Primary category">
            <select className="input" required value={primaryCategory} onChange={(e) => setPrimaryCategory(e.target.value)}>
              <option value="">Select…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Also show in" hint="Hold Ctrl / Cmd to select several">
            <select multiple className="input h-40" value={extraCategories} onChange={(e) => setExtraCategories(Array.from(e.target.selectedOptions).map((o) => o.value))}>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="URL slug" hint="Leave empty to generate from the name"><input className="input" value={form.slug} onChange={set('slug')} /></Field>
          <Field label="HSN code (GST)" hint="e.g. 6109 for T-shirts. Empty = store default"><input className="input" inputMode="numeric" value={form.hsnCode} onChange={set('hsnCode')} /></Field>
          {product && product.status === 'ACTIVE' && <a href={`${STORE_URL}/p/${product.slug}`} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-brand-700">View in store ↗</a>}
        </section>
      </div>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Images</h2>
          <label className="btn-outline btn-sm cursor-pointer">
            Upload images
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void onUpload(e.target.files)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((img, i) => (
            <div key={i} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="aspect-[3/4] w-full rounded bg-gray-100 object-cover" />
              <select className="input py-1 text-xs" value={img.color} onChange={(e) => setImages((imgs) => imgs.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} aria-label="Image colour">
                <option value="">All colours</option>
                {colorsInVariants.map((c) => <option key={c}>{c}</option>)}
              </select>
              <div className="flex justify-between text-xs">
                <button type="button" disabled={i === 0} onClick={() => setImages((imgs) => { const n = [...imgs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>← Move</button>
                <button type="button" className="text-red-600" onClick={() => setImages((imgs) => imgs.filter((_, j) => j !== i))}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input id="imgurl" className="input" placeholder="…or paste an image URL" />
          <button type="button" className="btn-outline" onClick={() => { const el = document.getElementById('imgurl') as HTMLInputElement; if (el.value) { setImages((imgs) => [...imgs, { url: el.value, alt: '', color: '' }]); el.value = ''; } }}>Add</button>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-bold">Variants (colour × size)</h2>
        <div className="grid gap-3 rounded-md bg-gray-50 p-4 md:grid-cols-6">
          <Field label="Colours" hint="Black:#111111, White:#ffffff"><input className="input" value={gen.colors} onChange={(e) => setGen((g) => ({ ...g, colors: e.target.value }))} /></Field>
          <Field label="Sizes"><input className="input" value={gen.sizes} onChange={(e) => setGen((g) => ({ ...g, sizes: e.target.value }))} /></Field>
          <Field label="Price (₹)"><input className="input" type="number" min="1" value={gen.price} onChange={(e) => setGen((g) => ({ ...g, price: e.target.value }))} /></Field>
          <Field label="MRP (₹)"><input className="input" type="number" min="1" value={gen.mrp} onChange={(e) => setGen((g) => ({ ...g, mrp: e.target.value }))} /></Field>
          <Field label="Stock each"><input className="input" type="number" min="0" value={gen.stock} onChange={(e) => setGen((g) => ({ ...g, stock: e.target.value }))} /></Field>
          <div className="flex items-end"><button type="button" className="btn-dark w-full" onClick={generate}>Generate variants</button></div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>SKU</th><th>Colour</th><th>Size</th><th>Price ₹</th><th>MRP ₹</th><th>Stock</th><th>Barcode</th><th>Active</th><th /></tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={v.id ?? i}>
                  <td><input className="input w-40 font-mono text-xs" required value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} aria-label="SKU" /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <input type="color" value={v.colorHex} onChange={(e) => updateVariant(i, { colorHex: e.target.value })} className="h-8 w-8 rounded" aria-label="Colour swatch" />
                      <input className="input w-24" value={v.color} onChange={(e) => updateVariant(i, { color: e.target.value })} aria-label="Colour" />
                    </div>
                  </td>
                  <td><input className="input w-20" value={v.size} onChange={(e) => updateVariant(i, { size: e.target.value })} aria-label="Size" /></td>
                  <td><input className="input w-24" type="number" min="1" step="0.01" required value={v.price} onChange={(e) => updateVariant(i, { price: e.target.value })} aria-label="Price" /></td>
                  <td><input className="input w-24" type="number" min="1" step="0.01" required value={v.mrp} onChange={(e) => updateVariant(i, { mrp: e.target.value })} aria-label="MRP" /></td>
                  <td>
                    {v.id ? <span title="Change stock from Inventory">{v.currentStock}</span> : <input className="input w-20" type="number" min="0" value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })} aria-label="Initial stock" />}
                  </td>
                  <td><input className="input w-28" value={v.barcode} onChange={(e) => updateVariant(i, { barcode: e.target.value })} aria-label="Barcode" /></td>
                  <td><input type="checkbox" checked={v.isActive} onChange={(e) => updateVariant(i, { isActive: e.target.checked })} aria-label="Active" /></td>
                  <td><button type="button" className="text-xs text-red-600" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {product && <p className="text-xs text-gray-500">Stock of existing variants is changed from the Inventory page so every change is logged.</p>}
      </section>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-white/95 px-4 py-3 lg:-mx-8 lg:px-8">
        <button type="button" className="btn-outline" onClick={() => router.push(pageBase)}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
      </div>
    </form>
  );
}
