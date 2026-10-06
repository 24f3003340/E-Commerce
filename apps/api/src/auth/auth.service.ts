import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { config } from '../common/config';
import { EmailService, escapeHtml } from '../common/email.service';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../common/totp';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto, ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto';
import { TokensService } from './tokens.service';

const BCRYPT_ROUNDS = 12;
// Used to keep login timing similar whether or not the account exists
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', BCRYPT_ROUNDS);

export const publicUser = (u: { id: string; name: string; email: string; phone: string | null }) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly email: EmailService,
  ) {}

  // ───────────── Customers ─────────────

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    });
    if (exists) throw new ConflictException('An account with this email or phone already exists');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      },
    });
    return { user: publicUser(user), ...(await this.tokens.issueForUser(user.id)) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Account is disabled');
    return { user: publicUser(user), ...(await this.tokens.issueForUser(user.id)) };
  }

  async refreshUser(refreshToken: string) {
    const { userId } = await this.tokens.consume(refreshToken);
    if (!userId) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new UnauthorizedException('Account is disabled');
    return { user: publicUser(user), ...(await this.tokens.issueForUser(user.id)) };
  }

  async changeUserPassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    await this.tokens.revokeAll({ userId });
    return { ok: true };
  }

  /**
   * Emails a single-use reset link valid for 30 minutes. Always succeeds from the caller's point
   * of view so the endpoint cannot be used to discover which emails have accounts.
   */
  async forgotPassword(emailAddress: string) {
    const user = await this.prisma.user.findUnique({ where: { email: emailAddress.toLowerCase().trim() } });
    if (user?.isActive) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256').update(token).digest('hex'),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      const url = `${config.storefrontUrl}/reset-password?token=${token}`;
      const html = await this.email.layout(
        'Reset your password',
        `<p>Hi ${escapeHtml(user.name)},</p><p>We received a request to reset your password. This link is valid for 30 minutes and can be used once.</p><p>If you did not ask for this, you can ignore this email — your password will not change.</p>`,
        { label: 'Set a new password', url },
      );
      await this.email.send(user.email, 'Reset your password', html, `Reset your password: ${url} (valid for 30 minutes)`);
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired. Please request a new one.');
    }
    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) throw new BadRequestException('This reset link has already been used.');
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });
    await this.tokens.revokeAll({ userId: record.userId });
    return { ok: true };
  }

  // ───────────── Admins ─────────────

  async adminLogin(dto: AdminLoginDto) {
    const admin = await this.prisma.admin.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    const ok = await bcrypt.compare(dto.password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !ok || !admin.isActive) throw new UnauthorizedException('Invalid email or password');
    if (admin.twoFactorEnabled) {
      if (!dto.otp) throw new UnauthorizedException({ message: 'OTP required', code: 'OTP_REQUIRED' });
      if (!admin.twoFactorSecret || !verifyTotp(admin.twoFactorSecret, dto.otp)) {
        throw new UnauthorizedException({ message: 'Invalid OTP', code: 'OTP_INVALID' });
      }
    }
    await this.prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    return { admin: this.publicAdmin(admin), ...(await this.tokens.issueForAdmin(admin.id, admin.role)) };
  }

  async refreshAdmin(refreshToken: string) {
    const { adminId } = await this.tokens.consume(refreshToken);
    if (!adminId) throw new UnauthorizedException('Invalid refresh token');
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin?.isActive) throw new UnauthorizedException('Account is disabled');
    return { admin: this.publicAdmin(admin), ...(await this.tokens.issueForAdmin(admin.id, admin.role)) };
  }

  async adminMe(adminId: string) {
    return this.publicAdmin(await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } }));
  }

  async setupTwoFactor(adminId: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    if (admin.twoFactorEnabled) throw new BadRequestException('Two-factor authentication already enabled');
    const secret = generateTotpSecret();
    await this.prisma.admin.update({ where: { id: adminId }, data: { twoFactorSecret: secret } });
    return { secret, otpauthUrl: otpauthUrl(secret, admin.email, 'Store Admin') };
  }

  async enableTwoFactor(adminId: string, otp: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.twoFactorSecret || !verifyTotp(admin.twoFactorSecret, otp)) {
      throw new BadRequestException('Invalid OTP');
    }
    await this.prisma.admin.update({ where: { id: adminId }, data: { twoFactorEnabled: true } });
    return { ok: true };
  }

  async disableTwoFactor(adminId: string, otp: string) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    if (!admin.twoFactorEnabled || !admin.twoFactorSecret || !verifyTotp(admin.twoFactorSecret, otp)) {
      throw new BadRequestException('Invalid OTP');
    }
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { ok: true };
  }

  async logout(refreshToken: string) {
    await this.tokens.revoke(refreshToken);
    return { ok: true };
  }

  static hashPassword(password: string) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  private publicAdmin(a: {
    id: string;
    name: string;
    email: string;
    role: string;
    twoFactorEnabled: boolean;
  }) {
    return { id: a.id, name: a.name, email: a.email, role: a.role, twoFactorEnabled: a.twoFactorEnabled };
  }
}
