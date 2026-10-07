import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isLiveProduct } from '../catalog/visibility';
import { config } from '../common/config';
import { SettingsService } from '../common/settings.service';
import { DeliveryMethod, PricedLine, shippingFee, subtotalOf } from '../coupons/coupon-math';
import { CouponsService } from '../coupons/coupons.service';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_QTY_PER_ITEM, QuoteDto } from './cart.dto';

const cartItemInclude = {
  variant: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          sellerId: true,
          seller: { select: { status: true, storeName: true } },
          images: { orderBy: { sortOrder: 'asc' }, select: { url: true, color: true } },
          categories: { select: { categoryId: true } },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

export type CartItemRow = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

export type CartIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export function cartItemIssue(item: CartItemRow): CartIssue | undefined {
  const { variant } = item;
  if (!variant.isActive || !isLiveProduct(variant.product)) return 'UNAVAILABLE';
  if (variant.stock <= 0) return 'OUT_OF_STOCK';
  if (variant.stock < item.quantity) return 'INSUFFICIENT_STOCK';
  return undefined;
}

export function variantLabel(v: { color: string | null; size: string | null }) {
  return [v.color, v.size].filter(Boolean).join(' / ') || 'Default';
}

export function variantImage(item: CartItemRow) {
  const images = item.variant.product.images;
  return (images.find((i) => i.color && i.color === item.variant.color) ?? images[0])?.url ?? null;
}

export function toPricedLines(items: CartItemRow[]): PricedLine[] {
  return items.map((i) => ({
    productId: i.variant.productId,
    categoryIds: i.variant.product.categories.map((c) => c.categoryId),
    unitPrice: i.variant.price,
    quantity: i.quantity,
  }));
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coupons: CouponsService,
    private readonly settings: SettingsService,
  ) {}

  async items(userId: string, db: Prisma.TransactionClient = this.prisma): Promise<CartItemRow[]> {
    return db.cartItem.findMany({
      where: { cart: { userId } },
      include: cartItemInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async view(userId: string) {
    return this.quote(userId, {});
  }

  /** Full price breakdown for the cart. Coupon problems are reported, not thrown. */
  async quote(userId: string, dto: QuoteDto) {
    const items = await this.items(userId);
    const settings = await this.settings.get();
    const available = items.filter((i) => !cartItemIssue(i));
    const lines = toPricedLines(available);
    const subtotal = subtotalOf(lines);
    const mrpTotal = available.reduce((s, i) => s + i.variant.mrp * i.quantity, 0);

    let discount = 0;
    let couponError: string | undefined;
    let appliedCoupon: string | undefined;
    if (dto.couponCode && lines.length) {
      try {
        const result = await this.coupons.evaluate(dto.couponCode, userId, lines);
        discount = result.discount;
        appliedCoupon = result.coupon.code;
      } catch (err) {
        couponError = err instanceof HttpException ? err.message : 'Invalid coupon';
      }
    }
    const deliveryMethod: DeliveryMethod = dto.deliveryMethod ?? 'STANDARD';
    const shipping = shippingFee(subtotal - discount, deliveryMethod, settings);
    const codFee = dto.paymentMethod === 'COD' ? settings.codFee : 0;
    const total = subtotal - discount + shipping + codFee;

    return {
      items: items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        issue: cartItemIssue(i),
        lineTotal: i.variant.price * i.quantity,
        product: { id: i.variant.product.id, name: i.variant.product.name, slug: i.variant.product.slug },
        soldBy: i.variant.product.seller?.storeName ?? null,
        variant: {
          id: i.variant.id,
          sku: i.variant.sku,
          color: i.variant.color,
          size: i.variant.size,
          label: variantLabel(i.variant),
          price: i.variant.price,
          mrp: i.variant.mrp,
          maxQuantity: Math.min(MAX_QTY_PER_ITEM, Math.max(i.variant.stock, 0)),
        },
        image: variantImage(i),
      })),
      summary: {
        itemCount: available.reduce((s, i) => s + i.quantity, 0),
        mrpTotal,
        subtotal,
        productDiscount: mrpTotal - subtotal,
        couponDiscount: discount,
        shippingFee: shipping,
        codFee,
        total,
        freeShippingThreshold: settings.freeShippingThreshold,
        codAvailable: settings.codEnabled && total <= settings.codMaxOrderValue,
        onlinePaymentsAvailable: config.onlinePaymentsEnabled,
        // Items from different sellers are delivered as separate orders / packages
        packageCount: new Set(available.map((i) => i.variant.product.sellerId ?? 'store')).size,
      },
      coupon: appliedCoupon ? { code: appliedCoupon } : undefined,
      couponError,
      hasIssues: items.some((i) => cartItemIssue(i)),
    };
  }

  async add(userId: string, variantId: string, quantity: number) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { status: true, seller: { select: { status: true } } } } },
    });
    if (!variant || !variant.isActive || !isLiveProduct(variant.product)) {
      throw new NotFoundException('Product is not available');
    }
    const cart = await this.prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const next = Math.min(MAX_QTY_PER_ITEM, (existing?.quantity ?? 0) + quantity);
    if (variant.stock < next) {
      throw new BadRequestException(variant.stock > 0 ? `Only ${variant.stock} left in stock` : 'Out of stock');
    }
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, quantity: next },
      update: { quantity: next },
    });
    return this.view(userId);
  }

  async update(userId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
      include: { variant: true },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (item.variant.stock < quantity) {
      throw new BadRequestException(item.variant.stock > 0 ? `Only ${item.variant.stock} left in stock` : 'Out of stock');
    }
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.view(userId);
  }

  async remove(userId: string, itemId: string) {
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
    return this.view(userId);
  }

  /** Merges a guest cart (kept in the browser) into the account cart after login. */
  async merge(userId: string, items: { variantId: string; quantity: number }[]) {
    for (const item of items) {
      try {
        await this.add(userId, item.variantId, item.quantity);
      } catch {
        // Skip items that are no longer available
      }
    }
    return this.view(userId);
  }

  async clear(userId: string, db: Prisma.TransactionClient = this.prisma) {
    await db.cartItem.deleteMany({ where: { cart: { userId } } });
  }
}
