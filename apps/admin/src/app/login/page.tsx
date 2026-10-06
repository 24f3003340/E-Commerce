'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [needOtp, setNeedOtp] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <form
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await login(email, password, needOtp ? otp : undefined);
            router.replace('/');
          } catch (err) {
            if (err instanceof ApiError && err.code === 'OTP_REQUIRED') setNeedOtp(true);
            else setError(err instanceof ApiError ? err.message : 'Login failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-xl font-bold">Store Admin</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to manage your store</p>
        {error && <p className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 space-y-4">
          <input type="email" required placeholder="Email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" autoComplete="username" />
          <input type="password" required placeholder="Password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" autoComplete="current-password" />
          {needOtp && (
            <input required inputMode="numeric" pattern="\d{6}" placeholder="6-digit code from authenticator app" className="input" value={otp} onChange={(e) => setOtp(e.target.value)} aria-label="One-time code" autoFocus />
          )}
        </div>
        <button className="btn-primary mt-6 w-full" disabled={busy}>
          {busy ? 'Signing in…' : needOtp ? 'Verify & sign in' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
