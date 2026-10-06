'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Price, Stars } from '@/components/ui';
import { useStore } from '@/context/StoreProvider';
import { api, ApiError } from '@/lib/api';
import { cn, formatDate } from '@/lib/format';
import type { ProductDetail } from '@/lib/types';

interface Serviceability {
  serviceable: boolean;
  codAvailable: boolean;
  estimatedDelivery?: { from: string; to: string };
}

export function ProductPurchase({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const { addToCart, toast, wishlist, toggleWishlist } = useStore();
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
  const [busy, setBusy] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  const [pincode, setPincode] = useState('');
  const [svc, setSvc] = useState<Serviceability | null>(null);
  const [showChart, setShowChart] = useState(false);

  const images = useMemo(() => {
    const forColor = product.images.filter((i) => i.color === color);
    return forColor.length ? forColor : product.images;
  }, [product.images, color]);

  const variant = product.variants.find((v) => v.color === color && v.size === size) ??
    (sizes.length === 0 ? product.variants.find((v) => v.color === color) : undefined);
  const sizeAvailable = (s: string) => product.variants.some((v) => v.size === s && v.color === color && v.inStock);
  const wished = wishlist.has(product.id);

  const add = async (buyNow: boolean) => {
    if (!variant) {
      setSizeError(true);
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

  const checkPincode = async () => {
    if (!/^\d{6}$/.test(pincode)) return toast('Enter a valid 6 digit pincode', 'error');
    try {
      setSvc(await api<Serviceability>(`/serviceability?pincode=${pincode}`, { auth: false }));
    } catch {
      setSvc({ serviceable: false, codAvailable: false });
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <div className="flex gap-2 sm:flex-col">
          {images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => setImageIndex(i)}
              aria-label={`Show image ${i + 1}`}
              className={cn('h-20 w-16 overflow-hidden rounded border-2', i === imageIndex ? 'border-brand-600' : 'border-transparent')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="relative aspect-[3/4] flex-1 overflow-hidden rounded-lg bg-gray-100">
          {images[imageIndex] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[imageIndex].url} alt={images[imageIndex].alt ?? product.name} className="h-full w-full object-cover" />
          )}
        </div>
      </div>

      {/* Info */}
      <div>
        {product.brand && <p className="text-sm font-bold uppercase tracking-wide text-gray-500">{product.brand}</p>}
        <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>
        {product.ratingCount > 0 && (
          <a href="#reviews" className="mt-2 inline-block">
            <Stars value={product.ratingAvg} count={product.ratingCount} />
          </a>
        )}
        <div className="mt-4 border-t pt-4">
          <Price price={variant?.price ?? product.price} mrp={variant?.mrp ?? product.mrp} size="lg" />
          <p className="mt-1 text-xs text-emerald-700">Inclusive of all taxes</p>
        </div>

        {colors.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold">
              Color: <span className="font-normal text-gray-600">{color}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {colors.map(([name, hex]) => (
                <button
                  key={name}
                  title={name}
                  aria-label={name}
                  aria-pressed={color === name}
                  onClick={() => {
                    setColor(name);
                    setImageIndex(0);
                  }}
                  className={cn('h-9 w-9 rounded-full border-2 p-0.5', color === name ? 'border-brand-600' : 'border-gray-200')}
                >
                  <span className="block h-full w-full rounded-full border border-gray-200" style={{ background: hex ?? '#ccc' }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {sizes.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <p className={cn('text-sm font-semibold', sizeError && 'text-red-600')}>{sizeError ? 'Please select a size' : 'Select size'}</p>
              {product.sizeChart && (
                <button onClick={() => setShowChart(true)} className="text-xs font-semibold text-brand-700">
                  Size chart
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
                      'min-w-[3rem] rounded-full border px-3 py-2 text-sm font-semibold',
                      size === s ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-300 hover:border-gray-900',
                      !available && 'cursor-not-allowed text-gray-300 line-through hover:border-gray-300',
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {variant && variant.inStock && variant.stock <= 5 && <p className="mt-2 text-xs font-semibold text-orange-600">Only {variant.stock} left!</p>}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button className="btn-primary flex-1 py-3" disabled={busy || (variant && !variant.inStock)} onClick={() => void add(false)}>
            {variant && !variant.inStock ? 'Out of stock' : 'Add to cart'}
          </button>
          <button className="btn-dark flex-1 py-3" disabled={busy || (variant && !variant.inStock)} onClick={() => void add(true)}>
            Buy now
          </button>
          <button className="btn-outline px-4" onClick={() => void toggleWishlist(product.id)} aria-pressed={wished} aria-label="Wishlist">
            <span className={wished ? 'text-rose-600' : ''}>{wished ? '♥' : '♡'}</span>
          </button>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-semibold">Delivery options</p>
          <div className="mt-2 flex gap-2">
            <input value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter pincode" inputMode="numeric" className="input" aria-label="Pincode" />
            <button className="btn-outline" onClick={() => void checkPincode()}>
              Check
            </button>
          </div>
          {svc && (
            <div className="mt-3 text-sm">
              {svc.serviceable && svc.estimatedDelivery ? (
                <>
                  <p className="text-emerald-700">
                    ✓ Delivery by {formatDate(svc.estimatedDelivery.to)}
                  </p>
                  <p className="text-gray-600">{svc.codAvailable ? '✓ Cash on delivery available' : '✗ Cash on delivery not available'}</p>
                </>
              ) : (
                <p className="text-red-600">Sorry, we do not deliver to this pincode yet.</p>
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            {product.returnPolicy.isReturnable ? `Easy ${product.returnPolicy.returnWindowDays}-day returns & exchange` : 'This item is not returnable'}
          </p>
        </div>
      </div>

      {showChart && product.sizeChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowChart(false)} />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Size chart (inches)</h2>
              <button onClick={() => setShowChart(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {Object.keys(product.sizeChart[0]).map((k) => (
                    <th key={k} className="py-2 text-left capitalize">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {product.sizeChart.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="py-2">
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
