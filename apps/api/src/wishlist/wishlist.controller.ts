import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { toListingItem } from '../catalog/products.service';
import { UserPrincipal } from '../common/auth.types';
import { CurrentUser } from '../common/decorators';
import { UserAuthGuard } from '../common/guards';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(UserAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: UserPrincipal) {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            brand: true,
            status: true,
            minPrice: true,
            maxMrp: true,
            discountPct: true,
            ratingAvg: true,
            ratingCount: true,
            isFeatured: true,
            createdAt: true,
            images: { orderBy: { sortOrder: 'asc' }, take: 2, select: { url: true, alt: true } },
            variants: { where: { isActive: true }, select: { color: true, colorHex: true, size: true, stock: true } },
          },
        },
      },
    });
    return rows
      .filter((r) => r.product.status === ProductStatus.ACTIVE)
      .map((r) => toListingItem(r.product));
  }

  @Get('ids')
  async ids(@CurrentUser() user: UserPrincipal) {
    const rows = await this.prisma.wishlistItem.findMany({ where: { userId: user.id }, select: { productId: true } });
    return rows.map((r) => r.productId);
  }

  @Post(':productId')
  async add(@CurrentUser() user: UserPrincipal, @Param('productId') productId: string) {
    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: user.id, productId } },
      create: { userId: user.id, productId },
      update: {},
    });
    return { ok: true };
  }

  @Delete(':productId')
  async remove(@CurrentUser() user: UserPrincipal, @Param('productId') productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId: user.id, productId } });
    return { ok: true };
  }
}
