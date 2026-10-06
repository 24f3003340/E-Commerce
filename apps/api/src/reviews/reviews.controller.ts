import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminRole, OrderStatus } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../common/audit.service';
import { CacheService } from '../common/cache.service';
import { AdminPrincipal, UserPrincipal } from '../common/auth.types';
import { AdminRoles, CurrentAdmin, CurrentUser } from '../common/decorators';
import { AdminAuthGuard, UserAuthGuard } from '../common/guards';
import { paginate, paginated } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

class ReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

class ModerateDto {
  @IsBoolean()
  isApproved: boolean;
}

async function refreshRating(prisma: PrismaService, productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
  });
}

@Controller('products/:productId/reviews')
export class ReviewsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get()
  async list(@Param('productId') productId: string, @Query('page') page?: string) {
    const p = paginate(Number(page) || 1, 10);
    const where = { productId, isApproved: true };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { user: { select: { name: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(
      items.map((r) => ({ ...r, author: r.user.name, user: undefined, userId: undefined })),
      total,
      p.page,
      p.limit,
    );
  }

  /** One review per customer per product; only customers who received the product can review. */
  @UseGuards(UserAuthGuard)
  @Post()
  async upsert(@CurrentUser() user: UserPrincipal, @Param('productId') productId: string, @Body() dto: ReviewDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) throw new NotFoundException('Product not found');
    const purchased = await this.prisma.orderItem.count({
      where: { productId, order: { userId: user.id, status: OrderStatus.DELIVERED } },
    });
    if (!purchased) throw new BadRequestException('You can review products after they are delivered to you');
    const review = await this.prisma.review.upsert({
      where: { productId_userId: { productId, userId: user.id } },
      create: { ...dto, productId, userId: user.id, verifiedPurchase: true },
      update: { ...dto },
    });
    await refreshRating(this.prisma, productId);
    await this.cache.delByPrefix('catalog:');
    return review;
  }
}

@UseGuards(AdminAuthGuard)
@AdminRoles(AdminRole.PRODUCT_MANAGER, AdminRole.SUPPORT_MANAGER)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query('page') page?: string) {
    const p = paginate(Number(page) || 1, 20);
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { user: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } },
      }),
      this.prisma.review.count(),
    ]);
    return paginated(items, total, p.page, p.limit);
  }

  @Patch(':id')
  async moderate(@Param('id') id: string, @Body() dto: ModerateDto, @CurrentAdmin() admin: AdminPrincipal) {
    const review = await this.prisma.review.update({ where: { id }, data: { isApproved: dto.isApproved } });
    await refreshRating(this.prisma, review.productId);
    await this.cache.delByPrefix('catalog:');
    await this.audit.log(admin, 'moderate', 'review', id, dto);
    return review;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentAdmin() admin: AdminPrincipal) {
    const review = await this.prisma.review.delete({ where: { id } });
    await refreshRating(this.prisma, review.productId);
    await this.cache.delByPrefix('catalog:');
    await this.audit.log(admin, 'delete', 'review', id);
    return { ok: true };
  }
}
