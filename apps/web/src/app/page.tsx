import Link from 'next/link';
import { HeroCarousel } from '@/components/HeroCarousel';
import { Icon, type IconName } from '@/components/icons';
import { DealCountdown, ProductRail } from '@/components/ProductRail';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import { CouponStrip, type PublicCoupon } from '@/components/CouponStrip';
import { inr } from '@/lib/format';
import { serverGetSafe } from '@/lib/server';
import type { Banner, Category, ListingProduct, ProductListResponse } from '@/lib/types';

const empty = { items: [], facets: { brands: [] } } as unknown as ProductListResponse;

/** Amazon-style card: a heading and a 2×2 grid of picks from one category. */
function QuadCard({ title, href, products, cta }: { title: string; href: string; products: ListingProduct[]; cta: string }) {
  if (products.length < 2) return null;
  return (
    <div className="card flex flex-col p-4">
      <h3 className="mb-3 font-display text-lg font-extrabold">{title}</h3>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {products.slice(0, 4).map((p) => (
          <Link key={p.id} href={`/p/${p.slug}`} className="group">
            <div className="aspect-square overflow-hidden rounded-xl border-2 border-black bg-brand-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.images[0]?.url} alt={p.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-gray-700">{p.name}</p>
            <p className="text-xs font-extrabold text-hot-500">{p.discountPct ? `Min. ${p.discountPct}% off` : inr(p.price)}</p>
          </Link>
        ))}
      </div>
      <Link href={href} className="btn-outline mt-4 w-full py-2 text-xs">
        {cta}
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const categories = await serverGetSafe<Category[]>('/categories', []);
  const [hero, offers, deals, trending, newArrivals, budget, topRated, ...byCategory] = await Promise.all([
    serverGetSafe<Banner[]>('/banners?position=HERO', []),
    serverGetSafe<Banner[]>('/banners?position=OFFER', []),
    serverGetSafe<ProductListResponse>('/products?sort=discount&inStock=true&limit=12', empty),
    serverGetSafe<ProductListResponse>('/products?sort=popular&limit=12', empty),
    serverGetSafe<ProductListResponse>('/products?sort=newest&limit=12', empty),
    serverGetSafe<ProductListResponse>('/products?maxPrice=99900&sort=popular&limit=12', empty),
    serverGetSafe<ProductListResponse>('/products?sort=rating&limit=12', empty),
    ...categories.slice(0, 4).map((c) => serverGetSafe<ProductListResponse>(`/products?category=${c.slug}&sort=popular&limit=4`, empty)),
  ]);
  const coupons = await serverGetSafe<PublicCoupon[]>('/coupons', []);
  const brands = trending.facets?.brands ?? [];

  return (
    <div className="container space-y-4 py-4">
      {/* Category icons strip */}
      <nav className="card flex gap-2 overflow-x-auto px-3 py-3 scrollbar-none sm:justify-around" aria-label="Shop by category">
        {categories.map((c) => (
          <Link key={c.id} href={`/c/${c.slug}`} className="group flex w-20 shrink-0 flex-col items-center text-center sm:w-24">
            <span className="h-16 w-16 overflow-hidden rounded-full border-2 border-black bg-accent-100 shadow-brutal-sm transition group-hover:-translate-y-1 group-hover:bg-accent-400 sm:h-20 sm:w-20">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="mt-2 text-xs font-extrabold text-black sm:text-sm">{c.name}</span>
          </Link>
        ))}
        <Link href="/search?sort=discount" className="group flex w-20 shrink-0 flex-col items-center text-center sm:w-24">
          <span className="flex h-16 w-16 animate-wiggle items-center justify-center rounded-full border-2 border-black bg-hot-500 text-white shadow-brutal-sm motion-reduce:animate-none sm:h-20 sm:w-20">
            <Icon name="zap" className="h-8 w-8" />
          </span>
          <span className="mt-2 text-xs font-extrabold text-hot-600 sm:text-sm">Top Offers</span>
        </Link>
      </nav>

      <HeroCarousel banners={hero} />

      {/* Category quad cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.slice(0, 4).map((c, i) => (
          <QuadCard key={c.id} title={`${c.name} — upto ${Math.max(0, ...byCategory[i].items.map((p) => p.discountPct))}% off`} href={`/c/${c.slug}`} products={byCategory[i].items} cta={`See all in ${c.name}`} />
        ))}
      </div>

      <CouponStrip coupons={coupons} />

      <RecentlyViewed />

      <ProductRail title="Loot Deals 🔥" href="/search?sort=discount" products={deals.items} aside={<DealCountdown />} />

      {offers.map((b) => (
        <Link key={b.id} href={b.linkUrl ?? '/search'} className="relative block overflow-hidden rounded-3xl border-2 border-black shadow-brutal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.imageUrl} alt="" className="h-32 w-full object-cover sm:h-44" />
          <div className="absolute inset-0 flex items-center justify-between gap-4 px-6 text-white sm:px-12">
            <div>
              <p className="font-display text-3xl font-extrabold sm:text-5xl">{b.title} 🤑</p>
              {b.subtitle && <p className="mt-1 text-sm text-white/90 sm:text-base">{b.subtitle}</p>}
            </div>
            <span className="btn-cart hidden shrink-0 rotate-[-2deg] sm:inline-flex">{b.ctaText ?? 'Shop now'}</span>
          </div>
        </Link>
      ))}

      <ProductRail title="Trending rn 📈" href="/search?sort=popular" products={trending.items} />
      <ProductRail title="Under ₹999 — pocket friendly 💸" href="/search?maxPrice=99900&sort=popular" products={budget.items} />

      {brands.length > 0 && (
        <section className="card p-4 sm:p-5">
          <h2 className="section-title mb-4">Brands we ❤️</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {brands.slice(0, 12).map((b, i) => (
              <Link
                key={b}
                href={`/search?brand=${encodeURIComponent(b)}`}
                className="group flex h-20 items-center justify-center rounded-2xl border-2 border-black bg-white px-3 text-center shadow-brutal-sm transition hover:-translate-y-0.5 hover:bg-accent-400 hover:shadow-brutal"
              >
                <span className={`text-lg font-extrabold tracking-tight font-display text-black`}>{b}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductRail title="Sabka favourite ⭐" href="/search?sort=rating" products={topRated.items} />
      <ProductRail title="Fresh Drops ✨" href="/search?sort=newest" products={newArrivals.items} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ['truck', 'Free Delivery 🚚', '₹999+ ke orders pe'],
            ['returns', 'Easy Returns 🔁', '7 din, no tension'],
            ['shield', 'Safe Payments 🔒', 'UPI, cards, COD'],
            ['headset', 'Help 24x7 💬', 'Hum hain na!'],
          ] as [IconName, string, string][]
        ).map(([icon, title, text]) => (
          <div key={title} className="card flex items-center gap-3 p-4 sm:p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-accent-400 text-black">
              <Icon name={icon} />
            </span>
            <span>
              <span className="block text-sm font-bold">{title}</span>
              <span className="block text-xs text-gray-500">{text}</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
