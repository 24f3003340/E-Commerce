'use client';

import { createClient } from './client';
import type { Seller } from './types';

export interface SellerAuth {
  accessToken: string;
  refreshToken: string;
  seller: Seller;
}

/** Marketplace seller panel session — kept across browser restarts like a normal shop login. */
export const sellerClient = createClient<SellerAuth>({
  key: 'sk_seller_auth',
  persistent: true,
  authPath: '/seller/auth',
  uploadPath: '/seller/uploads',
  loginPage: '/seller/login',
});

export const sellerApi = sellerClient.api;
