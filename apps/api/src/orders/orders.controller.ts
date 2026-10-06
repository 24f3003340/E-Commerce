import { Body, Controller, Get, Header, HttpCode, Param, Post, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuditService } from '../common/audit.service';
import { AdminPrincipal, UserPrincipal } from '../common/auth.types';
import { AdminRoles, CurrentAdmin, CurrentUser } from '../common/decorators';
import { AdminAuthGuard, UserAuthGuard } from '../common/guards';
import { SettingsService } from '../common/settings.service';
import { renderInvoice } from './invoice';
import { allowedNextStatuses } from './order-state';
import {
  AdminOrderQueryDto,
  CancelOrderDto,
  CheckoutDto,
  CreateShipmentDto,
  TrackOrderDto,
  UpdateOrderStatusDto,
} from './orders.dto';
import { OrdersService } from './orders.service';
import { ShippingService } from '../shipping/shipping.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('track')
  track(@Body() dto: TrackOrderDto) {
    return this.orders.track(dto.orderNumber, dto.contact);
  }

  @UseGuards(UserAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  checkout(@CurrentUser() user: UserPrincipal, @Body() dto: CheckoutDto) {
    return this.orders.checkout(user.id, dto);
  }

  @UseGuards(UserAuthGuard)
  @Get()
  list(@CurrentUser() user: UserPrincipal, @Query('page') page?: string) {
    return this.orders.customerOrders(user.id, Number(page) || 1, 10);
  }

  @UseGuards(UserAuthGuard)
  @Get(':orderNumber')
  get(@CurrentUser() user: UserPrincipal, @Param('orderNumber') orderNumber: string) {
    return this.orders.customerOrder(user.id, orderNumber);
  }

  @UseGuards(UserAuthGuard)
  @HttpCode(200)
  @Post(':orderNumber/cancel')
  cancel(@CurrentUser() user: UserPrincipal, @Param('orderNumber') orderNumber: string, @Body() dto: CancelOrderDto) {
    return this.orders.customerCancel(user.id, orderNumber, dto.reason);
  }

  @UseGuards(UserAuthGuard)
  @HttpCode(200)
  @Post(':orderNumber/pay')
  async retryPayment(@CurrentUser() user: UserPrincipal, @Param('orderNumber') orderNumber: string) {
    const order = await this.orders.customerOrder(user.id, orderNumber);
    return this.orders.createGatewayPayment(order.id);
  }

  @UseGuards(UserAuthGuard)
  @Get(':orderNumber/invoice')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoice(@CurrentUser() user: UserPrincipal, @Param('orderNumber') orderNumber: string) {
    await this.orders.customerOrder(user.id, orderNumber); // ownership check
    const order = await this.orders.findForInvoice({ orderNumber });
    return renderInvoice(order, await this.settings.get());
  }
}

@UseGuards(AdminAuthGuard)
@AdminRoles(AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_MANAGER)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly shipping: ShippingService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query() query: AdminOrderQueryDto) {
    return this.orders.adminList(query);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const order = await this.orders.adminGet(id);
    return { ...order, allowedNextStatuses: allowedNextStatuses(order.status) };
  }

  @Get(':id/invoice')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoice(@Param('id') id: string) {
    const order = await this.orders.findForInvoice({ id });
    return renderInvoice(order, await this.settings.get());
  }

  @AdminRoles(AdminRole.ORDER_MANAGER)
  @Patch(':id/status')
  async status(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @CurrentAdmin() admin: AdminPrincipal) {
    const order = await this.orders.transition(id, dto.status, `admin:${admin.id}`, dto.note);
    await this.audit.log(admin, 'status', 'order', id, dto);
    return { ...order, allowedNextStatuses: allowedNextStatuses(order.status) };
  }

  @AdminRoles(AdminRole.ORDER_MANAGER)
  @Post(':id/shipments')
  async createShipment(@Param('id') id: string, @Body() dto: CreateShipmentDto, @CurrentAdmin() admin: AdminPrincipal) {
    const shipment = await this.shipping.create(id, dto, `admin:${admin.id}`);
    await this.audit.log(admin, 'create', 'shipment', shipment.id, { orderId: id, ...dto });
    return shipment;
  }

  @AdminRoles(AdminRole.ORDER_MANAGER)
  @HttpCode(200)
  @Post(':id/refunds/retry')
  async retryRefunds(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    await this.orders.processPendingRefunds(id);
    await this.audit.log(admin, 'retry_refunds', 'order', id);
    return this.orders.adminGet(id);
  }
}
