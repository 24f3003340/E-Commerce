'use client';

import { useState } from 'react';
import { EMPTY_SELLER_DETAILS, SellerDetailsFields, type SellerDetailsForm } from '@/components/SellerDetailsFields';
import { useSeller } from '@/components/SellerShell';
import { Badge, Field, PageHeader } from '@/components/ui';
import { ApiError } from '@/lib/client';
import { sellerApi } from '@/lib/sellerApi';
import type { Seller } from '@/lib/types';

export default function SellerProfilePage() {
  const { seller, setSeller, toast } = useSeller();
  const [form, setForm] = useState<SellerDetailsForm>(() =>
    Object.fromEntries(Object.keys(EMPTY_SELLER_DETAILS).map((k) => [k, (seller[k as keyof Seller] as string | null) ?? ''])) as unknown as SellerDetailsForm,
  );
  const [auto, setAuto] = useState({
    autoShip: seller.autoShip ?? false,
    weight: String(seller.defaultWeightKg ?? 0.5),
    length: String(seller.defaultLengthCm ?? 25),
    breadth: String(seller.defaultBreadthCm ?? 20),
    height: String(seller.defaultHeightCm ?? 5),
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & bank details" subtitle={seller.email} actions={<Badge value={seller.status} />} />
      <form
        className="card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            setSeller(await sellerApi<Seller>('/seller/me', { method: 'PUT', body: form }));
            toast('Profile saved');
          } catch (err) {
            toast(err instanceof ApiError ? err.message : 'Could not save', true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <SellerDetailsFields form={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
        <button className="btn-primary mt-6" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>

      <form
        className="card max-w-xl space-y-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setSeller(await sellerApi<Seller>('/seller/me', { method: 'PUT', body: { autoShip: auto.autoShip, defaultWeightKg: Number(auto.weight), defaultLengthCm: Number(auto.length), defaultBreadthCm: Number(auto.breadth), defaultHeightCm: Number(auto.height) } }));
            toast('Automation saved');
          } catch (err) {
            toast(err instanceof ApiError ? err.message : 'Could not save', true);
          }
        }}
      >
        <h2 className="font-bold">Automatic shipping</h2>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={auto.autoShip} onChange={(e) => setAuto((a) => ({ ...a, autoShip: e.target.checked }))} />
          <span>Book the courier automatically for every new order. You only pack the parcel and print the label — pickup is scheduled for you. If booking ever fails, the order stays in “To ship” so you can book it by hand.</span>
        </label>
        <p className="text-xs text-gray-500">Usual parcel size (used for every auto-booked order)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Weight (kg)"><input className="input" type="number" step="0.05" min="0.05" value={auto.weight} onChange={(e) => setAuto((a) => ({ ...a, weight: e.target.value }))} /></Field>
          <Field label="Length (cm)"><input className="input" type="number" min="1" value={auto.length} onChange={(e) => setAuto((a) => ({ ...a, length: e.target.value }))} /></Field>
          <Field label="Breadth (cm)"><input className="input" type="number" min="1" value={auto.breadth} onChange={(e) => setAuto((a) => ({ ...a, breadth: e.target.value }))} /></Field>
          <Field label="Height (cm)"><input className="input" type="number" min="1" value={auto.height} onChange={(e) => setAuto((a) => ({ ...a, height: e.target.value }))} /></Field>
        </div>
        <button className="btn-outline">Save automation</button>
      </form>

      <form
        className="card max-w-xl space-y-3 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await sellerApi('/seller/me/change-password', { method: 'POST', body: pw });
            toast('Password changed. You will be asked to log in again.');
            setPw({ currentPassword: '', newPassword: '' });
          } catch (err) {
            toast(err instanceof ApiError ? err.message : 'Could not change password', true);
          }
        }}
      >
        <h2 className="font-bold">Change password</h2>
        <Field label="Current password"><input className="input" type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} /></Field>
        <Field label="New password" hint="At least 8 characters with letters and numbers"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} /></Field>
        <button className="btn-outline">Change password</button>
      </form>
    </div>
  );
}
