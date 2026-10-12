import { ProductStatus } from '@prisma/client';
import type { ProductDto } from './catalog.dto';

/**
 * Helpers that let a seller add a product by filling in just a few things (photo, name, category,
 * price, sizes, colours, stock). Everything else — SKUs, slug, description, tags — is generated.
 */

/** What the seller actually types. Amounts are in paise. */
export interface QuickProductInput {
  name: string;
  categoryId: string;
  price: number;
  mrp?: number;
  colors: string[];
  sizes: string[];
  stock: number;
  images: string[];
  description?: string;
  brand?: string;
  material?: string;
  publish: boolean;
}

const COLOR_HEX: Record<string, string> = {
  black: '#111111', white: '#ffffff', red: '#c62828', blue: '#1e40af', navy: '#1f2a5a', 'light blue': '#93c5fd',
  green: '#2e7d32', olive: '#6b7a2a', yellow: '#facc15', mustard: '#d4a017', pink: '#f472b6', maroon: '#7f1d1d',
  grey: '#6b7280', gray: '#6b7280', brown: '#78350f', beige: '#d6c7a1', orange: '#ea580c', purple: '#7e22ce',
  cream: '#f5f0e1', gold: '#c9a227', silver: '#c0c0c0', khaki: '#b5a46a', peach: '#fdba9a', teal: '#0f766e',
};

const alnum = (s: string) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** Splits "Black, White | Navy" style lists into clean unique items. */
export function splitList(value: string | string[] | undefined): string[] {
  const parts = Array.isArray(value) ? value : String(value ?? '').split(/[|;,\n]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const item = raw.trim();
    if (item && !seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase());
      out.push(item);
    }
  }
  return out;
}

export const randomCode = (len = 4) => Math.random().toString(36).slice(2, 2 + len).toUpperCase().padEnd(len, 'X');

/** Three letters from the store name, used to start every generated SKU. */
export const skuPrefix = (storeName: string) => (alnum(storeName).slice(0, 3) || 'PRD').padEnd(3, 'X');

function autoDescription(input: QuickProductInput, categoryName: string, storeName: string) {
  const bits = [`${input.name}${input.brand ? ` by ${input.brand}` : ''}.`];
  if (input.material) bits.push(`Made from ${input.material}.`);
  if (input.sizes.length) bits.push(`Available in ${input.sizes.join(', ')}.`);
  if (input.colors.length) bits.push(`Colours: ${input.colors.join(', ')}.`);
  bits.push(`${categoryName ? `${categoryName} ` : ''}quality product sold by ${storeName}.`);
  return bits.join(' ');
}

function autoTags(input: QuickProductInput, categoryName: string) {
  const words = `${input.name} ${categoryName} ${input.brand ?? ''}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  return [...new Set(words)].slice(0, 10);
}

/** Expands the seller's few inputs into the full product payload used by the normal editor. */
export function buildQuickProduct(
  input: QuickProductInput,
  ctx: { prefix: string; categoryName: string; storeName: string; code?: string },
): ProductDto {
  const code = ctx.code ?? randomCode();
  const colors = input.colors.length ? input.colors : [''];
  const sizes = input.sizes.length ? input.sizes : [''];
  const mrp = Math.max(input.mrp ?? input.price, input.price);
  const variants: ProductDto['variants'] = [];
  for (const color of colors) {
    for (const size of sizes) {
      const parts = [ctx.prefix, code, alnum(color).slice(0, 3), alnum(size)].filter(Boolean);
      variants.push({
        sku: parts.join('-'),
        color: color || undefined,
        colorHex: color ? COLOR_HEX[color.toLowerCase()] : undefined,
        size: size || undefined,
        price: input.price,
        mrp,
        stock: input.stock,
        isActive: true,
      } as ProductDto['variants'][number]);
    }
  }
  return {
    name: input.name.trim(),
    description: input.description?.trim() || autoDescription(input, ctx.categoryName, ctx.storeName),
    brand: input.brand?.trim() || undefined,
    material: input.material?.trim() || undefined,
    tags: autoTags(input, ctx.categoryName),
    status: input.publish && input.images.length ? ProductStatus.ACTIVE : ProductStatus.DRAFT,
    categoryIds: [input.categoryId],
    images: input.images.map((url) => ({ url, alt: input.name })),
    variants,
  } as ProductDto;
}

// ───────────── Bulk upload (CSV rows) ─────────────

/** One CSV row exactly as typed in the sheet (all strings, price in rupees). */
export interface BulkRow {
  name?: string;
  category?: string;
  price?: string;
  mrp?: string;
  colors?: string;
  sizes?: string;
  stock?: string;
  images?: string;
  description?: string;
  brand?: string;
  material?: string;
}

export const BULK_COLUMNS = ['name', 'category', 'price', 'mrp', 'colors', 'sizes', 'stock', 'images', 'description', 'brand', 'material'] as const;

const rupeesToPaise = (v: string | undefined) => {
  const n = Number(String(v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : NaN;
};

/** Validates one row and resolves its category (by name or slug). Returns an error message or the input. */
export function parseBulkRow(
  row: BulkRow,
  categories: { id: string; name: string; slug: string }[],
): { error: string } | { input: QuickProductInput; categoryName: string } {
  const name = (row.name ?? '').trim();
  if (name.length < 2) return { error: 'Product name is missing' };
  const wanted = (row.category ?? '').trim().toLowerCase();
  const category = categories.find((c) => c.slug.toLowerCase() === wanted || c.name.toLowerCase() === wanted);
  if (!category) return { error: wanted ? `Category "${row.category}" not found` : 'Category is missing' };
  const price = rupeesToPaise(row.price);
  if (Number.isNaN(price)) return { error: 'Price must be a number above 0' };
  const mrpRaw = (row.mrp ?? '').trim();
  const mrp = mrpRaw ? rupeesToPaise(mrpRaw) : price;
  if (Number.isNaN(mrp)) return { error: 'MRP must be a number above 0' };
  if (price > mrp) return { error: 'Price cannot be more than MRP' };
  const stockRaw = (row.stock ?? '').trim();
  const stock = stockRaw ? Number(stockRaw) : 0;
  if (!Number.isInteger(stock) || stock < 0) return { error: 'Stock must be a whole number' };
  const images = splitList(row.images).filter((u) => /^https?:\/\//i.test(u));
  return {
    categoryName: category.name,
    input: {
      name,
      categoryId: category.id,
      price,
      mrp,
      colors: splitList(row.colors),
      sizes: splitList(row.sizes),
      stock,
      images,
      description: row.description,
      brand: row.brand,
      material: row.material,
      publish: images.length > 0,
    },
  };
}
