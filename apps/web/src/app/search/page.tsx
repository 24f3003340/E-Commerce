import type { Metadata } from 'next';
import { ProductListing, type SearchParams } from '@/components/ProductListing';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  return (
    <div className="container py-4">
      <ProductListing searchParams={params} title={q ? `Results for “${q}”` : 'All products'} />
    </div>
  );
}
