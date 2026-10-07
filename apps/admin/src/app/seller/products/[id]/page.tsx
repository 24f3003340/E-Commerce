'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProductForm, type ProductRecord } from '@/components/ProductForm';
import { useSeller } from '@/components/SellerShell';
import { Badge, PageHeader, Spinner } from '@/components/ui';
import { sellerApi, sellerClient } from '@/lib/sellerApi';

export default function SellerProductPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useSeller();
  const isNew = id === 'new';
  const [product, setProduct] = useState<ProductRecord | null>(null);

  useEffect(() => {
    if (!isNew) sellerApi<ProductRecord>(`/seller/products/${id}`).then(setProduct);
  }, [id, isNew]);

  if (!isNew && !product) return <Spinner />;
  return (
    <div>
      <PageHeader title={isNew ? 'Add product' : `Edit: ${product?.name}`} actions={product ? <Badge value={product.status} /> : undefined} />
      <ProductForm key={product?.id ?? 'new'} product={product ?? undefined} toast={toast} mode="seller" client={sellerClient} />
    </div>
  );
}
