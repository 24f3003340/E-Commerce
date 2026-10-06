import { StoreSettings } from '../common/settings.service';

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

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
  items: { productName: string; variantLabel: string; sku: string; unitPrice: number; quantity: number; total: number }[];
}

/** Printable HTML invoice — the browser's "Save as PDF" produces the PDF. */
export function renderInvoice(order: InvoiceOrder, settings: StoreSettings): string {
  const a = order.shippingAddress as Record<string, string>;
  const rows = order.items
    .map(
      (i, idx) => `<tr><td>${idx + 1}</td><td>${esc(i.productName)}<br><small>${esc(i.variantLabel)} · ${esc(i.sku)}</small></td>
      <td class="r">${inr(i.unitPrice)}</td><td class="r">${i.quantity}</td><td class="r">${inr(i.total)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(order.orderNumber)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;max-width:800px;margin:24px auto;padding:0 16px}
h1{margin:0;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:14px;vertical-align:top}
.r{text-align:right}.muted{color:#666;font-size:13px}.grid{display:flex;justify-content:space-between;gap:24px;margin-top:16px}
.totals td{border:none;padding:4px 8px}.totals tr:last-child td{font-weight:700;border-top:2px solid #111}
@media print{button{display:none}}
</style></head><body>
<div class="grid"><div><h1>${esc(settings.storeName)}</h1><div class="muted">${esc(settings.invoiceAddress)}${
    settings.gstin ? `<br>GSTIN: ${esc(settings.gstin)}` : ''
  }</div></div>
<div class="r"><strong>TAX INVOICE</strong><div class="muted">Order: ${esc(order.orderNumber)}<br>Date: ${new Date(
    order.createdAt,
  ).toLocaleDateString('en-IN')}<br>Payment: ${esc(order.paymentMethod)} (${esc(order.paymentStatus)})</div></div></div>
<div class="grid"><div><strong>Ship to</strong><div class="muted">${esc(a.name)}<br>${esc(a.line1)}${
    a.line2 ? `, ${esc(a.line2)}` : ''
  }<br>${esc(a.city)}, ${esc(a.state)} - ${esc(a.pincode)}<br>Phone: ${esc(a.phone)}</div></div></div>
<table><thead><tr><th>#</th><th>Item</th><th class="r">Price</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals" style="width:320px;margin-left:auto">
<tr><td>Subtotal</td><td class="r">${inr(order.subtotal)}</td></tr>
${order.discount ? `<tr><td>Discount${order.couponCode ? ` (${esc(order.couponCode)})` : ''}</td><td class="r">-${inr(order.discount)}</td></tr>` : ''}
<tr><td>Shipping</td><td class="r">${order.shippingFee ? inr(order.shippingFee) : 'FREE'}</td></tr>
${order.codFee ? `<tr><td>COD charges</td><td class="r">${inr(order.codFee)}</td></tr>` : ''}
<tr><td>Total</td><td class="r">${inr(order.total)}</td></tr></table>
<p class="muted">Prices are inclusive of all taxes. This is a computer generated invoice.</p>
<button onclick="window.print()">Print / Save as PDF</button>
</body></html>`;
}
