import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn, inr } from '@/lib/format';

export function Price({ price, mrp, size = 'md' }: { price: number; mrp: number; size?: 'sm' | 'md' | 'lg' }) {
  const off = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn('font-bold text-gray-900', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-lg')}>{inr(price)}</span>
      {off > 0 && (
        <>
          <span className={cn('text-gray-500 line-through', size === 'lg' ? 'text-base' : 'text-xs')}>{inr(mrp)}</span>
          <span className={cn('font-semibold text-emerald-600', size === 'lg' ? 'text-base' : 'text-xs')}>{off}% off</span>
        </>
      )}
    </div>
  );
}

export function Stars({ value, count, small }: { value: number; count?: number; small?: boolean }) {
  if (!value && !count) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5', small ? 'text-xs' : 'text-sm')}>
      <span className={cn('inline-flex items-center gap-0.5 rounded px-1.5 font-semibold text-white', value >= 3 ? 'bg-emerald-600' : 'bg-amber-500', small ? 'py-px text-[11px]' : 'py-0.5')}>
        {value.toFixed(1)}
        <svg viewBox="0 0 24 24" className={small ? 'h-2.5 w-2.5' : 'h-3 w-3'} fill="currentColor" aria-hidden>
          <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1L12 2Z" />
        </svg>
      </span>
      {count !== undefined && <span className="font-medium text-gray-500">({count.toLocaleString('en-IN')})</span>}
    </span>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-gray-500">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link href="/" className="hover:text-gray-900">
            Home
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            <span aria-hidden>/</span>
            {item.href ? (
              <Link href={item.href} className="hover:text-gray-900">
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-900">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1 max-w-md text-sm text-gray-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center py-16', className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" aria-label="Loading" />
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  PACKED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SHIPPED: 'bg-violet-50 text-violet-700 border-violet-200',
  OUT_FOR_DELIVERY: 'bg-violet-50 text-violet-700 border-violet-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
  REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={cn('chip', STATUS_COLORS[status] ?? 'border-gray-200 bg-gray-50 text-gray-700')}>
      {label ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}
