import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, Prisma } from '@prisma/client';
import { CacheService } from '../common/cache.service';
import { paginate, paginated } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';

export const LOW_STOCK_THRESHOLD = 5;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async list(params: { q?: string; lowStock?: boolean; page?: number; limit?: number }) {
    const { page, limit, skip, take } = paginate(params.page, params.limit);
    const where: Prisma.ProductVariantWhereInput = {
      ...(params.lowStock ? { stock: { lte: LOW_STOCK_THRESHOLD }, isActive: true } : {}),
      ...(params.q
        ? {
            OR: [
              { sku: { contains: params.q, mode: 'insensitive' } },
              { product: { name: { contains: params.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        orderBy: [{ stock: 'asc' }, { sku: 'asc' }],
        skip,
        take,
        include: { product: { select: { id: true, name: true, status: true } } },
      }),
      this.prisma.productVariant.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async movements(variantId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async adjust(variantId: string, change: number, reason: InventoryReason, note: string | undefined, adminId: string) {
    if (change === 0) throw new BadRequestException('Change cannot be zero');
    if (reason !== InventoryReason.RESTOCK && reason !== InventoryReason.ADJUSTMENT) {
      throw new BadRequestException('Only RESTOCK or ADJUSTMENT can be applied manually');
    }
    const variant = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.updateMany({
        where: { id: variantId, ...(change < 0 ? { stock: { gte: -change } } : {}) },
        data: { stock: { increment: change } },
      });
      if (updated.count === 0) {
        const exists = await tx.productVariant.findUnique({ where: { id: variantId } });
        if (!exists) throw new NotFoundException('Variant not found');
        throw new BadRequestException('Stock cannot go below zero');
      }
      await tx.inventoryMovement.create({ data: { variantId, change, reason, note, adminId } });
      return tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    });
    await this.cache.delByPrefix('catalog:');
    return variant;
  }
}
