'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getAuth, logout as apiLogout, onAuthChange, setAuth, type AuthState } from '@/lib/api';
import type { Cart, User } from '@/lib/types';

const GUEST_CART_KEY = 'sk_guest_cart';

export interface GuestCartItem {
  variantId: string;
  quantity: number;
  productName: string;
  productSlug: string;
  label: string;
  image: string | null;
  price: number;
  mrp: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface StoreContextValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  cartCount: number;
  guestCart: GuestCartItem[];
  refreshCart: () => Promise<void>;
  addToCart: (item: GuestCartItem) => Promise<void>;
  updateGuestItem: (variantId: string, quantity: number) => void;
  wishlist: Set<string>;
  toggleWishlist: (productId: string) => Promise<void>;
  toast: (message: string, type?: Toast['type']) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function readGuestCart(): GuestCartItem[] {
  try {
    return JSON.parse(window.localStorage.getItem(GUEST_CART_KEY) ?? '[]') as GuestCartItem[];
  } catch {
    return [];
  }
}

function writeGuestCart(items: GuestCartItem[]) {
  try {
    window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [ready, setReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [guestCart, setGuestCart] = useState<GuestCartItem[]>([]);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!getAuth()) {
      const items = readGuestCart();
      setGuestCart(items);
      setCartCount(items.reduce((s, i) => s + i.quantity, 0));
      return;
    }
    try {
      const cart = await api<Cart>('/cart');
      setCartCount(cart.items.reduce((s, i) => s + i.quantity, 0));
    } catch {
      setCartCount(0);
    }
  }, []);

  const loadWishlist = useCallback(async () => {
    if (!getAuth()) return setWishlist(new Set());
    try {
      setWishlist(new Set(await api<string[]>('/wishlist/ids')));
    } catch {
      setWishlist(new Set());
    }
  }, []);

  useEffect(() => {
    setAuthState(getAuth());
    setReady(true);
    void refreshCart();
    void loadWishlist();
    return onAuthChange((next) => setAuthState(next));
  }, [refreshCart, loadWishlist]);

  /** After login: move the guest cart into the account cart. */
  const afterLogin = useCallback(
    async (next: AuthState) => {
      setAuth(next);
      const guest = readGuestCart();
      if (guest.length) {
        await api('/cart/merge', { method: 'POST', body: { items: guest.map(({ variantId, quantity }) => ({ variantId, quantity })) } }).catch(() => undefined);
        writeGuestCart([]);
        setGuestCart([]);
      }
      await Promise.all([refreshCart(), loadWishlist()]);
    },
    [refreshCart, loadWishlist],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<AuthState>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
      await afterLogin(res);
    },
    [afterLogin],
  );

  const register = useCallback(
    async (data: { name: string; email: string; phone?: string; password: string }) => {
      const res = await api<AuthState>('/auth/register', { method: 'POST', body: data, auth: false });
      await afterLogin(res);
    },
    [afterLogin],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setWishlist(new Set());
    await refreshCart();
    router.push('/');
  }, [refreshCart, router]);

  const addToCart = useCallback(
    async (item: GuestCartItem) => {
      if (getAuth()) {
        await api('/cart/items', { method: 'POST', body: { variantId: item.variantId, quantity: item.quantity } });
      } else {
        const items = readGuestCart();
        const existing = items.find((i) => i.variantId === item.variantId);
        if (existing) existing.quantity = Math.min(10, existing.quantity + item.quantity);
        else items.push(item);
        writeGuestCart(items);
      }
      await refreshCart();
    },
    [refreshCart],
  );

  const updateGuestItem = useCallback(
    (variantId: string, quantity: number) => {
      const items = readGuestCart()
        .map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0);
      writeGuestCart(items);
      void refreshCart();
    },
    [refreshCart],
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!getAuth()) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const has = wishlist.has(productId);
      setWishlist((prev) => {
        const next = new Set(prev);
        if (has) next.delete(productId);
        else next.add(productId);
        return next;
      });
      try {
        await api(`/wishlist/${productId}`, { method: has ? 'DELETE' : 'POST' });
        toast(has ? 'Removed from wishlist' : 'Added to wishlist');
      } catch {
        void loadWishlist();
      }
    },
    [wishlist, router, toast, loadWishlist],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      user: auth?.user ?? null,
      ready,
      login,
      register,
      logout,
      cartCount,
      guestCart,
      refreshCart,
      addToCart,
      updateGuestItem,
      wishlist,
      toggleWishlist,
      toast,
    }),
    [auth, ready, login, register, logout, cartCount, guestCart, refreshCart, addToCart, updateGuestItem, wishlist, toggleWishlist, toast],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-md px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              t.type === 'error' ? 'bg-red-600' : t.type === 'info' ? 'bg-ink-800' : 'bg-emerald-600'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Redirects to login when the visitor is not signed in. Returns the user once known. */
export function useRequireAuth() {
  const { user, ready } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [ready, user, router]);
  return { user, ready: ready && !!user };
}
