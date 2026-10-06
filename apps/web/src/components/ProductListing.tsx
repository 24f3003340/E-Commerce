import { Suspense } from 'react';
import { serverGet } from '@/lib/server';
import type { ProductListResponse } from '@/lib/types';
import { ActiveFilters, Filters, Pagination, SortSelect } from './Filters';
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

  const from = data.total ? (data.page - 1) * data.limit + 1 : 0;
  const to = Math.min(data.page * data.limit, data.total);
  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Suspense>
        <Filters facets={data.facets} />
      </Suspense>
      <div className="min-w-0 space-y-3">
        <div className="card space-y-3 px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-xs text-gray-500">
              (Showing {from}–{to} of {data.total} products)
            </p>
          </div>
          <Suspense>
            <SortSelect />
          </Suspense>
          <Suspense>
            <ActiveFilters />
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
