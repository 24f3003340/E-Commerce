'use client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export interface Session {
  accessToken: string;
  refreshToken: string;
}

async function toError(res: Response) {
  const body = await res.json().catch(() => ({}));
  const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
  return new ApiError(message || `Request failed (${res.status})`, res.status, body.code);
}

/**
 * A small authenticated API client. The admin panel and the marketplace seller panel each get
 * their own (separate tokens, storage and login page).
 */
export function createClient<A extends Session>(opts: {
  /** Storage key of the session */
  key: string;
  /** sessionStorage ends the session with the tab (admin); localStorage keeps it (sellers) */
  persistent: boolean;
  /** e.g. /admin/auth or /seller/auth */
  authPath: string;
  uploadPath: string;
  loginPage: string;
}) {
  const store = () => (opts.persistent ? window.localStorage : window.sessionStorage);

  function getAuth(): A | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = store().getItem(opts.key);
      return raw ? (JSON.parse(raw) as A) : null;
    } catch {
      return null;
    }
  }

  function setAuth(auth: A | null) {
    try {
      if (auth) store().setItem(opts.key, JSON.stringify(auth));
      else store().removeItem(opts.key);
    } catch {
      // ignore
    }
  }

  let refreshing: Promise<A | null> | null = null;

  async function refresh(): Promise<A | null> {
    const current = getAuth();
    if (!current) return null;
    refreshing ??= (async () => {
      try {
        const res = await fetch(`${API_URL}${opts.authPath}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) {
          setAuth(null);
          return null;
        }
        const next = (await res.json()) as A;
        setAuth(next);
        return next;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
    return refreshing;
  }

  async function request(path: string, init: RequestInit, retry = true): Promise<Response> {
    const auth = getAuth();
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), ...(auth ? { Authorization: `Bearer ${auth.accessToken}` } : {}) },
    });
    if (res.status === 401 && auth && retry) {
      const next = await refresh();
      if (next) return request(path, init, false);
      if (typeof window !== 'undefined') window.location.href = opts.loginPage;
    }
    return res;
  }

  async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await request(path, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) throw await toError(res);
    return (await res.json()) as T;
  }

  async function uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await request(opts.uploadPath, { method: 'POST', body: form });
    if (!res.ok) throw await toError(res);
    return ((await res.json()) as { url: string }).url;
  }

  async function openHtml(path: string) {
    const win = window.open('', '_blank');
    const res = await request(path, {});
    const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
    if (win) win.location.href = url;
  }

  /** Signs in (or registers) with the given endpoint and stores the session. */
  async function authenticate(endpoint: string, body: unknown): Promise<A> {
    const res = await fetch(`${API_URL}${opts.authPath}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await toError(res);
    const auth = (await res.json()) as A;
    setAuth(auth);
    return auth;
  }

  async function logout() {
    const auth = getAuth();
    if (auth) {
      await fetch(`${API_URL}${opts.authPath}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      }).catch(() => undefined);
    }
    setAuth(null);
  }

  return { getAuth, setAuth, api, uploadImage, openHtml, authenticate, logout };
}

/** What ProductForm and other shared screens need from a client. */
export type ApiClient = Pick<ReturnType<typeof createClient>, 'api' | 'uploadImage'>;
