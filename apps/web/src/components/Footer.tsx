'use client';

import Link from 'next/link';
import type { Category } from '@/lib/types';
import { Icon } from './icons';
import { Logo } from './Header';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'DukaanX';
const ONLINE_METHODS = ['UPI', 'Visa', 'Mastercard', 'RuPay', 'Net Banking', 'Wallets'];
/** Seller panel (part of the admin app), e.g. https://admin.yourstore.com/seller */
const SELLER_URL = `${(process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001').replace(/\/$/, '')}/seller`;

export function Footer({ categories, onlinePayments, sellerRegistrationOpen }: { categories: Category[]; onlinePayments: boolean; sellerRegistrationOpen: boolean }) {
  return (
    <footer className="mt-12">
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="block w-full bg-navy-700 py-3.5 text-center text-sm font-medium text-white hover:bg-navy-700/90"
      >
        Back to top
      </button>

      <div className="bg-navy-900 text-gray-300">
        <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-6 text-gray-400">
              India&apos;s online dukaan for fashion, footwear, accessories and more — from trusted sellers, with easy returns and fast delivery across India.
            </p>
            <div className="mt-5 grid max-w-sm grid-cols-3 gap-3 text-center text-xs">
              {(
                [
                  ['truck', 'Fast delivery'],
                  ['returns', 'Easy returns'],
                  ['shield', 'Secure payments'],
                ] as const
              ).map(([icon, label]) => (
                <div key={label} className="rounded-md bg-white/5 px-2 py-3">
                  <Icon name={icon} className="mx-auto h-5 w-5 text-accent-400" />
                  <p className="mt-1.5 text-gray-300">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-white">Shop</p>
            <ul className="space-y-2.5 text-sm">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/c/${c.slug}`} className="hover:text-white hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/search?sort=discount" className="hover:text-white hover:underline">
                  Today&apos;s Deals
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-white">Help</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/track" className="hover:text-white hover:underline">Track your order</Link></li>
              <li><Link href="/account/orders" className="hover:text-white hover:underline">Your orders</Link></li>
              <li><Link href="/account/returns" className="hover:text-white hover:underline">Returns & refunds</Link></li>
              <li><Link href="/account" className="hover:text-white hover:underline">Your account</Link></li>
              <li><Link href="/wishlist" className="hover:text-white hover:underline">Wishlist</Link></li>
            </ul>
            {sellerRegistrationOpen && (
              <>
                <p className="mb-4 mt-8 text-xs font-bold uppercase tracking-wider text-white">Sell with us</p>
                <ul className="space-y-2.5 text-sm">
                  <li><a href={`${SELLER_URL}/register`} className="font-semibold text-accent-400 hover:text-white hover:underline">Sell on {STORE_NAME}</a></li>
                  <li><a href={`${SELLER_URL}/login`} className="hover:text-white hover:underline">Seller login</a></li>
                </ul>
              </>
            )}
          </div>
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-white">Company &amp; Policies</p>
            <ul className="space-y-2.5 text-sm">
              {(
                [
                  ['/about', 'About us'],
                  ['/contact', 'Contact us'],
                  ['/faq', 'FAQs'],
                  ['/shipping-policy', 'Shipping policy'],
                  ['/return-policy', 'Returns & refunds'],
                  ['/terms', 'Terms of use'],
                  ['/privacy', 'Privacy policy'],
                ] as const
              ).map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-white hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="container flex flex-col items-center justify-between gap-4 py-5 text-xs text-gray-400 md:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="mr-1">We accept</span>
              {[...(onlinePayments ? ONLINE_METHODS : []), 'Cash on Delivery'].map((m) => (
                <span key={m} className="rounded border border-white/15 bg-white/5 px-2 py-1 font-semibold text-gray-200">
                  {m}
                </span>
              ))}
              {!onlinePayments && <span className="text-gray-400">· Online payments coming soon</span>}
            </div>
            <p>© {new Date().getFullYear()} {STORE_NAME}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
