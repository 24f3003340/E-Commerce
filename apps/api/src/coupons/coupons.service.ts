import { BadRequestException, Injectable } from '@nestjs/common';
import { Coupon, OrderStatus, Prisma } from '@prisma/client';
import { CategoriesService } from '../catalog/categories.service';
import { paginate, paginated } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { couponDiscount, eligibleSubtotal, PricedLine, subtotalOf } from './coupon-math';
import { CouponDto } from './coupons.dto';

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  /** Validates a coupon for a user + cart and returns the discount. Throws with a user-friendly message. */
  async evaluate(
    code: string,
    userId: string,
    lines: PricedLine[],
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<{ coupon: Coupon; discount: number }> {
    const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    const now = new Date();
    if (!coupon || !coupon.isActive) throw new BadRequestException('Invalid coupon code');
    if (coupon.startsAt && coupon.startsAt > now) throw new BadRequestException('Coupon is not active yet');
    if (coupon.endsAt && coupon.endsAt < now) throw new BadRequestException('Coupon has expired');
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (coupon.perUserLimit != null) {
      const used = await db.couponUsage.count({ where: { couponId: coupon.id, userId } });
      if (used >= coupon.perUserLimit) throw new BadRequestException('You have already used this coupon');
    }
    if (coupon.firstOrderOnly) {
      const previous = await db.order.count({
        where: { userId, status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT] } },
      });
      if (previous > 0) throw new BadRequestException('Coupon is valid on your first order only');
    }
    const eligibleCategoryIds: string[] = [];
    for (const id of coupon.applicableCategoryIds) {
      eligibleCategoryIds.push(...(await this.categories.descendantIds(id)));
    }
    const subtotal = subtotalOf(lines);
    if (subtotal < coupon.minOrderValue) {
      throw new BadRequestException(`Add items worth ₹${Math.ceil((coupon.minOrderValue - subtotal) / 100)} more to use this coupon`);
    }
    const ctx = { ...coupon, eligibleCategoryIds };
    if (eligibleSubtotal(ctx, lines) <= 0) {
      throw new BadRequestException('Coupon is not applicable to the items in your cart');
    }
    return { coupon, discount: couponDiscount(ctx, lines) };
  }

  /** Coupons shown on the cart / checkout page. */
  listPublic() {
    const now = new Date();
    return this.prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      select: { code: true, description: true, type: true, value: true, maxDiscount: true, minOrderValue: true, endsAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  // ───────────── Admin ─────────────

  async adminList(page?: number, limit?: number) {
    const p = paginate(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, skip: p.skip, take: p.take }),
      this.prisma.coupon.count(),
    ]);
    return paginated(items, total, p.page, p.limit);
  }

  create(dto: CouponDto) {
    this.validate(dto);
    return this.prisma.coupon.create({ data: { ...this.fields(dto) } });
  }

  update(id: string, dto: CouponDto) {
    this.validate(dto);
    return this.prisma.coupon.update({ where: { id }, data: this.fields(dto) });
  }

  async remove(id: string) {
    const used = await this.prisma.couponUsage.count({ where: { couponId: id } });
    if (used) {
      await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return { ok: true, deactivated: true };
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { ok: true, deactivated: false };
  }

  usages(id: string) {
    return this.prisma.couponUsage.findMany({
      where: { couponId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, email: true } }, order: { select: { orderNumber: true, total: true } } },
    });
  }

  private validate(dto: CouponDto) {
    if (dto.type === 'PERCENT' && (dto.value < 1 || dto.value > 90)) {
      throw new BadRequestException('Percent coupons must be between 1 and 90');
    }
    if (dto.startsAt && dto.endsAt && new Date(dto.startsAt) > new Date(dto.endsAt)) {
      throw new BadRequestException('Start date must be before end date');
    }
  }

  private fields(dto: CouponDto) {
    return {
      code: dto.code.trim().toUpperCase(),
      description: dto.description,
      type: dto.type,
      value: dto.value,
      maxDiscount: dto.maxDiscount ?? null,
      minOrderValue: dto.minOrderValue ?? 0,
      applicableCategoryIds: dto.applicableCategoryIds ?? [],
      firstOrderOnly: dto.firstOrderOnly ?? false,
      usageLimit: dto.usageLimit ?? null,
      perUserLimit: dto.perUserLimit ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      isActive: dto.isActive ?? true,
    };
  }
}
