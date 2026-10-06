'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Address } from '@/lib/types';

const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

type FormState = Omit<Address, 'id' | 'isDefault'> & { isDefault: boolean };

export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    landmark: initial?.landmark ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
    isDefault: initial?.isDefault ?? false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          const body = { ...form, line2: form.line2 || undefined, landmark: form.landmark || undefined };
          const saved = initial
            ? await api<Address>(`/me/addresses/${initial.id}`, { method: 'PUT', body })
            : await api<Address>('/me/addresses', { method: 'POST', body });
          onSaved(saved);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Could not save address');
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <input required placeholder="Full name" className="input" value={form.name} onChange={set('name')} aria-label="Full name" />
        <input required placeholder="Mobile number" pattern="[6-9][0-9]{9}" title="10 digit mobile number" inputMode="numeric" className="input" value={form.phone} onChange={set('phone')} aria-label="Mobile number" />
      </div>
      <input required placeholder="House no., building, street" className="input" value={form.line1} onChange={set('line1')} aria-label="Address line 1" />
      <input placeholder="Area, locality (optional)" className="input" value={form.line2 ?? ''} onChange={set('line2')} aria-label="Address line 2" />
      <input placeholder="Landmark (optional)" className="input" value={form.landmark ?? ''} onChange={set('landmark')} aria-label="Landmark" />
      <div className="grid gap-3 sm:grid-cols-3">
        <input required placeholder="Pincode" pattern="[1-9][0-9]{5}" title="6 digit pincode" inputMode="numeric" className="input" value={form.pincode} onChange={set('pincode')} aria-label="Pincode" />
        <input required placeholder="City" className="input" value={form.city} onChange={set('city')} aria-label="City" />
        <select required className="input" value={form.state} onChange={set('state')} aria-label="State">
          <option value="">State</option>
          {STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.isDefault} onChange={set('isDefault')} /> Make this my default address
      </label>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save address'}
        </button>
        {onCancel && (
          <button type="button" className="btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
