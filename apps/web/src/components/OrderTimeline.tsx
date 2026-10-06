import { formatDate, ORDER_STATUS_LABEL, cn } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';

const STEPS: OrderStatus[] = ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export function OrderTimeline({ status, history }: { status: OrderStatus; history: { status: OrderStatus; createdAt: string; note: string | null }[] }) {
  if (status === 'CANCELLED' || status === 'PENDING_PAYMENT') {
    const last = history[history.length - 1];
    return (
      <div className={cn('rounded-md p-4 text-sm', status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-800')}>
        <p className="font-semibold">{ORDER_STATUS_LABEL[status]}</p>
        {last?.note && <p className="mt-1">{last.note}</p>}
      </div>
    );
  }
  const order = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentIndex = order.indexOf(status);
  return (
    <ol className="relative ml-3 border-l-2 border-gray-200">
      {STEPS.map((step) => {
        const done = order.indexOf(step) <= currentIndex;
        const entry = [...history].reverse().find((h) => h.status === step);
        return (
          <li key={step} className="mb-6 ml-6 last:mb-0">
            <span className={cn('absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white', done ? 'bg-emerald-600' : 'bg-gray-300')} />
            <p className={cn('text-sm font-semibold', done ? 'text-gray-900' : 'text-gray-400')}>{ORDER_STATUS_LABEL[step]}</p>
            {entry && (
              <p className="text-xs text-gray-500">
                {formatDate(entry.createdAt, true)}
                {entry.note ? ` · ${entry.note}` : ''}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
