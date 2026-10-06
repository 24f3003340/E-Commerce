import Link from 'next/link';
import { HeroCarousel } from '@/components/HeroCarousel';
import { ProductGrid } from '@/components/ProductCard';
import { serverGetSafe } from '@/lib/server';
import type { Banner, Category, ProductListResponse } from '@/lib/types';

const empty = { items: [] } as unknown as ProductListResponse;

export default async function HomePage() {
  const [hero, offers, categories, trending, newArrivals] = await Promise.all([
    serverGetSafe<Banner[]>('/banners?position=HERO', []),
    serverGetSafe<Banner[]>('/banners?position=OFFER', []),
    serverGetSafe<Category[]>('/categories', []),
    serverGetSafe<ProductListResponse>('/products?sort=popular&limit=8', empty),
    serverGetSafe<ProductListResponse>('/products?sort=newest&limit=8', empty),
  ]);

  return (
    <div className="container space-y-14 py-6">
      <HeroCarousel banners={hero} />

      <section>
        <h2 className="mb-5 text-center text-xl font-bold uppercase tracking-wider">Shop by category</h2>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {categories.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="group text-center">
              <div className="mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-full bg-brand-50">
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                )}
              </div>
              <p className="mt-2 text-sm font-semibold">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {trending.items.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-xl font-bold">Trending now</h2>
            <Link href="/search?sort=popular" className="text-sm font-semibold text-brand-700">
              View all →
            </Link>
          </div>
          <ProductGrid products={trending.items} />
        </section>
      )}

      {offers.map((b) => (
        <Link key={b.id} href={b.linkUrl ?? '/search'} className="relative block overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.imageUrl} alt="" className="h-40 w-full object-cover sm:h-56" />
          <div className="absolute inset-0 flex flex-col justify-center p-6 text-white sm:p-10">
            <p className="text-2xl font-extrabold sm:text-4xl">{b.title}</p>
            {b.subtitle && <p className="mt-1 text-sm opacity-90 sm:text-base">{b.subtitle}</p>}
          </div>
        </Link>
      ))}

      {newArrivals.items.length > 0 && (
        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-xl font-bold">New arrivals</h2>
            <Link href="/search?sort=newest" className="text-sm font-semibold text-brand-700">
              View all →
            </Link>
          </div>
          <ProductGrid products={newArrivals.items} />
        </section>
      )}

      <section className="grid gap-4 rounded-xl bg-gray-50 p-6 text-center sm:grid-cols-3">
        {[
          ['🚚', 'Free delivery', 'On orders above ₹999'],
          ['↩️', 'Easy returns', '7-day hassle-free returns'],
          ['🔒', 'Secure payments', 'UPI, cards, net banking & COD'],
        ].map(([icon, title, text]) => (
          <div key={title}>
            <div className="text-2xl">{icon}</div>
            <p className="mt-1 font-semibold">{title}</p>
            <p className="text-sm text-gray-500">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
