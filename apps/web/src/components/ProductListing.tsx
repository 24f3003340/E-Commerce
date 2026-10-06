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
    <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
      <Suspense>
        <Filters facets={data.facets} />
      </Suspense>
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {data.total} {data.total === 1 ? 'style' : 'styles'}
              {data.total > data.limit && ` · showing ${from}–${to}`}
            </p>
          </div>
          <Suspense>
            <SortSelect />
          </Suspense>
        </div>
        <Suspense>
          <ActiveFilters />
        </Suspense>
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
