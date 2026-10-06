'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ListingProduct } from '@/lib/types';
import { Icon } from './icons';
import { ProductCard } from './ProductCard';

/** A titled, horizontally scrolling shelf of products. */
export function ProductRail({ title, eyebrow, href, products, aside }: { title: string; eyebrow?: string; href?: string; products: ListingProduct[]; aside?: ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="section-title">{title}</h2>
            {aside}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {products.length > 4 && (
            <>
              <button onClick={() => scroll(-1)} aria-label="Scroll left" className="hidden h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-white hover:border-ink-900 md:flex">
                <Icon name="chevronLeft" className="h-4 w-4" />
              </button>
              <button onClick={() => scroll(1)} aria-label="Scroll right" className="hidden h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-white hover:border-ink-900 md:flex">
                <Icon name="chevronRight" className="h-4 w-4" />
              </button>
            </>
          )}
          {href && (
            <Link href={href} className="ml-1 text-sm font-semibold text-ink-900 underline decoration-brand-400 decoration-2 underline-offset-4 hover:text-brand-600">
              See all
            </Link>
          )}
        </div>
      </div>
      <div ref={scroller} className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 scrollbar-none">
        {products.map((p) => (
          <div key={p.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[18.5%]">
            <ProductCard product={p} compact />
          </div>
        ))}
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

/** "Sale ends tonight" countdown to midnight IST. */
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
    <span className="inline-flex items-center gap-2 rounded-full bg-butter-100 px-3 py-1 text-xs font-semibold text-ink-800">
      <Icon name="clock" className="h-3.5 w-3.5" />
      Ends tonight · <span className="font-mono">{pad(h)}:{pad(m)}:{pad(s)}</span>
    </span>
  );
}
