'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { ProductForm, type ProductRecord } from '@/components/ProductForm';
import { Badge, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

/** Approve / reject a product a marketplace seller submitted. */
function SellerReview({ product, onDone }: { product: ProductRecord; onDone: () => void }) {
  const { toast } = useAdmin();
  const [note, setNote] = useState('');
  const review = async (approve: boolean) => {
    if (!approve && !note.trim()) return toast('Write the reason so the seller can fix it', true);
    try {
      await api(`/admin/products/${product.id}/review`, { method: 'PATCH', body: { approve, note: note || undefined } });
      toast(approve ? 'Product approved' : 'Product rejected');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Failed', true);
    }
  };
  return (
    <section className="card mb-6 flex flex-wrap items-end gap-3 border-amber-200 bg-amber-50/60 p-4">
      <div className="min-w-[220px] flex-1">
        <p className="text-sm font-semibold">
          Sold by <Link href={`/sellers/${product.seller!.id}`} className="text-brand-700">{product.seller!.storeName}</Link>{' '}
          {product.seller!.status !== 'APPROVED' && <Badge value={product.seller!.status} />}
        </p>
        <p className="text-xs text-gray-600">
          {product.status === 'PENDING_APPROVAL' ? 'Check the photos, title, description, category and price, then approve or reject.' : 'You can approve or reject this product at any time.'}
        </p>
        <input className="input mt-2" placeholder="Reason (shown to the seller when rejecting)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={() => void review(true)}>Approve</button>
      <button className="btn-outline text-red-600" onClick={() => void review(false)}>Reject</button>
    </section>
  );
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useAdmin();
  const isNew = id === 'new';
  const [product, setProduct] = useState<ProductRecord | null>(null);

  const load = useCallback(() => api<ProductRecord>(`/admin/products/${id}`).then(setProduct), [id]);
  useEffect(() => {
    if (!isNew) void load();
  }, [isNew, load]);

  if (!isNew && !product) return <Spinner />;
  return (
    <div>
      <PageHeader title={isNew ? 'Add product' : `Edit: ${product?.name}`} actions={product ? <Badge value={product.status} /> : undefined} />
      {product?.seller && <SellerReview product={product} onDone={() => void load()} />}
      <ProductForm key={`${product?.id ?? 'new'}-${product?.status}`} product={product ?? undefined} toast={toast} />
    </div>
  );
}
