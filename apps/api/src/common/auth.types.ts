import { AdminRole } from '@prisma/client';

export interface UserPrincipal {
  id: string;
  type: 'user';
}

export interface AdminPrincipal {
  id: string;
  type: 'admin';
  role: AdminRole;
}

export interface AccessTokenPayload {
  sub: string;
  typ: 'user' | 'admin';
  role?: AdminRole;
}
