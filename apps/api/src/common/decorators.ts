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

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().admin;
});
