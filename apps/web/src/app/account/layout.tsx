'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { useRequireAuth } from '@/context/StoreProvider';
import { cn } from '@/lib/format';

const LINKS = [
  { href: '/account', label: 'Profile & addresses' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/returns', label: 'Returns' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/wishlist', label: 'Wishlist' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useRequireAuth();
  const pathname = usePathname();
  if (!ready) return <Spinner />;
  return (
    <div className="container grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
      <aside>
        <p className="text-sm text-gray-500">Hello,</p>
        <p className="mb-4 font-bold">{user?.name}</p>
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-2 text-sm',
                (l.href === '/account' ? pathname === l.href : pathname.startsWith(l.href)) ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
