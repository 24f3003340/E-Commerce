'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ProductGrid } from '@/components/ProductCard';
import { EmptyState, Spinner } from '@/components/ui';
import { useRequireAuth, useStore } from '@/context/StoreProvider';
import { api } from '@/lib/api';
import type { ListingProduct } from '@/lib/types';

export default function WishlistPage() {
  const { ready } = useRequireAuth();
  const { wishlist } = useStore();
  const [items, setItems] = useState<ListingProduct[] | null>(null);

  useEffect(() => {
    if (ready) api<ListingProduct[]>('/wishlist').then(setItems);
  }, [ready]);

  if (!ready || !items) return <Spinner />;
  const visible = items.filter((p) => wishlist.has(p.id));
  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">My wishlist ({visible.length})</h1>
      {visible.length ? (
        <ProductGrid products={visible} />
      ) : (
        <EmptyState title="Your wishlist is empty" text="Save items you love by tapping the heart icon." action={<Link href="/" className="btn-primary">Discover products</Link>} />
      )}
    </div>
  );
}
