'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ListingProduct, ProductDetail } from './types';

const KEY = 'sk_recent';
const EVENT = 'sk:recent';
const MAX = 12;

function read(): ListingProduct[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as ListingProduct[];
  } catch {
    return [];
  }
}

export function toListing(p: ProductDetail): ListingProduct {
  const colors = new Map<string, string | null>();
  for (const v of p.variants) if (v.color && !colors.has(v.color)) colors.set(v.color, v.colorHex);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    price: p.price,
    mrp: p.mrp,
    discountPct: p.discountPct,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    images: p.images.slice(0, 2).map(({ url, alt }) => ({ url, alt })),
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
    sizes: [...new Set(p.variants.map((v) => v.size).filter((s): s is string => !!s))],
    inStock: p.variants.some((v) => v.inStock),
  };
}

/** Products this shopper viewed recently (kept in their browser only). */
export function useRecentlyViewed() {
  const [items, setItems] = useState<ListingProduct[]>([]);

  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const record = useCallback((product: ListingProduct) => {
    const next = [product, ...read().filter((p) => p.id !== product.id)].slice(0, MAX);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — feature silently disabled
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { items, record };
}
