'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { canAccess, getAuth, logout } from '@/lib/api';
import { cn } from '@/lib/format';
import type { AdminUser } from '@/lib/types';
import { Icon, type IconName } from './icons';
import { Spinner } from './ui';

const NAV: { href: string; label: string; section: string; icon: IconName }[] = [
  { href: '/', label: 'Dashboard', section: 'dashboard', icon: 'dashboard' },
  { href: '/orders', label: 'Orders', section: 'orders', icon: 'receipt' },
  { href: '/returns', label: 'Returns & refunds', section: 'returns', icon: 'returns' },
  { href: '/products', label: 'Products', section: 'products', icon: 'shirt' },
  { href: '/categories', label: 'Categories', section: 'categories', icon: 'folder' },
  { href: '/inventory', label: 'Inventory', section: 'inventory', icon: 'package' },
  { href: '/customers', label: 'Customers', section: 'customers', icon: 'users' },
  { href: '/coupons', label: 'Coupons', section: 'coupons', icon: 'tag' },
  { href: '/banners', label: 'Banners', section: 'banners', icon: 'image' },
  { href: '/reviews', label: 'Reviews', section: 'reviews', icon: 'star' },
  { href: '/reports', label: 'Reports', section: 'reports', icon: 'chart' },
  { href: '/settings', label: 'Settings', section: 'settings', icon: 'settings' },
  { href: '/admins', label: 'Admin users', section: 'admins', icon: 'shield' },
  { href: '/audit-logs', label: 'Audit logs', section: 'audit-logs', icon: 'file' },
];

interface ToastItem {
  id: number;
  text: string;
  error?: boolean;
}

const AdminContext = createContext<{ admin: AdminUser; toast: (text: string, error?: boolean) => void } | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin outside AdminShell');
  return ctx;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const isLogin = pathname === '/login';

  useEffect(() => {
    const auth = getAuth();
    if (!auth && !isLogin) router.replace('/login');
    setAdmin(auth?.admin ?? null);
    setNavOpen(false);
  }, [pathname, isLogin, router]);

  const toast = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  if (isLogin) return <>{children}</>;
  if (!admin) return <Spinner />;

  const section = NAV.find((n) => n.href !== '/' && pathname.startsWith(n.href))?.section ?? 'dashboard';
  const allowed = canAccess(admin.role, section);

  return (
    <AdminContext.Provider value={{ admin, toast }}>
      <div className="flex min-h-screen bg-page">
        <aside className={cn('fixed inset-y-0 left-0 z-40 w-60 shrink-0 overflow-y-auto bg-ink-900 text-gray-300 transition-transform lg:static lg:translate-x-0', navOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="px-5 py-5"><p className="text-xl font-extrabold tracking-tight text-white">stylekart<span className="text-brand-400">.</span></p><p className="text-[11px] font-semibold uppercase tracking-widest text-brand-300">Seller Admin</p></div>
          <nav className="space-y-0.5 px-3 pb-6">
            {NAV.filter((n) => canAccess(admin.role, n.section)).map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
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
            <span className="hidden text-sm text-gray-500 lg:block">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-right">
                <span className="block font-semibold">{admin.name}</span>
                <span className="block text-xs text-gray-500">{admin.role.replace(/_/g, ' ').toLowerCase()}</span>
              </span>
              <button
                className="btn-outline btn-sm"
                onClick={async () => {
                  await logout();
                  router.replace('/login');
                }}
              >
                Logout
              </button>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-8">{allowed ? children : <p className="text-sm text-red-600">You do not have permission to view this page.</p>}</main>
        </div>
      </div>
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cn('rounded-md px-4 py-2.5 text-sm font-medium text-white shadow-lg', t.error ? 'bg-red-600' : 'bg-emerald-600')}>
            {t.text}
          </div>
        ))}
      </div>
    </AdminContext.Provider>
  );
}
