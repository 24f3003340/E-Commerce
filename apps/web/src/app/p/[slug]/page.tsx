import type { Metadata } from 'next';
import { ProductRail } from '@/components/ProductRail';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { Breadcrumbs, Stars } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { serverGet } from '@/lib/server';
import { SITE_URL } from '@/lib/site';
import type { ProductDetail } from '@/lib/types';
import { ProductPurchase } from './ProductPurchase';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await serverGet<ProductDetail>(`/products/${slug}`);
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: { title: product.name, description: product.description.slice(0, 160), images: product.images[0] ? [product.images[0].url] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await serverGet<ProductDetail>(`/products/${slug}`);
  const total = Object.values(product.ratingBreakdown).reduce((a, b) => a + b, 0);
  // Google "Product" rich result: price, availability and rating in search results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.slice(0, 4).map((i) => i.url),
    sku: product.variants[0]?.sku,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: (Math.min(...product.variants.map((v) => v.price)) / 100).toFixed(2),
      highPrice: (Math.max(...product.variants.map((v) => v.price)) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.inStock) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/p/${product.slug}`,
    },
    aggregateRating: product.ratingCount
      ? { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount }
      : undefined,
  };

  return (
    <div className="container space-y-4 py-4 pb-24 lg:pb-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <Breadcrumbs items={[...product.breadcrumbs.map((b) => ({ label: b.name, href: `/c/${b.slug}` })), { label: product.name }]} />
      <ProductPurchase product={product} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="section-title mb-3">Product Description</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{product.description}</p>
          <h3 className="mb-2 mt-6 text-base font-bold">Specifications</h3>
          <dl className="overflow-hidden rounded-md border border-gray-100 text-sm">
            {product.material && (
              <div className="grid grid-cols-[40%_60%] border-b border-gray-100 last:border-0">
                <dt className="bg-gray-50 px-3 py-2 text-gray-500">Material</dt>
                <dd className="px-3 py-2 font-medium">{product.material}</dd>
              </div>
            )}
            {product.brand && (
              <div className="grid grid-cols-[40%_60%] border-b border-gray-100 last:border-0">
                <dt className="bg-gray-50 px-3 py-2 text-gray-500">Brand</dt>
                <dd className="px-3 py-2 font-medium">{product.brand}</dd>
              </div>
            )}
            {Object.entries(product.specifications ?? {}).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[40%_60%] border-b border-gray-100 last:border-0">
                <dt className="bg-gray-50 px-3 py-2 text-gray-500">{k}</dt>
                <dd className="px-3 py-2 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="reviews" className="card p-5">
          <h2 className="section-title mb-4">Ratings & Reviews</h2>
          {product.ratingCount > 0 ? (
            <>
              <div className="flex items-center gap-8 border-b border-gray-100 pb-5">
                <div className="text-center">
                  <p className="text-4xl font-bold">
                    {product.ratingAvg.toFixed(1)}
                    <span className="text-2xl text-gray-400">★</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {product.ratingCount} rating{product.ratingCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((r) => {
                    const n = product.ratingBreakdown[r] ?? 0;
                    return (
                      <div key={r} className="flex items-center gap-2 text-xs">
                        <span className="w-6 font-medium">{r}★</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div className={`h-full rounded-full ${r >= 3 ? 'bg-emerald-500' : r === 2 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                        </div>
                        <span className="w-6 text-right text-gray-500">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <ul className="divide-y divide-gray-100">
                {product.reviews.map((r) => (
                  <li key={r.id} className="py-4">
                    <div className="flex items-center gap-2">
                      <Stars value={r.rating} small />
                      {r.title && <span className="text-sm font-semibold">{r.title}</span>}
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-gray-700">{r.comment}</p>}
                    <p className="mt-2 text-xs text-gray-500">
                      {r.author} · {formatDate(r.createdAt)} {r.verifiedPurchase && <span className="font-medium text-emerald-700">· ✓ Verified buyer</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-500">No reviews yet. Buy this product and be the first to review it.</p>
          )}
        </section>
      </div>

      <ProductRail title="Similar Products" products={product.related} />
      <RecentlyViewed excludeId={product.id} />
    </div>
  );
}
