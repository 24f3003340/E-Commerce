'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { cn, inr } from '@/lib/format';
import type { Facets } from '@/lib/types';

const SORTS = [
  { value: 'popular', label: 'Popularity' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Customer rating' },
  { value: 'discount', label: 'Better discount' },
];

const PRICE_BUCKETS = [
  { label: 'Under ₹500', min: undefined, max: 49999 },
  { label: '₹500 – ₹1,000', min: 50000, max: 99999 },
  { label: '₹1,000 – ₹2,000', min: 100000, max: 199999 },
  { label: 'Above ₹2,000', min: 200000, max: undefined },
];

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return {
    params,
    update(changes: Record<string, string | undefined>) {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === undefined || v === '') next.delete(k);
        else next.set(k, v);
      }
      next.delete('page');
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
  };
}

export function SortSelect() {
  const { params, update } = useQueryUpdater();
  const current = params.get('sort') ?? 'popular';
  return (
    <div className="flex items-center gap-1 overflow-x-auto text-sm scrollbar-none">
      <span className="mr-2 shrink-0 font-semibold text-gray-800">Sort By</span>
      {SORTS.map((s) => (
        <button
          key={s.value}
          onClick={() => update({ sort: s.value })}
          aria-pressed={current === s.value}
          className={cn(
            'shrink-0 border-b-2 px-2 py-1.5 transition',
            current === s.value ? 'border-brand-600 font-semibold text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

/** Removable chips for the filters currently applied. */
export function ActiveFilters() {
  const { params, update } = useQueryUpdater();
  const chips: { label: string; remove: () => void }[] = [];
  for (const key of ['size', 'color', 'brand']) {
    for (const v of (params.get(key) ?? '').split(',').filter(Boolean)) {
      chips.push({ label: v, remove: () => update({ [key]: toggleCsv(params.get(key), v) }) });
    }
  }
  if (params.get('minPrice') || params.get('maxPrice')) {
    const min = params.get('minPrice');
    const max = params.get('maxPrice');
    chips.push({
      label: min && max ? `${inr(Number(min))} – ${inr(Number(max) + 1)}` : min ? `Above ${inr(Number(min))}` : `Under ${inr(Number(max) + 1)}`,
      remove: () => update({ minPrice: undefined, maxPrice: undefined }),
    });
  }
  if (params.get('rating')) chips.push({ label: `${params.get('rating')}★ & above`, remove: () => update({ rating: undefined }) });
  if (params.get('discount')) chips.push({ label: `${params.get('discount')}% or more off`, remove: () => update({ discount: undefined }) });
  if (params.get('inStock')) chips.push({ label: 'In stock', remove: () => update({ inStock: undefined }) });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button key={c.label} onClick={c.remove} className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-500">
          {c.label}
          <span aria-hidden>✕</span>
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
    </div>
  );
}

function toggleCsv(current: string | null, value: string) {
  const set = new Set((current ?? '').split(',').filter(Boolean));
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set].join(',') || undefined;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 py-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

export function Filters({ facets }: { facets: Facets }) {
  const { params, update } = useQueryUpdater();
  const [open, setOpen] = useState(false);
  const selected = (key: string) => new Set((params.get(key) ?? '').split(',').filter(Boolean));
  const sizes = selected('size');
  const colors = selected('color');
  const brands = selected('brand');
  const activeCount = ['size', 'color', 'brand', 'minPrice', 'maxPrice', 'rating', 'discount', 'inStock'].filter((k) => params.get(k)).length;

  const body = (
    <div>
      <div className="flex items-center justify-between pb-2">
        <span className="text-sm font-bold">Filters</span>
        {activeCount > 0 && (
          <button
            className="text-xs font-semibold text-brand-700"
            onClick={() => update({ size: undefined, color: undefined, brand: undefined, minPrice: undefined, maxPrice: undefined, rating: undefined, discount: undefined, inStock: undefined })}
          >
            Clear all
          </button>
        )}
      </div>

      {facets.sizes.length > 0 && (
        <Section title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button
                key={s}
                onClick={() => update({ size: toggleCsv(params.get('size'), s) })}
                aria-pressed={sizes.has(s)}
                className={cn('min-w-[2.5rem] rounded-md border px-2 py-1 text-xs font-medium', sizes.has(s) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-300 hover:border-gray-900')}
              >
                {s}
              </button>
            ))}
          </div>
        </Section>
      )}

      {facets.colors.length > 0 && (
        <Section title="Color">
          <div className="space-y-2">
            {facets.colors.map((c) => (
              <label key={c.name} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={colors.has(c.name)} onChange={() => update({ color: toggleCsv(params.get('color'), c.name) })} />
                <span className="h-4 w-4 rounded-full border border-gray-300" style={{ background: c.hex ?? '#ccc' }} />
                {c.name}
              </label>
            ))}
          </div>
        </Section>
      )}

      <Section title="Price">
        <div className="space-y-2">
          {PRICE_BUCKETS.map((b) => {
            const active = params.get('minPrice') === (b.min?.toString() ?? null) && params.get('maxPrice') === (b.max?.toString() ?? null);
            return (
              <label key={b.label} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="price"
                  checked={active}
                  onChange={() => update({ minPrice: b.min?.toString(), maxPrice: b.max?.toString() })}
                />
                {b.label}
              </label>
            );
          })}
          {facets.price.max > 0 && (
            <p className="text-xs text-gray-500">
              Range {inr(facets.price.min)} – {inr(facets.price.max)}
            </p>
          )}
        </div>
      </Section>

      {facets.brands.length > 0 && (
        <Section title="Brand">
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {facets.brands.map((b) => (
              <label key={b} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={brands.has(b)} onChange={() => update({ brand: toggleCsv(params.get('brand'), b) })} />
                {b}
              </label>
            ))}
          </div>
        </Section>
      )}

      <Section title="Customer rating">
        {[4, 3].map((r) => (
          <label key={r} className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="rating" checked={params.get('rating') === String(r)} onChange={() => update({ rating: String(r) })} />
            {r}★ & above
          </label>
        ))}
      </Section>

      <Section title="Discount">
        {[10, 30, 50].map((d) => (
          <label key={d} className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
            <input type="radio" name="discount" checked={params.get('discount') === String(d)} onChange={() => update({ discount: String(d) })} />
            {d}% or more
          </label>
        ))}
      </Section>

      <Section title="Availability">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={params.get('inStock') === 'true'} onChange={(e) => update({ inStock: e.target.checked ? 'true' : undefined })} />
          In stock only
        </label>
      </Section>
    </div>
  );

  return (
    <>
      <button className="btn-outline w-full lg:hidden" onClick={() => setOpen(true)}>
        Filters {activeCount > 0 && `(${activeCount})`}
      </button>
      <aside className="card hidden h-fit p-4 lg:sticky lg:top-32 lg:block">{body}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-full overflow-y-auto bg-white p-5">
            {body}
            <button className="btn-primary mt-4 w-full" onClick={() => setOpen(false)}>
              Show results
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function Pagination({ page, pages }: { page: number; pages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (pages <= 1) return null;
  const go = (p: number) => {
    const next = new URLSearchParams(params.toString());
    next.set('page', String(p));
    router.push(`${pathname}?${next.toString()}`);
  };
  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
      <button className="btn-outline" disabled={page <= 1} onClick={() => go(page - 1)}>
        Previous
      </button>
      <span className="px-3 text-sm text-gray-600">
        Page {page} of {pages}
      </span>
      <button className="btn-outline" disabled={page >= pages} onClick={() => go(page + 1)}>
        Next
      </button>
    </nav>
  );
}
