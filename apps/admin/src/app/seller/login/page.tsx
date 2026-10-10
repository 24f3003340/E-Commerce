'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError } from '@/lib/client';
import { sellerClient } from '@/lib/sellerApi';

export default function SellerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-brand-900 p-4">
      <form
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await sellerClient.authenticate('login', { email, password });
            router.replace('/seller');
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Login failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
<img src="/brand/logo.svg" alt="DukaanX" width={156} height={30} className="h-[30px] w-auto" />
        <h1 className="mt-1 text-sm font-semibold uppercase tracking-widest text-brand-600">Seller Panel</h1>
        <p className="mt-1 text-sm text-gray-500">Log in to manage your products and orders</p>
        {error && <p className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 space-y-4">
          <input type="email" required placeholder="Email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" autoComplete="username" />
          <input type="password" required placeholder="Password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" autoComplete="current-password" />
        </div>
        <button className="btn-primary mt-6 w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="mt-4 text-center text-sm text-gray-600">
          New seller? <Link href="/seller/register" className="font-semibold text-brand-700">Start selling</Link>
        </p>
      </form>
    </div>
  );
}
