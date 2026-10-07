import { PaymentMethod } from '@prisma/client';
import { buildShiprocketOrder, istDateTime, mapShiprocketWebhook, sellerPickupName } from './shiprocket.mapper';

const order = {
  orderNumber: 'ORD-20261007-000012',
  createdAt: new Date('2026-10-07T08:35:00Z'),
  paymentMethod: PaymentMethod.COD,
  subtotal: 149800,
  discount: 10000,
  shippingFee: 7900,
  codFee: 4900,
  customerEmail: 'asha@example.com',
  shippingAddress: { name: 'Asha Rani Verma', phone: '9876543210', line1: '7 Park Street', line2: 'Flat 3B', landmark: 'Near metro', city: 'Kolkata', state: 'West Bengal', pincode: '700016' },
  items: [
    { productName: 'Cotton Kurta', variantLabel: 'White / M', sku: 'KUR-W-M', unitPrice: 74900, quantity: 2, hsn: '6211' },
  ],
};
const size = { weightKg: 0.5, lengthCm: 30, breadthCm: 25, heightCm: 5 };

describe('buildShiprocketOrder', () => {
  it('maps a COD order so the courier collects exactly the order total', () => {
    const p = buildShiprocketOrder(order, 'Primary', size);
    expect(p.payment_method).toBe('COD');
    expect(p.billing_customer_name).toBe('Asha');
    expect(p.billing_last_name).toBe('Rani Verma');
    expect(p.billing_address).toBe('7 Park Street, Near metro');
    expect(p.order_items[0]).toEqual({ name: 'Cotton Kurta (White / M)', sku: 'KUR-W-M', units: 2, selling_price: 749, hsn: '6211' });
    const collect = p.sub_total + p.shipping_charges + p.transaction_charges - p.total_discount;
    expect(collect).toBeCloseTo((149800 + 7900 + 4900 - 10000) / 100);
    expect(p.order_date).toBe('2026-10-07 14:05');
  });

  it('marks online orders as prepaid', () => {
    expect(buildShiprocketOrder({ ...order, paymentMethod: PaymentMethod.ONLINE, codFee: 0 }, 'Primary', size).payment_method).toBe('Prepaid');
  });
});

describe('mapShiprocketWebhook', () => {
  it('uses the latest scan for location, note and time (IST)', () => {
    const u = mapShiprocketWebhook({
      awb: 19041424751540,
      current_status: 'IN TRANSIT',
      scans: [
        { date: '2026-10-07 10:00:00', activity: 'Manifested', location: 'Mumbai' },
        { date: '2026-10-07 18:30:00', activity: 'Shipment picked up', location: 'Andheri Hub (Maharashtra)' },
      ],
    });
    expect(u).toEqual({
      awb: '19041424751540',
      status: 'IN TRANSIT',
      location: 'Andheri Hub (Maharashtra)',
      note: 'Shipment picked up',
      occurredAt: '2026-10-07T18:30:00+05:30',
    });
  });

  it('ignores payloads without an AWB or status (e.g. Shiprocket test pings)', () => {
    expect(mapShiprocketWebhook({})).toBeNull();
    expect(mapShiprocketWebhook({ awb: '123' })).toBeNull();
  });
});

describe('helpers', () => {
  it('formats IST dates and pickup names', () => {
    expect(istDateTime(new Date('2026-01-31T20:00:00Z'))).toBe('2026-02-01 01:30');
    expect(sellerPickupName('a-very-long-seller-store-name-that-goes-on')).toHaveLength(36);
  });
});
