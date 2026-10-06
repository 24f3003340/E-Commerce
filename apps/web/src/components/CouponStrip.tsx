'use client';

import { useState } from 'react';
import { inr } from '@/lib/format';
import { Icon } from './icons';

export interface PublicCoupon {
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FLAT';
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
}

/** Ticket-style coupon cards with one-tap copy. */
export function CouponStrip({ coupons }: { coupons: PublicCoupon[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (!coupons.length) return null;

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // clipboard blocked — the code is still visible to type
    }
    setCopied(code);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <section aria-label="Offers">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="tag" className="h-5 w-5 text-brand-600" />
        <h2 className="section-title">Offers for you</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {coupons.map((c) => (
          <div key={c.code} className="relative flex w-72 shrink-0 overflow-hidden rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white">
            <div className="flex w-20 shrink-0 flex-col items-center justify-center bg-brand-600 px-2 text-center text-white">
              <span className="text-xl font-extrabold leading-none">{c.type === 'PERCENT' ? `${c.value}%` : inr(c.value)}</span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">off</span>
            </div>
            <span className="absolute left-[74px] top-0 h-3 w-3 -translate-y-1/2 rounded-full bg-page" aria-hidden />
            <span className="absolute bottom-0 left-[74px] h-3 w-3 translate-y-1/2 rounded-full bg-page" aria-hidden />
            <div className="flex flex-1 flex-col justify-between gap-2 border-l border-dashed border-brand-200 p-3">
              <p className="line-clamp-2 text-xs text-gray-700">{c.description}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md border border-dashed border-brand-400 bg-white px-2 py-0.5 font-mono text-xs font-bold text-brand-700">{c.code}</span>
                <button onClick={() => void copy(c.code)} className="text-xs font-bold text-brand-600 hover:text-brand-700">
                  {copied === c.code ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              {c.minOrderValue > 0 && <p className="text-[10px] text-gray-500">Min. order {inr(c.minOrderValue)}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
