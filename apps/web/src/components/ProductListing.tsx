import { Suspense } from 'react';
import { serverGet } from '@/lib/server';
import type { ProductListResponse } from '@/lib/types';
import { Filters, Pagination, SortSelect } from './Filters';
import { ProductGrid } from './ProductCard';
import { EmptyState } from './ui';

const ALLOWED = ['q', 'brand', 'size', 'color', 'minPrice', 'maxPrice', 'rating', 'discount', 'inStock', 'sort', 'page'];

export type SearchParams = Record<string, string | string[] | undefined>;

export async function ProductListing({ searchParams, category, title }: { searchParams: SearchParams; category?: string; title: string }) {
  const query = new URLSearchParams();
  for (const key of ALLOWED) {
    const v = searchParams[key];
    if (typeof v === 'string' && v) query.set(key, v);
  }
  if (!query.get('sort')) query.set('sort', 'popular');
  if (category) query.set('category', category);
  query.set('limit', '24');
  const data = await serverGet<ProductListResponse>(`/products?${query.toString()}`);

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <Suspense>
        <Filters facets={data.facets} />
      </Suspense>
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-gray-500">{data.total} products</p>
          </div>
          <Suspense>
            <SortSelect />
          </Suspense>
        </div>
        {data.items.length ? (
          <ProductGrid products={data.items} />
        ) : (
          <EmptyState title="No products found" text="Try removing some filters or searching for something else." />
        )}
        <Suspense>
          <Pagination page={data.page} pages={data.pages} />
        </Suspense>
      </div>
    </div>
  );
}
