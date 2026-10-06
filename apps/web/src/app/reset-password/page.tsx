'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ApiError } from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <p className="mt-4 text-sm text-gray-600">
        This link is incomplete. Please request a new one from{' '}
        <Link href="/forgot-password" className="font-semibold text-brand-700">
          Forgot password
        </Link>
        .
      </p>
    );
  }
  if (done) {
    return (
      <>
        <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Your password has been changed. Please log in with your new password.</p>
        <Link href="/login" className="btn-primary mt-6 w-full">
          Log in
        </Link>
      </>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== confirm) return setError('Passwords do not match');
        setBusy(true);
        setError('');
        try {
          await api('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false });
          setDone(true);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Could not reset password');
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="label mt-6" htmlFor="password">
        New password
      </label>
      <input id="password" type="password" required minLength={8} autoComplete="new-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      <p className="mt-1 text-xs text-gray-500">At least 8 characters with letters and numbers.</p>
      <label className="label mt-4" htmlFor="confirm">
        Confirm new password
      </label>
      <input id="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <button className="btn-primary mt-6 w-full" disabled={busy}>
        {busy ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container flex justify-center py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
