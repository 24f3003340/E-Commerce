import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ROLES_KEY = 'adminRoles';
/**
 * Restricts an admin endpoint to the given roles. SUPER_ADMIN and ADMIN always pass unless
 * `SuperAdminOnly` is used.
 */
export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

export const SUPER_ADMIN_ONLY_KEY = 'superAdminOnly';
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY_KEY, true);

/**
 * Seller endpoints normally need an active (pending or approved) seller account. Marks the few
 * endpoints a rejected / suspended seller may still use (profile, status).
 */
export const SELLER_ANY_STATUS_KEY = 'sellerAnyStatus';
export const SellerAnyStatus = () => SetMetadata(SELLER_ANY_STATUS_KEY, true);
/** Endpoints that need an approved seller (orders, payouts). */
export const SELLER_APPROVED_KEY = 'sellerApproved';
export const ApprovedSellerOnly = () => SetMetadata(SELLER_APPROVED_KEY, true);

export const CurrentSeller = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().seller;
});

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().admin;
});
