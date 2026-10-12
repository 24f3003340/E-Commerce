import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason, ProductStatus } from '@prisma/client';
import { CacheService } from '../common/cache.service';
import { SettingsService } from '../common/settings.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ProductDto } from './catalog.dto';
import { CategoriesService } from './categories.service';
import { InventoryService } from './inventory.service';
import { builtInCharges, customerPrice, sellerPrice } from './pricing';
import { ProductsService } from './products.service';
import { BulkRow, buildQuickProduct, parseBulkRow, QuickProductInput, randomCode, skuPrefix } from './quick-product';

export interface RowResult {
  row: number;
  ok: boolean;
  message: string;
}

export interface VariantUpdateRow {
  sku?: string;
  /** Rupees, as typed in the sheet or grid */
  price?: string | number;
  mrp?: string | number;
  stock?: string | number;
}

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/**
 * Shortcuts that save marketplace sellers time: one-screen product creation, CSV bulk upload,
 * bulk price/stock updates and product duplication. They all go through the normal product code so
 * pricing, review rules and stock history behave exactly like the full editor.
 */
@Injectable()
export class ProductToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly categories: CategoriesService,
    private readonly inventory: InventoryService,
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
  ) {}

  private async sellerContext(sellerId: string) {
    const seller = await this.prisma.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { storeName: true, slug: true } });
    return { storeName: seller.storeName, prefix: skuPrefix(seller.storeName) };
  }

  /** Creates a product from the few things a seller types on the Quick Add screen. */
  async quickCreate(sellerId: string, input: QuickProductInput) {
    const category = (await this.categories.all()).find((c) => c.id === input.categoryId && c.isActive);
    if (!category) throw new BadRequestException('Please choose a category');
    const ctx = await this.sellerContext(sellerId);
    const dto = buildQuickProduct(input, { ...ctx, categoryName: category.name });
    return this.products.create(dto, `seller:${sellerId}`, { sellerId });
  }

  /** Creates many products from CSV rows. Each row succeeds or fails on its own. */
  async bulkCreate(sellerId: string, rows: BulkRow[]): Promise<RowResult[]> {
    const categories = await this.categories.all();
    const ctx = await this.sellerContext(sellerId);
    const results: RowResult[] = [];
    for (const [i, row] of rows.entries()) {
      const parsed = parseBulkRow(row, categories.filter((c) => c.isActive));
      if ('error' in parsed) {
        results.push({ row: i + 1, ok: false, message: parsed.error });
        continue;
      }
      try {
        const product = await this.products.create(buildQuickProduct(parsed.input, { ...ctx, categoryName: parsed.categoryName }), `seller:${sellerId}`, { sellerId });
        const note = parsed.input.images.length ? '' : ' (saved as draft — add photos, then publish)';
        results.push({ row: i + 1, ok: true, message: `${product.name} added${note}` });
      } catch (err) {
        results.push({ row: i + 1, ok: false, message: err instanceof Error ? err.message : 'Failed' });
      }
    }
    return results;
  }

  /**
   * Updates price / MRP / stock by SKU. Blank cells are left unchanged; stock is the new total.
   * Like in the inventory screen, these changes go live without a new review.
   */
  async bulkUpdate(sellerId: string, rows: VariantUpdateRow[]): Promise<RowResult[]> {
    const charges = builtInCharges(await this.settings.get());
    const results: RowResult[] = [];
    const touched = new Set<string>();
    for (const [i, row] of rows.entries()) {
      const fail = (message: string) => results.push({ row: i + 1, ok: false, message });
      const sku = String(row.sku ?? '').trim().toUpperCase();
      if (!sku) { fail('SKU is missing'); continue; }
      const variant = await this.prisma.productVariant.findFirst({ where: { sku, product: { sellerId } } });
      if (!variant) { fail(`SKU ${sku} not found in your products`); continue; }

      const base = blank(row.price) ? sellerPrice(variant) : Math.round(Number(row.price) * 100);
      const requestedMrp = blank(row.mrp) ? undefined : Math.round(Number(row.mrp) * 100);
      const stock = blank(row.stock) ? undefined : Number(row.stock);
      if (!Number.isFinite(base) || base < 100) { fail('Price must be at least ₹1'); continue; }
      if (requestedMrp !== undefined && (!Number.isFinite(requestedMrp) || requestedMrp < 100)) { fail('MRP must be at least ₹1'); continue; }
      if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) { fail('Stock must be a whole number'); continue; }
      const sellerMrp = requestedMrp ?? variant.mrp;
      if (base > sellerMrp) { fail('Price cannot be more than MRP'); continue; }

      try {
        const price = customerPrice(base, charges);
        if (!blank(row.price) || requestedMrp !== undefined) {
          await this.prisma.productVariant.update({ where: { id: variant.id }, data: { price, basePrice: base, mrp: Math.max(sellerMrp, price) } });
          touched.add(variant.productId);
        }
        if (stock !== undefined && stock !== variant.stock) {
          const change = stock - variant.stock;
          await this.inventory.adjust(variant.id, change, change > 0 ? InventoryReason.RESTOCK : InventoryReason.ADJUSTMENT, 'Bulk update', `seller:${sellerId}`);
        }
        results.push({ row: i + 1, ok: true, message: `${sku} updated` });
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Failed');
      }
    }
    if (touched.size) {
      await this.prisma.$transaction(async (tx) => {
        for (const productId of touched) await this.products.refreshAggregates(tx, productId);
      });
      await this.cache.delByPrefix('catalog:');
    }
    return results;
  }

  /** Copies a product as a draft so a similar one (another colour, another design) is quick to add. */
  async duplicate(sellerId: string, productId: string) {
    const source = await this.products.adminGet(productId);
    if (source.sellerId !== sellerId) throw new NotFoundException('Product not found');
    const code = randomCode();
    const dto = {
      name: `${source.name} (Copy)`.slice(0, 160),
      description: source.description,
      brand: source.brand ?? undefined,
      material: source.material ?? undefined,
      specifications: (source.specifications ?? undefined) as Record<string, string> | undefined,
      sizeChart: (source.sizeChart ?? undefined) as Record<string, string>[] | undefined,
      videoUrl: source.videoUrl ?? undefined,
      hsnCode: source.hsnCode ?? undefined,
      tags: source.tags,
      status: ProductStatus.DRAFT,
      categoryIds: source.categories.map((c) => c.categoryId),
      images: source.images.map((i) => ({ url: i.url, alt: i.alt ?? undefined, color: i.color ?? undefined })),
      variants: source.variants
        .filter((v) => v.isActive)
        .map((v) => ({
          sku: `${v.sku}-${code}`.slice(0, 64),
          color: v.color ?? undefined,
          colorHex: v.colorHex ?? undefined,
          size: v.size ?? undefined,
          price: sellerPrice(v),
          mrp: v.mrp,
          stock: 0,
          isActive: true,
        })),
    } as ProductDto;
    return this.products.create(dto, `seller:${sellerId}`, { sellerId });
  }

  /** Every variant of the seller's catalogue as CSV rows (sku, product, variant, price, mrp, stock). */
  async exportVariants(sellerId: string) {
    const variants = await this.prisma.productVariant.findMany({
      where: { product: { sellerId }, isActive: true },
      orderBy: [{ product: { name: 'asc' } }, { color: 'asc' }, { size: 'asc' }],
      include: { product: { select: { name: true } } },
    });
    return variants.map((v) => ({
      sku: v.sku,
      product: v.product.name,
      variant: [v.color, v.size].filter(Boolean).join(' / '),
      price: sellerPrice(v) / 100,
      mrp: v.mrp / 100,
      stock: v.stock,
    }));
  }
}
