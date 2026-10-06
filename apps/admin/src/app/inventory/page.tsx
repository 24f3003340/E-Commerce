'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Empty, Field, Modal, PageHeader, Pager, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface VariantRow {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  stock: number;
  reserved: number;
  isActive: boolean;
  product: { id: string; name: string; status: string };
}

interface Movement {
  id: string;
  change: number;
  reason: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

function Inventory() {
  const { toast } = useAdmin();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [lowStock, setLowStock] = useState(params.get('lowStock') === 'true');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<VariantRow> | null>(null);
  const [adjusting, setAdjusting] = useState<VariantRow | null>(null);
  const [adj, setAdj] = useState({ change: '', reason: 'RESTOCK', note: '' });
  const [history, setHistory] = useState<{ v: VariantRow; rows: Movement[] } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), limit: '30', lowStock: String(lowStock) });
    if (q) qs.set('q', q);
    const t = setTimeout(() => api<Paginated<VariantRow>>(`/admin/inventory?${qs}`).then(setData), 250);
    return () => clearTimeout(t);
  }, [q, lowStock, page, reload]);

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock per SKU. Reserved = held by orders awaiting payment." />
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-4">
        <input className="input max-w-sm" placeholder="Search SKU or product" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} /> Low stock only (≤ 5)</label>
      </div>
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No variants found." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>SKU</th><th>Product</th><th>Variant</th><th>Available</th><th>Reserved</th><th /></tr></thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id}>
                  <td className="font-mono text-xs">{v.sku}</td>
                  <td><Link href={`/products/${v.product.id}`} className="text-brand-700">{v.product.name}</Link></td>
                  <td>{[v.color, v.size].filter(Boolean).join(' / ')}{!v.isActive && <span className="ml-1 text-xs text-gray-400">(inactive)</span>}</td>
                  <td className={v.stock === 0 ? 'font-bold text-red-600' : v.stock <= 5 ? 'font-bold text-amber-700' : ''}>{v.stock}</td>
                  <td>{v.reserved}</td>
                  <td className="whitespace-nowrap text-right text-xs font-semibold">
                    <button className="mr-3 text-gray-600" onClick={async () => setHistory({ v, rows: await api<Movement[]>(`/admin/inventory/${v.id}/movements`) })}>History</button>
                    <button className="text-brand-700" onClick={() => { setAdjusting(v); setAdj({ change: '', reason: 'RESTOCK', note: '' }); }}>Adjust stock</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}

      {adjusting && (
        <Modal title={`Adjust ${adjusting.sku}`} onClose={() => setAdjusting(null)}>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(`/admin/inventory/${adjusting.id}/adjust`, { method: 'POST', body: { change: Number(adj.change), reason: adj.reason, note: adj.note || undefined } });
                toast('Stock updated');
                setAdjusting(null);
                setReload((r) => r + 1);
              } catch (err) {
                toast(err instanceof ApiError ? err.message : 'Failed', true);
              }
            }}
          >
            <p className="text-sm text-gray-600">Current stock: <span className="font-semibold">{adjusting.stock}</span></p>
            <Field label="Change" hint="Positive to add (e.g. 20), negative to remove (e.g. -3)"><input className="input" type="number" required value={adj.change} onChange={(e) => setAdj((a) => ({ ...a, change: e.target.value }))} /></Field>
            <Field label="Reason">
              <select className="input" value={adj.reason} onChange={(e) => setAdj((a) => ({ ...a, reason: e.target.value }))}>
                <option value="RESTOCK">Restock (new stock received)</option>
                <option value="ADJUSTMENT">Adjustment (damage, audit, loss)</option>
              </select>
            </Field>
            <Field label="Note"><input className="input" value={adj.note} onChange={(e) => setAdj((a) => ({ ...a, note: e.target.value }))} /></Field>
            <button className="btn-primary w-full">Save</button>
          </form>
        </Modal>
      )}
      {history && (
        <Modal title={`Stock history — ${history.v.sku}`} onClose={() => setHistory(null)}>
          <table className="table">
            <thead><tr><th>Date</th><th>Change</th><th>Reason</th><th>Reference</th></tr></thead>
            <tbody>
              {history.rows.map((m) => (
                <tr key={m.id}>
                  <td className="text-xs">{formatDate(m.createdAt, true)}</td>
                  <td className={m.change > 0 ? 'text-emerald-700' : 'text-red-600'}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                  <td className="text-xs">{m.reason.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="text-xs">{m.reference ?? m.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Inventory />
    </Suspense>
  );
}
