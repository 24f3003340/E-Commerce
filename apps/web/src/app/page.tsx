import Link from 'next/link';
import { HeroCarousel } from '@/components/HeroCarousel';
import { Icon, type IconName } from '@/components/icons';
import { DealCountdown, ProductRail } from '@/components/ProductRail';
import { serverGetSafe } from '@/lib/server';
import type { Banner, Category, ProductListResponse } from '@/lib/types';

const empty = { items: [], facets: { brands: [] } } as unknown as ProductListResponse;
const BUBBLE_BG = ['bg-brand-100', 'bg-sage-100', 'bg-butter-100', 'bg-ink-100', 'bg-brand-50'];

export default async function HomePage() {
  const [categories, hero, offers, fresh, loved, sale, budget, topRated] = await Promise.all([
    serverGetSafe<Category[]>('/categories', []),
    serverGetSafe<Banner[]>('/banners?position=HERO', []),
    serverGetSafe<Banner[]>('/banners?position=OFFER', []),
    serverGetSafe<ProductListResponse>('/products?sort=newest&limit=12', empty),
    serverGetSafe<ProductListResponse>('/products?sort=popular&limit=12', empty),
    serverGetSafe<ProductListResponse>('/products?sort=discount&inStock=true&limit=12', empty),
    serverGetSafe<ProductListResponse>('/products?maxPrice=99900&sort=popular&limit=4', empty),
    serverGetSafe<ProductListResponse>('/products?sort=rating&limit=12', empty),
  ]);
  const brands = loved.facets?.brands ?? [];
  const budgetArt = budget.items[0]?.images[0]?.url;
  const saleArt = sale.items[1]?.images[0]?.url ?? sale.items[0]?.images[0]?.url;

  return (
    <div className="container space-y-16 py-6 sm:space-y-20">
      <HeroCarousel banners={hero} />

      {/* Category bubbles */}
      <section>
        <div className="mb-6 text-center">
          <p className="eyebrow">Find your fit</p>
          <h2 className="section-title mt-1">Shop by category</h2>
        </div>
        <div className="flex justify-start gap-5 overflow-x-auto pb-2 scrollbar-none sm:justify-center sm:gap-8">
          {categories.map((c, i) => (
            <Link key={c.id} href={`/c/${c.slug}`} className="group flex w-24 shrink-0 flex-col items-center sm:w-32">
              <span className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-full ${BUBBLE_BG[i % BUBBLE_BG.length]} transition group-hover:-translate-y-1`}>
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="h-full w-full scale-110 object-cover" />
                )}
              </span>
              <span className="mt-3 font-display text-sm font-bold sm:text-base">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <ProductRail eyebrow="Just landed" title="Fresh drops" href="/search?sort=newest" products={fresh.items} />

      {/* Promo tiles */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link href="/search?maxPrice=99900&sort=popular" className="group relative flex min-h-[260px] overflow-hidden rounded-4xl bg-butter-100 p-8">
          <div className="relative z-10 max-w-[55%]">
            <p className="eyebrow text-ink-700">Pocket friendly</p>
            <p className="mt-2 font-display text-4xl font-extrabold leading-none tracking-tight">Under ₹999</p>
            <p className="mt-3 text-sm text-ink-700">Everyday basics that don&apos;t break the bank.</p>
            <span className="btn-buy mt-6">Shop now</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {budgetArt && <img src={budgetArt} alt="" className="absolute -bottom-6 -right-6 h-[115%] rotate-6 object-contain mix-blend-multiply transition group-hover:rotate-3" />}
        </Link>
        <Link href="/search?sort=discount" className="group relative flex min-h-[260px] overflow-hidden rounded-4xl bg-brand-500 p-8 text-white">
          <div className="relative z-10 max-w-[55%]">
            <p className="eyebrow text-brand-100">Limited time</p>
            <p className="mt-2 font-display text-4xl font-extrabold leading-none tracking-tight">Up to 50% off</p>
            <p className="mt-3 text-sm text-brand-50">Grab your favourites before they&apos;re gone.</p>
            <span className="btn mt-6 bg-white text-ink-900 hover:bg-ink-50">Shop the sale</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {saleArt && <img src={saleArt} alt="" className="absolute -bottom-6 -right-6 h-[115%] -rotate-6 rounded-3xl object-contain opacity-95 transition group-hover:-rotate-3" />}
        </Link>
      </section>

      <ProductRail eyebrow="Customer favourites" title="Most loved" href="/search?sort=popular" products={loved.items} />

      {offers.map((b) => (
        <Link key={b.id} href={b.linkUrl ?? '/search'} className="relative block overflow-hidden rounded-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.imageUrl} alt="" className="h-48 w-full object-cover object-right sm:h-56" />
          <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-12">
            <p className="font-display text-3xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">{b.title}</p>
            {b.subtitle && <p className="mt-2 max-w-md text-sm text-ink-700 sm:text-base">{b.subtitle}</p>}
          </div>
        </Link>
      ))}

      <ProductRail eyebrow="Don't miss out" title="On sale now" href="/search?sort=discount" products={sale.items} aside={<DealCountdown />} />

      {brands.length > 0 && (
        <section className="overflow-hidden rounded-4xl bg-ink-900 py-8">
          <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-ink-300">Brands you&apos;ll love</p>
          <div className="flex w-max animate-marquee gap-12 motion-reduce:animate-none">
            {[...brands, ...brands, ...brands, ...brands].map((b, i) => (
              <Link key={i} href={`/search?brand=${encodeURIComponent(b)}`} aria-hidden={i >= brands.length} tabIndex={i >= brands.length ? -1 : 0} className="font-display text-3xl font-extrabold tracking-tight text-white/90 hover:text-brand-400">
                {b}
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductRail eyebrow="Rated by you" title="Top rated" href="/search?sort=rating" products={topRated.items} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ['truck', 'Free delivery', 'On every order above ₹999', 'bg-sage-100 text-sage-700'],
            ['returns', '7-day returns', 'Changed your mind? No stress.', 'bg-brand-100 text-brand-700'],
            ['card', 'Pay your way', 'UPI, cards, net banking or COD', 'bg-butter-100 text-ink-800'],
            ['shield', 'Safe & secure', 'Your payments are protected', 'bg-ink-100 text-ink-800'],
          ] as [IconName, string, string, string][]
        ).map(([icon, title, text, tone]) => (
          <div key={title} className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-card">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
              <Icon name={icon} />
            </span>
            <span>
              <span className="block font-display font-bold">{title}</span>
              <span className="block text-sm text-ink-500">{text}</span>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
