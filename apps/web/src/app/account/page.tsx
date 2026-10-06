'use client';

import { useEffect, useState } from 'react';
import { AddressForm } from '@/components/AddressForm';
import { Spinner } from '@/components/ui';
import { useStore } from '@/context/StoreProvider';
import { api, ApiError, getAuth, setAuth } from '@/lib/api';
import type { Address, User } from '@/lib/types';

export default function AccountPage() {
  const { user, toast } = useStore();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });

  const load = () => api<Address[]>('/me/addresses').then(setAddresses);
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-8">
      <section className="card p-6">
        <h1 className="mb-4 text-lg font-bold">Profile</h1>
        <form
          className="grid max-w-xl gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const updated = await api<User>('/me', { method: 'PATCH', body: { name: profile.name, phone: profile.phone || undefined } });
              const auth = getAuth();
              if (auth) setAuth({ ...auth, user: updated });
              toast('Profile updated');
            } catch (err) {
              toast(err instanceof ApiError ? err.message : 'Could not update profile', 'error');
            }
          }}
        >
          <div>
            <label className="label">Name</label>
            <input className="input" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input className="input" value={profile.phone} pattern="[6-9][0-9]{9}" onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input className="input bg-gray-50" value={user?.email ?? ''} disabled />
          </div>
          <button className="btn-primary w-fit">Save profile</button>
        </form>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Saved addresses</h2>
          {!editing && (
            <button className="text-sm font-semibold text-brand-700" onClick={() => setEditing('new')}>
              + Add address
            </button>
          )}
        </div>
        {editing && (
          <div className="mb-6 rounded-md border p-4">
            <AddressForm
              initial={editing === 'new' ? undefined : editing}
              onSaved={() => {
                setEditing(null);
                void load();
                toast('Address saved');
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
        {!addresses ? (
          <Spinner />
        ) : addresses.length === 0 ? (
          <p className="text-sm text-gray-500">No saved addresses yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-md border p-4 text-sm">
                <p className="font-semibold">
                  {a.name} {a.isDefault && <span className="chip ml-2 border-brand-100 bg-brand-50 text-brand-700">Default</span>}
                </p>
                <p className="mt-1 text-gray-600">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ''}
                  <br />
                  {a.city}, {a.state} – {a.pincode}
                  <br />
                  Phone: {a.phone}
                </p>
                <div className="mt-3 flex gap-4">
                  <button className="font-semibold text-brand-700" onClick={() => setEditing(a)}>
                    Edit
                  </button>
                  <button
                    className="font-semibold text-red-600"
                    onClick={async () => {
                      if (!confirm('Delete this address?')) return;
                      await api(`/me/addresses/${a.id}`, { method: 'DELETE' });
                      void load();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-bold">Change password</h2>
        <form
          className="grid max-w-xl gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/auth/change-password', { method: 'POST', body: pw });
              toast('Password changed. Please login again.');
              setAuth(null);
              window.location.href = '/login';
            } catch (err) {
              toast(err instanceof ApiError ? err.message : 'Could not change password', 'error');
            }
          }}
        >
          <input type="password" required placeholder="Current password" className="input" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} autoComplete="current-password" />
          <input type="password" required minLength={8} placeholder="New password" className="input" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} autoComplete="new-password" />
          <button className="btn-outline w-fit">Update password</button>
        </form>
      </section>
    </div>
  );
}
