import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { AdminRole, OrderStatus, ProductStatus } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { ChangePasswordDto, LoginDto, RefreshDto } from '../auth/auth.dto';
import { TokensService } from '../auth/tokens.service';
import { AdjustStockDto, InventoryQueryDto } from '../catalog/catalog.controller';
import { AdminProductQueryDto, ProductDto } from '../catalog/catalog.dto';
import { CategoriesService } from '../catalog/categories.service';
import { InventoryService } from '../catalog/inventory.service';
import { ProductsService } from '../catalog/products.service';
import { AuditService } from '../common/audit.service';
import { AdminPrincipal, SellerPrincipal } from '../common/auth.types';
import { AdminRoles, ApprovedSellerOnly, CurrentAdmin, CurrentSeller, SellerAnyStatus } from '../common/decorators';
import { AdminAuthGuard, SellerAuthGuard } from '../common/guards';
import { SettingsService } from '../common/settings.service';
import { renderInvoice } from '../orders/invoice';
import { allowedNextStatuses } from '../orders/order-state';
import { AdminOrderQueryDto, CreateShipmentDto } from '../orders/orders.dto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingService } from '../shipping/shipping.service';
import { imageUpload, storeImage } from '../uploads/uploads.controller';
import {
  AdminSellerQueryDto,
  CreatePayoutDto,
  ProductReviewDto,
  SELLER_ORDER_STATUSES,
  SellerOrderStatusDto,
  SellerProfileDto,
  SellerRegisterDto,
  UpdateCommissionDto,
  UpdateSellerStatusDto,
} from './sellers.dto';
import { SellersService } from './sellers.service';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const actor = (seller: SellerPrincipal) => `seller:${seller.id}`;

// ───────────── Seller panel: account ─────────────

@Controller('seller/auth')
export class SellerAuthController {
  constructor(
    private readonly sellers: SellersService,
    private readonly tokens: TokensService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: SellerRegisterDto) {
    return this.sellers.register(dto);
  }

  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.sellers.login(dto);
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.sellers.refresh(dto.refreshToken);
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.tokens.revoke(dto.refreshToken);
    return { ok: true };
  }
}

@UseGuards(SellerAuthGuard)
@Controller('seller')
export class SellerAccountController {
  constructor(private readonly sellers: SellersService) {}

  @SellerAnyStatus()
  @Get('me')
  me(@CurrentSeller() seller: SellerPrincipal) {
    return this.sellers.me(seller.id);
  }

  @SellerAnyStatus()
  @Put('me')
  update(@CurrentSeller() seller: SellerPrincipal, @Body() dto: SellerProfileDto) {
    return this.sellers.updateProfile(seller.id, dto);
  }

  @SellerAnyStatus()
  @HttpCode(200)
  @Post('me/change-password')
  changePassword(@CurrentSeller() seller: SellerPrincipal, @Body() dto: ChangePasswordDto) {
    return this.sellers.changePassword(seller.id, dto);
  }

  @Get('dashboard')
  dashboard(@CurrentSeller() seller: SellerPrincipal) {
    return this.sellers.dashboard(seller.id);
  }

  @Get('earnings')
  earnings(@CurrentSeller() seller: SellerPrincipal) {
    return this.sellers.earningsSummary(seller.id);
  }

  @Get('payouts')
  payouts(@CurrentSeller() seller: SellerPrincipal, @Query('page') page?: string) {
    return this.sellers.payouts(seller.id, Number(page) || 1, 20);
  }
}

// ───────────── Seller panel: catalog ─────────────

@UseGuards(SellerAuthGuard)
@Controller('seller')
export class SellerCatalogController {
  constructor(
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('categories')
  categoryTree() {
    return this.categories.tree();
  }

  @Get('products')
  list(@CurrentSeller() seller: SellerPrincipal, @Query() query: AdminProductQueryDto) {
    return this.products.adminList({ ...query, sellerId: seller.id });
  }

  @Get('products/:id')
  async get(@CurrentSeller() seller: SellerPrincipal, @Param('id') id: string) {
    return this.owned(seller, id);
  }

  @Post('products')
  create(@CurrentSeller() seller: SellerPrincipal, @Body() dto: ProductDto) {
    return this.products.create(dto, actor(seller), { sellerId: seller.id });
  }

  @Put('products/:id')
  update(@CurrentSeller() seller: SellerPrincipal, @Param('id') id: string, @Body() dto: ProductDto) {
    return this.products.update(id, dto, actor(seller), { sellerId: seller.id });
  }

  @Delete('products/:id')
  async remove(@CurrentSeller() seller: SellerPrincipal, @Param('id') id: string) {
    await this.owned(seller, id);
    return this.products.remove(id);
  }

  @Get('inventory')
  inventoryList(@CurrentSeller() seller: SellerPrincipal, @Query() query: InventoryQueryDto) {
    return this.inventory.list({ ...query, lowStock: query.lowStock === 'true', sellerId: seller.id });
  }

  @Get('inventory/:variantId/movements')
  async movements(@CurrentSeller() seller: SellerPrincipal, @Param('variantId') variantId: string) {
    await this.ownedVariant(seller, variantId);
    return this.inventory.movements(variantId);
  }

  @Post('inventory/:variantId/adjust')
  async adjust(@CurrentSeller() seller: SellerPrincipal, @Param('variantId') variantId: string, @Body() dto: AdjustStockDto) {
    await this.ownedVariant(seller, variantId);
    return this.inventory.adjust(variantId, dto.change, dto.reason, dto.note, actor(seller));
  }

  @Post('uploads')
  @imageUpload()
  upload(@UploadedFile() file?: Express.Multer.File) {
    return storeImage(file);
  }

  private async ownedVariant(seller: SellerPrincipal, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, product: { sellerId: seller.id } } });
    if (!variant) throw new NotFoundException('Variant not found');
  }

  private async owned(seller: SellerPrincipal, id: string) {
    const product = await this.products.adminGet(id);
    if (product.sellerId !== seller.id) throw new NotFoundException('Product not found');
    return product;
  }
}

// ───────────── Seller panel: orders ─────────────

@UseGuards(SellerAuthGuard)
@ApprovedSellerOnly()
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly shipping: ShippingService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  list(@CurrentSeller() seller: SellerPrincipal, @Query() query: AdminOrderQueryDto) {
    return this.orders.sellerOrders(seller.id, query);
  }

  @Get(':id')
  async get(@CurrentSeller() seller: SellerPrincipal, @Param('id') id: string) {
    return this.detail(seller, id);
  }

  @Patch(':id/status')
  async status(@CurrentSeller() seller: SellerPrincipal, @Param('id') id: string, @Body() dto: SellerOrderStatusDto) {
    await this.orders.sellerOrder(seller.id, id);
    if (dto.status === OrderStatus.CANCELLED) {
      await this.orders.cancel(id, actor(seller), `Cancelled by seller${dto.note ? `: ${dto.note}` : ''}`);
    } else {
      await this.orders.transition(id, dto.status, actor(seller), dto.note);
    }
    return this.detail(seller, id);
  }

  @Post(':id/shipments')
  async ship(@CurrentSeller() seller: SellerPrincipal, @Param('id') id: string, @Body() dto: CreateShipmentDto) {
    await this.orders.sellerOrder(seller.id, id);
    await this.shipping.create(id, dto, actor(seller));
    return this.detail(seller, id);
  }

  @Get(':id/invoice')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async invoice(@CurrentSeller() seller: SellerPrincipal, @Param('id') id: string) {
    await this.orders.sellerOrder(seller.id, id);
    return renderInvoice(await this.orders.findForInvoice({ id }), await this.settings.get());
  }

  /** Order as the seller sees it: their items, the delivery address, no payment internals. */
  private async detail(seller: SellerPrincipal, id: string) {
    const { payments: _payments, refunds: _refunds, ...order } = await this.orders.sellerOrder(seller.id, id);
    const sellerSteps: OrderStatus[] = [...SELLER_ORDER_STATUSES, OrderStatus.SHIPPED];
    return { ...order, allowedNextStatuses: allowedNextStatuses(order.status).filter((s) => sellerSteps.includes(s)) };
  }
}

// ───────────── Admin: sellers, product review, payouts ─────────────

@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminSellersController {
  constructor(
    private readonly sellers: SellersService,
    private readonly products: ProductsService,
    private readonly audit: AuditService,
  ) {}

  @AdminRoles(AdminRole.PRODUCT_MANAGER, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_MANAGER)
  @Get('sellers')
  list(@Query() query: AdminSellerQueryDto) {
    return this.sellers.adminList(query);
  }

  @AdminRoles(AdminRole.PRODUCT_MANAGER, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_MANAGER)
  @Get('sellers/:id')
  get(@Param('id') id: string) {
    return this.sellers.adminGet(id);
  }

  // Only SUPER_ADMIN / ADMIN approve sellers, set commission and record payouts
  @AdminRoles(AdminRole.ADMIN)
  @Patch('sellers/:id/status')
  async status(@Param('id') id: string, @Body() dto: UpdateSellerStatusDto, @CurrentAdmin() admin: AdminPrincipal) {
    const seller = await this.sellers.setStatus(id, dto.status, dto.note);
    await this.audit.log(admin, 'status', 'seller', id, dto);
    return seller;
  }

  @AdminRoles(AdminRole.ADMIN)
  @Patch('sellers/:id/commission')
  async commission(@Param('id') id: string, @Body() dto: UpdateCommissionDto, @CurrentAdmin() admin: AdminPrincipal) {
    const seller = await this.sellers.setCommission(id, dto.commissionPct);
    await this.audit.log(admin, 'commission', 'seller', id, dto);
    return seller;
  }

  @AdminRoles(AdminRole.ADMIN)
  @Post('sellers/:id/payouts')
  async payout(@Param('id') id: string, @Body() dto: CreatePayoutDto, @CurrentAdmin() admin: AdminPrincipal) {
    const payout = await this.sellers.createPayout(id, dto, admin.id);
    await this.audit.log(admin, 'create', 'payout', payout.id, { sellerId: id, amount: payout.amount, reference: dto.reference });
    return payout;
  }

  @AdminRoles(AdminRole.ADMIN)
  @Get('payouts')
  payouts(@Query('sellerId') sellerId?: string, @Query('page') page?: string) {
    return this.sellers.payouts(sellerId || undefined, Number(page) || 1, 20);
  }

  /** Approve or reject a product a seller submitted. */
  @AdminRoles(AdminRole.PRODUCT_MANAGER)
  @Patch('products/:id/review')
  async review(@Param('id') id: string, @Body() dto: ProductReviewDto, @CurrentAdmin() admin: AdminPrincipal) {
    const result = await this.products.setStatus(id, dto.approve ? ProductStatus.ACTIVE : ProductStatus.REJECTED, dto.note);
    await this.sellers.notifyProductReview(id, dto.approve, dto.note);
    await this.audit.log(admin, dto.approve ? 'approve' : 'reject', 'product', id, dto);
    return result;
  }
}
