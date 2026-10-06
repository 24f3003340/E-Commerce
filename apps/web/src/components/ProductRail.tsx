'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ListingProduct } from '@/lib/types';
import { Icon } from './icons';
import { ProductCard } from './ProductCard';

/** Horizontally scrolling row of products with arrow controls (marketplace-style shelf). */
export function ProductRail({ title, href, products, aside }: { title: string; href?: string; products: ListingProduct[]; aside?: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <section className="card relative overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b-2 border-black bg-white px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="section-title">{title}</h2>
          {aside}
        </div>
        {href && (
          <Link href={href} className="btn-cart shrink-0 px-3.5 py-1.5 text-xs">
            Sab dekho <Icon name="chevronRight" className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="relative">
        <div ref={scroller} className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-4 pt-3 scrollbar-none">
          {products.map((p) => (
            <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[18.5%] xl:w-[15.6%]">
              <ProductCard product={p} compact />
            </div>
          ))}
        </div>
        {products.length > 4 && (
          <>
            <button onClick={() => scroll(-1)} aria-label="Scroll left" className="absolute left-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black bg-accent-400 shadow-brutal-sm hover:bg-accent-300 md:flex">
              <Icon name="chevronLeft" />
            </button>
            <button onClick={() => scroll(1)} aria-label="Scroll right" className="absolute right-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black bg-accent-400 shadow-brutal-sm hover:bg-accent-300 md:flex">
              <Icon name="chevronRight" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}



function msToIstMidnight() {
  const now = Date.now();
  const ist = new Date(now + 5.5 * 3600_000);
  const next = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1) - 5.5 * 3600_000;
  return next - now;
}

/** Countdown to midnight IST for "Deals of the Day". */
export function DealCountdown() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    setLeft(msToIstMidnight());
    const t = setInterval(() => setLeft(msToIstMidnight()), 1000);
    return () => clearInterval(t);
  }, []);
  if (left === null) return null;
  const h = Math.floor(left / 3600_000);
  const m = Math.floor((left % 3600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-black" aria-live="off">
      ⏰ Khatam in
      <span className="rounded-md border-2 border-black bg-hot-500 px-1.5 py-0.5 font-mono text-xs font-extrabold text-white">
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </span>
  );
}
