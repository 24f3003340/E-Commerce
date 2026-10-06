'use client';

import Link from 'next/link';
import { useStore } from '@/context/StoreProvider';
import { cn } from '@/lib/format';
import type { ListingProduct } from '@/lib/types';
import { Icon } from './icons';
import { Price, Stars } from './ui';

const FREE_DELIVERY_FROM = 99900;

export function ProductCard({ product, compact }: { product: ListingProduct; compact?: boolean }) {
  const { wishlist, toggleWishlist } = useStore();
  const wished = wishlist.has(product.id);
  const [first, second] = product.images;

  return (
    <div className="group relative flex h-full flex-col rounded-lg bg-white p-3 transition hover:shadow-lift">
      <Link href={`/p/${product.slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-gray-50">
          {first && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first.url} alt={first.alt ?? product.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
          )}
          {second && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={second.url} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {product.inStock && product.isFeatured ? (
              <span className="rounded-sm bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Bestseller</span>
            ) : product.inStock && product.discountPct >= 50 ? (
              <span className="rounded-sm bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Deal</span>
            ) : null}
          </div>
          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <span className="rounded bg-gray-900 px-3 py-1 text-xs font-semibold text-white">Currently unavailable</span>
            </div>
          )}
        </div>
        <div className={cn('mt-3 flex flex-1 flex-col gap-1', compact && 'mt-2')}>
          {product.brand && <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{product.brand}</p>}
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-gray-800 group-hover:text-brand-700">{product.name}</h3>
          {product.ratingCount > 0 && <Stars value={product.ratingAvg} count={product.ratingCount} small />}
          <div className="mt-auto pt-1">
            <Price price={product.price} mrp={product.mrp} size="sm" />
            {!compact && (
              <p className="mt-1 text-xs text-gray-600">
                {product.price >= FREE_DELIVERY_FROM ? (
                  <span className="font-semibold text-gray-800">Free delivery</span>
                ) : (
                  'Free delivery over ₹999'
                )}
              </p>
            )}
          </div>
          {!compact && product.colors.length > 1 && (
            <div className="flex items-center gap-1 pt-1">
              {product.colors.slice(0, 5).map((c) => (
                <span key={c.name} title={c.name} className="h-3.5 w-3.5 rounded-full border border-gray-300" style={{ background: c.hex ?? '#ccc' }} />
              ))}
              <span className="ml-1 text-[11px] text-gray-500">{product.colors.length} colours</span>
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => void toggleWishlist(product.id)}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wished}
        className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-card transition hover:scale-110"
      >
        <Icon name="heart" filled={wished} className={cn('h-4 w-4', wished ? 'text-rose-500' : 'text-gray-400')} />
      </button>
    </div>
  );
}

export function ProductGrid({ products }: { products: ListingProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
      {products.map((p) => (
        <div key={p.id} className="rounded-lg border border-gray-200/70 bg-white shadow-card">
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
