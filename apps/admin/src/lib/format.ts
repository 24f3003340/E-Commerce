import type { OrderStatus } from './types';

/** Formats integer paise as Indian Rupees, e.g. 149900 → ₹1,499 */
export function inr(paise: number, opts: { decimals?: boolean } = {}): string {
  const rupees = paise / 100;
  const digits = opts.decimals || paise % 100 !== 0 ? 2 : 0;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatDate(value: string | Date, withTime = false): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const RETURN_REASONS: Record<string, string> = {
  WRONG_SIZE: 'Wrong size',
  WRONG_PRODUCT: 'Wrong product received',
  DAMAGED: 'Damaged',
  DEFECTIVE: 'Defective',
  NOT_AS_EXPECTED: 'Not as expected',
  OTHER: 'Other',
};

export function humanize(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
