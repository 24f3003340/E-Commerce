'use client';

import { useState } from 'react';
import { inr } from '@/lib/format';

export interface SalesPoint {
  day: string;
  orders: number;
  sales: number;
}

function niceMax(v: number) {
  if (v <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Single-series daily sales bar chart: one brand hue, thin rounded bars anchored to the
 * baseline, recessive grid, hover tooltip, and a table view for screen readers.
 */
export function SalesChart({ data, title = 'Sales' }: { data: SalesPoint[]; title?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 240;
  const pad = { l: 64, r: 12, t: 12, b: 28 };
  const max = niceMax(Math.max(...data.map((d) => d.sales), 0));
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const step = innerW / Math.max(data.length, 1);
  const barW = Math.max(4, Math.min(28, step * 0.6));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.ceil(data.length / 8);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const hovered = hover !== null ? data[hover] : null;

  return (
    <figure className="relative">
      <figcaption className="sr-only">{title} per day</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title} per day bar chart`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#6b7280">
              {inr(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + step * i + step / 2;
          const h = Math.max(0, pad.t + innerH - y(d.sales));
          const r = Math.min(4, h, barW / 2);
          const x0 = cx - barW / 2;
          const top = pad.t + innerH - h;
          // Bar with 4px rounded data-end and a square baseline
          const path = h > 0
            ? `M${x0},${pad.t + innerH} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${pad.t + innerH} Z`
            : '';
          return (
            <g key={d.day}>
              {path && <path d={path} fill={hover === i ? '#263578' : '#2e3f8f'} />}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b7280">
                  {shortDay(d.day)}
                </text>
              )}
              {/* Hit target wider and taller than the bar */}
              <rect x={pad.l + step * i} y={pad.t} width={step} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${shortDay(d.day)}: ${inr(d.sales)}, ${d.orders} orders`} />
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + innerH} y2={pad.t + innerH} stroke="#9ca3af" strokeWidth={1} />
      </svg>
      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{ left: `${((pad.l + step * hover + step / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <p className="font-semibold text-gray-900">{shortDay(hovered.day)}</p>
          <p className="text-gray-700">{inr(hovered.sales)}</p>
          <p className="text-gray-500">{hovered.orders} orders</p>
        </div>
      )}
      <table className="sr-only">
        <thead>
          <tr>
            <th>Day</th>
            <th>Sales</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{inr(d.sales)}</td>
              <td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
