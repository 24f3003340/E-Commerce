'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AddressForm } from '@/components/AddressForm';
import { Spinner } from '@/components/ui';
import { useRequireAuth, useStore } from '@/context/StoreProvider';
import { api, ApiError } from '@/lib/api';
import { cn, inr } from '@/lib/format';
import type { Address, Cart, GatewayPayment, Order } from '@/lib/types';
import { usePayment } from '@/lib/usePayment';

interface PublicCoupon {
  code: string;
  description: string | null;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-3 font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CheckoutPage() {
  const { ready } = useRequireAuth();
  const { refreshCart, toast } = useStore();
  const router = useRouter();
  const { pay, dialog } = usePayment();

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressId, setAddressId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'STANDARD' | 'EXPRESS'>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'COD'>('ONLINE');
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | undefined>();
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);
  const [quote, setQuote] = useState<Cart | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!ready) return;
    api<Address[]>('/me/addresses').then((list) => {
      setAddresses(list);
      setAddressId(list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? '');
      setAdding(list.length === 0);
    });
    api<PublicCoupon[]>('/coupons', { auth: false }).then(setCoupons).catch(() => undefined);
  }, [ready]);

  const loadQuote = useCallback(async () => {
    const q = await api<Cart>('/cart/quote', { method: 'POST', body: { couponCode, paymentMethod, deliveryMethod } });
    setQuote(q);
    if (q.couponError && couponCode) {
      toast(q.couponError, 'error');
      setCouponCode(undefined);
    }
  }, [couponCode, paymentMethod, deliveryMethod, toast]);

  useEffect(() => {
    if (ready) void loadQuote();
  }, [ready, loadQuote]);

  useEffect(() => {
    if (quote && !quote.items.length && !placing) router.replace('/cart');
  }, [quote, placing, router]);

  if (!ready || !quote || !addresses) return <Spinner />;
  const s = quote.summary;

  const placeOrder = async () => {
    if (!addressId) return toast('Please add a delivery address', 'error');
    setPlacing(true);
    try {
      const res = await api<{ order: Order; payment: GatewayPayment | null }>('/orders', {
        method: 'POST',
        body: { addressId, paymentMethod, deliveryMethod, couponCode },
      });
      await refreshCart();
      if (res.payment) {
        const result = await pay(res.payment);
        if (result === 'failed') toast('Payment failed. You can retry from your order page.', 'error');
        if (result === 'dismissed') toast('Payment not completed. You can retry from your order page.', 'info');
      }
      router.replace(`/account/orders/${res.order.orderNumber}?placed=1`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not place order', 'error');
      setPlacing(false);
      void loadQuote();
    }
  };

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Step n={1} title="Delivery address">
            {addresses.length > 0 && !adding && (
              <div className="space-y-3">
                {addresses.map((a) => (
                  <label key={a.id} className={cn('flex cursor-pointer gap-3 rounded-md border p-3 text-sm', addressId === a.id ? 'border-brand-600 bg-brand-50' : 'border-ink-100')}>
                    <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span>
                      <span className="font-semibold">{a.name}</span> · {a.phone}
                      <br />
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}
                    </span>
                  </label>
                ))}
                <button className="text-sm font-semibold text-brand-700" onClick={() => setAdding(true)}>
                  + Add a new address
                </button>
              </div>
            )}
            {adding && (
              <AddressForm
                onSaved={(a) => {
                  setAddresses((list) => [a, ...(list ?? []).map((x) => (a.isDefault ? { ...x, isDefault: false } : x))]);
                  setAddressId(a.id);
                  setAdding(false);
                }}
                onCancel={addresses.length ? () => setAdding(false) : undefined}
              />
            )}
          </Step>

          <Step n={2} title="Delivery method">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['STANDARD', 'Standard delivery', '3–7 days', s.subtotal - s.couponDiscount >= s.freeShippingThreshold ? 'FREE' : null],
                  ['EXPRESS', 'Express delivery', '1–3 days', null],
                ] as const
              ).map(([value, label, eta, free]) => (
                <label key={value} className={cn('cursor-pointer rounded-md border p-3 text-sm', deliveryMethod === value ? 'border-brand-600 bg-brand-50' : 'border-ink-100')}>
                  <input type="radio" name="delivery" className="mr-2" checked={deliveryMethod === value} onChange={() => setDeliveryMethod(value)} />
                  <span className="font-semibold">{label}</span>
                  <span className="block pl-6 text-ink-500">
                    {eta} {free && <span className="font-semibold text-emerald-700">· {free}</span>}
                  </span>
                </label>
              ))}
            </div>
          </Step>

          <Step n={3} title="Apply coupon">
            {quote.coupon ? (
              <div className="flex items-center justify-between rounded-md bg-emerald-50 p-3 text-sm">
                <span>
                  <span className="font-bold text-emerald-800">{quote.coupon.code}</span> applied · you save {inr(s.couponDiscount)}
                </span>
                <button className="text-sm font-semibold text-red-600" onClick={() => setCouponCode(undefined)}>
                  Remove
                </button>
              </div>
            ) : (
              <>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (couponInput.trim()) setCouponCode(couponInput.trim().toUpperCase());
                  }}
                >
                  <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Enter coupon code" className="input uppercase" aria-label="Coupon code" />
                  <button className="btn-outline">Apply</button>
                </form>
                {coupons.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {coupons.map((c) => (
                      <li key={c.code} className="flex items-center justify-between rounded border border-dashed border-ink-200 p-2 text-sm">
                        <span>
                          <span className="font-bold">{c.code}</span> <span className="text-ink-500">— {c.description}</span>
                        </span>
                        <button className="text-xs font-semibold text-brand-700" onClick={() => setCouponCode(c.code)}>
                          Apply
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Step>

          <Step n={4} title="Payment method">
            <div className="space-y-3">
              <label className={cn('flex cursor-pointer gap-3 rounded-md border p-3 text-sm', paymentMethod === 'ONLINE' ? 'border-brand-600 bg-brand-50' : 'border-ink-100')}>
                <input type="radio" name="payment" checked={paymentMethod === 'ONLINE'} onChange={() => setPaymentMethod('ONLINE')} />
                <span>
                  <span className="font-semibold">Pay online</span>
                  <span className="block text-ink-500">UPI, credit / debit card, net banking, wallets</span>
                </span>
              </label>
              <label
                className={cn(
                  'flex gap-3 rounded-md border p-3 text-sm',
                  paymentMethod === 'COD' ? 'border-brand-600 bg-brand-50' : 'border-ink-100',
                  s.codAvailable || paymentMethod === 'COD' ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                )}
              >
                <input type="radio" name="payment" disabled={!s.codAvailable && paymentMethod !== 'COD'} checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} />
                <span>
                  <span className="font-semibold">Cash on delivery</span>
                  <span className="block text-ink-500">{s.codAvailable ? 'Pay when your order arrives (small COD fee applies)' : 'Not available for this order'}</span>
                </span>
              </label>
            </div>
          </Step>
        </div>

        <aside className="card h-fit space-y-2 p-5 text-sm lg:sticky lg:top-24">
          <h2 className="mb-2 font-bold">Order summary</h2>
          <ul className="mb-3 space-y-2 border-b pb-3">
            {quote.items.map((i) => (
              <li key={i.id} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.image && <img src={i.image} alt="" className="h-14 w-11 rounded object-cover" />}
                <span className="flex-1">
                  <span className="line-clamp-1">{i.product.name}</span>
                  <span className="text-xs text-ink-500">
                    {i.variant.label} × {i.quantity}
                  </span>
                </span>
                <span>{inr(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{inr(s.subtotal)}</span>
          </div>
          {s.couponDiscount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Coupon discount</span>
              <span>−{inr(s.couponDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{s.shippingFee ? inr(s.shippingFee) : 'FREE'}</span>
          </div>
          {s.codFee > 0 && (
            <div className="flex justify-between">
              <span>COD fee</span>
              <span>{inr(s.codFee)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{inr(s.total)}</span>
          </div>
          {s.productDiscount + s.couponDiscount > 0 && (
            <p className="text-xs font-semibold text-emerald-700">You save {inr(s.productDiscount + s.couponDiscount)} on this order</p>
          )}
          <button className="btn-buy mt-3 w-full py-3 text-base" disabled={placing || !addressId || quote.hasIssues} onClick={() => void placeOrder()}>
            {placing ? 'Placing order…' : paymentMethod === 'COD' ? 'Place order' : `Pay ${inr(s.total)}`}
          </button>
          <p className="text-center text-xs text-ink-500">🔒 Payments are processed securely</p>
        </aside>
      </div>
      {dialog}
    </div>
  );
}
