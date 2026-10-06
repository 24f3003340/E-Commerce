'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useStore } from '@/context/StoreProvider';
import { ApiError } from '@/lib/api';

function RegisterForm() {
  const { register } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const next = params.get('next');

  return (
    <div className="container flex justify-center py-12">
      <form
        className="card w-full max-w-md p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await register({ ...form, phone: form.phone || undefined });
            router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Registration failed');
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-2xl font-bold">Create account</h1>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input id="name" required minLength={2} className="input" value={form.name} onChange={set('name')} autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required className="input" value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Mobile number (optional)
            </label>
            <input id="phone" inputMode="numeric" pattern="[6-9][0-9]{9}" title="10 digit mobile number" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel-national" />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input id="password" type="password" required minLength={8} className="input" value={form.password} onChange={set('password')} autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-500">At least 8 characters with letters and numbers.</p>
          </div>
        </div>
        <button className="btn-primary mt-6 w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="mt-3 text-center text-[11px] text-gray-500">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline">
            Privacy policy
          </Link>
          .
        </p>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-700">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
