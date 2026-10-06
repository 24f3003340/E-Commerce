'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Banner } from '@/lib/types';
import { Icon } from './icons';

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;
  const go = useCallback((dir: number) => setIndex((i) => (i + dir + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => go(1), 6000);
    return () => clearInterval(t);
  }, [count, paused, go]);

  if (!count) return null;

  return (
    <section
      className="relative overflow-hidden rounded-4xl"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((b, i) => (
          <div key={b.id} className="relative aspect-[4/5] w-full shrink-0 sm:aspect-[16/7] lg:aspect-[16/6]" aria-hidden={i !== index}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:justify-center sm:p-12 lg:p-16">
              <div className="max-w-md rounded-3xl bg-page/85 p-5 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <p className="eyebrow">New in</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold leading-[1.05] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">{b.title}</h2>
                {b.subtitle && <p className="mt-3 text-sm text-ink-700 sm:text-lg">{b.subtitle}</p>}
                {b.linkUrl && (
                  <Link href={b.linkUrl} tabIndex={i === index ? 0 : -1} className="btn-buy mt-5 px-6 py-3">
                    {b.ctaText ?? 'Shop now'} <Icon name="chevronRight" className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:bottom-5 sm:right-5 sm:top-auto">
          <button onClick={() => go(-1)} aria-label="Previous slide" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-card hover:bg-white">
            <Icon name="chevronLeft" className="h-4 w-4" />
          </button>
          <span className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-ink-900">
            {index + 1} / {count}
          </span>
          <button onClick={() => go(1)} aria-label="Next slide" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink-900 shadow-card hover:bg-white">
            <Icon name="chevronRight" className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
