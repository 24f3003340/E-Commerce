'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { ApiError } from '@/lib/api';

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function LoginForm() {
  const { login } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="container flex justify-center py-12">
      <form
        className="card w-full max-w-md p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await login(email, password);
            router.replace(safeNext(params.get('next')));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Login failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-1 text-sm text-gray-500">Track orders, save your wishlist and checkout faster.</p>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <button className="btn-primary mt-6 w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Login'}
        </button>
        <p className="mt-4 text-center text-sm text-gray-600">
          New here?{' '}
          <Link href={`/register?next=${encodeURIComponent(safeNext(params.get('next')))}`} className="font-semibold text-brand-700">
            Create an account
          </Link>
        </p>
        <p className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-gray-500">Demo account: customer@example.com / Customer@123</p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
