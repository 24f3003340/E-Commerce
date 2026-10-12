'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSeller } from '@/components/SellerShell';
import { PageHeader } from '@/components/ui';
import { ApiError } from '@/lib/client';
import { downloadCsv, parseCsv, toCsv } from '@/lib/csv';
import { sellerApi } from '@/lib/sellerApi';

interface RowResult { row: number; ok: boolean; message: string }

const ADD_COLUMNS = ['name', 'category', 'price', 'mrp', 'colors', 'sizes', 'stock', 'images', 'description', 'brand', 'material'];
const ADD_SAMPLE = [
  { name: 'Cotton Printed Kurta', category: 'Kurtas', price: 599, mrp: 1199, colors: 'Maroon|Navy', sizes: 'S|M|L|XL', stock: 10, images: 'https://example.com/kurta-1.jpg|https://example.com/kurta-2.jpg', description: '', brand: '', material: 'Cotton' },
];

function Results({ results }: { results: RowResult[] }) {
  const ok = results.filter((r) => r.ok).length;
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold"><span className="text-emerald-700">{ok} done</span>{results.length - ok > 0 && <span className="ml-3 text-red-600">{results.length - ok} need fixing</span>}</p>
      <div className="mt-2 max-h-72 overflow-y-auto rounded border">
        <table className="table">
          <thead><tr><th>Row</th><th>Result</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.row}><td>{r.row}</td><td className={r.ok ? 'text-emerald-700' : 'text-red-600'}>{r.message}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BulkPage() {
  const { toast } = useSeller();
  const [addRows, setAddRows] = useState<Record<string, string>[]>([]);
  const [addResults, setAddResults] = useState<RowResult[] | null>(null);
  const [updRows, setUpdRows] = useState<Record<string, string>[]>([]);
  const [updResults, setUpdResults] = useState<RowResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  const read = async (file: File | undefined, set: (r: Record<string, string>[]) => void, clear: () => void) => {
    if (!file) return;
    clear();
    const rows = parseCsv(await file.text());
    if (!rows.length) return toast('No rows found in that file', true);
    if (rows.length > 200) return toast('Please upload at most 200 rows at a time', true);
    set(rows);
  };

  const run = async (path: string, rows: Record<string, string>[], done: (r: RowResult[]) => void) => {
    setBusy(true);
    try {
      done(await sellerApi<RowResult[]>(path, { method: 'POST', body: { rows } }));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Upload failed', true);
    } finally {
      setBusy(false);
    }
  };

  const exportCurrent = async () => {
    const rows = await sellerApi<Record<string, unknown>[]>('/seller/products-export');
    if (!rows.length) return toast('You have no products yet', true);
    downloadCsv('my-products.csv', toCsv(['sku', 'product', 'variant', 'price', 'mrp', 'stock'], rows));
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Bulk upload" subtitle="Add or update many products at once from an Excel / CSV sheet." actions={<Link href="/seller/products" className="btn-outline">Back</Link>} />

      <section className="card p-5">
        <h2 className="font-bold">1. Add many new products</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>Download the sample sheet and open it in Excel / Google Sheets. One row = one product.</li>
          <li>Category: use the category name exactly as in your panel. Colours, sizes and image links: separate several with <b>|</b>.</li>
          <li>Rows without a photo link are saved as drafts — add photos later and publish.</li>
          <li>Save as <b>CSV</b> and upload it here.</li>
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn-outline" onClick={() => downloadCsv('add-products-sample.csv', toCsv(ADD_COLUMNS, ADD_SAMPLE))}>Download sample sheet</button>
          <input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { void read(e.target.files?.[0], setAddRows, () => setAddResults(null)); e.target.value = ''; }} />
        </div>
        {addRows.length > 0 && !addResults && (
          <div className="mt-4">
            <p className="text-sm">{addRows.length} products ready. First one: <b>{addRows[0].name}</b></p>
            <button className="btn-primary mt-2" disabled={busy} onClick={() => void run('/seller/products/bulk', addRows, setAddResults)}>{busy ? 'Uploading…' : `Add ${addRows.length} products`}</button>
          </div>
        )}
        {addResults && <Results results={addResults} />}
      </section>

      <section className="card p-5">
        <h2 className="font-bold">2. Update prices &amp; stock</h2>
        <p className="mt-2 text-sm text-gray-600">Download your current sheet, change the <b>price</b>, <b>mrp</b> or <b>stock</b> columns (stock = new total) and upload it again. Leave a cell blank to keep it unchanged. Changes go live immediately.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn-outline" onClick={() => void exportCurrent()}>Download my products</button>
          <input type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => { void read(e.target.files?.[0], setUpdRows, () => setUpdResults(null)); e.target.value = ''; }} />
          <Link href="/seller/products/quick-edit" className="text-sm font-semibold text-brand-700">or edit in a table →</Link>
        </div>
        {updRows.length > 0 && !updResults && (
          <button className="btn-primary mt-4" disabled={busy} onClick={() => void run('/seller/products/bulk-update', updRows, setUpdResults)}>{busy ? 'Updating…' : `Update ${updRows.length} rows`}</button>
        )}
        {updResults && <Results results={updResults} />}
      </section>
    </div>
  );
}
