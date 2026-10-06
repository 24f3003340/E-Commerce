'use client';

import { useEffect, useState } from 'react';
import { SalesChart, type SalesPoint } from '@/components/SalesChart';
import { PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';

interface Report {
  series: SalesPoint[];
  summary: { orders: number; sales: number; averageOrderValue: number; discounts: number; shipping: number; refunds: number; cancelledOrders: number };
  byPaymentMethod: { method: string; orders: number; sales: number }[];
  topProducts: { productId: string; name: string; quantity: number; sales: number }[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ReportsPage() {
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const [data, setData] = useState<Report | null>(null);

  useEffect(() => {
    setData(null);
    api<Report>(`/admin/reports/sales?from=${from}&to=${to}`).then(setData);
  }, [from, to]);

  const csv = () => {
    if (!data) return;
    const rows = [['Day', 'Orders', 'Sales (INR)'], ...data.series.map((d) => [d.day, String(d.orders), (d.sales / 100).toFixed(2)])];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales-${from}-to-${to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales report"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input w-auto" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <span className="text-gray-500">to</span>
            <input type="date" className="input w-auto" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" />
            <button className="btn-outline" onClick={csv} disabled={!data}>Export CSV</button>
          </div>
        }
      />
      {!data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['Net sales', inr(data.summary.sales)],
              ['Orders', data.summary.orders],
              ['Avg. order value', inr(data.summary.averageOrderValue)],
              ['Refunds', inr(data.summary.refunds)],
              ['Coupon discounts', inr(data.summary.discounts)],
              ['Shipping collected', inr(data.summary.shipping)],
              ['Cancelled orders', data.summary.cancelledOrders],
            ].map(([label, value]) => (
              <div key={label} className="card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-2 text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Daily sales</h2>
            <SalesChart data={data.series} />
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-3 font-bold">Top products</h2>
              <table className="table">
                <thead><tr><th>Product</th><th>Units</th><th className="text-right">Sales</th></tr></thead>
                <tbody>
                  {data.topProducts.map((p) => (
                    <tr key={p.productId}><td>{p.name}</td><td>{p.quantity}</td><td className="text-right">{inr(p.sales)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="card p-5">
              <h2 className="mb-3 font-bold">By payment method</h2>
              <table className="table">
                <thead><tr><th>Method</th><th>Orders</th><th className="text-right">Sales</th></tr></thead>
                <tbody>
                  {data.byPaymentMethod.map((m) => (
                    <tr key={m.method}><td>{m.method === 'COD' ? 'Cash on delivery' : 'Online'}</td><td>{m.orders}</td><td className="text-right">{inr(m.sales)}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
