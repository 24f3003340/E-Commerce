'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/format';
import { sellerApi, sellerClient } from '@/lib/sellerApi';
import type { Seller } from '@/lib/types';
import { Icon, type IconName } from './icons';
import { Spinner } from './ui';

const NAV: { href: string; label: string; icon: IconName; activeOnly?: boolean }[] = [
  { href: '/seller', label: 'Dashboard', icon: 'dashboard', activeOnly: true },
  { href: '/seller/orders', label: 'Orders', icon: 'receipt', activeOnly: true },
  { href: '/seller/products', label: 'Products', icon: 'shirt', activeOnly: true },
  { href: '/seller/inventory', label: 'Inventory', icon: 'package', activeOnly: true },
  { href: '/seller/earnings', label: 'Earnings & payouts', icon: 'wallet', activeOnly: true },
  { href: '/seller/profile', label: 'Profile & bank', icon: 'store' },
];

const PUBLIC_PAGES = ['/seller/login', '/seller/register'];

interface ToastItem {
  id: number;
  text: string;
  error?: boolean;
}

const SellerContext = createContext<{
  seller: Seller;
  setSeller: (s: Seller) => void;
  toast: (text: string, error?: boolean) => void;
} | null>(null);

export function useSeller() {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error('useSeller outside SellerShell');
  return ctx;
}

export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [seller, setSellerState] = useState<Seller | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const isPublic = PUBLIC_PAGES.includes(pathname);

  const setSeller = useCallback((s: Seller) => {
    setSellerState(s);
    const auth = sellerClient.getAuth();
    if (auth) sellerClient.setAuth({ ...auth, seller: s });
  }, []);

  useEffect(() => {
    setNavOpen(false);
    if (isPublic) return;
    const auth = sellerClient.getAuth();
    if (!auth) {
      router.replace('/seller/login');
      return;
    }
    setSellerState(auth.seller);
    // Pick up approval / suspension done by the marketplace team since the last visit
    sellerApi<Seller>('/seller/me').then(setSeller).catch(() => undefined);
  }, [pathname, isPublic, router, setSeller]);

  const toast = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  if (isPublic) return <>{children}</>;
  if (!seller) return <Spinner />;

  const inactive = seller.status === 'REJECTED' || seller.status === 'SUSPENDED';
  const nav = NAV.filter((n) => !inactive || !n.activeOnly);
  const blocked = inactive && pathname !== '/seller/profile';

  return (
    <SellerContext.Provider value={{ seller, setSeller, toast }}>
      <div className="flex min-h-screen bg-page">
        <aside className={cn('fixed inset-y-0 left-0 z-40 w-60 shrink-0 overflow-y-auto bg-navy-900 text-gray-300 transition-transform lg:static lg:translate-x-0', navOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="px-5 py-5">
            <p className="text-xl font-extrabold italic tracking-tight text-white">StyleKart</p>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-300">Seller Panel</p>
            <p className="mt-3 truncate text-sm font-semibold text-white">{seller.storeName}</p>
          </div>
          <nav className="space-y-0.5 px-3 pb-6">
            {nav.map((n) => {
              const active = n.href === '/seller' ? pathname === '/seller' : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm', active ? 'bg-brand-600 font-semibold text-white shadow-sm' : 'hover:bg-white/5 hover:text-white')}>
                  <Icon name={n.icon} className="h-[18px] w-[18px] shrink-0 opacity-80" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        {navOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8">
            <button className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
              <Icon name="menu" className="h-6 w-6" />
            </button>
            <span className="hidden text-sm text-gray-500 lg:block">Welcome, {seller.name}</span>
            <button
              className="btn-outline btn-sm"
              onClick={async () => {
                await sellerClient.logout();
                router.replace('/seller/login');
              }}
            >
              Logout
            </button>
          </header>
          {seller.status === 'PENDING' && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 lg:px-8">
              <span className="font-semibold">Your seller account is under review.</span> You can add products now — they go live once your account and the products are approved. Make sure your GSTIN and bank details are filled in under Profile.
            </div>
          )}
          {inactive && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 lg:px-8">
              <span className="font-semibold">{seller.status === 'REJECTED' ? 'Your seller application was not approved.' : 'Your seller account is suspended.'}</span>
              {seller.statusNote ? ` Reason: ${seller.statusNote}.` : ''} Please contact the marketplace team.
            </div>
          )}
          <main className="flex-1 p-4 lg:p-8">{blocked ? <p className="text-sm text-gray-600">This section is not available while your account is inactive.</p> : children}</main>
        </div>
      </div>
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cn('rounded-md px-4 py-2.5 text-sm font-medium text-white shadow-lg', t.error ? 'bg-red-600' : 'bg-emerald-600')}>
            {t.text}
          </div>
        ))}
      </div>
    </SellerContext.Provider>
  );
}
