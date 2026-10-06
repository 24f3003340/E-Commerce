'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { Price, Stars } from '@/components/ui';
import { useStore } from '@/context/StoreProvider';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate, inr } from '@/lib/format';
import type { ProductDetail } from '@/lib/types';
import { usePincode } from '@/lib/usePincode';

interface Serviceability {
  serviceable: boolean;
  codAvailable: boolean;
  estimatedDelivery?: { from: string; to: string };
}

interface PublicCoupon {
  code: string;
  description: string | null;
  minOrderValue: number;
  applicableCategoryIds?: string[];
}

export function ProductPurchase({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { addToCart, toast, wishlist, toggleWishlist } = useStore();
  const { pincode: savedPincode, setPincode: savePincode } = usePincode();
  const colors = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const v of product.variants) if (v.color && !map.has(v.color)) map.set(v.color, v.colorHex);
    return [...map];
  }, [product.variants]);
  const sizes = useMemo(() => [...new Set(product.variants.map((v) => v.size).filter((s): s is string => !!s))], [product.variants]);

  const firstInStock = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [color, setColor] = useState<string | null>(firstInStock?.color ?? null);
  const [size, setSize] = useState<string | null>(sizes.length <= 1 ? (sizes[0] ?? null) : null);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [pincode, setPincodeInput] = useState('');
  const [svc, setSvc] = useState<Serviceability | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [coupons, setCoupons] = useState<PublicCoupon[]>([]);

  useEffect(() => {
    // Only show coupons that can apply to this product (category-restricted ones must match its category tree)
    const trail = new Set(product.breadcrumbs.map((b) => b.id));
    api<PublicCoupon[]>('/coupons', { auth: false })
      .then((list) => setCoupons(list.filter((c) => !c.applicableCategoryIds?.length || c.applicableCategoryIds.some((id) => trail.has(id)))))
      .catch(() => undefined);
  }, [product.breadcrumbs]);

  const checkPincode = async (code: string, quiet = false) => {
    if (!/^\d{6}$/.test(code)) {
      if (!quiet) toast('Enter a valid 6 digit pincode', 'error');
      return;
    }
    try {
      setSvc(await api<Serviceability>(`/serviceability?pincode=${code}`, { auth: false }));
      savePincode(code);
    } catch {
      setSvc({ serviceable: false, codAvailable: false });
    }
  };

  useEffect(() => {
    if (savedPincode && !pincode) {
      setPincodeInput(savedPincode);
      void checkPincode(savedPincode, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPincode]);

  const imagesFor = (c: string | null) => {
    const forColor = product.images.filter((i) => i.color === c);
    return forColor.length ? forColor : product.images;
  };
  const images = imagesFor(color);

  const variant =
    product.variants.find((v) => v.color === color && v.size === size) ??
    (sizes.length === 0 ? product.variants.find((v) => v.color === color) : undefined);
  const sizeAvailable = (s: string) => product.variants.some((v) => v.size === s && v.color === color && v.inStock);
  const wished = wishlist.has(product.id);
  const unavailable = variant ? !variant.inStock : !product.variants.some((v) => v.inStock);
  const price = variant?.price ?? product.price;
  const mrp = variant?.mrp ?? product.mrp;

  const add = async (buyNow: boolean) => {
    if (!variant) {
      setSizeError(true);
      document.getElementById('size-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    try {
      await addToCart({
        variantId: variant.id,
        quantity: 1,
        productName: product.name,
        productSlug: product.slug,
        label: [variant.color, variant.size].filter(Boolean).join(' / '),
        image: images[0]?.url ?? null,
        price: variant.price,
        mrp: variant.mrp,
      });
      if (buyNow) router.push('/cart');
      else toast('Added to cart');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not add to cart', 'error');
    } finally {
      setBusy(false);
    }
  };

  const actionButtons = (
    <>
      <button className="btn-cart flex-1 py-4 text-base" disabled={busy || unavailable} onClick={() => void add(false)}>
        <Icon name="cart" className="h-[18px] w-[18px]" /> {unavailable ? 'Sold out' : 'Add to bag'}
      </button>
      <button className="btn-buy flex-1 py-4 text-base" disabled={busy || unavailable} onClick={() => void add(true)}>
        Buy now
      </button>
    </>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12">
      {/* Gallery */}
      <div className="lg:sticky lg:top-32 lg:self-start">
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <div className="flex gap-2 overflow-x-auto scrollbar-none sm:flex-col">
            {images.map((img, i) => (
              <button
                key={img.url}
                onMouseEnter={() => setImageIndex(i)}
                onClick={() => setImageIndex(i)}
                aria-label={`Show image ${i + 1}`}
                className={cn('h-20 w-16 shrink-0 overflow-hidden rounded border-2 bg-ink-50', i === imageIndex ? 'border-ink-900' : 'border-ink-100 hover:border-ink-300')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          <div
            className="relative aspect-[4/5] flex-1 cursor-zoom-in overflow-hidden rounded-2xl border border-ink-100 bg-ink-50"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
            }}
            onMouseLeave={() => setZoom(null)}
          >
            {images[imageIndex] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={images[imageIndex].url}
                alt={images[imageIndex].alt ?? product.name}
                className="h-full w-full object-cover transition-transform duration-150"
                style={zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
              />
            )}
            <button
              onClick={() => void toggleWishlist(product.id)}
              aria-pressed={wished}
              aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card transition hover:scale-110"
            >
              <Icon name="heart" filled={wished} className={cn('h-5 w-5', wished ? 'text-brand-500' : 'text-ink-300')} />
            </button>
          </div>
        </div>
        <div className="mt-4 hidden gap-3 lg:flex">{actionButtons}</div>
      </div>

      {/* Details */}
      <div className="min-w-0">
        {product.brand && <p className="eyebrow">{product.brand}</p>}
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-ink-900 sm:text-4xl">{product.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {product.ratingCount > 0 ? (
            <a href="#reviews" className="flex items-center gap-2">
              <Stars value={product.ratingAvg} />
              <span className="font-medium text-ink-500">
                {product.ratingCount} rating{product.ratingCount === 1 ? '' : 's'} & reviews
              </span>
            </a>
          ) : (
            <span className="text-ink-500">Be the first to review</span>
          )}
        </div>

        <div className="mt-5">
          <Price price={price} mrp={mrp} size="lg" />
          <p className="mt-1 text-xs text-ink-500">Inclusive of all taxes · {price >= 99900 ? 'Free delivery' : 'Free delivery on orders above ₹999'}</p>
        </div>

        {coupons.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-bold">Offers for you</p>
            <ul className="space-y-2 text-sm">
              {coupons.slice(0, 4).map((c) => (
                <li key={c.code} className="flex gap-2">
                  <Icon name="tag" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <span>
                    <span className="font-semibold">Coupon {c.code}</span> — {c.description}
                    {c.minOrderValue > 0 && <span className="text-ink-500"> (min. order {inr(c.minOrderValue)})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {colors.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm">
              <span className="font-bold">Colour:</span> <span className="text-ink-700">{color}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {colors.map(([name, hex]) => {
                const thumb = imagesFor(name)[0];
                const anyStock = product.variants.some((v) => v.color === name && v.inStock);
                return (
                  <button
                    key={name}
                    title={name}
                    aria-label={name}
                    aria-pressed={color === name}
                    onClick={() => {
                      setColor(name);
                      setImageIndex(0);
                    }}
                    className={cn('relative h-16 w-14 overflow-hidden rounded-xl border-2 bg-ink-50 transition', color === name ? 'border-ink-900' : 'border-ink-100 hover:border-ink-300', !anyStock && 'opacity-50')}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="block h-full w-full" style={{ background: hex ?? '#ccc' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {sizes.length > 0 && (
          <div className="mt-6" id="size-picker">
            <div className="mb-2 flex items-center gap-4">
              <p className={cn('text-sm font-bold', sizeError && 'text-brand-700')}>{sizeError ? 'Please select a size' : 'Select size'}</p>
              {product.sizeChart && (
                <button onClick={() => setShowChart(true)} className="flex items-center gap-1 text-sm font-semibold text-brand-700">
                  <Icon name="ruler" className="h-4 w-4" /> Size chart
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const available = sizeAvailable(s);
                return (
                  <button
                    key={s}
                    disabled={!available}
                    aria-pressed={size === s}
                    onClick={() => {
                      setSize(s);
                      setSizeError(false);
                    }}
                    className={cn(
                      'min-w-[3.25rem] rounded-full border px-4 py-2 text-sm font-semibold transition',
                      size === s ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white hover:border-ink-900',
                      !available && 'cursor-not-allowed border-dashed bg-ink-50 text-ink-300 line-through hover:border-ink-200',
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {variant && variant.inStock && variant.stock <= 5 && <p className="mt-2 text-sm font-semibold text-brand-700">Hurry, only {variant.stock} left!</p>}
          </div>
        )}

        <div className="mt-6 grid gap-4 rounded-2xl border border-ink-100 p-4 sm:grid-cols-[auto_1fr]">
          <p className="flex items-center gap-2 text-sm font-bold text-ink-700">
            <Icon name="pin" className="h-4 w-4" /> Delivery
          </p>
          <div>
            <form
              className="flex max-w-sm border-b-2 border-ink-900"
              onSubmit={(e) => {
                e.preventDefault();
                void checkPincode(pincode);
              }}
            >
              <input
                value={pincode}
                onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter delivery pincode"
                inputMode="numeric"
                className="w-full bg-transparent py-1.5 text-sm font-medium outline-none"
                aria-label="Pincode"
              />
              <button className="px-2 text-sm font-bold text-brand-600">Check</button>
            </form>
            {svc ? (
              svc.serviceable && svc.estimatedDelivery ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    Delivery by <span className="font-bold">{formatDate(svc.estimatedDelivery.to)}</span>
                    <span className="text-ink-500"> | </span>
                    <span className="text-sage-700">{price >= 99900 ? 'Free delivery' : 'Free on orders above ₹999'}</span>
                  </p>
                  <p className="text-ink-500">{svc.codAvailable ? 'Cash on Delivery available' : 'Cash on Delivery not available'}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-brand-700">Sorry, we do not deliver to this pincode yet.</p>
              )
            ) : (
              <p className="mt-2 text-xs text-ink-500">Enter your pincode to check delivery date and COD availability.</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-ink-700">
          {(
            [
              ['returns', product.returnPolicy.isReturnable ? `${product.returnPolicy.returnWindowDays}-day return` : 'No returns'],
              ['card', 'Cash on Delivery'],
              ['shield', 'Original product'],
            ] as const
          ).map(([icon, label]) => (
            <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-ink-50 px-2 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-100 text-sage-700">
                <Icon name={icon} className="h-4 w-4" />
              </span>
              {label}
            </div>
          ))}
        </div>


        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <div className="mt-6 border-t border-ink-100 pt-5">
            <p className="mb-2 text-sm font-bold">Highlights</p>
            <ul className="grid list-disc gap-x-8 gap-y-1.5 pl-5 text-sm text-ink-700 sm:grid-cols-2">
              {product.material && <li>{product.material}</li>}
              {Object.entries(product.specifications).slice(0, 7).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mobile sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-0 border-t bg-white shadow-lift lg:hidden [&>button]:rounded-none">{actionButtons}</div>

      {showChart && product.sizeChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Size chart">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowChart(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Size chart (inches)</h2>
              <button onClick={() => setShowChart(false)} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-ink-50">
                  {Object.keys(product.sizeChart[0]).map((k) => (
                    <th key={k} className="px-2 py-2 text-left capitalize">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {product.sizeChart.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-2 py-2">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
