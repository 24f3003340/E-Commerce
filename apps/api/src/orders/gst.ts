import { StoreSettings } from '../common/settings.service';

export interface GstLine {
  label: string;
  hsn: string;
  quantity: number;
  /** Amount charged incl. GST, after any discount share (paise) */
  gross: number;
  rate: number;
  taxable: number;
  tax: number;
}

export interface GstBreakdown {
  lines: GstLine[];
  intraState: boolean;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

const split = (gross: number, rate: number) => {
  const taxable = Math.round((gross * 100) / (100 + rate));
  return { taxable, tax: gross - taxable };
};

/**
 * GST breakdown for tax-inclusive prices. Coupon discounts are shared across items in proportion
 * to their value; shipping / COD charges are taxed at the highest item rate. Same state as the
 * seller → CGST + SGST, otherwise IGST.
 */
export function gstBreakdown(
  order: {
    subtotal: number;
    discount: number;
    shippingFee: number;
    codFee: number;
    shipState: string;
    items: { productName: string; variantLabel: string; unitPrice: number; quantity: number; total: number; hsn?: string | null }[];
  },
  s: Pick<StoreSettings, 'gstRateLow' | 'gstRateHigh' | 'gstHighRateAbove' | 'defaultHsn' | 'sellerState'>,
): GstBreakdown {
  const lines: GstLine[] = [];
  let allocated = 0;
  order.items.forEach((item, idx) => {
    const share =
      idx === order.items.length - 1
        ? order.discount - allocated
        : order.subtotal
          ? Math.round((order.discount * item.total) / order.subtotal)
          : 0;
    allocated += share;
    const gross = item.total - share;
    const rate = item.unitPrice > s.gstHighRateAbove ? s.gstRateHigh : s.gstRateLow;
    lines.push({ label: `${item.productName} (${item.variantLabel})`, hsn: item.hsn || s.defaultHsn, quantity: item.quantity, gross, rate, ...split(gross, rate) });
  });
  const maxRate = lines.reduce((m, l) => Math.max(m, l.rate), 0);
  const charges = order.shippingFee + order.codFee;
  if (charges > 0) {
    lines.push({ label: 'Shipping & handling', hsn: '9965', quantity: 1, gross: charges, rate: maxRate, ...split(charges, maxRate) });
  }
  const taxable = lines.reduce((t, l) => t + l.taxable, 0);
  const tax = lines.reduce((t, l) => t + l.tax, 0);
  const intraState = order.shipState.trim().toLowerCase() === s.sellerState.trim().toLowerCase();
  const cgst = intraState ? Math.floor(tax / 2) : 0;
  const sgst = intraState ? tax - cgst : 0;
  return { lines, intraState, taxable, cgst, sgst, igst: intraState ? 0 : tax, total: taxable + tax };
}
