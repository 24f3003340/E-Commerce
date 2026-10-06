'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSeller } from '@/components/SellerShell';
import { Badge, PageHeader, Spinner } from '@/components/ui';
import { formatDate, inr } from '@/lib/format';
import { sellerApi } from '@/lib/sellerApi';
import type { Earnings } from '@/lib/types';

interface SellerDashboard {
  products: Record<string, number>;
  ordersToShip: number;
  ordersThisMonth: number;
  salesThisMonth: number;
  lowStock: number;
  recentOrders: { id: string; orderNumber: string; customer: string; subtotal: number; status: string; paymentMethod: string; createdAt: string }[];
  earnings: Earnings['totals'];
}

function Tile({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: 'warn' | 'good' }) {
  const body = (
    <div className="card h-full p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone === 'warn' && value ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href} className="block transition hover:-translate-y-0.5">{body}</Link> : body;
}

export default function SellerDashboardPage() {
  const { seller } = useSeller();
  const [data, setData] = useState<SellerDashboard | null>(null);

  useEffect(() => {
    sellerApi<SellerDashboard>('/seller/dashboard').then(setData);
  }, []);
  if (!data) return <Spinner />;
  const live = data.products.ACTIVE ?? 0;
  const inReview = data.products.PENDING_APPROVAL ?? 0;
  const approved = seller.status === 'APPROVED';

  return (
    <div className="space-y-6">
      <PageHeader title={`Hello, ${seller.name.split(' ')[0]} 👋`} subtitle={seller.storeName} actions={<Link href="/seller/products/new" className="btn-primary">+ Add product</Link>} />

      {live + inReview + (data.products.DRAFT ?? 0) === 0 && (
        <section className="card p-5">
          <h2 className="font-bold">Get your store ready</h2>
          <ol className="mt-3 space-y-2 text-sm">
            <li>1. <Link href="/seller/profile" className="font-semibold text-brand-700">Check your GSTIN, pickup address and bank details</Link></li>
            <li>2. <Link href="/seller/products/new" className="font-semibold text-brand-700">Add your first product</Link> with clear photos, sizes and stock, then choose “Publish”</li>
            <li>3. Our team reviews your store and products — you get an email when they are live</li>
          </ol>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Orders to ship" value={data.ordersToShip} href={approved ? '/seller/orders?status=CONFIRMED' : undefined} tone="warn" />
        <Tile label="Orders this month" value={data.ordersThisMonth} href={approved ? '/seller/orders' : undefined} />
        <Tile label="Sales this month" value={inr(data.salesThisMonth)} />
        <Tile label="Live products" value={live} href="/seller/products?status=ACTIVE" />
        <Tile label="In review" value={inReview} href="/seller/products?status=PENDING_APPROVAL" tone="warn" />
        <Tile label="Low stock SKUs" value={data.lowStock} href="/seller/inventory?lowStock=true" tone="warn" />
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Earnings</h2>
          <Link href="/seller/earnings" className="text-sm font-semibold text-brand-700">Details →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-emerald-50 p-3"><p className="text-xs text-emerald-800">Ready for payout</p><p className="text-xl font-bold text-emerald-900">{inr(data.earnings.readyForPayout)}</p></div>
          <div className="rounded-md bg-amber-50 p-3"><p className="text-xs text-amber-800">On hold (not delivered / return window)</p><p className="text-xl font-bold text-amber-900">{inr(data.earnings.onHold)}</p></div>
          <div className="rounded-md bg-gray-50 p-3"><p className="text-xs text-gray-600">Paid to you</p><p className="text-xl font-bold">{inr(data.earnings.paidOut)}</p></div>
        </div>
      </section>

      {data.recentOrders.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Recent orders</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Status</th><th className="text-right">Item value</th></tr></thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/seller/orders/${o.id}`} className="font-semibold text-brand-700">{o.orderNumber}</Link></td>
                    <td>{o.customer}</td>
                    <td>{formatDate(o.createdAt, true)}</td>
                    <td className="text-xs">{o.paymentMethod === 'COD' ? 'Cash on delivery' : 'Prepaid'}</td>
                    <td><Badge value={o.status} /></td>
                    <td className="text-right font-semibold">{inr(o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
