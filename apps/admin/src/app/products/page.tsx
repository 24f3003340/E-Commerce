'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Badge, Empty, PageHeader, Pager, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDate, inr } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  status: string;
  reviewNote: string | null;
  seller: { id: string; storeName: string } | null;
  isFeatured: boolean;
  price: number;
  mrp: number;
  image: string | null;
  variantCount: number;
  totalStock: number;
  categories: string[];
  updatedAt: string;
}

function Products() {
  const { toast } = useAdmin();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [sellerId, setSellerId] = useState(params.get('sellerId') ?? '');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ProductRow> | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    if (sellerId) qs.set('sellerId', sellerId);
    const t = setTimeout(() => api<Paginated<ProductRow>>(`/admin/products?${qs}`).then(setData), 250);
    return () => clearTimeout(t);
  }, [q, status, sellerId, page, reload]);

  const remove = async (p: ProductRow) => {
    if (!confirm(`Delete "${p.name}"? Products that were ordered are archived instead.`)) return;
    try {
      const res = await api<{ archived: boolean }>(`/admin/products/${p.id}`, { method: 'DELETE' });
      toast(res.archived ? 'Product archived (it has orders)' : 'Product deleted');
      setReload((r) => r + 1);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed', true);
    }
  };

  return (
    <div>
      <PageHeader title="Products" subtitle={data ? `${data.total} products` : undefined} actions={<Link href="/products/new" className="btn-primary">+ Add product</Link>} />
      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <input className="input max-w-sm" placeholder="Search name, brand or SKU" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search products" />
        <select className="input max-w-[180px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="">All statuses</option>
          <option value="PENDING_APPROVAL">Waiting for approval</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="REJECTED">Rejected</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select className="input max-w-[200px]" value={sellerId} onChange={(e) => { setSellerId(e.target.value); setPage(1); }} aria-label="Sold by">
          <option value="">All sellers</option>
          <option value="store">Own store products</option>
          {params.get('sellerId') && params.get('sellerId') !== 'store' && <option value={params.get('sellerId')!}>This seller only</option>}
        </select>
      </div>
      {!data ? <Spinner /> : !data.items.length ? <Empty text="No products found." /> : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Product</th><th>Sold by</th><th>Category</th><th>Price</th><th>Variants</th><th>Stock</th><th>Status</th><th>Updated</th><th /></tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td>
                    <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image ?? ''} alt="" className="h-12 w-10 rounded bg-gray-100 object-cover" />
                      <span><span className="font-semibold text-gray-900 hover:text-brand-700">{p.name}</span>{p.isFeatured && <span className="ml-1 text-amber-500" title="Featured">★</span>}<span className="block text-xs text-gray-500">{p.brand}</span></span>
                    </Link>
                  </td>
                  <td className="text-xs">{p.seller ? <Link href={`/sellers/${p.seller.id}`} className="text-brand-700">{p.seller.storeName}</Link> : <span className="text-gray-500">Own store</span>}</td>
                  <td className="text-xs text-gray-600">{p.categories.join(', ')}</td>
                  <td>{inr(p.price)}<span className="block text-xs text-gray-400 line-through">{p.mrp > p.price ? inr(p.mrp) : ''}</span></td>
                  <td>{p.variantCount}</td>
                  <td className={p.totalStock === 0 ? 'font-semibold text-red-600' : ''}>{p.totalStock}</td>
                  <td><Badge value={p.status} /></td>
                  <td className="whitespace-nowrap text-xs">{formatDate(p.updatedAt)}</td>
                  <td className="whitespace-nowrap text-right">
                    <Link href={`/products/${p.id}`} className="mr-3 text-xs font-semibold text-brand-700">{p.status === 'PENDING_APPROVAL' ? 'Review' : 'Edit'}</Link>
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

export default function ProductsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Products />
    </Suspense>
  );
}
