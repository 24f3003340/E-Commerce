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
}

const MONEY: (keyof Settings)[] = ['freeShippingThreshold', 'standardShippingFee', 'expressShippingFee', 'codFee', 'codMaxOrderValue'];

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
        <div className="md:col-span-2"><Field label="Invoice address"><input className="input" value={s.invoiceAddress} onChange={text('invoiceAddress')} /></Field></div>

        <h2 className="pt-2 font-bold md:col-span-2">Shipping & COD (₹)</h2>
        <Field label="Free shipping above"><input className="input" type="number" min={0} value={s.freeShippingThreshold} onChange={num('freeShippingThreshold')} /></Field>
        <Field label="Standard shipping fee"><input className="input" type="number" min={0} value={s.standardShippingFee} onChange={num('standardShippingFee')} /></Field>
        <Field label="Express shipping fee"><input className="input" type="number" min={0} value={s.expressShippingFee} onChange={num('expressShippingFee')} /></Field>
        <Field label="COD fee"><input className="input" type="number" min={0} value={s.codFee} onChange={num('codFee')} /></Field>
        <Field label="COD maximum order value"><input className="input" type="number" min={0} value={s.codMaxOrderValue} onChange={num('codMaxOrderValue')} /></Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={s.codEnabled} onChange={(e) => setS({ ...s, codEnabled: e.target.checked })} /> Cash on delivery enabled</label>
        <Field label="Blocked pincode prefixes" hint="Comma separated, e.g. 79, 744"><input className="input" value={s.blockedPincodePrefixes.join(', ')} onChange={(e) => setS({ ...s, blockedPincodePrefixes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
        <Field label="Metro pincode prefixes (faster delivery)"><input className="input" value={s.metroPincodePrefixes.join(', ')} onChange={(e) => setS({ ...s, metroPincodePrefixes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>

        <h2 className="pt-2 font-bold md:col-span-2">Returns</h2>
        <Field label="Default return window (days)" hint="Categories can override this"><input className="input" type="number" min={0} value={s.defaultReturnWindowDays} onChange={num('defaultReturnWindowDays')} /></Field>
        {canEdit ? <button className="btn-primary self-end md:col-span-2 md:w-fit">Save settings</button> : <p className="text-sm text-gray-500 md:col-span-2">Only admins can change store settings.</p>}
      </form>
      <TwoFactor />
    </div>
  );
}
