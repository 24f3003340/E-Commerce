import { gstBreakdown } from './gst';

const settings = { gstRateLow: 5, gstRateHigh: 18, gstHighRateAbove: 250000, defaultHsn: '6109', sellerState: 'Karnataka' };

describe('GST breakdown', () => {
  it('splits CGST/SGST for same-state delivery and adds up to the order total', () => {
    const g = gstBreakdown(
      { subtotal: 105000, discount: 0, shippingFee: 0, codFee: 0, shipState: 'karnataka', items: [{ productName: 'Tee', variantLabel: 'M', unitPrice: 105000, quantity: 1, total: 105000 }] },
      settings,
    );
    expect(g.intraState).toBe(true);
    expect(g.taxable).toBe(100000);
    expect(g.cgst + g.sgst).toBe(5000);
    expect(g.igst).toBe(0);
    expect(g.total).toBe(105000);
  });

  it('uses IGST across states, the high slab above the threshold, and shares discounts', () => {
    const g = gstBreakdown(
      {
        subtotal: 400000,
        discount: 20000,
        shippingFee: 7900,
        codFee: 0,
        shipState: 'Maharashtra',
        items: [
          { productName: 'Watch', variantLabel: 'Black', unitPrice: 300000, quantity: 1, total: 300000 },
          { productName: 'Tee', variantLabel: 'M', unitPrice: 50000, quantity: 2, total: 100000 },
        ],
      },
      settings,
    );
    expect(g.intraState).toBe(false);
    expect(g.lines[0].rate).toBe(18);
    expect(g.lines[1].rate).toBe(5);
    expect(g.lines[0].gross + g.lines[1].gross).toBe(380000);
    expect(g.lines[2].rate).toBe(18);
    expect(g.total).toBe(400000 - 20000 + 7900);
  });
});
