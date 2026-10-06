'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container flex flex-col items-center py-24 text-center">
      <p className="text-5xl">😕</p>
      <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-gray-500">We couldn&apos;t load this page. Please try again — if it keeps happening, contact our support team.</p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-outline">
          Go to home
        </Link>
      </div>
    </div>
  );
}
