'use client';

import Link from 'next/link';
import { useStore } from '@/context/StoreProvider';
import { cn, inr } from '@/lib/format';
import type { ListingProduct } from '@/lib/types';
import { Icon } from './icons';

// Playful pastel tile behind each product image, picked from the product id so it stays stable.
const TILE_BG = ['bg-brand-100', 'bg-accent-100', 'bg-hot-100', 'bg-sky-100'];
const tileFor = (id: string) => TILE_BG[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % TILE_BG.length];

export function ProductCard({ product, compact }: { product: ListingProduct; compact?: boolean }) {
  const { wishlist, toggleWishlist } = useStore();
  const wished = wishlist.has(product.id);
  const [first, second] = product.images;

  return (
    <div className="group relative flex h-full flex-col rounded-2xl border-2 border-black bg-white p-2 shadow-brutal-sm transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal">
      <Link href={`/p/${product.slug}`} className="flex flex-1 flex-col">
        <div className={cn('relative aspect-[4/5] overflow-hidden rounded-xl border-2 border-black', tileFor(product.id))}>
          {first && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first.url} alt={first.alt ?? product.name} loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-[1.05]" />
          )}
          {second && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={second.url} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 mix-blend-multiply transition duration-500 group-hover:opacity-100" />
          )}
          {product.inStock && product.isFeatured ? (
            <span className="sticker absolute left-2 top-2 -rotate-3 bg-accent-400 text-black">Bestseller 🔥</span>
          ) : product.inStock && product.discountPct >= 50 ? (
            <span className="sticker absolute left-2 top-2 -rotate-3 bg-hot-500 text-white">Steal deal 💸</span>
          ) : null}
          {!product.inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <span className="sticker rotate-[-4deg] bg-black text-white">Sold out 😢</span>
            </div>
          )}
          {product.ratingCount > 0 && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full border-2 border-black bg-white px-2 py-0.5 text-[11px] font-extrabold">
              {product.ratingAvg.toFixed(1)} <Icon name="star" filled className="h-3 w-3 text-accent-600" />
              <span className="font-semibold text-gray-500">({product.ratingCount})</span>
            </span>
          )}
        </div>
        <div className={cn('flex flex-1 flex-col gap-0.5 px-1 pt-2.5', compact && 'pt-2')}>
          {product.brand && <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-600">{product.brand}</p>}
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-black">{product.name}</h3>
          <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 pt-1">
            <span className="text-lg font-extrabold text-black">{inr(product.price)}</span>
            {product.mrp > product.price && (
              <>
                <span className="text-xs font-medium text-gray-500 line-through">{inr(product.mrp)}</span>
                <span className="rounded-md bg-hot-500 px-1.5 py-0.5 text-[11px] font-extrabold text-white">{product.discountPct}% OFF</span>
              </>
            )}
          </div>
          {!compact && (
            <p className="text-[11px] font-semibold text-gray-600">{product.price >= 99900 ? '🚚 Free delivery' : '🚚 Free delivery on ₹999+'}</p>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => void toggleWishlist(product.id)}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wished}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white transition hover:scale-110"
      >
        <Icon name="heart" filled={wished} className={cn('h-4 w-4', wished ? 'text-hot-500' : 'text-black')} />
      </button>
    </div>
  );
}

export function ProductGrid({ products }: { products: ListingProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
