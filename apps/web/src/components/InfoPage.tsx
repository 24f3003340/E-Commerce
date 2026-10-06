import Link from 'next/link';
import type { ReactNode } from 'react';
import { Breadcrumbs } from './ui';

const LINKS = [
  ['/about', 'About us'],
  ['/contact', 'Contact us'],
  ['/faq', 'FAQs'],
  ['/shipping-policy', 'Shipping policy'],
  ['/return-policy', 'Returns & refunds'],
  ['/terms', 'Terms of use'],
  ['/privacy', 'Privacy policy'],
] as const;

export function InfoPage({ title, updated, children, path }: { title: string; updated?: string; children: ReactNode; path: string }) {
  return (
    <div className="container py-4">
      <Breadcrumbs items={[{ label: title }]} />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav className="card h-fit p-2 text-sm lg:sticky lg:top-32" aria-label="Help pages">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`block rounded-md px-3 py-2 ${href === path ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <article className="card p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {updated && <p className="mt-1 text-xs text-gray-500">Last updated: {updated}</p>}
          <div className="prose-info mt-6 space-y-4 text-sm leading-7 text-gray-700">{children}</div>
        </article>
      </div>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-base font-bold text-gray-900">{children}</h2>;
}
