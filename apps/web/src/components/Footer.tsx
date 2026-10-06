import Link from 'next/link';
import type { Category } from '@/lib/types';
import { Logo } from './Header';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="mt-20 bg-ink-900 text-ink-200">
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-sm font-display text-2xl font-bold leading-snug text-white">
              Easy clothes for easy days. <span className="text-brand-400">Made to be lived in.</span>
            </p>
            <p className="mt-3 max-w-sm text-sm text-ink-300">Free delivery over ₹999, 7-day returns and cash on delivery — no fuss.</p>
          </div>
          <div>
            <p className="mb-4 text-sm font-bold text-white">Shop</p>
            <ul className="space-y-2.5 text-sm">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/c/${c.slug}`} className="hover:text-white">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/search?sort=discount" className="text-brand-300 hover:text-brand-200">
                  Sale
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-sm font-bold text-white">Help</p>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/track" className="hover:text-white">Track an order</Link></li>
              <li><Link href="/account/orders" className="hover:text-white">My orders</Link></li>
              <li><Link href="/account/returns" className="hover:text-white">Returns & refunds</Link></li>
              <li><Link href="/account" className="hover:text-white">My account</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-sm font-bold text-white">The good stuff</p>
            <ul className="space-y-2.5 text-sm">
              <li>Free delivery over ₹999</li>
              <li>Easy 7-day returns</li>
              <li>Cash on delivery</li>
              <li>UPI, cards & net banking</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-ink-300 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} {STORE_NAME}. Made with ♥ in India.</p>
          <p>Secure checkout · UPI · Cards · Net banking · Wallets · COD</p>
        </div>
      </div>
    </footer>
  );
}
