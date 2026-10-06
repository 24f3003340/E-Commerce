'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProductForm, type ProductRecord } from '@/components/ProductForm';
import { PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const [product, setProduct] = useState<ProductRecord | null>(null);

  useEffect(() => {
    if (!isNew) api<ProductRecord>(`/admin/products/${id}`).then(setProduct);
  }, [id, isNew]);

  if (!isNew && !product) return <Spinner />;
  return (
    <div>
      <PageHeader title={isNew ? 'Add product' : `Edit: ${product?.name}`} />
      <ProductForm key={product?.id ?? 'new'} product={product ?? undefined} />
    </div>
  );
}
