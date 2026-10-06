'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import type { Category } from '@/lib/types';
import { Icon } from './icons';

const STORE_NAME = (process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart').toLowerCase();

interface Suggestions {
  products: { name: string; slug: string; images: { url: string }[] }[];
  categories: { name: string; slug: string }[];
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="shrink-0 font-display text-2xl font-extrabold tracking-tight" aria-label={`${STORE_NAME} home`}>
      <span className={light ? 'text-white' : 'text-ink-900'}>{STORE_NAME}</span>
      <span className="text-brand-500">.</span>
    </Link>
  );
}

function SearchBox({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sugg, setSugg] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (q.trim().length < 2) {
      setSugg(null);
      return;
    }
    const t = setTimeout(() => {
      api<Suggestions>(`/products/suggest?q=${encodeURIComponent(q.trim())}`, { auth: false })
        .then((s) => {
          setSugg(s);
          setActive(-1);
        })
        .catch(() => setSugg(null));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const items = [
    ...(sugg?.categories.map((c) => ({ key: `c-${c.slug}`, href: `/c/${c.slug}`, label: c.name, image: undefined as string | undefined, kind: 'category' })) ?? []),
    ...(sugg?.products.map((p) => ({ key: `p-${p.slug}`, href: `/p/${p.slug}`, label: p.name, image: p.images[0]?.url, kind: 'product' })) ?? []),
  ];

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
        if (active >= 0 && items[active]) go(items[active].href);
        else if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
      <input
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!items.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
          } else if (e.key === 'Escape') setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search tees, kurtas, sneakers…"
        aria-label="Search"
        className="h-11 w-full rounded-full border border-ink-100 bg-ink-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-ink-500 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
      />
      {open && items.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-ink-100 bg-white p-1.5 shadow-lift">
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onMouseDown={() => go(item.href)}
              onMouseEnter={() => setActive(i)}
              className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm', i === active && 'bg-brand-50')}
            >
              {item.kind === 'category' ? (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-100 text-sage-700">
                    <Icon name="grid" className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="font-semibold">{item.label}</span> <span className="text-xs text-ink-500">· category</span>
                  </span>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {item.image ? <img src={item.image} alt="" className="h-11 w-9 rounded-lg object-cover" /> : <span className="h-11 w-9" />}
                  <span className="line-clamp-1">{item.label}</span>
                </>
              )}
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
  const [mobileSearch, setMobileSearch] = useState(false);
  const pathname = usePathname();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
    setMobileSearch(false);
  }, [pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const iconBtn = 'relative flex h-10 w-10 items-center justify-center rounded-full text-ink-900 transition hover:bg-ink-100';

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-page/90 backdrop-blur-md">
      <div className="container flex h-[68px] items-center gap-4">
        <button className={cn(iconBtn, 'lg:hidden')} aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <Icon name="menu" />
        </button>
        <Logo />

        <nav className="ml-6 hidden h-full items-center gap-1 lg:flex" aria-label="Categories">
          {categories.map((cat) => (
            <div key={cat.id} className="group relative flex h-full items-center">
              <Link
                href={`/c/${cat.slug}`}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm font-semibold transition hover:bg-ink-100',
                  pathname.startsWith(`/c/${cat.slug}`) ? 'text-brand-600' : 'text-ink-700',
                )}
              >
                {cat.name}
              </Link>
              {cat.children.length > 0 && (
                <div className="invisible absolute left-0 top-full z-50 pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100">
                  <div className="w-60 rounded-2xl border border-ink-100 bg-white p-2 shadow-lift">
                    {cat.children.map((sub) => (
                      <Link key={sub.id} href={`/c/${sub.slug}`} className="block rounded-xl px-3 py-2 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700">
                        {sub.name}
                      </Link>
                    ))}
                    <Link href={`/c/${cat.slug}`} className="mt-1 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-sm font-semibold text-ink-900 hover:bg-ink-100">
                      Shop all {cat.name} <Icon name="chevronRight" className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link href="/search?sort=discount" className="rounded-full bg-brand-50 px-3.5 py-2 text-sm font-bold text-brand-600 transition hover:bg-brand-100">
            Sale
          </Link>
        </nav>

        <div className="ml-auto hidden w-full max-w-xs md:block xl:max-w-sm">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-0.5 md:ml-1">
          <button className={cn(iconBtn, 'md:hidden')} aria-label="Search" onClick={() => setMobileSearch((s) => !s)}>
            <Icon name="search" />
          </button>
          <Link href="/wishlist" className={cn(iconBtn, 'hidden sm:flex')} aria-label={`Wishlist, ${wishlist.size} items`}>
            <Icon name="heart" />
            {wishlist.size > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-page" />}
          </Link>
          <div className="relative" ref={accountRef}>
            {user ? (
              <button onClick={() => setAccountOpen((o) => !o)} className={iconBtn} aria-expanded={accountOpen} aria-label="Account menu">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sage-100 font-display text-sm font-bold text-sage-700">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </button>
            ) : (
              <Link href="/login" className={iconBtn} aria-label="Sign in">
                <Icon name="user" />
              </Link>
            )}
            {accountOpen && user && (
              <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-ink-100 bg-white p-2 text-sm shadow-lift">
                <div className="px-3 pb-2 pt-1">
                  <p className="font-display font-bold">Hey {user.name.split(' ')[0]} 👋</p>
                  <p className="truncate text-xs text-ink-500">{user.email}</p>
                </div>
                {(
                  [
                    ['/account/orders', 'package', 'My orders'],
                    ['/wishlist', 'heart', 'Wishlist'],
                    ['/account', 'user', 'Profile & addresses'],
                    ['/account/returns', 'returns', 'Returns'],
                    ['/account/notifications', 'bell', 'Updates'],
                  ] as const
                ).map(([href, icon, label]) => (
                  <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-ink-50">
                    <Icon name={icon} className="h-4 w-4 text-ink-500" /> {label}
                  </Link>
                ))}
                <button onClick={() => void logout()} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-brand-700 hover:bg-brand-50">
                  <Icon name="logout" className="h-4 w-4" /> Log out
                </button>
              </div>
            )}
          </div>
          <Link href="/cart" className={cn(iconBtn, 'w-auto gap-1.5 bg-ink-900 px-3.5 text-white hover:bg-ink-800')} aria-label={`Bag, ${cartCount} items`}>
            <Icon name="cart" className="h-[18px] w-[18px]" />
            <span className="text-sm font-bold">{cartCount}</span>
          </Link>
        </div>
      </div>

      {mobileSearch && (
        <div className="container pb-3 md:hidden">
          <SearchBox autoFocus onDone={() => setMobileSearch(false)} />
        </div>
      )}

      {/* Mobile category pills */}
      <nav className="container flex gap-2 overflow-x-auto pb-3 scrollbar-none lg:hidden" aria-label="Categories">
        {categories.map((c) => (
          <Link key={c.id} href={`/c/${c.slug}`} className="shrink-0 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-700">
            {c.name}
          </Link>
        ))}
        <Link href="/search?sort=discount" className="shrink-0 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-600">
          Sale
        </Link>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto rounded-r-3xl bg-page p-5">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className={iconBtn}>
                <Icon name="x" />
              </button>
            </div>
            {categories.map((cat) => (
              <div key={cat.id} className="mb-4">
                <Link href={`/c/${cat.slug}`} className="font-display text-lg font-bold">
                  {cat.name}
                </Link>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cat.children.map((sub) => (
                    <Link key={sub.id} href={`/c/${sub.slug}`} className="rounded-full bg-white px-3 py-1 text-sm text-ink-700 shadow-card">
                      {sub.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-6 space-y-1 border-t border-ink-100 pt-4 text-sm">
              <Link href="/search?sort=discount" className="block py-1.5 font-semibold text-brand-600">Sale</Link>
              <Link href="/account/orders" className="block py-1.5">My orders</Link>
              <Link href="/track" className="block py-1.5">Track an order</Link>
              <Link href="/wishlist" className="block py-1.5">Wishlist</Link>
              {user ? (
                <button onClick={() => void logout()} className="block py-1.5 text-brand-700">Log out</button>
              ) : (
                <Link href="/login" className="block py-1.5 font-semibold">Log in / Sign up</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
