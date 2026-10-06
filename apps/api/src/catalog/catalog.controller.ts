import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole, InventoryReason, ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';
import { AdminPrincipal } from '../common/auth.types';
import { AdminRoles, CurrentAdmin } from '../common/decorators';
import { AdminAuthGuard } from '../common/guards';
import { AuditService } from '../common/audit.service';
import { AdminProductQueryDto, CategoryDto, PincodeQueryDto, ProductDto, ProductQueryDto } from './catalog.dto';
import { CategoriesService } from './categories.service';
import { InventoryService } from './inventory.service';
import { ProductsService } from './products.service';

export class AdjustStockDto {
  @IsInt()
  @Min(-100000)
  @Max(100000)
  change: number;

  @IsEnum(InventoryReason)
  reason: InventoryReason;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class InventoryQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  lowStock?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

class StatusDto {
  @IsEnum(ProductStatus)
  status: ProductStatus;
}

// ───────────── Storefront ─────────────

@Controller()
export class CatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
  ) {}

  @Get('categories')
  tree() {
    return this.categories.tree();
  }

  @Get('categories/:slug')
  category(@Param('slug') slug: string) {
    return this.categories.bySlug(slug);
  }

  @Get('products')
  list(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  /** Every live product slug — used by the website's sitemap.xml */
  @Get('products/sitemap')
  sitemap() {
    return this.products.sitemap();
  }

  @Get('products/suggest')
  suggest(@Query('q') q = '') {
    return this.products.suggestions(String(q).slice(0, 100));
  }

  @Get('products/:slug')
  detail(@Param('slug') slug: string) {
    return this.products.detail(slug);
  }

  @Get('serviceability')
  serviceability(@Query() query: PincodeQueryDto) {
    return this.products.serviceability(query.pincode);
  }
}

// ───────────── Admin ─────────────

@UseGuards(AdminAuthGuard)
@AdminRoles(AdminRole.PRODUCT_MANAGER)
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  @Get('categories')
  @AdminRoles(AdminRole.PRODUCT_MANAGER, AdminRole.MARKETING_MANAGER, AdminRole.ORDER_MANAGER, AdminRole.SUPPORT_MANAGER)
  categoryTree() {
    return this.categories.tree(true);
  }

  @Post('categories')
  async createCategory(@Body() dto: CategoryDto, @CurrentAdmin() admin: AdminPrincipal) {
    const created = await this.categories.create(dto);
    await this.audit.log(admin, 'create', 'category', created.id, dto);
    return created;
  }

  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: CategoryDto, @CurrentAdmin() admin: AdminPrincipal) {
    const updated = await this.categories.update(id, dto);
    await this.audit.log(admin, 'update', 'category', id, dto);
    return updated;
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    const result = await this.categories.remove(id);
    await this.audit.log(admin, 'delete', 'category', id);
    return result;
  }

  @Get('products')
  listProducts(@Query() query: AdminProductQueryDto) {
    return this.products.adminList(query);
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.products.adminGet(id);
  }

  @Post('products')
  async createProduct(@Body() dto: ProductDto, @CurrentAdmin() admin: AdminPrincipal) {
    const product = await this.products.create(dto, admin.id);
    await this.audit.log(admin, 'create', 'product', product.id, { name: dto.name });
    return product;
  }

  @Put('products/:id')
  async updateProduct(@Param('id') id: string, @Body() dto: ProductDto, @CurrentAdmin() admin: AdminPrincipal) {
    const product = await this.products.update(id, dto, admin.id);
    await this.audit.log(admin, 'update', 'product', id, { name: dto.name });
    return product;
  }

  @Patch('products/:id/status')
  async setStatus(@Param('id') id: string, @Body() dto: StatusDto, @CurrentAdmin() admin: AdminPrincipal) {
    const result = await this.products.setStatus(id, dto.status);
    await this.audit.log(admin, 'status', 'product', id, dto);
    return result;
  }

  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    const result = await this.products.remove(id);
    await this.audit.log(admin, result.archived ? 'archive' : 'delete', 'product', id);
    return result;
  }

  @Get('inventory')
  inventoryList(@Query() query: InventoryQueryDto) {
    return this.inventory.list({ ...query, lowStock: query.lowStock === 'true' });
  }

  @Get('inventory/:variantId/movements')
  movements(@Param('variantId') variantId: string) {
    return this.inventory.movements(variantId);
  }

  @Post('inventory/:variantId/adjust')
  async adjust(@Param('variantId') variantId: string, @Body() dto: AdjustStockDto, @CurrentAdmin() admin: AdminPrincipal) {
    const variant = await this.inventory.adjust(variantId, dto.change, dto.reason, dto.note, admin.id);
    await this.audit.log(admin, 'adjust_stock', 'variant', variantId, dto);
    return variant;
  }
}
