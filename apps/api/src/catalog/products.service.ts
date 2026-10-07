import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, Prisma, ProductStatus } from '@prisma/client';
import { CacheService } from '../common/cache.service';
import { SettingsService } from '../common/settings.service';
import { csv, paginate, paginated, slugify } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { AdminProductQueryDto, ProductDto, ProductQueryDto } from './catalog.dto';
import { CategoriesService } from './categories.service';
import { LIVE_PRODUCT, liveProduct } from './visibility';

const listingSelect = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  minPrice: true,
  maxMrp: true,
  discountPct: true,
  ratingAvg: true,
  ratingCount: true,
  isFeatured: true,
  createdAt: true,
  images: { orderBy: { sortOrder: 'asc' }, take: 2, select: { url: true, alt: true } },
  variants: {
    where: { isActive: true },
    select: { color: true, colorHex: true, size: true, stock: true },
  },
} satisfies Prisma.ProductSelect;

type ListingRow = Prisma.ProductGetPayload<{ select: typeof listingSelect }>;

export interface SellerOwner {
  sellerId: string;
}

export function toListingItem(p: ListingRow) {
  const colors = new Map<string, string | null>();
  const sizes = new Set<string>();
  for (const v of p.variants) {
    if (v.color && !colors.has(v.color)) colors.set(v.color, v.colorHex);
    if (v.size) sizes.add(v.size);
  }
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    price: p.minPrice,
    mrp: p.maxMrp,
    discountPct: p.discountPct,
    ratingAvg: Math.round(p.ratingAvg * 10) / 10,
    ratingCount: p.ratingCount,
    isFeatured: p.isFeatured,
    images: p.images,
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
    sizes: [...sizes],
    inStock: p.variants.some((v) => v.stock > 0),
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly cache: CacheService,
    private readonly settings: SettingsService,
  ) {}

  // ───────────── Storefront ─────────────

  async list(query: ProductQueryDto) {
    const cacheKey = `catalog:list:${JSON.stringify(query)}`;
    return this.cache.wrap(cacheKey, 60, () => this.listUncached(query));
  }

  private async buildWhere(query: ProductQueryDto, opts: { skipVariantFilters?: boolean } = {}) {
    const and: Prisma.ProductWhereInput[] = [LIVE_PRODUCT];

    if (query.category) {
      const category = (await this.categories.all()).find((c) => c.slug === query.category);
      if (!category) throw new NotFoundException('Category not found');
      const ids = await this.categories.descendantIds(category.id);
      and.push({ categories: { some: { categoryId: { in: ids } } } });
    }

    const q = query.q?.trim();
    if (q) {
      // Version 1 search: PostgreSQL ILIKE over name / brand / category / SKU / tags.
      // Swap for OpenSearch / Elasticsearch once the catalog grows.
      const words = q.split(/\s+/).filter(Boolean).slice(0, 5);
      for (const word of words) {
        and.push({
          OR: [
            { name: { contains: word, mode: 'insensitive' } },
            { brand: { contains: word, mode: 'insensitive' } },
            { tags: { has: word.toLowerCase() } },
            { variants: { some: { sku: { equals: word, mode: 'insensitive' } } } },
            { categories: { some: { category: { name: { contains: word, mode: 'insensitive' } } } } },
          ],
        });
      }
    }

    const brands = csv(query.brand);
    if (brands.length) and.push({ brand: { in: brands, mode: 'insensitive' } });
    if (query.minPrice !== undefined) and.push({ minPrice: { gte: query.minPrice } });
    if (query.maxPrice !== undefined) and.push({ minPrice: { lte: query.maxPrice } });
    if (query.rating) and.push({ ratingAvg: { gte: query.rating } });
    if (query.discount) and.push({ discountPct: { gte: query.discount } });
    if (query.featured) and.push({ isFeatured: true });

    if (!opts.skipVariantFilters) {
      const sizes = csv(query.size);
      const colors = csv(query.color);
      if (sizes.length || colors.length || query.inStock) {
        and.push({
          variants: {
            some: {
              isActive: true,
              ...(sizes.length ? { size: { in: sizes } } : {}),
              ...(colors.length ? { color: { in: colors, mode: 'insensitive' } } : {}),
              ...(query.inStock ? { stock: { gt: 0 } } : {}),
            },
          },
        });
      }
    }
    return { AND: and } satisfies Prisma.ProductWhereInput;
  }

  private async listUncached(query: ProductQueryDto) {
    const where = await this.buildWhere(query);
    const { page, limit, skip, take } = paginate(query.page, query.limit ?? 24, 60);
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
      switch (query.sort) {
        case 'price_asc':
          return [{ minPrice: 'asc' }];
        case 'price_desc':
          return [{ minPrice: 'desc' }];
        case 'popular':
          return [{ soldCount: 'desc' }, { ratingCount: 'desc' }];
        case 'rating':
          return [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }];
        case 'discount':
          return [{ discountPct: 'desc' }];
        default:
          return [{ createdAt: 'desc' }];
      }
    })();
    orderBy.push({ id: 'asc' });

    const [rows, total, facets] = await Promise.all([
      this.prisma.product.findMany({ where, orderBy, skip, take, select: listingSelect }),
      this.prisma.product.count({ where }),
      this.facets(query),
    ]);
    return { ...paginated(rows.map(toListingItem), total, page, limit), facets };
  }

  /** Values available for filtering within the current category/search. */
  private async facets(query: ProductQueryDto) {
    const base = await this.buildWhere(
      { category: query.category, q: query.q },
      { skipVariantFilters: true },
    );
    const [brands, variants, price] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...base, brand: { not: null } },
        distinct: ['brand'],
        select: { brand: true },
        orderBy: { brand: 'asc' },
        take: 50,
      }),
      this.prisma.productVariant.findMany({
        where: { isActive: true, product: base },
        distinct: ['size', 'color'],
        select: { size: true, color: true, colorHex: true },
        take: 500,
      }),
      this.prisma.product.aggregate({ where: base, _min: { minPrice: true }, _max: { minPrice: true } }),
    ]);
    const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
    const sizes = [...new Set(variants.map((v) => v.size).filter((s): s is string => !!s))].sort((a, b) => {
      const ia = sizeOrder.indexOf(a);
      const ib = sizeOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    const colors = new Map<string, string | null>();
    for (const v of variants) if (v.color && !colors.has(v.color)) colors.set(v.color, v.colorHex);
    return {
      brands: brands.map((b) => b.brand as string),
      sizes,
      colors: [...colors].map(([name, hex]) => ({ name, hex })),
      price: { min: price._min.minPrice ?? 0, max: price._max.minPrice ?? 0 },
    };
  }

  sitemap() {
    return this.cache.wrap('catalog:sitemap', 600, () =>
      this.prisma.product.findMany({
        where: LIVE_PRODUCT,
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50000,
      }),
    );
  }

  async suggestions(q: string) {
    const term = q.trim();
    if (term.length < 2) return { products: [], categories: [] };
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: liveProduct({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { brand: { contains: term, mode: 'insensitive' } },
          ],
        }),
        select: { name: true, slug: true, images: { take: 1, select: { url: true } } },
        orderBy: { soldCount: 'desc' },
        take: 6,
      }),
      this.prisma.category.findMany({
        where: { isActive: true, name: { contains: term, mode: 'insensitive' } },
        select: { name: true, slug: true },
        take: 4,
      }),
    ]);
    return { products, categories };
  }

  async detail(slug: string) {
    return this.cache.wrap(`catalog:product:${slug}`, 60, async () => {
      const product = await this.prisma.product.findFirst({
        where: liveProduct({ slug }),
        include: {
          seller: { select: { storeName: true, slug: true } },
          images: { orderBy: { sortOrder: 'asc' } },
          variants: { where: { isActive: true }, orderBy: [{ color: 'asc' }, { createdAt: 'asc' }] },
          categories: { include: { category: true } },
        },
      });
      if (!product) throw new NotFoundException('Product not found');

      const primary = product.categories.find((c) => c.isPrimary) ?? product.categories[0];
      const [breadcrumbs, related, reviews, ratingBreakdown, policy] = await Promise.all([
        primary ? this.categories.breadcrumbs(primary.categoryId) : [],
        primary
          ? this.prisma.product.findMany({
              where: liveProduct({
                id: { not: product.id },
                categories: { some: { categoryId: primary.categoryId } },
              }),
              orderBy: { soldCount: 'desc' },
              take: 8,
              select: listingSelect,
            })
          : [],
        this.prisma.review.findMany({
          where: { productId: product.id, isApproved: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { name: true } } },
        }),
        this.prisma.review.groupBy({
          by: ['rating'],
          where: { productId: product.id, isApproved: true },
          _count: { _all: true },
        }),
        primary ? this.categories.returnPolicy(primary.categoryId) : Promise.resolve({} as { isReturnable?: boolean; returnWindowDays?: number }),
      ]);
      const settings = await this.settings.get();

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        brand: product.brand,
        material: product.material,
        specifications: product.specifications,
        sizeChart: product.sizeChart,
        videoUrl: product.videoUrl,
        tags: product.tags,
        // Marketplace seller; null when sold by the store itself
        seller: product.seller,
        price: product.minPrice,
        mrp: product.maxMrp,
        discountPct: product.discountPct,
        ratingAvg: Math.round(product.ratingAvg * 10) / 10,
        ratingCount: product.ratingCount,
        images: product.images.map(({ url, alt, color }) => ({ url, alt, color })),
        variants: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          color: v.color,
          colorHex: v.colorHex,
          size: v.size,
          price: v.price,
          mrp: v.mrp,
          stock: Math.min(v.stock, 10), // never expose exact stock levels
          inStock: v.stock > 0,
        })),
        breadcrumbs,
        returnPolicy: {
          isReturnable: policy.isReturnable ?? true,
          returnWindowDays: policy.returnWindowDays ?? settings.defaultReturnWindowDays,
        },
        reviews: reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          verifiedPurchase: r.verifiedPurchase,
          createdAt: r.createdAt,
          author: r.user.name,
        })),
        ratingBreakdown: Object.fromEntries(ratingBreakdown.map((r) => [r.rating, r._count._all])),
        related: related.map(toListingItem),
      };
    });
  }

  /** Delivery estimate + COD availability for a pincode. */
  async serviceability(pincode: string) {
    const s = await this.settings.get();
    const valid = /^[1-9]\d{5}$/.test(pincode);
    const blocked = s.blockedPincodePrefixes.some((p) => pincode.startsWith(p));
    if (!valid || blocked) return { pincode, serviceable: false, codAvailable: false };
    const metro = s.metroPincodePrefixes.some((p) => pincode.startsWith(p));
    const minDays = metro ? 2 : 4;
    const maxDays = metro ? 4 : 7;
    const add = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    return {
      pincode,
      serviceable: true,
      codAvailable: s.codEnabled,
      estimatedDelivery: { from: add(minDays), to: add(maxDays), minDays, maxDays },
    };
  }

  // ───────────── Admin ─────────────

  async adminList(query: AdminProductQueryDto) {
    const { page, limit, skip, take } = paginate(query.page, query.limit);
    const where: Prisma.ProductWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId === 'store' ? null : query.sellerId } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { brand: { contains: query.q, mode: 'insensitive' } },
              { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          seller: { select: { id: true, storeName: true } },
          images: { take: 1, orderBy: { sortOrder: 'asc' } },
          variants: { select: { id: true, stock: true, reserved: true, isActive: true } },
          categories: { include: { category: { select: { name: true } } } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginated(
      items.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        status: p.status,
        reviewNote: p.reviewNote,
        seller: p.seller,
        isFeatured: p.isFeatured,
        price: p.minPrice,
        mrp: p.maxMrp,
        image: p.images[0]?.url ?? null,
        variantCount: p.variants.length,
        totalStock: p.variants.reduce((sum, v) => sum + v.stock, 0),
        categories: p.categories.map((c) => c.category.name),
        updatedAt: p.updatedAt,
      })),
      total,
      page,
      limit,
    );
  }

  async adminGet(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, storeName: true, status: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: [{ color: 'asc' }, { createdAt: 'asc' }] },
        categories: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  /**
   * @param actorId admin id, or `seller:<id>` for marketplace sellers (stored on stock movements)
   * @param owner   set for marketplace sellers: the product belongs to them and its status is
   *                decided by the marketplace's approval rules
   */
  async create(dto: ProductDto, actorId: string, owner?: SellerOwner) {
    this.validateVariants(dto);
    await this.assertSkusFree(dto);
    const slug = await this.uniqueSlug(dto.slug || dto.name);
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...this.productFields(dto),
          ...(owner ? { sellerId: owner.sellerId, isFeatured: false, status: await this.sellerStatus(dto.status), reviewNote: null } : {}),
          slug,
          categories: {
            create: dto.categoryIds.map((categoryId, i) => ({ categoryId, isPrimary: i === 0 })),
          },
          images: { create: dto.images.map((img, i) => ({ ...img, sortOrder: i })) },
        },
      });
      for (const v of dto.variants) {
        const variant = await tx.productVariant.create({
          data: { ...this.variantFields(v), stock: v.stock ?? 0, productId: created.id },
        });
        if (v.stock) {
          await tx.inventoryMovement.create({
            data: { variantId: variant.id, change: v.stock, reason: InventoryReason.RESTOCK, note: 'Initial stock', adminId: actorId },
          });
        }
      }
      await this.refreshAggregates(tx, created.id);
      return created;
    });
    await this.categories.invalidate();
    return this.adminGet(product.id);
  }

  async update(id: string, dto: ProductDto, actorId: string, owner?: SellerOwner) {
    this.validateVariants(dto);
    const existing = await this.adminGet(id);
    if (owner && existing.sellerId !== owner.sellerId) throw new NotFoundException('Product not found');
    await this.assertSkusFree(dto, id);
    const slug = dto.slug && slugify(dto.slug) !== existing.slug ? await this.uniqueSlug(dto.slug) : existing.slug;
    const sellerFields = owner
      ? {
          isFeatured: existing.isFeatured,
          ...(await this.sellerUpdateStatus(existing, dto)),
        }
      : {};

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { ...this.productFields(dto), ...sellerFields, slug } });

      await tx.productCategory.deleteMany({ where: { productId: id } });
      await tx.productCategory.createMany({
        data: dto.categoryIds.map((categoryId, i) => ({ productId: id, categoryId, isPrimary: i === 0 })),
      });

      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: dto.images.map((img, i) => ({ ...img, productId: id, sortOrder: i })),
      });

      const keepIds = new Set<string>();
      for (const v of dto.variants) {
        const match = existing.variants.find((ev) => (v.id && ev.id === v.id) || ev.sku === v.sku);
        if (match) {
          // Stock is managed via the inventory endpoints so it is never overwritten here.
          await tx.productVariant.update({ where: { id: match.id }, data: this.variantFields(v) });
          keepIds.add(match.id);
        } else {
          const created = await tx.productVariant.create({
            data: { ...this.variantFields(v), stock: v.stock ?? 0, productId: id },
          });
          keepIds.add(created.id);
          if (v.stock) {
            await tx.inventoryMovement.create({
              data: { variantId: created.id, change: v.stock, reason: InventoryReason.RESTOCK, note: 'Initial stock', adminId: actorId },
            });
          }
        }
      }
      // Variants removed from the form: delete if never ordered, otherwise deactivate.
      for (const ev of existing.variants) {
        if (keepIds.has(ev.id)) continue;
        const ordered = await tx.orderItem.count({ where: { variantId: ev.id } });
        if (ordered) await tx.productVariant.update({ where: { id: ev.id }, data: { isActive: false } });
        else await tx.productVariant.delete({ where: { id: ev.id } });
      }
      await this.refreshAggregates(tx, id);
    });
    await this.categories.invalidate();
    return this.adminGet(id);
  }

  async setStatus(id: string, status: ProductStatus, reviewNote?: string) {
    await this.prisma.product.update({
      where: { id },
      data: { status, ...(status === ProductStatus.REJECTED ? { reviewNote: reviewNote ?? null } : status === ProductStatus.ACTIVE ? { reviewNote: null } : {}) },
    });
    await this.categories.invalidate();
    return { ok: true };
  }

  /** Hard delete only for products that were never ordered; otherwise archive. */
  async remove(id: string) {
    const ordered = await this.prisma.orderItem.count({ where: { productId: id } });
    if (ordered) {
      await this.prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
      await this.categories.invalidate();
      return { ok: true, archived: true };
    }
    await this.prisma.product.delete({ where: { id } });
    await this.categories.invalidate();
    return { ok: true, archived: false };
  }

  /** Recomputes the denormalised price/discount columns used for listing & sorting. */
  async refreshAggregates(tx: Prisma.TransactionClient, productId: string) {
    const variants = await tx.productVariant.findMany({
      where: { productId, isActive: true },
      select: { price: true, mrp: true },
    });
    if (!variants.length) {
      await tx.product.update({ where: { id: productId }, data: { minPrice: 0, maxMrp: 0, discountPct: 0 } });
      return;
    }
    const cheapest = variants.reduce((a, b) => (b.price < a.price ? b : a));
    const discountPct = cheapest.mrp > cheapest.price ? Math.round(((cheapest.mrp - cheapest.price) / cheapest.mrp) * 100) : 0;
    await tx.product.update({
      where: { id: productId },
      data: { minPrice: cheapest.price, maxMrp: cheapest.mrp, discountPct },
    });
  }

  /** SKUs are unique across the whole marketplace, so check other products before saving. */
  private async assertSkusFree(dto: ProductDto, productId?: string) {
    const taken = await this.prisma.productVariant.findFirst({
      where: { sku: { in: dto.variants.map((v) => v.sku.toUpperCase()) }, ...(productId ? { productId: { not: productId } } : {}) },
      select: { sku: true },
    });
    if (taken) throw new BadRequestException(`SKU ${taken.sku} is already used by another product. Please choose a different SKU.`);
  }

  /** Status a seller's product gets: "publish" means "submit for review" when approval is on. */
  private async sellerStatus(requested: ProductStatus | undefined): Promise<ProductStatus> {
    if (requested === ProductStatus.ARCHIVED) return ProductStatus.ARCHIVED;
    if (requested !== ProductStatus.ACTIVE && requested !== ProductStatus.PENDING_APPROVAL) return ProductStatus.DRAFT;
    const { sellerProductApproval } = await this.settings.get();
    return sellerProductApproval ? ProductStatus.PENDING_APPROVAL : ProductStatus.ACTIVE;
  }

  /**
   * A live product stays live when the seller only changes prices, stock or variants. Changing what
   * shoppers read or see (name, description, photos, category…) sends it back for review.
   */
  private async sellerUpdateStatus(existing: Awaited<ReturnType<ProductsService['adminGet']>>, dto: ProductDto) {
    const status = await this.sellerStatus(dto.status);
    if (status !== ProductStatus.PENDING_APPROVAL || existing.status !== ProductStatus.ACTIVE) {
      return { status, ...(status === ProductStatus.PENDING_APPROVAL ? { reviewNote: null } : {}) };
    }
    const before = this.productFields({
      ...dto,
      name: existing.name,
      description: existing.description,
      brand: existing.brand ?? undefined,
      material: existing.material ?? undefined,
      specifications: (existing.specifications ?? undefined) as Record<string, string> | undefined,
      sizeChart: (existing.sizeChart ?? undefined) as Record<string, string>[] | undefined,
      videoUrl: existing.videoUrl ?? undefined,
    });
    const after = this.productFields(dto);
    const sameText = (['name', 'description', 'brand', 'material', 'videoUrl'] as const).every((k) => before[k] === after[k]) &&
      JSON.stringify(before.specifications) === JSON.stringify(after.specifications) &&
      JSON.stringify(before.sizeChart) === JSON.stringify(after.sizeChart);
    const sameImages = JSON.stringify(existing.images.map((i) => i.url)) === JSON.stringify(dto.images.map((i) => i.url));
    const sameCategories =
      JSON.stringify(existing.categories.map((c) => c.categoryId).sort()) === JSON.stringify([...dto.categoryIds].sort());
    return sameText && sameImages && sameCategories ? { status: ProductStatus.ACTIVE } : { status, reviewNote: null };
  }

  private validateVariants(dto: ProductDto) {
    const skus = new Set<string>();
    const combos = new Set<string>();
    for (const v of dto.variants) {
      if (v.price > v.mrp) throw new BadRequestException(`Price cannot exceed MRP for SKU ${v.sku}`);
      const sku = v.sku.toUpperCase();
      if (skus.has(sku)) throw new BadRequestException(`Duplicate SKU ${v.sku}`);
      skus.add(sku);
      const combo = `${v.color ?? ''}|${v.size ?? ''}`.toLowerCase();
      if (combos.has(combo)) throw new BadRequestException(`Duplicate variant ${v.color ?? ''} / ${v.size ?? ''}`);
      combos.add(combo);
    }
  }

  private productFields(dto: ProductDto) {
    return {
      name: dto.name.trim(),
      description: dto.description,
      brand: dto.brand?.trim() || null,
      material: dto.material || null,
      specifications: (dto.specifications ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      sizeChart: (dto.sizeChart ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      videoUrl: dto.videoUrl || null,
      hsnCode: dto.hsnCode || null,
      tags: (dto.tags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean),
      status: dto.status ?? ProductStatus.DRAFT,
      isFeatured: dto.isFeatured ?? false,
    };
  }

  private variantFields(v: ProductDto['variants'][number]) {
    return {
      sku: v.sku.toUpperCase(),
      barcode: v.barcode || null,
      color: v.color?.trim() || null,
      colorHex: v.colorHex || null,
      size: v.size?.trim() || null,
      price: v.price,
      mrp: v.mrp,
      isActive: v.isActive ?? true,
    };
  }

  private async uniqueSlug(source: string) {
    const base = slugify(source) || 'product';
    let slug = base;
    for (let i = 2; await this.prisma.product.findUnique({ where: { slug }, select: { id: true } }); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }
}
