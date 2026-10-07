import { PaymentMethod } from '@prisma/client';

/** Package size the person booking enters (kg / cm). */
export interface PackageSize {
  weightKg: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
}

export interface CourierOrderInput {
  orderNumber: string;
  createdAt: Date;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  shippingAddress: unknown;
  customerEmail: string;
  items: { productName: string; variantLabel: string; sku: string; unitPrice: number; quantity: number; hsn?: string | null }[];
}

const rupees = (paise: number) => Math.round(paise) / 100;

/** "2026-10-07 14:05" in Indian time, the format Shiprocket expects. */
export function istDateTime(date: Date): string {
  return new Date(date.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Builds a Shiprocket "create adhoc order" payload. Amounts are rupees. For COD the courier
 * collects sub_total + shipping_charges + transaction_charges − total_discount, which equals the
 * order total customers saw at checkout.
 */
export function buildShiprocketOrder(order: CourierOrderInput, pickupLocation: string, size: PackageSize) {
  const a = order.shippingAddress as Record<string, string | null | undefined>;
  const [first, ...rest] = String(a.name ?? 'Customer').trim().split(/\s+/);
  return {
    order_id: order.orderNumber,
    order_date: istDateTime(order.createdAt),
    pickup_location: pickupLocation,
    billing_customer_name: first,
    billing_last_name: rest.join(' '),
    billing_address: [a.line1, a.landmark].filter(Boolean).join(', '),
    billing_address_2: a.line2 ?? '',
    billing_city: a.city ?? '',
    billing_pincode: a.pincode ?? '',
    billing_state: a.state ?? '',
    billing_country: 'India',
    billing_email: order.customerEmail,
    billing_phone: a.phone ?? '',
    shipping_is_billing: true,
    order_items: order.items.map((i) => ({
      name: `${i.productName} (${i.variantLabel})`.slice(0, 200),
      sku: i.sku,
      units: i.quantity,
      selling_price: rupees(i.unitPrice),
      ...(i.hsn ? { hsn: i.hsn } : {}),
    })),
    payment_method: order.paymentMethod === PaymentMethod.COD ? 'COD' : 'Prepaid',
    sub_total: rupees(order.subtotal),
    total_discount: rupees(order.discount),
    shipping_charges: rupees(order.shippingFee),
    transaction_charges: rupees(order.codFee),
    length: size.lengthCm,
    breadth: size.breadthCm,
    height: size.heightCm,
    weight: size.weightKg,
  };
}

export interface TrackingUpdate {
  awb: string;
  status: string;
  location?: string;
  note?: string;
  occurredAt?: string;
}

/**
 * Turns a Shiprocket tracking webhook into our tracking update. Shiprocket sends the latest status
 * plus the scan history; the newest scan supplies location and description.
 */
export function mapShiprocketWebhook(body: unknown): TrackingUpdate | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const awb = b.awb != null ? String(b.awb).trim() : '';
  const status = String(b.current_status ?? b.shipment_status ?? '').trim();
  if (!awb || !status) return null;
  const scans = Array.isArray(b.scans) ? (b.scans as Record<string, unknown>[]) : [];
  const last = scans[scans.length - 1];
  const date = typeof last?.date === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(last.date) ? `${last.date.replace(' ', 'T').slice(0, 19)}+05:30` : undefined;
  return {
    awb,
    status,
    location: typeof last?.location === 'string' ? last.location.slice(0, 120) : undefined,
    note: typeof last?.activity === 'string' ? last.activity.slice(0, 300) : undefined,
    occurredAt: date,
  };
}

/** Pickup nickname for a marketplace seller (Shiprocket allows up to 36 characters). */
export function sellerPickupName(slug: string): string {
  return `SK-${slug}`.slice(0, 36);
}
