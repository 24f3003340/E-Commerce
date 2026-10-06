'use client';

import type { AdminUser } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const KEY = 'sk_admin_auth';

export interface AdminAuth {
  accessToken: string;
  refreshToken: string;
  admin: AdminUser;
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

// Admin sessions live in sessionStorage so they end when the browser tab is closed.
export function getAuth(): AdminAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AdminAuth) : null;
  } catch {
    return null;
  }
}

export function setAuth(auth: AdminAuth | null) {
  try {
    if (auth) window.sessionStorage.setItem(KEY, JSON.stringify(auth));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

let refreshing: Promise<AdminAuth | null> | null = null;

async function refresh(): Promise<AdminAuth | null> {
  const current = getAuth();
  if (!current) return null;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) {
        setAuth(null);
        return null;
      }
      const next = (await res.json()) as AdminAuth;
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
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  return res;
}

async function toError(res: Response) {
  const body = await res.json().catch(() => ({}));
  const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
  return new ApiError(message || `Request failed (${res.status})`, res.status, body.code);
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await request(path, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw await toError(res);
  return (await res.json()) as T;
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await request('/admin/uploads', { method: 'POST', body: form });
  if (!res.ok) throw await toError(res);
  return ((await res.json()) as { url: string }).url;
}

export async function openHtml(path: string) {
  const win = window.open('', '_blank');
  const res = await request(path, {});
  const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
  if (win) win.location.href = url;
}

export async function login(email: string, password: string, otp?: string) {
  const res = await fetch(`${API_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, otp: otp || undefined }),
  });
  if (!res.ok) throw await toError(res);
  const auth = (await res.json()) as AdminAuth;
  setAuth(auth);
  return auth;
}

export async function logout() {
  const auth = getAuth();
  if (auth) {
    await fetch(`${API_URL}/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    }).catch(() => undefined);
  }
  setAuth(null);
}

/** Which sidebar sections each role can open — mirrors the API's @AdminRoles guards. */
export const ROLE_ACCESS: Record<string, AdminUser['role'][]> = {
  products: ['PRODUCT_MANAGER'],
  categories: ['PRODUCT_MANAGER'],
  inventory: ['PRODUCT_MANAGER'],
  reviews: ['PRODUCT_MANAGER', 'SUPPORT_MANAGER'],
  orders: ['ORDER_MANAGER', 'SUPPORT_MANAGER'],
  returns: ['ORDER_MANAGER', 'SUPPORT_MANAGER'],
  customers: ['SUPPORT_MANAGER', 'ORDER_MANAGER', 'MARKETING_MANAGER'],
  coupons: ['MARKETING_MANAGER'],
  banners: ['MARKETING_MANAGER'],
  reports: ['MARKETING_MANAGER', 'ORDER_MANAGER'],
  settings: [],
  admins: [],
};

export function canAccess(role: AdminUser['role'], section: string) {
  if (section === 'admins' || section === 'audit-logs') return role === 'SUPER_ADMIN';
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
  return section === 'dashboard' || section === 'settings' || (ROLE_ACCESS[section] ?? []).includes(role);
}
