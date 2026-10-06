'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useSeller } from '@/components/SellerShell';
import { Badge, Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { ApiError } from '@/lib/client';
import { formatDate, inr } from '@/lib/format';
import { sellerApi } from '@/lib/sellerApi';
import type { Paginated } from '@/lib/types';

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  status: string;
  reviewNote: string | null;
  price: number;
  mrp: number;
  image: string | null;
  variantCount: number;
  totalStock: number;
  categories: string[];
  updatedAt: string;
}

function Products() {
  const { toast } = useSeller();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ProductRow> | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    const t = setTimeout(() => sellerApi<Paginated<ProductRow>>(`/seller/products?${qs}`).then(setData), 250);
    return () => clearTimeout(t);
  }, [q, status, page, reload]);

  const remove = async (p: ProductRow) => {
    if (!confirm(`Delete "${p.name}"? Products that were ordered are archived instead.`)) return;
    try {
      const res = await sellerApi<{ archived: boolean }>(`/seller/products/${p.id}`, { method: 'DELETE' });
      toast(res.archived ? 'Product archived (it has orders)' : 'Product deleted');
      setReload((r) => r + 1);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed', true);
    }
  };

  return (
    <div>
      <PageHeader title="Your products" subtitle={data ? `${data.total} products` : undefined} actions={<Link href="/seller/products/new" className="btn-primary">+ Add product</Link>} />
      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <input className="input max-w-sm" placeholder="Search name, brand or SKU" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search products" />
        <select className="input max-w-[200px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="">All statuses</option>
          <option value="ACTIVE">Live</option>
          <option value="PENDING_APPROVAL">In review</option>
          <option value="REJECTED">Needs changes</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No products yet — add your first product." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td>
                    <Link href={`/seller/products/${p.id}`} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image ?? ''} alt="" className="h-12 w-10 rounded bg-gray-100 object-cover" />
                      <span><span className="font-semibold text-gray-900 hover:text-brand-700">{p.name}</span><span className="block text-xs text-gray-500">{p.variantCount} variants{p.brand ? ` · ${p.brand}` : ''}</span></span>
                    </Link>
                  </td>
                  <td className="text-xs text-gray-600">{p.categories.join(', ')}</td>
                  <td>{inr(p.price)}<span className="block text-xs text-gray-400 line-through">{p.mrp > p.price ? inr(p.mrp) : ''}</span></td>
                  <td className={p.totalStock === 0 ? 'font-semibold text-red-600' : ''}>{p.totalStock}</td>
                  <td>
                    <Badge value={p.status} />
                    {p.status === 'REJECTED' && p.reviewNote && <span className="mt-1 block max-w-[220px] text-xs text-red-700">{p.reviewNote}</span>}
                  </td>
                  <td className="whitespace-nowrap text-xs">{formatDate(p.updatedAt)}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/seller/products/${p.id}`} className="mr-3 text-xs font-semibold text-brand-700">Edit</Link>
                    <button className="text-xs font-semibold text-red-600" onClick={() => void remove(p)}>Delete</button>
                  </td>
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

export default function SellerProductsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Products />
    </Suspense>
  );
}
