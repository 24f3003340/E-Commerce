import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { CacheService } from '../common/cache.service';
import { ProductsService } from '../catalog/products.service';
import { PrismaService } from '../prisma/prisma.service';

const SETTING_KEY = 'demo';

export interface DemoDataStatus {
  /** Set once the admin has removed the demo data; the seed script then never recreates it */
  removedAt: string | null;
  /** Demo records that are still live on the store */
  products: number;
  coupons: number;
  banners: number;
}

export interface DemoDataRemoval {
  productsDeleted: number;
  /** Demo products that already have orders cannot be deleted; they are archived (hidden) instead */
  productsArchived: number;
  couponsDeleted: number;
  couponsDeactivated: number;
  bannersDeleted: number;
}

/**
 * The seed script fills a new database with a sample catalog so the store can be tried right away.
 * It runs on every API start, so simply deleting the samples in the admin panel is not enough —
 * they would come back. Removing them here also records that fact, and the seed honours it.
 */
@Injectable()
export class DemoDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly cache: CacheService,
  ) {}

  async status(): Promise<DemoDataStatus> {
    const [row, products, coupons, banners] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: SETTING_KEY } }),
      this.prisma.product.count({ where: { isDemo: true, status: { not: ProductStatus.ARCHIVED } } }),
      this.prisma.coupon.count({ where: { isDemo: true, isActive: true } }),
      this.prisma.banner.count({ where: { isDemo: true } }),
    ]);
    const removedAt = (row?.value as { removedAt?: string } | null)?.removedAt ?? null;
    return { removedAt, products, coupons, banners };
  }

  /** Safe to run again after a partial failure: it only touches what is still left. */
  async remove(): Promise<DemoDataRemoval> {
    const result: DemoDataRemoval = {
      productsDeleted: 0,
      productsArchived: 0,
      couponsDeleted: 0,
      couponsDeactivated: 0,
      bannersDeleted: 0,
    };

    // Products: deleted for good unless an order already refers to them (then archived)
    const demoProducts = await this.prisma.product.findMany({
      where: { isDemo: true, status: { not: ProductStatus.ARCHIVED } },
      select: { id: true },
    });
    for (const { id } of demoProducts) {
      const r = await this.products.remove(id);
      if (r.archived) result.productsArchived++;
      else result.productsDeleted++;
    }

    // Coupons: deleted unless customers have already used them (then switched off)
    const demoCoupons = await this.prisma.coupon.findMany({ where: { isDemo: true }, select: { id: true, isActive: true } });
    for (const { id, isActive } of demoCoupons) {
      const used = await this.prisma.couponUsage.count({ where: { couponId: id } });
      const ordered = await this.prisma.order.count({ where: { couponId: id } });
      if (used || ordered) {
        if (isActive) {
          await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
          result.couponsDeactivated++;
        }
      } else {
        await this.prisma.coupon.delete({ where: { id } });
        result.couponsDeleted++;
      }
    }

    // Banners are only pictures with a link
    result.bannersDeleted = (await this.prisma.banner.deleteMany({ where: { isDemo: true } })).count;

    // Category pictures drawn by the seed (the categories themselves stay — they are the shop's
    // structure and can be renamed or deleted in Admin → Categories)
    await this.prisma.category.updateMany({ where: { imageUrl: { contains: '/assets/seed/' } }, data: { imageUrl: null } });

    await this.prisma.setting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: { removedAt: new Date().toISOString() } as Prisma.InputJsonValue },
      update: { value: { removedAt: new Date().toISOString() } as Prisma.InputJsonValue },
    });
    await this.cache.delByPrefix('catalog:');
    return result;
  }
}
