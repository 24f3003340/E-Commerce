import Link from 'next/link';
import type { Category } from '@/lib/types';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-gray-50">
      <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-extrabold text-brand-700">{STORE_NAME}</p>
          <p className="mt-2 text-sm text-gray-600">Fashion for everyone. Easy returns, secure payments and fast delivery across India.</p>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-900">Shop</p>
          <ul className="space-y-2 text-sm text-gray-600">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.slug}`} className="hover:text-gray-900">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-900">Help</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>
              <Link href="/track" className="hover:text-gray-900">
                Track your order
              </Link>
            </li>
            <li>
              <Link href="/account/orders" className="hover:text-gray-900">
                My orders
              </Link>
            </li>
            <li>
              <Link href="/account/returns" className="hover:text-gray-900">
                Returns & refunds
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-900">Our promise</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>✓ 100% original products</li>
            <li>✓ Easy returns within 7 days</li>
            <li>✓ Secure payments — UPI, cards, net banking, COD</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} {STORE_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
