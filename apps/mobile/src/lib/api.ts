import { API_URL } from './config';
import { getItem, setItem } from './storage';
import type { User } from './types';

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
let current: AuthState | null = null;

/** Reads the saved session once at startup. */
export async function loadAuth(): Promise<AuthState | null> {
  try {
    const raw = await getItem(STORAGE_KEY);
    current = raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    current = null;
  }
  return current;
}

export function getAuth(): AuthState | null {
  return current;
}

export async function setAuth(auth: AuthState | null) {
  current = auth;
  listeners.forEach((l) => l(auth));
  await setItem(STORAGE_KEY, auth ? JSON.stringify(auth) : null).catch(() => undefined);
}

export function onAuthChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let refreshing: Promise<AuthState | null> | null = null;

async function refreshTokens(): Promise<AuthState | null> {
  const auth = current;
  if (!auth?.refreshToken) return null;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });
      if (!res.ok) {
        await setAuth(null);
        return null;
      }
      const next = (await res.json()) as AuthState;
      await setAuth(next);
      return next;
    } catch {
      return null;
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

/** API call. Attaches the access token and transparently refreshes it once on 401. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const send = (token?: string) =>
    fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

  const auth = init.auth === false ? null : current;
  let res: Response;
  try {
    res = await send(auth?.accessToken);
  } catch {
    throw new ApiError('No internet connection. Please try again.', 0);
  }
  if (res.status === 401 && auth) {
    const refreshed = await refreshTokens();
    if (refreshed) res = await send(refreshed.accessToken);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function logout() {
  const auth = current;
  if (auth) {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    }).catch(() => undefined);
  }
  await setAuth(null);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}
