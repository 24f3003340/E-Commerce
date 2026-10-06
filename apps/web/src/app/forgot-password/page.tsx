'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="container flex justify-center py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">Forgot password?</h1>
        {sent ? (
          <>
            <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              If an account exists for <strong>{email}</strong>, we&apos;ve emailed a link to reset your password. It is valid for 30 minutes —
              check your spam folder too.
            </p>
            <Link href="/login" className="btn-primary mt-6 w-full">
              Back to login
            </Link>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
                setSent(true);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="mt-1 text-sm text-gray-500">Enter the email you signed up with and we&apos;ll send you a reset link.</p>
            {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <label className="label mt-6" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn-primary mt-6 w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="mt-4 text-center text-sm">
              <Link href="/login" className="font-semibold text-brand-700">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
