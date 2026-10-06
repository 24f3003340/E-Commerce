'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';

interface Suggestions {
  products: { name: string; slug: string; images: { url: string }[] }[];
  categories: { name: string; slug: string }[];
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sugg, setSugg] = useState<Suggestions | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSugg(null);
      return;
    }
    const t = setTimeout(() => {
      api<Suggestions>(`/products/suggest?q=${encodeURIComponent(q.trim())}`, { auth: false })
        .then(setSugg)
        .catch(() => setSugg(null));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    onDone?.();
    router.push(href);
  };

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search for products, brands and more"
        aria-label="Search"
        className="w-full rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-brand-600 focus:bg-white"
      />
      {open && sugg && (sugg.products.length > 0 || sugg.categories.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          {sugg.categories.map((c) => (
            <button key={c.slug} type="button" onMouseDown={() => go(`/c/${c.slug}`)} className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50">
              <span className="text-gray-500">in</span> {c.name}
            </button>
          ))}
          {sugg.products.map((p) => (
            <button key={p.slug} type="button" onMouseDown={() => go(`/p/${p.slug}`)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.images[0] && <img src={p.images[0].url} alt="" className="h-10 w-8 rounded object-cover" />}
              <span className="line-clamp-1">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

export function Header({ categories }: { categories: Category[] }) {
  const { user, cartCount, wishlist, logout } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const pathname = usePathname();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="container flex h-16 items-center gap-4">
        <button className="text-2xl lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          ☰
        </button>
        <Link href="/" className="shrink-0 text-xl font-extrabold tracking-tight text-brand-700">
          {STORE_NAME}
        </Link>

        <nav className="hidden h-full items-center lg:flex" aria-label="Categories">
          {categories.map((cat) => (
            <div key={cat.id} className="group relative flex h-full items-center">
              <Link href={`/c/${cat.slug}`} className="border-b-2 border-transparent px-3 py-5 text-sm font-semibold uppercase tracking-wide text-gray-700 group-hover:border-brand-600 group-hover:text-gray-900">
                {cat.name}
              </Link>
              {cat.children.length > 0 && (
                <div className="invisible absolute left-0 top-full min-w-[220px] rounded-b-md border border-gray-200 bg-white p-4 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                  <ul className="space-y-2">
                    {cat.children.map((sub) => (
                      <li key={sub.id}>
                        <Link href={`/c/${sub.slug}`} className="text-sm text-gray-600 hover:text-brand-700">
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                    <li className="border-t pt-2">
                      <Link href={`/c/${cat.slug}`} className="text-sm font-semibold text-brand-700">
                        View all {cat.name}
                      </Link>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="hidden flex-1 md:block">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <div className="relative" ref={accountRef}>
            {user ? (
              <button onClick={() => setAccountOpen((o) => !o)} className="flex flex-col items-center px-2 text-xs font-semibold" aria-expanded={accountOpen}>
                <span className="text-lg" aria-hidden>
                  👤
                </span>
                <span className="hidden sm:block">{user.name.split(' ')[0]}</span>
              </button>
            ) : (
              <Link href="/login" className="flex flex-col items-center px-2 text-xs font-semibold">
                <span className="text-lg" aria-hidden>
                  👤
                </span>
                <span className="hidden sm:block">Login</span>
              </Link>
            )}
            {accountOpen && user && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-md border border-gray-200 bg-white py-2 text-sm shadow-lg">
                <p className="px-4 pb-2 text-xs text-gray-500">{user.email}</p>
                <Link href="/account" className="block px-4 py-2 hover:bg-gray-50">
                  My profile
                </Link>
                <Link href="/account/orders" className="block px-4 py-2 hover:bg-gray-50">
                  Orders
                </Link>
                <Link href="/account/returns" className="block px-4 py-2 hover:bg-gray-50">
                  Returns
                </Link>
                <Link href="/account/notifications" className="block px-4 py-2 hover:bg-gray-50">
                  Notifications
                </Link>
                <button onClick={() => void logout()} className="block w-full px-4 py-2 text-left text-red-600 hover:bg-gray-50">
                  Logout
                </button>
              </div>
            )}
          </div>
          <Link href="/wishlist" className="relative flex flex-col items-center px-2 text-xs font-semibold">
            <span className="text-lg" aria-hidden>
              ♡
            </span>
            <span className="hidden sm:block">Wishlist</span>
            {wishlist.size > 0 && (
              <span className="absolute -right-0.5 -top-1 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{wishlist.size}</span>
            )}
          </Link>
          <Link href="/cart" className="relative flex flex-col items-center px-2 text-xs font-semibold">
            <span className="text-lg" aria-hidden>
              🛍
            </span>
            <span className="hidden sm:block">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-1 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{cartCount}</span>
            )}
          </Link>
        </div>
      </div>
      <div className="container pb-3 md:hidden">
        <SearchBox />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold text-brand-700">{STORE_NAME}</span>
              <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="text-xl">
                ✕
              </button>
            </div>
            {categories.map((cat) => (
              <div key={cat.id} className="border-b py-3">
                <Link href={`/c/${cat.slug}`} className="font-semibold">
                  {cat.name}
                </Link>
                <ul className="mt-2 space-y-1 pl-3">
                  {cat.children.map((sub) => (
                    <li key={sub.id}>
                      <Link href={`/c/${sub.slug}`} className="text-sm text-gray-600">
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-4 space-y-2 text-sm">
              <Link href="/track" className="block">
                Track order
              </Link>
              <Link href={user ? '/account' : '/login'} className="block">
                {user ? 'My account' : 'Login / Register'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
