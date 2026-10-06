import 'server-only';
import { notFound } from 'next/navigation';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Server-side GET against the API. 404 → Next.js not-found page. */
export async function serverGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

/** Same as serverGet but returns a fallback instead of failing the whole page. */
export async function serverGetSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}
