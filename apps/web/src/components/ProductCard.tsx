'use client';

import Link from 'next/link';
import { useStore } from '@/context/StoreProvider';
import { cn, inr } from '@/lib/format';
import type { ListingProduct } from '@/lib/types';
import { Icon } from './icons';

export function ProductCard({ product, compact }: { product: ListingProduct; compact?: boolean }) {
  const { wishlist, toggleWishlist } = useStore();
  const wished = wishlist.has(product.id);
  const [first, second] = product.images;

  return (
    <div className="group relative flex h-full flex-col">
      <Link href={`/p/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-ink-50">
          {first && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first.url} alt={first.alt ?? product.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          )}
          {second && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={second.url} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />
          )}
          {product.inStock && (product.isFeatured || product.discountPct >= 50) && (
            <span
              className={cn(
                'absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold',
                product.isFeatured ? 'bg-butter-300 text-ink-900' : 'bg-brand-500 text-white',
              )}
            >
              {product.isFeatured ? 'Bestseller' : 'On sale'}
            </span>
          )}
          {!product.inStock && (
            <span className="absolute inset-x-3 bottom-3 rounded-full bg-white/90 py-1.5 text-center text-xs font-semibold text-ink-700">Sold out</span>
          )}
        </div>
        <div className={cn('flex flex-1 flex-col gap-1 px-1 pt-3', compact && 'pt-2.5')}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-medium leading-5 text-ink-900">{product.name}</h3>
            {product.ratingCount > 0 && (
              <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-xs font-semibold text-ink-700">
                <Icon name="star" filled className="h-3 w-3 text-butter-400" />
                {product.ratingAvg.toFixed(1)}
              </span>
            )}
          </div>
          {product.brand && <p className="text-xs text-ink-500">{product.brand}</p>}
          <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <span className="text-base font-bold text-ink-900">{inr(product.price)}</span>
            {product.mrp > product.price && (
              <>
                <span className="text-xs text-ink-500 line-through">{inr(product.mrp)}</span>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-600">-{product.discountPct}%</span>
              </>
            )}
          </div>
          {!compact && product.colors.length > 1 && (
            <div className="flex items-center gap-1 pt-1">
              {product.colors.slice(0, 5).map((c) => (
                <span key={c.name} title={c.name} className="h-3.5 w-3.5 rounded-full ring-1 ring-ink-200" style={{ background: c.hex ?? '#ccc' }} />
              ))}
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => void toggleWishlist(product.id)}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wished}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-card transition hover:scale-110"
      >
        <Icon name="heart" filled={wished} className={cn('h-4 w-4', wished ? 'text-brand-500' : 'text-ink-700')} />
      </button>
    </div>
  );
}

export function ProductGrid({ products }: { products: ListingProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
