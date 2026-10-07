import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminRole, BannerPosition } from '@prisma/client';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, IsArray } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { CacheService } from '../common/cache.service';
import { config } from '../common/config';
import { AdminPrincipal } from '../common/auth.types';
import { AdminRoles, CurrentAdmin } from '../common/decorators';
import { AdminAuthGuard } from '../common/guards';
import { SettingsService, StoreSettings } from '../common/settings.service';
import { PrismaService } from '../prisma/prisma.service';

class BannerDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsString()
  @MaxLength(500)
  imageUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaText?: string;

  @IsOptional()
  @IsEnum(BannerPosition)
  position?: BannerPosition;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

class SettingsDto implements Partial<StoreSettings> {
  @IsOptional() @IsString() @MaxLength(80) storeName?: string;
  @IsOptional() @IsEmail() supportEmail?: string;
  @IsOptional() @IsString() @MaxLength(30) supportPhone?: string;
  @IsOptional() @IsInt() @Min(0) freeShippingThreshold?: number;
  @IsOptional() @IsInt() @Min(0) standardShippingFee?: number;
  @IsOptional() @IsInt() @Min(0) expressShippingFee?: number;
  @IsOptional() @IsBoolean() codEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) codFee?: number;
  @IsOptional() @IsInt() @Min(0) codMaxOrderValue?: number;
  @IsOptional() @IsInt() @Min(0) defaultReturnWindowDays?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) blockedPincodePrefixes?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) metroPincodePrefixes?: string[];
  @IsOptional() @IsString() @MaxLength(20) gstin?: string;
  @IsOptional() @IsString() @MaxLength(300) invoiceAddress?: string;
  @IsOptional() @IsString() @MaxLength(120) legalName?: string;
  @IsOptional() @IsString() @MaxLength(60) sellerState?: string;
  @IsOptional() @IsInt() @Min(0) gstRateLow?: number;
  @IsOptional() @IsInt() @Min(0) gstRateHigh?: number;
  @IsOptional() @IsInt() @Min(0) gstHighRateAbove?: number;
  @IsOptional() @IsString() @MaxLength(10) defaultHsn?: string;
  @IsOptional() @IsString() @MaxLength(120) orderAlertEmail?: string;
  @IsOptional() @IsString() @MaxLength(20) whatsappNumber?: string;
  @IsOptional() @IsBoolean() sellerRegistrationOpen?: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) defaultCommissionPct?: number;
  @IsOptional() @IsBoolean() sellerProductApproval?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(90) sellerPayoutHoldDays?: number;
}

const bannerData = (dto: BannerDto) => ({
  ...dto,
  startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
  endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
});

@Controller()
export class ContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly settings: SettingsService,
  ) {}

  @Get('banners')
  banners(@Query('position') position?: BannerPosition) {
    const pos = position && Object.values(BannerPosition).includes(position) ? position : undefined;
    return this.cache.wrap(`catalog:banners:${pos ?? 'all'}`, 120, () => {
      const now = new Date();
      return this.prisma.banner.findMany({
        where: {
          isActive: true,
          ...(pos ? { position: pos } : {}),
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: { sortOrder: 'asc' },
      });
    });
  }

  /** Settings the storefront needs (no internal values). */
  @Get('settings/public')
  async publicSettings() {
    const s = await this.settings.get();
    return {
      storeName: s.storeName,
      supportEmail: s.supportEmail,
      supportPhone: s.supportPhone,
      freeShippingThreshold: s.freeShippingThreshold,
      standardShippingFee: s.standardShippingFee,
      expressShippingFee: s.expressShippingFee,
      codEnabled: s.codEnabled,
      codFee: s.codFee,
      defaultReturnWindowDays: s.defaultReturnWindowDays,
      legalName: s.legalName,
      address: s.invoiceAddress,
      gstin: s.gstin,
      whatsappNumber: s.whatsappNumber,
      // Online payments switch on automatically once Razorpay keys are configured
      onlinePayments: config.onlinePaymentsEnabled,
      sellerRegistrationOpen: s.sellerRegistrationOpen,
    };
  }
}

@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminContentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @AdminRoles(AdminRole.MARKETING_MANAGER)
  @Get('banners')
  list() {
    return this.prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }] });
  }

  @AdminRoles(AdminRole.MARKETING_MANAGER)
  @Post('banners')
  async create(@Body() dto: BannerDto, @CurrentAdmin() admin: AdminPrincipal) {
    const banner = await this.prisma.banner.create({ data: bannerData(dto) });
    await this.cache.delByPrefix('catalog:banners');
    await this.audit.log(admin, 'create', 'banner', banner.id, dto);
    return banner;
  }

  @AdminRoles(AdminRole.MARKETING_MANAGER)
  @Put('banners/:id')
  async update(@Param('id') id: string, @Body() dto: BannerDto, @CurrentAdmin() admin: AdminPrincipal) {
    const banner = await this.prisma.banner.update({ where: { id }, data: bannerData(dto) });
    await this.cache.delByPrefix('catalog:banners');
    await this.audit.log(admin, 'update', 'banner', id, dto);
    return banner;
  }

  @AdminRoles(AdminRole.MARKETING_MANAGER)
  @Delete('banners/:id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    await this.prisma.banner.delete({ where: { id } });
    await this.cache.delByPrefix('catalog:banners');
    await this.audit.log(admin, 'delete', 'banner', id);
    return { ok: true };
  }

  /** Which outside services are connected — shown on the admin Settings page. */
  @Get('system-status')
  systemStatus() {
    return {
      imageStorage: config.storage.enabled ? 'cloud' : 'local',
      imageStorageUrl: config.storage.enabled ? config.storage.publicUrl : null,
      courier: config.shiprocket.enabled,
      courierPickupLocation: config.shiprocket.enabled ? config.shiprocket.pickupLocation : null,
      onlinePayments: config.razorpay.enabled,
      email: Boolean(config.email.resendApiKey),
    };
  }

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  // Only SUPER_ADMIN / ADMIN (no specific manager role listed)
  @AdminRoles(AdminRole.ADMIN)
  @Put('settings')
  async updateSettings(@Body() dto: SettingsDto, @CurrentAdmin() admin: AdminPrincipal) {
    const result = await this.settings.update(dto);
    await this.cache.delByPrefix('catalog:');
    await this.audit.log(admin, 'update', 'settings', 'store', dto);
    return result;
  }
}
