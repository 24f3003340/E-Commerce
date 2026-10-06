'use client';

import Link from 'next/link';
import type { Category } from '@/lib/types';
import { Icon } from './icons';
import { Logo } from './Header';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';
const PAYMENT_METHODS = ['UPI', 'Visa', 'Mastercard', 'RuPay', 'Net Banking', 'Wallets', 'Cash on Delivery'];

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="mt-12">
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="block w-full border-y-2 border-black bg-accent-400 py-3 text-center text-sm font-extrabold text-black hover:bg-accent-300"
      >
        Upar chalo ⬆️
      </button>

      <div className="bg-brand-900 text-brand-100">
        <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-6 text-brand-200">
              Trendy fits at loot prices — men, women aur kids ke liye. Original products, easy returns aur fast delivery, poore India mein. 🇮🇳
            </p>
            <div className="mt-5 grid max-w-sm grid-cols-3 gap-3 text-center text-xs">
              {(
                [
                  ['truck', 'Fast delivery'],
                  ['returns', 'Easy returns'],
                  ['shield', 'Secure payments'],
                ] as const
              ).map(([icon, label]) => (
                <div key={label} className="rounded-xl border-2 border-black bg-white px-2 py-3 text-black shadow-brutal-sm">
                  <Icon name={icon} className="mx-auto h-5 w-5 text-brand-500" />
                  <p className="mt-1.5 font-bold">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-4 font-display text-sm font-extrabold uppercase tracking-wider text-accent-400">Shop</p>
            <ul className="space-y-2.5 text-sm">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/c/${c.slug}`} className="hover:text-accent-300">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/search?sort=discount" className="hover:text-accent-300">
                  Deals
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 font-display text-sm font-extrabold uppercase tracking-wider text-accent-400">Help</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/track" className="hover:text-accent-300">Track your order</Link></li>
              <li><Link href="/account/orders" className="hover:text-accent-300">Your orders</Link></li>
              <li><Link href="/account/returns" className="hover:text-accent-300">Returns & refunds</Link></li>
              <li><Link href="/account" className="hover:text-accent-300">Your account</Link></li>
              <li><Link href="/wishlist" className="hover:text-accent-300">Wishlist</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 font-display text-sm font-extrabold uppercase tracking-wider text-accent-400">Policies</p>
            <ul className="space-y-2.5 text-sm text-brand-200">
              <li>7-day return policy</li>
              <li>Free shipping over ₹999</li>
              <li>Cash on delivery available</li>
              <li>Secure checkout</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/15">
          <div className="container flex flex-col items-center justify-between gap-4 py-5 text-xs text-brand-200 md:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="mr-1 font-bold">Pay kaise bhi 💳</span>
              {PAYMENT_METHODS.map((m) => (
                <span key={m} className="rounded-md border-2 border-black bg-white px-2 py-0.5 font-bold text-black">
                  {m}
                </span>
              ))}
            </div>
            <p>© {new Date().getFullYear()} {STORE_NAME}. Made with 💜 in India.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
