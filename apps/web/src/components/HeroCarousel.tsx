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
    const t = setInterval(() => go(1), 5000);
    return () => clearInterval(t);
  }, [count, paused, go]);

  if (!count) return null;

  return (
    <section
      className="group relative overflow-hidden rounded-2xl bg-navy-900"
      aria-roledescription="carousel"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((b, i) => (
          <div key={b.id} className="relative aspect-[4/3] w-full shrink-0 sm:aspect-[16/5]" aria-hidden={i !== index}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/30 to-transparent px-6 pb-10 sm:bg-gradient-to-r sm:from-black/60 sm:via-black/25 sm:pb-0 text-white sm:justify-center sm:px-14">
              <p className="mb-3 w-fit rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">Limited time</p>
              <h2 className="max-w-xl text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{b.title}</h2>
              {b.subtitle && <p className="mt-2 max-w-md text-sm text-white/90 sm:text-lg">{b.subtitle}</p>}
              {b.linkUrl && (
                <Link href={b.linkUrl} tabIndex={i === index ? 0 : -1} className="btn mt-6 w-fit bg-white px-7 py-3 text-sm text-gray-900 hover:bg-brand-50">
                  {b.ctaText ?? 'Shop now'} <Icon name="chevronRight" className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous slide" className="absolute left-0 top-1/2 flex h-20 w-10 -translate-y-1/2 items-center justify-center rounded-r-md bg-white/80 text-gray-800 opacity-0 transition hover:bg-white group-hover:opacity-100 focus:opacity-100">
            <Icon name="chevronLeft" />
          </button>
          <button onClick={() => go(1)} aria-label="Next slide" className="absolute right-0 top-1/2 flex h-20 w-10 -translate-y-1/2 items-center justify-center rounded-l-md bg-white/80 text-gray-800 opacity-0 transition hover:bg-white group-hover:opacity-100 focus:opacity-100">
            <Icon name="chevronRight" />
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {banners.map((b, i) => (
              <button key={b.id} aria-label={`Show slide ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)} className={`h-2 rounded-full transition-all ${i === index ? 'w-7 bg-white' : 'w-2 bg-white/50'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
