import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { AdminPrincipal } from '../common/auth.types';
import { AdminRoles, CurrentAdmin } from '../common/decorators';
import { AdminAuthGuard } from '../common/guards';
import { CouponDto } from './coupons.dto';
import { CouponsService } from './coupons.service';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list() {
    return this.coupons.listPublic();
  }
}

@UseGuards(AdminAuthGuard)
@AdminRoles(AdminRole.MARKETING_MANAGER)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.coupons.adminList(Number(page) || 1, Number(limit) || 20);
  }

  @Get(':id/usages')
  usages(@Param('id') id: string) {
    return this.coupons.usages(id);
  }

  @Post()
  async create(@Body() dto: CouponDto, @CurrentAdmin() admin: AdminPrincipal) {
    const coupon = await this.coupons.create(dto);
    await this.audit.log(admin, 'create', 'coupon', coupon.id, dto);
    return coupon;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: CouponDto, @CurrentAdmin() admin: AdminPrincipal) {
    const coupon = await this.coupons.update(id, dto);
    await this.audit.log(admin, 'update', 'coupon', id, dto);
    return coupon;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    const result = await this.coupons.remove(id);
    await this.audit.log(admin, 'delete', 'coupon', id);
    return result;
  }
}
