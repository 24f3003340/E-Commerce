import type { Metadata } from 'next';
import { ProductGrid } from '@/components/ProductCard';
import { Breadcrumbs, Stars } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { serverGet } from '@/lib/server';
import type { ProductDetail } from '@/lib/types';
import { ProductPurchase } from './ProductPurchase';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await serverGet<ProductDetail>(`/products/${slug}`);
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: { images: product.images[0] ? [product.images[0].url] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await serverGet<ProductDetail>(`/products/${slug}`);
  const total = Object.values(product.ratingBreakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="container py-6">
      <Breadcrumbs items={[...product.breadcrumbs.map((b) => ({ label: b.name, href: `/c/${b.slug}` })), { label: product.name }]} />
      <ProductPurchase product={product} />

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">Product details</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{product.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {product.material && (
              <div className="border-b pb-2">
                <dt className="text-gray-500">Material</dt>
                <dd className="font-medium">{product.material}</dd>
              </div>
            )}
            {Object.entries(product.specifications ?? {}).map(([k, v]) => (
              <div key={k} className="border-b pb-2">
                <dt className="text-gray-500">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="reviews">
          <h2 className="mb-3 text-lg font-bold">Ratings & reviews</h2>
          {product.ratingCount > 0 ? (
            <>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-4xl font-bold">{product.ratingAvg.toFixed(1)}★</p>
                  <p className="text-xs text-gray-500">{product.ratingCount} ratings</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((r) => {
                    const n = product.ratingBreakdown[r] ?? 0;
                    return (
                      <div key={r} className="flex items-center gap-2 text-xs">
                        <span className="w-6">{r}★</span>
                        <div className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
                          <div className="h-full bg-emerald-500" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                        </div>
                        <span className="w-6 text-right text-gray-500">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <ul className="mt-6 space-y-4">
                {product.reviews.map((r) => (
                  <li key={r.id} className="border-b pb-4">
                    <div className="flex items-center gap-2">
                      <Stars value={r.rating} small />
                      {r.title && <span className="text-sm font-semibold">{r.title}</span>}
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-gray-700">{r.comment}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {r.author} · {formatDate(r.createdAt)} {r.verifiedPurchase && <span className="text-emerald-700">· ✓ Verified buyer</span>}
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

      {product.related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-lg font-bold">You may also like</h2>
          <ProductGrid products={product.related.slice(0, 4)} />
        </section>
      )}
    </div>
  );
}
