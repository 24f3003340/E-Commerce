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
        <h2 className="section-title">Coupon codes 🎟️ <span className="text-base font-bold text-gray-600">— copy karo, paise bachao</span></h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {coupons.map((c) => (
          <div key={c.code} className="relative flex w-72 shrink-0 overflow-hidden rounded-2xl border-2 border-black bg-white shadow-brutal-sm">
            <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-black bg-brand-500 px-2 text-center text-white">
              <span className="text-xl font-extrabold leading-none">{c.type === 'PERCENT' ? `${c.value}%` : inr(c.value)}</span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">off</span>
            </div>
                        <div className="flex flex-1 flex-col justify-between gap-2 p-3">
              <p className="line-clamp-2 text-xs text-gray-700">{c.description}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md border-2 border-dashed border-black bg-accent-100 px-2 py-0.5 font-mono text-xs font-extrabold text-black">{c.code}</span>
                <button onClick={() => void copy(c.code)} className="rounded-md border-2 border-black bg-accent-400 px-2 py-0.5 text-xs font-extrabold text-black">
                  {copied === c.code ? 'Copied ✅' : 'Copy'}
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
