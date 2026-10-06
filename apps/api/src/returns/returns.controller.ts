import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminRole, ReturnStatus } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { AdminPrincipal, UserPrincipal } from '../common/auth.types';
import { AdminRoles, CurrentAdmin, CurrentUser } from '../common/decorators';
import { AdminAuthGuard, UserAuthGuard } from '../common/guards';
import { CreateReturnDto, UpdateReturnStatusDto } from './returns.dto';
import { ReturnsService } from './returns.service';

@UseGuards(UserAuthGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  mine(@CurrentUser() user: UserPrincipal) {
    return this.returns.mine(user.id);
  }

  @Get('eligibility/:orderNumber')
  eligibility(@CurrentUser() user: UserPrincipal, @Param('orderNumber') orderNumber: string) {
    return this.returns.eligibility(user.id, orderNumber);
  }

  @Post()
  create(@CurrentUser() user: UserPrincipal, @Body() dto: CreateReturnDto) {
    return this.returns.create(user.id, dto);
  }
}

@UseGuards(AdminAuthGuard)
@AdminRoles(AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_MANAGER)
@Controller('admin/returns')
export class AdminReturnsController {
  constructor(
    private readonly returns: ReturnsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('status') status?: ReturnStatus, @Query('page') page?: string) {
    const valid = status && Object.values(ReturnStatus).includes(status) ? status : undefined;
    return this.returns.adminList(valid, Number(page) || 1, 20);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.returns.adminGet(id);
  }

  @Patch(':id/status')
  async status(@Param('id') id: string, @Body() dto: UpdateReturnStatusDto, @CurrentAdmin() admin: AdminPrincipal) {
    const result = await this.returns.updateStatus(id, dto);
    await this.audit.log(admin, 'status', 'return', id, dto);
    return result;
  }
}
