'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/format';
import { usePincode } from '@/lib/usePincode';
import type { Category } from '@/lib/types';
import { Icon } from './icons';

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? 'StyleKart';

interface Suggestions {
  products: { name: string; slug: string; images: { url: string }[] }[];
  categories: { name: string; slug: string }[];
}

export function Logo({ light = true }: { light?: boolean }) {
  return (
    <Link href="/" className="flex shrink-0 flex-col leading-none" aria-label={`${STORE_NAME} home`}>
      <span className={cn('text-[22px] font-extrabold italic tracking-tight', light ? 'text-white' : 'text-navy-900')}>
        {STORE_NAME}
      </span>
      <span className="mt-0.5 text-[10px] font-medium italic text-accent-300">
        Explore <span className="font-bold">Plus</span> ✦
      </span>
    </Link>
  );
}

function SearchBox({ categories, onDone }: { categories: Category[]; onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('');
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
    ...(sugg?.categories.map((c) => ({ key: `c-${c.slug}`, href: `/c/${c.slug}`, label: c.name, kind: 'category' as const, image: undefined })) ?? []),
    ...(sugg?.products.map((p) => ({ key: `p-${p.slug}`, href: `/p/${p.slug}`, label: p.name, kind: 'product' as const, image: p.images[0]?.url })) ?? []),
  ];

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    onDone?.();
    router.push(href);
  };

  const submit = () => {
    if (active >= 0 && items[active]) return go(items[active].href);
    const term = q.trim();
    if (!term && !scope) return;
    if (scope && !term) return go(`/c/${scope}`);
    go(scope ? `/c/${scope}?q=${encodeURIComponent(term)}` : `/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <form
      role="search"
      className="relative flex w-full"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <select
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        aria-label="Search in category"
        className="hidden max-w-[130px] rounded-l-md border-r border-gray-300 bg-gray-100 px-2 text-xs text-gray-700 outline-none hover:bg-gray-200 sm:block"
      >
        <option value="">All</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        value={q}
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
        placeholder="Search for products, brands and more"
        aria-label="Search"
        className="h-10 w-full rounded-l-md px-4 text-sm text-gray-900 outline-none placeholder:text-gray-500 sm:rounded-none"
      />
      <button type="submit" aria-label="Search" className="flex h-10 w-12 shrink-0 items-center justify-center rounded-r-md bg-accent-400 text-navy-950 hover:bg-accent-500">
        <Icon name="search" />
      </button>
      {open && items.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lift">
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onMouseDown={() => go(item.href)}
              onMouseEnter={() => setActive(i)}
              className={cn('flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-800', i === active && 'bg-gray-100')}
            >
              {item.kind === 'category' ? (
                <>
                  <Icon name="search" className="h-4 w-4 text-gray-400" />
                  <span>
                    <span className="font-semibold">{item.label}</span> <span className="text-xs text-brand-600">in Categories</span>
                  </span>
                </>
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {item.image ? <img src={item.image} alt="" className="h-10 w-8 rounded object-cover" /> : <span className="h-10 w-8" />}
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

function PincodeButton() {
  const { pincode, setPincode } = usePincode();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  return (
    <div className="relative hidden lg:block">
      <button onClick={() => { setValue(pincode ?? ''); setOpen((o) => !o); }} className="flex items-end gap-1 rounded px-2 py-1 text-left text-white hover:outline hover:outline-1 hover:outline-white/60">
        <Icon name="pin" className="mb-0.5 h-5 w-5" />
        <span className="leading-tight">
          <span className="block text-[11px] text-gray-300">Deliver to</span>
          <span className="block text-sm font-bold">{pincode ?? 'Select pincode'}</span>
        </span>
      </button>
      {open && (
        <form
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg bg-white p-4 text-gray-900 shadow-lift"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^[1-9]\d{5}$/.test(value)) {
              setPincode(value);
              setOpen(false);
            }
          }}
        >
          <p className="text-sm font-semibold">Choose your location</p>
          <p className="mt-1 text-xs text-gray-500">Delivery options and speeds may vary by pincode.</p>
          <div className="mt-3 flex gap-2">
            <input autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit pincode" className="input" aria-label="Pincode" />
            <button className="btn-cart px-3">Apply</button>
          </div>
        </form>
      )}
    </div>
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
    <header className="sticky top-0 z-40 shadow-md">
      {/* Main bar */}
      <div className="bg-navy-900">
        <div className="container flex h-16 items-center gap-3 lg:gap-5">
          <button className="text-white lg:hidden" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" className="h-6 w-6" />
          </button>
          <Logo />
          <PincodeButton />
          <div className="hidden flex-1 md:flex">
            <SearchBox categories={categories} />
          </div>

          <div className="ml-auto flex items-center gap-1 text-white md:ml-0 lg:gap-2">
            <div className="relative" ref={accountRef}>
              {user ? (
                <button
                  onClick={() => setAccountOpen((o) => !o)}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left hover:outline hover:outline-1 hover:outline-white/60"
                  aria-expanded={accountOpen}
                  aria-label="Account menu"
                >
                  <Icon name="user" className="h-5 w-5 sm:hidden" />
                  <span className="hidden leading-tight sm:block">
                    <span className="block text-[11px] text-gray-300">Hello, {user.name.split(' ')[0]}</span>
                    <span className="flex items-center gap-0.5 text-sm font-bold">
                      Account & Lists <Icon name="chevronDown" className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </button>
              ) : (
                <Link href="/login" className="flex items-center gap-2 rounded px-2 py-1 hover:outline hover:outline-1 hover:outline-white/60" aria-label="Sign in">
                  <Icon name="user" className="h-5 w-5 sm:hidden" />
                  <span className="hidden leading-tight sm:block">
                    <span className="block text-[11px] text-gray-300">Hello, sign in</span>
                    <span className="block text-sm font-bold">Account & Lists</span>
                  </span>
                </Link>
              )}
              {accountOpen && user && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-lg bg-white py-2 text-sm text-gray-800 shadow-lift">
                  <div className="border-b px-4 pb-2">
                    <p className="font-semibold">{user.name}</p>
                    <p className="truncate text-xs text-gray-500">{user.email}</p>
                  </div>
                  {(
                    [
                      ['/account', 'user', 'My Profile'],
                      ['/account/orders', 'package', 'Orders'],
                      ['/wishlist', 'heart', 'Wishlist'],
                      ['/account/returns', 'returns', 'Returns & Refunds'],
                      ['/account/notifications', 'bell', 'Notifications'],
                    ] as const
                  ).map(([href, icon, label]) => (
                    <Link key={href} href={href} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50">
                      <Icon name={icon} className="h-4 w-4 text-brand-600" /> {label}
                    </Link>
                  ))}
                  <button onClick={() => void logout()} className="flex w-full items-center gap-3 border-t px-4 py-2 text-left text-red-600 hover:bg-gray-50">
                    <Icon name="logout" className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>

            <Link href="/account/orders" className="hidden rounded px-2 py-1 leading-tight hover:outline hover:outline-1 hover:outline-white/60 lg:block">
              <span className="block text-[11px] text-gray-300">Returns</span>
              <span className="block text-sm font-bold">& Orders</span>
            </Link>

            <Link href="/wishlist" className="relative rounded p-2 hover:outline hover:outline-1 hover:outline-white/60" aria-label={`Wishlist, ${wishlist.size} items`}>
              <Icon name="heart" className="h-6 w-6" />
              {wishlist.size > 0 && (
                <span className="absolute -right-0.5 top-0 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px]">{wishlist.size}</span>
              )}
            </Link>

            <Link href="/cart" className="relative flex items-end gap-1 rounded px-2 py-1 hover:outline hover:outline-1 hover:outline-white/60" aria-label={`Cart, ${cartCount} items`}>
              <span className="relative">
                <Icon name="cart" className="h-7 w-7" />
                <span className="absolute -right-2 -top-1.5 min-w-[20px] rounded-full bg-accent-400 px-1 text-center text-[11px] font-extrabold leading-5 text-navy-950">{cartCount}</span>
              </span>
              <span className="hidden text-sm font-bold sm:block">Cart</span>
            </Link>
          </div>
        </div>
        <div className="container pb-3 md:hidden">
          <SearchBox categories={categories} />
        </div>
      </div>

      {/* Category strip */}
      <nav className="bg-navy-800 text-white" aria-label="Categories">
        <div className="container flex h-10 items-center gap-1 overflow-x-auto text-sm scrollbar-none lg:overflow-visible">
          <button onClick={() => setMenuOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 font-bold hover:outline hover:outline-1 hover:outline-white/60">
            <Icon name="menu" className="h-4 w-4" /> All
          </button>
          {categories.map((cat) => (
            <div key={cat.id} className="group relative shrink-0">
              <Link href={`/c/${cat.slug}`} className="flex items-center gap-0.5 rounded px-2 py-1 hover:outline hover:outline-1 hover:outline-white/60">
                {cat.name}
                {cat.children.length > 0 && <Icon name="chevronDown" className="hidden h-3.5 w-3.5 opacity-70 lg:block" />}
              </Link>
              {cat.children.length > 0 && (
                <div className="invisible absolute left-0 top-full z-50 hidden pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100 lg:block">
                  <div className="w-64 rounded-lg bg-white p-2 text-gray-800 shadow-lift">
                    <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-gray-500">{cat.name}</p>
                    {cat.children.map((sub) => (
                      <Link key={sub.id} href={`/c/${sub.slug}`} className="flex items-center justify-between rounded px-3 py-2 text-sm hover:bg-brand-50 hover:text-brand-700">
                        {sub.name} <Icon name="chevronRight" className="h-4 w-4 opacity-40" />
                      </Link>
                    ))}
                    <Link href={`/c/${cat.slug}`} className="mt-1 block rounded border-t px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                      View all {cat.name}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link href="/search?sort=discount" className="shrink-0 rounded px-2 py-1 font-semibold text-accent-300 hover:outline hover:outline-1 hover:outline-white/60">
            Today&apos;s Deals
          </Link>
          <Link href="/search?sort=newest" className="shrink-0 rounded px-2 py-1 hover:outline hover:outline-1 hover:outline-white/60">
            New Arrivals
          </Link>
          <Link href="/track" className="ml-auto hidden shrink-0 items-center gap-1 rounded px-2 py-1 hover:outline hover:outline-1 hover:outline-white/60 lg:flex">
            <Icon name="truck" className="h-4 w-4" /> Track Order
          </Link>
        </div>
      </nav>

      {/* Side drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto bg-white">
            <div className="flex items-center gap-3 bg-navy-800 px-5 py-4 text-white">
              <Icon name="user" className="h-7 w-7 rounded-full bg-white/15 p-1" />
              <span className="text-lg font-bold">{user ? `Hello, ${user.name.split(' ')[0]}` : <Link href="/login">Hello, sign in</Link>}</span>
              <button aria-label="Close menu" onClick={() => setMenuOpen(false)} className="ml-auto">
                <Icon name="x" />
              </button>
            </div>
            <p className="px-5 pb-1 pt-4 text-base font-bold">Shop by Category</p>
            {categories.map((cat) => (
              <div key={cat.id} className="border-b border-gray-100 px-5 py-2">
                <Link href={`/c/${cat.slug}`} className="flex items-center justify-between py-1 font-semibold">
                  {cat.name} <Icon name="chevronRight" className="h-4 w-4 text-gray-400" />
                </Link>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pb-1">
                  {cat.children.map((sub) => (
                    <Link key={sub.id} href={`/c/${sub.slug}`} className="text-sm text-gray-600 hover:text-brand-700">
                      {sub.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <p className="px-5 pb-1 pt-4 text-base font-bold">Help & Settings</p>
            <div className="space-y-1 px-5 pb-6 text-sm">
              <Link href="/account" className="block py-1.5">Your Account</Link>
              <Link href="/account/orders" className="block py-1.5">Your Orders</Link>
              <Link href="/track" className="block py-1.5">Track Order</Link>
              <Link href="/account/returns" className="block py-1.5">Returns & Refunds</Link>
              {user ? (
                <button onClick={() => void logout()} className="block py-1.5 text-red-600">Sign out</button>
              ) : (
                <Link href="/login" className="block py-1.5 font-semibold text-brand-700">Sign in</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
