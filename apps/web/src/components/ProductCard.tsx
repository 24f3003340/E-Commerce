'use client';

import Link from 'next/link';
import { useStore } from '@/context/StoreProvider';
import type { ListingProduct } from '@/lib/types';
import { Price, Stars } from './ui';

export function ProductCard({ product }: { product: ListingProduct }) {
  const { wishlist, toggleWishlist } = useStore();
  const wished = wishlist.has(product.id);
  const [first, second] = product.images;

  return (
    <div className="group relative">
      <Link href={`/p/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100">
          {first && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={first.url} alt={first.alt ?? product.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          )}
          {second && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={second.url} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-300 group-hover:opacity-100" />
          )}
          {!product.inStock && (
            <span className="absolute left-2 top-2 rounded bg-gray-900/80 px-2 py-0.5 text-xs font-medium text-white">Out of stock</span>
          )}
          {product.inStock && product.discountPct >= 40 && (
            <span className="absolute left-2 top-2 rounded bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">{product.discountPct}% OFF</span>
          )}
        </div>
        <div className="mt-2 space-y-1">
          {product.brand && <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{product.brand}</p>}
          <h3 className="line-clamp-1 text-sm text-gray-900">{product.name}</h3>
          <Price price={product.price} mrp={product.mrp} size="sm" />
          <div className="flex items-center justify-between">
            {product.ratingCount > 0 ? <Stars value={product.ratingAvg} count={product.ratingCount} small /> : <span />}
            <div className="flex gap-1">
              {product.colors.slice(0, 4).map((c) => (
                <span key={c.name} title={c.name} className="h-3 w-3 rounded-full border border-gray-300" style={{ background: c.hex ?? '#ccc' }} />
              ))}
            </div>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => void toggleWishlist(product.id)}
        aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        aria-pressed={wished}
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow-sm transition hover:scale-110"
      >
        <span className={wished ? 'text-rose-600' : 'text-gray-400'}>{wished ? '♥' : '♡'}</span>
      </button>
    </div>
  );
}

export function ProductGrid({ products }: { products: ListingProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
