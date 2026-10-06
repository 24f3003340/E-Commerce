'use client';

import type { User } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const STORAGE_KEY = 'sk_auth';

export interface AuthState {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

type Listener = (auth: AuthState | null) => void;
const listeners = new Set<Listener>();

export function getAuth(): AuthState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export function setAuth(auth: AuthState | null) {
  try {
    if (auth) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode) — session-only auth
  }
  listeners.forEach((l) => l(auth));
}

export function onAuthChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let refreshing: Promise<AuthState | null> | null = null;

async function refreshTokens(): Promise<AuthState | null> {
  const current = getAuth();
  if (!current?.refreshToken) return null;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        setAuth(null);
        return null;
      }
      const next = (await res.json()) as AuthState;
      setAuth(next);
      return next;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function parseError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  const message = Array.isArray(body.message) ? body.message[0] : body.message;
  return new ApiError(message || `Request failed (${res.status})`, res.status, body.code);
}

/** Browser-side API call. Attaches the access token and transparently refreshes it once on 401. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const send = (token?: string) =>
    fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

  const auth = init.auth === false ? null : getAuth();
  let res = await send(auth?.accessToken);
  if (res.status === 401 && auth) {
    const refreshed = await refreshTokens();
    if (refreshed) res = await send(refreshed.accessToken);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetches an authenticated HTML document (e.g. invoice) and opens it in a new tab. */
export async function openAuthedHtml(path: string) {
  const win = window.open('', '_blank');
  let auth = getAuth();
  let res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${auth?.accessToken}` } });
  if (res.status === 401) {
    auth = await refreshTokens();
    res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${auth?.accessToken}` } });
  }
  const html = await res.text();
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  if (win) win.location.href = url;
  else window.location.href = url;
}

export async function logout() {
  const auth = getAuth();
  if (auth) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    }).catch(() => undefined);
  }
  setAuth(null);
}
