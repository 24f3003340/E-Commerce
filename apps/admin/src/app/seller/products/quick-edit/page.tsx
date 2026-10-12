'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSeller } from '@/components/SellerShell';
import { Empty, PageHeader, Spinner } from '@/components/ui';
import { ApiError } from '@/lib/client';
import { sellerApi } from '@/lib/sellerApi';

interface Row { sku: string; product: string; variant: string; price: number; mrp: number; stock: number }
interface RowResult { row: number; ok: boolean; message: string }

/** One table for every variant: edit price and stock in place, then save all changes together. */
export default function QuickEditPage() {
  const { toast } = useSeller();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edits, setEdits] = useState<Record<string, { price?: string; stock?: string }>>({});
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => sellerApi<Row[]>('/seller/products-export').then(setRows);
  useEffect(() => { void load(); }, []);

  const shown = useMemo(() => (rows ?? []).filter((r) => `${r.sku} ${r.product} ${r.variant}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const changed = Object.keys(edits).filter((sku) => {
    const r = rows?.find((x) => x.sku === sku);
    const e = edits[sku];
    return r && ((e.price !== undefined && Number(e.price) !== r.price) || (e.stock !== undefined && Number(e.stock) !== r.stock));
  });

  const save = async () => {
    setBusy(true);
    try {
      const payload = changed.map((sku) => ({ sku, price: edits[sku].price, stock: edits[sku].stock }));
      const results = await sellerApi<RowResult[]>('/seller/products/bulk-update', { method: 'POST', body: { rows: payload } });
      const bad = results.filter((r) => !r.ok);
      toast(bad.length ? `${results.length - bad.length} saved, ${bad.length} failed: ${bad[0].message}` : `${results.length} variants updated`, bad.length > 0);
      setEdits({});
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', true);
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return <Spinner />;
  return (
    <div>
      <PageHeader title="Quick edit prices & stock" subtitle="Change numbers directly in the table, then press Save." actions={<Link href="/seller/products" className="btn-outline">Back</Link>} />
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <input className="input max-w-sm" placeholder="Search product or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <button className="btn-primary ml-auto" disabled={!changed.length || busy} onClick={() => void save()}>{busy ? 'Saving…' : `Save ${changed.length || ''} change${changed.length === 1 ? '' : 's'}`}</button>
      </div>
      {!shown.length ? <Empty text="No variants found." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Product</th><th>Variant</th><th>SKU</th><th>Price ₹</th><th>Stock</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const e = edits[r.sku] ?? {};
                const dirty = changed.includes(r.sku);
                return (
                  <tr key={r.sku} className={dirty ? 'bg-amber-50' : ''}>
                    <td className="font-medium">{r.product}</td>
                    <td className="text-xs">{r.variant}</td>
                    <td className="font-mono text-xs">{r.sku}</td>
                    <td><input className="input w-24" type="number" min="1" step="0.01" value={e.price ?? String(r.price)} onChange={(ev) => setEdits((p) => ({ ...p, [r.sku]: { ...p[r.sku], price: ev.target.value } }))} aria-label={`Price ${r.sku}`} /></td>
                    <td><input className={`input w-24 ${r.stock <= 5 ? 'border-amber-400' : ''}`} type="number" min="0" value={e.stock ?? String(r.stock)} onChange={(ev) => setEdits((p) => ({ ...p, [r.sku]: { ...p[r.sku], stock: ev.target.value } }))} aria-label={`Stock ${r.sku}`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
