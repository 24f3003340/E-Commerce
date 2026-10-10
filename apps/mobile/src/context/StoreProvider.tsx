import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, errorMessage, loadAuth, logout as apiLogout, onAuthChange, setAuth, type AuthState } from '../lib/api';
import { colors } from '../lib/theme';
import type { Cart } from '../lib/types';

interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

interface StoreContextValue {
  auth: AuthState | null;
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  register(data: RegisterInput): Promise<void>;
  logout(): Promise<void>;
  cartCount: number;
  refreshCart(): Promise<Cart | null>;
  addToCart(variantId: string, quantity?: number): Promise<boolean>;
  wishlist: Set<string>;
  toggleWishlist(productId: string): Promise<void>;
  toast(message: string): void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(null);
  const [ready, setReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [toastText, setToastText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void loadAuth().then((a) => {
      setAuthState(a);
      setReady(true);
    });
    return onAuthChange(setAuthState);
  }, []);

  const toast = useCallback(
    (message: string) => {
      setToastText(message);
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setToastText(null));
    },
    [opacity],
  );

  const refreshCart = useCallback(async () => {
    if (!auth) {
      setCartCount(0);
      return null;
    }
    try {
      const cart = await api<Cart>('/cart');
      setCartCount(cart.summary.itemCount);
      return cart;
    } catch {
      return null;
    }
  }, [auth]);

  const loadWishlist = useCallback(async () => {
    if (!auth) {
      setWishlist(new Set());
      return;
    }
    try {
      setWishlist(new Set(await api<string[]>('/wishlist/ids')));
    } catch {
      // keep the previous state
    }
  }, [auth]);

  useEffect(() => {
    if (!ready) return;
    void refreshCart();
    void loadWishlist();
  }, [ready, refreshCart, loadWishlist]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<AuthState>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
    await setAuth(res);
  }, []);

  const register = useCallback(async (data: RegisterInput) => {
    const res = await api<AuthState>('/auth/register', { method: 'POST', body: data, auth: false });
    await setAuth(res);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setCartCount(0);
    setWishlist(new Set());
  }, []);

  const addToCart = useCallback(
    async (variantId: string, quantity = 1) => {
      if (!auth) {
        router.push('/login');
        return false;
      }
      try {
        await api('/cart/items', { method: 'POST', body: { variantId, quantity } });
        await refreshCart();
        toast('Added to bag');
        return true;
      } catch (err) {
        toast(errorMessage(err));
        return false;
      }
    },
    [auth, refreshCart, toast],
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!auth) {
        router.push('/login');
        return;
      }
      const has = wishlist.has(productId);
      const next = new Set(wishlist);
      if (has) next.delete(productId);
      else next.add(productId);
      setWishlist(next);
      try {
        await api(`/wishlist/${productId}`, { method: has ? 'DELETE' : 'POST' });
        toast(has ? 'Removed from wishlist' : 'Added to wishlist');
      } catch (err) {
        toast(errorMessage(err));
        void loadWishlist();
      }
    },
    [auth, wishlist, toast, loadWishlist],
  );

  const value = useMemo(
    () => ({ auth, ready, login, register, logout, cartCount, refreshCart, addToCart, wishlist, toggleWishlist, toast }),
    [auth, ready, login, register, logout, cartCount, refreshCart, addToCart, wishlist, toggleWishlist, toast],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      {toastText && (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity, bottom: insets.bottom + 72 }]}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      )}
    </StoreContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: colors.brandDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: '90%',
  },
  toastText: { color: '#fff', fontWeight: '600' },
});
