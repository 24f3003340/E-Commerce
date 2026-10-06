'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState, Price, Spinner } from '@/components/ui';
import { useStore } from '@/context/StoreProvider';
import { api, ApiError } from '@/lib/api';
import { inr } from '@/lib/format';
import type { Cart } from '@/lib/types';

const ISSUE_TEXT = {
  UNAVAILABLE: 'No longer available',
  OUT_OF_STOCK: 'Out of stock',
  INSUFFICIENT_STOCK: 'Only a few left — reduce quantity',
};

function GuestCart() {
  const { guestCart, updateGuestItem } = useStore();
  const router = useRouter();
  if (!guestCart.length) {
    return <EmptyState title="Your cart is empty" text="Looks like you haven't added anything yet." action={<Link href="/" className="btn-primary">Start shopping</Link>} />;
  }
  const subtotal = guestCart.reduce((s, i) => s + i.price * i.quantity, 0);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul className="space-y-4">
        {guestCart.map((item) => (
          <li key={item.variantId} className="card flex gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image && <img src={item.image} alt="" className="h-28 w-20 rounded object-cover" />}
            <div className="flex-1">
              <Link href={`/p/${item.productSlug}`} className="font-medium hover:underline">
                {item.productName}
              </Link>
              <p className="text-sm text-gray-500">{item.label}</p>
              <Price price={item.price} mrp={item.mrp} size="sm" />
              <div className="mt-2 flex items-center gap-3">
                <select value={item.quantity} onChange={(e) => updateGuestItem(item.variantId, Number(e.target.value))} className="rounded border px-2 py-1 text-sm" aria-label="Quantity">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <button className="text-sm text-red-600" onClick={() => updateGuestItem(item.variantId, 0)}>
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="card h-fit p-5">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>{inr(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">Shipping and coupons are applied at checkout.</p>
        <button className="btn-buy mt-4 w-full py-3" onClick={() => router.push('/login?next=/checkout')}>
          Login to checkout
        </button>
      </div>
    </div>
  );
}

function AccountCart() {
  const { refreshCart, toast } = useStore();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);

  const load = useCallback(async () => setCart(await api<Cart>('/cart')), []);
  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (fn: () => Promise<Cart>) => {
    try {
      setCart(await fn());
      await refreshCart();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
    }
  };

  if (!cart) return <Spinner />;
  if (!cart.items.length) {
    return <EmptyState title="Your cart is empty" text="Looks like you haven't added anything yet." action={<Link href="/" className="btn-primary">Start shopping</Link>} />;
  }
  const s = cart.summary;
  const toFree = s.freeShippingThreshold - (s.subtotal - s.couponDiscount);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <ul className="space-y-4">
        {cart.items.map((item) => (
          <li key={item.id} className="card flex gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {item.image && <img src={item.image} alt="" className="h-28 w-20 rounded object-cover" />}
            <div className="flex-1">
              <Link href={`/p/${item.product.slug}`} className="font-medium hover:underline">
                {item.product.name}
              </Link>
              <p className="text-sm text-gray-500">{item.variant.label}</p>
              <Price price={item.variant.price} mrp={item.variant.mrp} size="sm" />
              {item.issue && <p className="mt-1 text-xs font-semibold text-red-600">{ISSUE_TEXT[item.issue]}</p>}
              <div className="mt-2 flex items-center gap-3">
                <select
                  value={item.quantity}
                  onChange={(e) => void mutate(() => api<Cart>(`/cart/items/${item.id}`, { method: 'PATCH', body: { quantity: Number(e.target.value) } }))}
                  className="rounded border px-2 py-1 text-sm"
                  aria-label="Quantity"
                  disabled={item.issue === 'UNAVAILABLE' || item.issue === 'OUT_OF_STOCK'}
                >
                  {Array.from({ length: Math.max(item.variant.maxQuantity, item.quantity) }, (_, i) => i + 1).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <button className="text-sm text-red-600" onClick={() => void mutate(() => api<Cart>(`/cart/items/${item.id}`, { method: 'DELETE' }))}>
                  Remove
                </button>
              </div>
            </div>
            <p className="font-semibold">{inr(item.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <div className="card h-fit space-y-2 p-5 text-sm">
        <h2 className="mb-2 font-bold">Price details ({s.itemCount} items)</h2>
        <div className="flex justify-between">
          <span>Total MRP</span>
          <span>{inr(s.mrpTotal)}</span>
        </div>
        {s.productDiscount > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Discount on MRP</span>
            <span>−{inr(s.productDiscount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Shipping</span>
          <span>{s.shippingFee ? inr(s.shippingFee) : <span className="text-emerald-700">FREE</span>}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span>{inr(s.total)}</span>
        </div>
        {toFree > 0 && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">Add {inr(toFree)} more for FREE delivery</p>}
        <button className="btn-buy mt-3 w-full py-3 text-base" disabled={cart.hasIssues} onClick={() => router.push('/checkout')}>
          Place Order
        </button>
        {cart.hasIssues && <p className="text-xs text-red-600">Remove unavailable items to continue.</p>}
      </div>
    </div>
  );
}

export default function CartPage() {
  const { user, ready } = useStore();
  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Shopping cart</h1>
      {!ready ? <Spinner /> : user ? <AccountCart /> : <GuestCart />}
    </div>
  );
}
