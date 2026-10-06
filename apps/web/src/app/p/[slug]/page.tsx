import type { Metadata } from 'next';
import { ProductRail } from '@/components/ProductRail';
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
    <div className="container space-y-12 py-6 pb-28 lg:pb-6">
      <Breadcrumbs items={[...product.breadcrumbs.map((b) => ({ label: b.name, href: `/c/${b.slug}` })), { label: product.name }]} />
      <ProductPurchase product={product} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="section-title mb-3">The details</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{product.description}</p>
          <h3 className="mb-2 mt-6 text-base font-bold">Specifications</h3>
          <dl className="overflow-hidden rounded-xl border border-ink-100 text-sm">
            {product.material && (
              <div className="grid grid-cols-[40%_60%] border-b border-ink-100 last:border-0">
                <dt className="bg-ink-50 px-3 py-2 text-ink-500">Material</dt>
                <dd className="px-3 py-2 font-medium">{product.material}</dd>
              </div>
            )}
            {product.brand && (
              <div className="grid grid-cols-[40%_60%] border-b border-ink-100 last:border-0">
                <dt className="bg-ink-50 px-3 py-2 text-ink-500">Brand</dt>
                <dd className="px-3 py-2 font-medium">{product.brand}</dd>
              </div>
            )}
            {Object.entries(product.specifications ?? {}).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[40%_60%] border-b border-ink-100 last:border-0">
                <dt className="bg-ink-50 px-3 py-2 text-ink-500">{k}</dt>
                <dd className="px-3 py-2 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="reviews" className="rounded-3xl bg-white p-6 shadow-card">
          <h2 className="section-title mb-4">What people say</h2>
          {product.ratingCount > 0 ? (
            <>
              <div className="flex items-center gap-8 border-b border-ink-100 pb-5">
                <div className="text-center">
                  <p className="text-4xl font-bold">
                    {product.ratingAvg.toFixed(1)}
                    <span className="text-2xl text-ink-300">★</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {product.ratingCount} rating{product.ratingCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((r) => {
                    const n = product.ratingBreakdown[r] ?? 0;
                    return (
                      <div key={r} className="flex items-center gap-2 text-xs">
                        <span className="w-6 font-medium">{r}★</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                          <div className={`h-full rounded-full ${r >= 3 ? 'bg-sage-500' : r === 2 ? 'bg-butter-400' : 'bg-brand-500'}`} style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                        </div>
                        <span className="w-6 text-right text-ink-500">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <ul className="divide-y divide-ink-100">
                {product.reviews.map((r) => (
                  <li key={r.id} className="py-4">
                    <div className="flex items-center gap-2">
                      <Stars value={r.rating} small />
                      {r.title && <span className="text-sm font-semibold">{r.title}</span>}
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-ink-700">{r.comment}</p>}
                    <p className="mt-2 text-xs text-ink-500">
                      {r.author} · {formatDate(r.createdAt)} {r.verifiedPurchase && <span className="font-medium text-sage-700">· ✓ Verified buyer</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-500">No reviews yet. Buy this product and be the first to review it.</p>
          )}
        </section>
      </div>

      <ProductRail eyebrow="Pairs well" title="You might also like" products={product.related} />
    </div>
  );
}
