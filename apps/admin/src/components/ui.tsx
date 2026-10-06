'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/format';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-900">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" aria-label="Loading" />
    </div>
  );
}

const COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  DRAFT: 'bg-gray-50 text-gray-600 border-gray-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  SUSPENDED: 'bg-red-50 text-red-700 border-red-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  PACKED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SHIPPED: 'bg-violet-50 text-violet-700 border-violet-200',
  OUT_FOR_DELIVERY: 'bg-violet-50 text-violet-700 border-violet-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REFUNDED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PROCESSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  QC_PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
  ARCHIVED: 'bg-gray-100 text-gray-600 border-gray-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  QC_FAILED: 'bg-red-50 text-red-700 border-red-200',
};

export function Badge({ value }: { value: string }) {
  return <span className={cn('chip whitespace-nowrap', COLORS[value] ?? 'border-gray-200 bg-gray-50 text-gray-700')}>{value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')}</span>;
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-gray-600">
        {page} / {pages}
      </span>
      <button className="btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-gray-500">{text}</p>;
}
