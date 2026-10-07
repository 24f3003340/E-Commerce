'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { SalesChart, type SalesPoint } from '@/components/SalesChart';
import { Badge, PageHeader, Spinner } from '@/components/ui';
import { api, canAccess } from '@/lib/api';
import { formatDate, inr } from '@/lib/format';

interface Dashboard {
  todaySales: number;
  ordersToday: number;
  customers: number;
  products: number;
  pendingOrders: number;
  returns: number;
  lowStock: number;
  pendingSellers: number;
  pendingProducts: number;
  recentOrders: { id: string; orderNumber: string; customer: string; total: number; status: string; paymentStatus: string; createdAt: string }[];
  salesSeries: SalesPoint[];
}

function Tile({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: 'warn' }) {
  const body = (
    <div className="card h-full p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone === 'warn' && value ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function DashboardPage() {
  const { admin } = useAdmin();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    api<Dashboard>('/admin/dashboard').then(setData);
  }, []);

  if (!data) return <Spinner />;
  const weekSales = data.salesSeries.slice(-7).reduce((s, d) => s + d.sales, 0);
  const canOrders = canAccess(admin.role, 'orders');

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${admin.name}`} />
      {(data.pendingSellers > 0 || data.pendingProducts > 0) && (
        <div className="flex flex-wrap gap-3">
          {data.pendingSellers > 0 && canAccess(admin.role, 'sellers') && (
            <Link href="/sellers?status=PENDING" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100">
              {data.pendingSellers} seller{data.pendingSellers > 1 ? 's' : ''} waiting for approval →
            </Link>
          )}
          {data.pendingProducts > 0 && canAccess(admin.role, 'products') && (
            <Link href="/products?status=PENDING_APPROVAL" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100">
              {data.pendingProducts} seller product{data.pendingProducts > 1 ? 's' : ''} to review →
            </Link>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <Tile label="Today's sales" value={inr(data.todaySales)} />
        <Tile label="Orders today" value={data.ordersToday} href={canOrders ? '/orders' : undefined} />
        <Tile label="Pending orders" value={data.pendingOrders} href={canOrders ? '/orders?status=CONFIRMED' : undefined} tone="warn" />
        <Tile label="Open returns" value={data.returns} href={canOrders ? '/returns' : undefined} tone="warn" />
        <Tile label="Customers" value={data.customers.toLocaleString('en-IN')} />
        <Tile label="Live products" value={data.products.toLocaleString('en-IN')} />
        <Tile label="Low stock SKUs" value={data.lowStock} href={canAccess(admin.role, 'inventory') ? '/inventory?lowStock=true' : undefined} tone="warn" />
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold">Sales — last 14 days</h2>
          <p className="text-sm text-gray-500">Last 7 days: <span className="font-semibold text-gray-900">{inr(weekSales)}</span></p>
        </div>
        <SalesChart data={data.salesSeries} />
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Recent orders</h2>
          {canOrders && (
            <Link href="/orders" className="text-sm font-semibold text-brand-700">
              View all →
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Payment</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>{canOrders ? <Link href={`/orders/${o.id}`} className="font-semibold text-brand-700">{o.orderNumber}</Link> : o.orderNumber}</td>
                  <td>{o.customer}</td>
                  <td>{formatDate(o.createdAt, true)}</td>
                  <td><Badge value={o.status} /></td>
                  <td><Badge value={o.paymentStatus} /></td>
                  <td className="text-right font-semibold">{inr(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
