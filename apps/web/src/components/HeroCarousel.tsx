'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Banner } from '@/lib/types';

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) return null;

  return (
    <section className="relative overflow-hidden rounded-xl" aria-roledescription="carousel">
      <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((b) => (
          <div key={b.id} className="relative aspect-[16/9] w-full shrink-0 sm:aspect-[16/6]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-r from-black/50 to-transparent p-6 text-white sm:p-12">
              <h2 className="max-w-lg text-2xl font-extrabold sm:text-5xl">{b.title}</h2>
              {b.subtitle && <p className="mt-2 max-w-md text-sm opacity-90 sm:text-lg">{b.subtitle}</p>}
              {b.linkUrl && (
                <Link href={b.linkUrl} className="mt-5 w-fit rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100">
                  {b.ctaText ?? 'Shop now'}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
