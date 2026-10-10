'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from '@/components/AdminShell';
import { Field, PageHeader, Spinner } from '@/components/ui';
import { api, ApiError, getAuth, setAuth } from '@/lib/api';

interface Settings {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  freeShippingThreshold: number;
  standardShippingFee: number;
  expressShippingFee: number;
  codEnabled: boolean;
  codFee: number;
  codMaxOrderValue: number;
  defaultReturnWindowDays: number;
  blockedPincodePrefixes: string[];
  metroPincodePrefixes: string[];
  gstin: string;
  invoiceAddress: string;
  legalName: string;
  sellerState: string;
  gstRateLow: number;
  gstRateHigh: number;
  gstHighRateAbove: number;
  defaultHsn: string;
  orderAlertEmail: string;
  whatsappNumber: string;
  sellerRegistrationOpen: boolean;
  defaultCommissionPct: number;
  sellerProductApproval: boolean;
  sellerPayoutHoldDays: number;
}

const MONEY: (keyof Settings)[] = ['freeShippingThreshold', 'standardShippingFee', 'expressShippingFee', 'codFee', 'codMaxOrderValue', 'gstHighRateAbove'];

function TwoFactor() {
  const { admin, toast } = useAdmin();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [otp, setOtp] = useState('');
  const enabled = admin.twoFactorEnabled;

  const finish = (on: boolean) => {
    const auth = getAuth();
    if (auth) setAuth({ ...auth, admin: { ...auth.admin, twoFactorEnabled: on } });
    window.location.reload();
  };

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">Two-factor authentication (your account)</h2>
      <p className="text-sm text-gray-600">Protect admin access with a 6-digit code from Google Authenticator, Authy or 1Password.</p>
      {enabled ? (
        <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); try { await api('/admin/auth/2fa/disable', { method: 'POST', body: { otp } }); toast('2FA disabled'); finish(false); } catch (err) { toast(err instanceof ApiError ? err.message : 'Failed', true); } }}>
          <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">Enabled</span>
          <input className="input max-w-[160px]" placeholder="Current code" value={otp} onChange={(e) => setOtp(e.target.value)} pattern="\d{6}" required />
          <button className="btn-outline text-red-600">Disable</button>
        </form>
      ) : setup ? (
        <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); try { await api('/admin/auth/2fa/enable', { method: 'POST', body: { otp } }); toast('2FA enabled'); finish(true); } catch (err) { toast(err instanceof ApiError ? err.message : 'Failed', true); } }}>
          <p className="text-sm">Add this key to your authenticator app (or open the link on your phone):</p>
          <p className="break-all rounded bg-gray-50 p-2 font-mono text-sm">{setup.secret}</p>
          <a href={setup.otpauthUrl} className="block break-all text-xs text-brand-700">{setup.otpauthUrl}</a>
          <div className="flex gap-2">
            <input className="input max-w-[160px]" placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)} pattern="\d{6}" required />
            <button className="btn-primary">Verify & enable</button>
          </div>
        </form>
      ) : (
        <button className="btn-primary" onClick={async () => setSetup(await api('/admin/auth/2fa/setup', { method: 'POST' }))}>Set up 2FA</button>
      )}
    </section>
  );
}

interface SystemStatus {
  imageStorage: 'cloud' | 'local';
  imageStorageUrl: string | null;
  courier: boolean;
  courierPickupLocation: string | null;
  onlinePayments: boolean;
  email: boolean;
}

/** Which outside services are connected. They are switched on with Render environment variables. */
function Connections() {
  const [st, setSt] = useState<SystemStatus | null>(null);
  useEffect(() => {
    api<SystemStatus>('/admin/system-status').then(setSt).catch(() => undefined);
  }, []);
  if (!st) return null;
  const rows: [string, boolean, string, string][] = [
    ['Product photo storage', st.imageStorage === 'cloud', `Cloudflare R2 — ${st.imageStorageUrl ?? ''}`, 'Server disk — photos are lost on every redeploy. Add the S3_* variables (Cloudflare R2).'],
    ['Courier (Shiprocket)', st.courier, `Connected — store pickup location “${st.courierPickupLocation ?? ''}”`, 'Not connected — add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD. Until then enter courier AWBs by hand.'],
    ['Online payments (Razorpay)', st.onlinePayments, 'Live — customers can pay by UPI / card', 'Coming soon — checkout is cash on delivery only. Add the RAZORPAY_* keys.'],
    ['Emails (Resend)', st.email, 'Sending order and account emails', 'Not sending — add RESEND_API_KEY.'],
  ];
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">Connected services</h2>
      <ul className="divide-y divide-gray-100 text-sm">
        {rows.map(([label, on, good, bad]) => (
          <li key={label} className="flex flex-wrap items-start gap-3 py-2.5">
            <span className={`chip ${on ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{on ? 'Connected' : 'Not set up'}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{label}</span>
              <span className="block text-gray-600">{on ? good : bad}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">Set these in Render → stylekart-api → Environment, then redeploy. Step-by-step guide: docs/LAUNCH.md.</p>
    </section>
  );
}

interface DemoStatus {
  removedAt: string | null;
  products: number;
  coupons: number;
  banners: number;
}

interface DemoRemoval {
  productsDeleted: number;
  productsArchived: number;
  couponsDeleted: number;
  couponsDeactivated: number;
  bannersDeleted: number;
}

/**
 * The sample products, coupons and banners that come with a new database. Removing them here is
 * permanent: the API runs its seed on every start, and it skips the samples once they are removed.
 */
function DemoData() {
  const { toast } = useAdmin();
  const [st, setSt] = useState<DemoStatus | null>(null);
  const [done, setDone] = useState<DemoRemoval | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<DemoStatus>('/admin/demo-data').then(setSt).catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);
  if (!st) return null;

  const left = st.products + st.coupons + st.banners;
  const remove = async () => {
    if (!confirm(`Remove ${st.products} sample products, ${st.coupons} sample coupons and ${st.banners} sample banners?\n\nYour own products, coupons, banners and orders are not touched. This cannot be undone.`)) return;
    setBusy(true);
    try {
      setDone(await api<DemoRemoval>('/admin/demo-data/remove', { method: 'POST' }));
      toast('Demo data removed');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove demo data', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-bold">Demo data</h2>
      <p className="text-sm text-gray-600">
        A new store comes with sample products, coupons (WELCOME10, FLAT200, FOOTWEAR15) and banners so you can try everything.
        Remove them before you open the shop to customers.
      </p>
      {left > 0 ? (
        <>
          <ul className="text-sm text-gray-700">
            <li>{st.products} sample products live on the website</li>
            <li>{st.coupons} sample coupons active</li>
            <li>{st.banners} sample banners on the home page</li>
          </ul>
          <button className="btn-outline text-red-600" disabled={busy} onClick={() => void remove()}>
            {busy ? 'Removing…' : 'Remove all demo data'}
          </button>
          <p className="text-xs text-gray-500">
            Categories stay (rename or delete them in Categories). Sample products that already have orders are hidden instead of deleted.
            The samples will not come back when the server restarts.
          </p>
        </>
      ) : (
        <p className="text-sm text-emerald-700">
          {st.removedAt ? `Demo data was removed on ${new Date(st.removedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.` : 'There is no demo data on this store.'}
          {done && ` Deleted ${done.productsDeleted + done.productsArchived} products, ${done.couponsDeleted + done.couponsDeactivated} coupons and ${done.bannersDeleted} banners.`}
        </p>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const { admin, toast } = useAdmin();
  const [s, setS] = useState<Settings | null>(null);
  const canEdit = admin.role === 'SUPER_ADMIN' || admin.role === 'ADMIN';

  useEffect(() => {
    api<Settings>('/admin/settings').then((v) => setS({ ...v, ...Object.fromEntries(MONEY.map((k) => [k, (v[k] as number) / 100])) } as Settings));
  }, []);
  if (!s) return <Spinner />;

  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  const text = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />
      <Connections />
      {admin.role === 'SUPER_ADMIN' && <DemoData />}
      <form
        className="card grid gap-4 p-5 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api('/admin/settings', {
              method: 'PUT',
              body: { ...s, ...Object.fromEntries(MONEY.map((k) => [k, Math.round((s[k] as number) * 100)])) },
            });
            toast('Settings saved');
          } catch (err) {
            toast(err instanceof ApiError ? err.message : 'Failed', true);
          }
        }}
      >
        <h2 className="font-bold md:col-span-2">Store</h2>
        <Field label="Store name"><input className="input" value={s.storeName} onChange={text('storeName')} /></Field>
        <Field label="GSTIN"><input className="input" value={s.gstin} onChange={text('gstin')} /></Field>
        <Field label="Support email"><input className="input" type="email" value={s.supportEmail} onChange={text('supportEmail')} /></Field>
        <Field label="Support phone"><input className="input" value={s.supportPhone} onChange={text('supportPhone')} /></Field>
        <Field label="Registered business name (legal name)"><input className="input" value={s.legalName} onChange={text('legalName')} /></Field>
        <Field label="WhatsApp support number" hint="With country code, digits only — e.g. 919876543210. Shows a chat button on the website."><input className="input" value={s.whatsappNumber} onChange={text('whatsappNumber')} /></Field>
        <div className="md:col-span-2"><Field label="Registered address (invoices, contact page)"><input className="input" value={s.invoiceAddress} onChange={text('invoiceAddress')} /></Field></div>
        <Field label="New order alert email" hint="Every confirmed order is emailed here (leave empty to turn off)"><input className="input" type="email" value={s.orderAlertEmail} onChange={text('orderAlertEmail')} /></Field>

        <h2 className="pt-2 font-bold md:col-span-2">GST (invoices)</h2>
        <Field label="Seller state" hint="Same-state orders get CGST + SGST, others IGST"><input className="input" value={s.sellerState} onChange={text('sellerState')} /></Field>
        <Field label="Default HSN code" hint="Used when a product has no HSN code"><input className="input" value={s.defaultHsn} onChange={text('defaultHsn')} /></Field>
        <Field label="GST % (lower slab)"><input className="input" type="number" min={0} max={40} value={s.gstRateLow} onChange={num('gstRateLow')} /></Field>
        <Field label="GST % (higher slab)"><input className="input" type="number" min={0} max={40} value={s.gstRateHigh} onChange={num('gstRateHigh')} /></Field>
        <Field label="Higher slab applies above (₹ per item)" hint="Confirm current apparel GST slabs with your CA"><input className="input" type="number" min={0} value={s.gstHighRateAbove} onChange={num('gstHighRateAbove')} /></Field>

        <h2 className="pt-2 font-bold md:col-span-2">Shipping & COD (₹)</h2>
        <Field label="Free shipping above"><input className="input" type="number" min={0} value={s.freeShippingThreshold} onChange={num('freeShippingThreshold')} /></Field>
        <Field label="Standard shipping fee"><input className="input" type="number" min={0} value={s.standardShippingFee} onChange={num('standardShippingFee')} /></Field>
        <Field label="Express shipping fee"><input className="input" type="number" min={0} value={s.expressShippingFee} onChange={num('expressShippingFee')} /></Field>
        <Field label="COD fee"><input className="input" type="number" min={0} value={s.codFee} onChange={num('codFee')} /></Field>
        <Field label="COD maximum order value"><input className="input" type="number" min={0} value={s.codMaxOrderValue} onChange={num('codMaxOrderValue')} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={s.codEnabled} onChange={(e) => setS({ ...s, codEnabled: e.target.checked })} /> Cash on delivery enabled</label>
        <Field label="Blocked pincode prefixes" hint="Comma separated, e.g. 79, 744"><input className="input" value={s.blockedPincodePrefixes.join(', ')} onChange={(e) => setS({ ...s, blockedPincodePrefixes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
        <Field label="Metro pincode prefixes (faster delivery)"><input className="input" value={s.metroPincodePrefixes.join(', ')} onChange={(e) => setS({ ...s, metroPincodePrefixes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>

        <h2 className="pt-2 font-bold md:col-span-2">Marketplace sellers</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.sellerRegistrationOpen} onChange={(e) => setS({ ...s, sellerRegistrationOpen: e.target.checked })} /> Sellers can register from the seller panel</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.sellerProductApproval} onChange={(e) => setS({ ...s, sellerProductApproval: e.target.checked })} /> Seller products need approval before going live</label>
        <Field label="Default commission (%)" hint="Kept from the item value of every seller order. You can set a different rate per seller."><input className="input" type="number" min={0} max={100} step="0.5" value={s.defaultCommissionPct} onChange={num('defaultCommissionPct')} /></Field>
        <Field label="Payout hold (days after delivery)" hint="Keep it longer than the return window so returns are settled before you pay sellers"><input className="input" type="number" min={0} max={90} value={s.sellerPayoutHoldDays} onChange={num('sellerPayoutHoldDays')} /></Field>

        <h2 className="pt-2 font-bold md:col-span-2">Returns</h2>
        <Field label="Default return window (days)" hint="Categories can override this"><input className="input" type="number" min={0} value={s.defaultReturnWindowDays} onChange={num('defaultReturnWindowDays')} /></Field>
        {canEdit ? <button className="btn-primary self-end md:col-span-2 md:w-fit">Save settings</button> : <p className="text-sm text-gray-500 md:col-span-2">Only admins can change store settings.</p>}
      </form>
      <TwoFactor />
    </div>
  );
}
