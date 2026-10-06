'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EMPTY_SELLER_DETAILS, SellerDetailsFields, type SellerDetailsForm } from '@/components/SellerDetailsFields';
import { Field } from '@/components/ui';
import { ApiError } from '@/lib/client';
import { sellerClient } from '@/lib/sellerApi';

const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL ?? 'http://localhost:3000';

export default function SellerRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<SellerDetailsForm>(EMPTY_SELLER_DETAILS);
  const [account, setAccount] = useState({ email: '', password: '' });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen bg-page">
      <div className="bg-gradient-to-br from-navy-950 via-navy-900 to-brand-900 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-2xl font-extrabold italic tracking-tight">StyleKart</p>
          <h1 className="mt-3 text-3xl font-bold">Sell on StyleKart</h1>
          <p className="mt-2 max-w-xl text-white/80">Reach customers across India. List your products for free, ship orders from your own address and get paid to your bank account after delivery.</p>
          <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            {['Register with your GST & bank details', 'We verify and approve your store', 'Add products, receive orders, get paid'].map((s, i) => (
              <li key={s} className="rounded-md bg-white/10 p-3"><span className="font-bold text-accent-300">{i + 1}.</span> {s}</li>
            ))}
          </ol>
        </div>
      </div>
      <form
        className="mx-auto -mt-4 max-w-3xl space-y-6 rounded-lg bg-white p-6 shadow-sm sm:p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!agree) return setError('Please accept the seller terms to continue');
          setBusy(true);
          setError('');
          try {
            const body = Object.fromEntries(Object.entries({ ...form, ...account }).filter(([, v]) => v !== ''));
            await sellerClient.authenticate('register', body);
            router.replace('/seller');
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Registration failed');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <section className="space-y-4">
          <h2 className="font-bold">Login details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email"><input className="input" type="email" required autoComplete="username" value={account.email} onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))} /></Field>
            <Field label="Password" hint="At least 8 characters with letters and numbers"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={account.password} onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))} /></Field>
          </div>
        </section>
        <SellerDetailsFields form={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I confirm the details are correct and I agree to the marketplace <a href={`${STORE_URL}/terms`} target="_blank" rel="noreferrer" className="font-semibold text-brand-700">terms</a>, including the commission on every sale and selling only genuine products.
          </span>
        </label>
        <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Creating your seller account…' : 'Register as a seller'}</button>
        <p className="text-center text-sm text-gray-600">
          Already registered? <Link href="/seller/login" className="font-semibold text-brand-700">Log in</Link>
        </p>
      </form>
    </div>
  );
}
