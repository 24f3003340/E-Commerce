import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole, Prisma } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthService } from '../auth/auth.service';
import { TokensService } from '../auth/tokens.service';
import { AuditService } from '../common/audit.service';
import { AdminPrincipal } from '../common/auth.types';
import { AdminRoles, CurrentAdmin, SuperAdminOnly } from '../common/decorators';
import { AdminAuthGuard } from '../common/guards';
import { paginate, paginated } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

class CreateAdminDto {
  @IsString()
  @Length(2, 80)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain letters and numbers' })
  password: string;

  @IsEnum(AdminRole)
  role: AdminRole;
}

class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  password?: string;
}

class CustomerStatusDto {
  @IsBoolean()
  isActive: boolean;
}

const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.AdminSelect;

@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @AdminRoles(AdminRole.MARKETING_MANAGER, AdminRole.ORDER_MANAGER)
  @Get('reports/sales')
  sales(@Query('from') from?: string, @Query('to') to?: string) {
    if ((from && isNaN(Date.parse(from))) || (to && isNaN(Date.parse(to)))) {
      throw new BadRequestException('Invalid date');
    }
    return this.admin.salesReport(from, to);
  }

  // ───────────── Customers ─────────────

  @AdminRoles(AdminRole.SUPPORT_MANAGER, AdminRole.ORDER_MANAGER, AdminRole.MARKETING_MANAGER)
  @Get('customers')
  async customers(@Query('q') q?: string, @Query('page') page?: string) {
    const p = paginate(Number(page) || 1, 20);
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        }
      : {};
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        select: { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true, _count: { select: { orders: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    const spend = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: users.map((u) => u.id) }, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } },
      _sum: { total: true },
    });
    const spendBy = new Map(spend.map((s) => [s.userId, s._sum.total ?? 0]));
    return paginated(
      users.map((u) => ({ ...u, orderCount: u._count.orders, totalSpend: spendBy.get(u.id) ?? 0 })),
      total,
      p.page,
      p.limit,
    );
  }

  @AdminRoles(AdminRole.SUPPORT_MANAGER, AdminRole.ORDER_MANAGER)
  @Get('customers/:id')
  async customer(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        addresses: true,
        orders: { orderBy: { createdAt: 'desc' }, take: 20 },
        returns: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    return user;
  }

  @AdminRoles(AdminRole.SUPPORT_MANAGER)
  @Patch('customers/:id/status')
  async customerStatus(@Param('id') id: string, @Body() dto: CustomerStatusDto, @CurrentAdmin() admin: AdminPrincipal) {
    await this.prisma.user.update({ where: { id }, data: { isActive: dto.isActive } });
    if (!dto.isActive) await this.tokens.revokeAll({ userId: id });
    await this.audit.log(admin, dto.isActive ? 'activate' : 'deactivate', 'customer', id);
    return { ok: true };
  }

  // ───────────── Admin users ─────────────

  @SuperAdminOnly()
  @Get('admins')
  admins() {
    return this.prisma.admin.findMany({ orderBy: { createdAt: 'asc' }, select: adminSelect });
  }

  @SuperAdminOnly()
  @Post('admins')
  async createAdmin(@Body() dto: CreateAdminDto, @CurrentAdmin() admin: AdminPrincipal) {
    const created = await this.prisma.admin.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase().trim(),
        role: dto.role,
        passwordHash: await AuthService.hashPassword(dto.password),
      },
      select: adminSelect,
    });
    await this.audit.log(admin, 'create', 'admin', created.id, { email: dto.email, role: dto.role });
    return created;
  }

  @SuperAdminOnly()
  @Put('admins/:id')
  async updateAdmin(@Param('id') id: string, @Body() dto: UpdateAdminDto, @CurrentAdmin() admin: AdminPrincipal) {
    if (id === admin.id && (dto.isActive === false || (dto.role && dto.role !== AdminRole.SUPER_ADMIN))) {
      throw new BadRequestException('You cannot deactivate or demote yourself');
    }
    const updated = await this.prisma.admin.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        isActive: dto.isActive,
        ...(dto.password ? { passwordHash: await AuthService.hashPassword(dto.password) } : {}),
      },
      select: adminSelect,
    });
    if (dto.isActive === false || dto.password) await this.tokens.revokeAll({ adminId: id });
    await this.audit.log(admin, 'update', 'admin', id, { ...dto, password: dto.password ? '***' : undefined });
    return updated;
  }

  @SuperAdminOnly()
  @Get('audit-logs')
  async auditLogs(@Query('page') page?: string, @Query('entity') entity?: string) {
    const p = paginate(Number(page) || 1, 50);
    const where = entity ? { entity } : {};
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { admin: { select: { name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, p.page, p.limit);
  }
}
