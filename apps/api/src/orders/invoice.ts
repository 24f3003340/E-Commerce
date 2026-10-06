import { escapeHtml as esc } from '../common/email.service';
import { StoreSettings } from '../common/settings.service';
import { gstBreakdown } from './gst';

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface InvoiceOrder {
  orderNumber: string;
  createdAt: Date;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  couponCode: string | null;
  shippingAddress: unknown;
  items: { productName: string; variantLabel: string; sku: string; unitPrice: number; quantity: number; total: number; hsn?: string | null }[];
  /** Marketplace seller who sold the goods; null = the store itself */
  seller?: {
    storeName: string;
    gstin: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    email: string;
    phone: string;
  } | null;
}

/** Printable GST tax invoice — the browser's "Save as PDF" produces the PDF. */
export function renderInvoice(order: InvoiceOrder, settings: StoreSettings): string {
  const a = order.shippingAddress as Record<string, string>;
  const s = order.seller;
  // Marketplace orders are invoiced by the seller (their GSTIN and state decide the tax split)
  const issuer = s
    ? {
        name: s.storeName,
        address: [s.addressLine1, s.addressLine2, `${s.city}, ${s.state} - ${s.pincode}`].filter(Boolean).join(', '),
        gstin: s.gstin ?? '',
        contact: `${s.email} · ${s.phone}`,
        state: s.state,
      }
    : {
        name: settings.legalName || settings.storeName,
        address: settings.invoiceAddress,
        gstin: settings.gstin,
        contact: `${settings.supportEmail} · ${settings.supportPhone}`,
        state: settings.sellerState,
      };
  const g = gstBreakdown({ ...order, shipState: a.state ?? '' }, { ...settings, sellerState: issuer.state });
  const rows = g.lines
    .map(
      (l, idx) => `<tr><td>${idx + 1}</td><td>${esc(l.label)}</td><td>${esc(l.hsn)}</td><td class="r">${l.quantity}</td>
      <td class="r">${inr(l.taxable)}</td><td class="r">${l.rate}%</td><td class="r">${inr(l.tax)}</td><td class="r">${inr(l.gross)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(order.orderNumber)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:860px;margin:24px auto;padding:0 16px}
h1{margin:0;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left;font-size:13px;vertical-align:top}
th{background:#f6f6f6}.r{text-align:right}.muted{color:#666;font-size:13px}.grid{display:flex;justify-content:space-between;gap:24px;margin-top:16px}
.totals td{border:none;padding:4px 8px}.totals tr.grand td{font-weight:700;border-top:2px solid #111}
@media print{button{display:none}}
</style></head><body>
<div class="grid"><div><h1>${esc(issuer.name)}</h1><div class="muted">${esc(issuer.address)}${
    issuer.gstin ? `<br>GSTIN: ${esc(issuer.gstin)}` : ''
  }<br>${esc(issuer.contact)}${s ? `<br>Sold via ${esc(settings.storeName)} marketplace` : ''}</div></div>
<div class="r"><strong>TAX INVOICE</strong><div class="muted">Invoice / Order: ${esc(order.orderNumber)}<br>Date: ${new Date(
    order.createdAt,
  ).toLocaleDateString('en-IN')}<br>Payment: ${esc(order.paymentMethod)} (${esc(order.paymentStatus)})<br>Place of supply: ${esc(a.state)}</div></div></div>
<div class="grid"><div><strong>Bill / Ship to</strong><div class="muted">${esc(a.name)}<br>${esc(a.line1)}${
    a.line2 ? `, ${esc(a.line2)}` : ''
  }<br>${esc(a.city)}, ${esc(a.state)} - ${esc(a.pincode)}<br>Phone: ${esc(a.phone)}</div></div></div>
<table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="r">Qty</th><th class="r">Taxable value</th><th class="r">GST</th><th class="r">Tax</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals" style="width:340px;margin-left:auto">
<tr><td>Items (MRP-inclusive price)</td><td class="r">${inr(order.subtotal)}</td></tr>
${order.discount ? `<tr><td>Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}</td><td class="r">-${inr(order.discount)}</td></tr>` : ''}
${order.shippingFee + order.codFee ? `<tr><td>Shipping & handling</td><td class="r">${inr(order.shippingFee + order.codFee)}</td></tr>` : ''}
<tr><td>Taxable value</td><td class="r">${inr(g.taxable)}</td></tr>
${g.intraState ? `<tr><td>CGST</td><td class="r">${inr(g.cgst)}</td></tr><tr><td>SGST</td><td class="r">${inr(g.sgst)}</td></tr>` : `<tr><td>IGST</td><td class="r">${inr(g.igst)}</td></tr>`}
<tr class="grand"><td>Invoice total</td><td class="r">${inr(order.total)}</td></tr></table>
<p class="muted">All prices are inclusive of GST. This is a computer generated invoice and does not need a signature.</p>
<button onclick="window.print()">Print / Save as PDF</button>
</body></html>`;
}
