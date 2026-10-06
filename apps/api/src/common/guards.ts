import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AdminRole, SellerStatus } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload } from './auth.types';
import { config } from './config';
import { ROLES_KEY, SELLER_ANY_STATUS_KEY, SELLER_APPROVED_KEY, SUPER_ADMIN_ONLY_KEY } from './decorators';

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7);
}

/** Requires a valid customer access token. */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = bearer(req);
    if (!token) throw new UnauthorizedException('Login required');
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: config.jwt.accessSecret,
      });
      if (payload.typ !== 'user') throw new Error('wrong token type');
      req.user = { id: payload.sub, type: 'user' };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

/** Attaches the customer when a valid token is present but never rejects the request. */
@Injectable()
export class OptionalUserGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = bearer(req);
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
          secret: config.jwt.accessSecret,
        });
        if (payload.typ === 'user') req.user = { id: payload.sub, type: 'user' };
      } catch {
        // ignore — treated as anonymous
      }
    }
    return true;
  }
}

/** Requires a valid admin access token and enforces role-based permissions. */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = bearer(req);
    if (!token) throw new UnauthorizedException('Admin login required');
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: config.jwt.adminAccessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.typ !== 'admin') throw new UnauthorizedException('Invalid token');

    // Re-read the role so deactivations / role changes take effect immediately.
    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true },
    });
    if (!admin?.isActive) throw new UnauthorizedException('Admin account disabled');
    req.admin = { id: admin.id, type: 'admin', role: admin.role };

    const targets = [ctx.getHandler(), ctx.getClass()];
    const superOnly = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_ONLY_KEY, targets);
    if (superOnly) {
      if (admin.role !== AdminRole.SUPER_ADMIN) throw new ForbiddenException('Super admin only');
      return true;
    }
    if (admin.role === AdminRole.SUPER_ADMIN || admin.role === AdminRole.ADMIN) return true;
    const roles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, targets);
    if (!roles || roles.length === 0) return true;
    if (!roles.includes(admin.role)) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

/** Requires a valid marketplace seller access token; re-reads the account status every request. */
@Injectable()
export class SellerAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = bearer(req);
    if (!token) throw new UnauthorizedException('Seller login required');
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: config.jwt.sellerAccessSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.typ !== 'seller') throw new UnauthorizedException('Invalid token');
    const seller = await this.prisma.seller.findUnique({ where: { id: payload.sub }, select: { id: true, status: true } });
    if (!seller) throw new UnauthorizedException('Seller account not found');
    req.seller = { id: seller.id, type: 'seller', status: seller.status };

    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SELLER_ANY_STATUS_KEY, targets)) return true;
    if (seller.status === SellerStatus.REJECTED || seller.status === SellerStatus.SUSPENDED) {
      throw new ForbiddenException({ message: 'Your seller account is not active', code: 'SELLER_INACTIVE' });
    }
    if (this.reflector.getAllAndOverride<boolean>(SELLER_APPROVED_KEY, targets) && seller.status !== SellerStatus.APPROVED) {
      throw new ForbiddenException({ message: 'Your seller account is waiting for approval', code: 'SELLER_PENDING' });
    }
    return true;
  }
}
