import { AdminRole, SellerStatus } from '@prisma/client';

export interface UserPrincipal {
  id: string;
  type: 'user';
}

export interface AdminPrincipal {
  id: string;
  type: 'admin';
  role: AdminRole;
}

export interface SellerPrincipal {
  id: string;
  type: 'seller';
  status: SellerStatus;
}

export interface AccessTokenPayload {
  sub: string;
  typ: 'user' | 'admin' | 'seller';
  role?: AdminRole;
}
