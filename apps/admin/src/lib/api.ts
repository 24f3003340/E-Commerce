'use client';

import { createClient } from './client';
import type { AdminUser } from './types';

export { API_URL, ApiError } from './client';

export interface AdminAuth {
  accessToken: string;
  refreshToken: string;
  admin: AdminUser;
}

// Admin sessions live in sessionStorage so they end when the browser tab is closed.
const client = createClient<AdminAuth>({
  key: 'sk_admin_auth',
  persistent: false,
  authPath: '/admin/auth',
  uploadPath: '/admin/uploads',
  loginPage: '/login',
});

export const { getAuth, setAuth, api, uploadImage, openHtml, logout } = client;
export const adminClient = client;

export function login(email: string, password: string, otp?: string) {
  return client.authenticate('login', { email, password, otp: otp || undefined });
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
  sellers: ['PRODUCT_MANAGER', 'ORDER_MANAGER', 'SUPPORT_MANAGER'],
  settings: [],
  admins: [],
  payouts: [],
};

export function canAccess(role: AdminUser['role'], section: string) {
  if (section === 'admins' || section === 'audit-logs') return role === 'SUPER_ADMIN';
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
  return section === 'dashboard' || section === 'settings' || (ROLE_ACCESS[section] ?? []).includes(role);
}
