import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AccessTokenPayload } from '../common/auth.types';
import { config } from '../common/config';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Short-lived JWT access tokens + opaque, rotating refresh tokens. Only a SHA-256 hash of each
 * refresh token is stored, and every refresh revokes the old token. Re-use of a revoked token
 * (a sign of theft) revokes every session of that account.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async issueForUser(userId: string): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: userId, typ: 'user' };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: config.jwt.accessSecret,
      expiresIn: config.jwt.accessTtl as any,
    });
    const refreshToken = await this.createRefresh({ userId });
    return { accessToken, refreshToken };
  }

  async issueForAdmin(adminId: string, role: AdminRole): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: adminId, typ: 'admin', role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: config.jwt.adminAccessSecret,
      expiresIn: config.jwt.accessTtl as any,
    });
    const refreshToken = await this.createRefresh({ adminId });
    return { accessToken, refreshToken };
  }

  /** Validates and revokes a refresh token, returning who it belonged to. */
  async consume(refreshToken: string): Promise<{ userId?: string; adminId?: string }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash(refreshToken) },
    });
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (record.revokedAt) {
      await this.revokeAll({ userId: record.userId ?? undefined, adminId: record.adminId ?? undefined });
      throw new UnauthorizedException('Refresh token reuse detected; please login again');
    }
    if (record.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');
    const updated = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) throw new UnauthorizedException('Invalid refresh token');
    return { userId: record.userId ?? undefined, adminId: record.adminId ?? undefined };
  }

  async revoke(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(owner: { userId?: string; adminId?: string }) {
    if (!owner.userId && !owner.adminId) return;
    await this.prisma.refreshToken.updateMany({
      where: { ...owner, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefresh(owner: { userId?: string; adminId?: string }): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        ...owner,
        tokenHash: hash(token),
        expiresAt: new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });
    return token;
  }
}
