import { PrismaClient } from '@prisma/client';

/**
 * Shipping and COD charges are never shown to customers as separate lines: the store's standard
 * shipping fee and COD fee are folded into every product's price. The seller / admin types the
 * base price; shoppers pay base + built-in charges. All amounts are in paise.
 */
export const builtInCharges = (s: { standardShippingFee: number; codFee: number }) => s.standardShippingFee + s.codFee;

export const customerPrice = (basePrice: number, charges: number) => basePrice + charges;

/** The price the seller typed in (legacy rows saved before this feature have basePrice = 0). */
export const sellerPrice = (v: { price: number; basePrice: number }) => v.basePrice || v.price;

/**
 * Re-applies the built-in charges to every variant (idempotent: price is always recomputed from the
 * seller's base price) and refreshes the denormalised listing columns on each product.
 */
export async function repriceCatalog(db: Pick<PrismaClient, '$executeRawUnsafe'>, charges: number) {
  const fee = Math.max(0, Math.trunc(charges));
  await db.$executeRawUnsafe(`UPDATE "product_variants" SET "basePrice" = "price" WHERE "basePrice" = 0`);
  await db.$executeRawUnsafe(
    `UPDATE "product_variants" SET "price" = "basePrice" + ${fee}, "mrp" = GREATEST("mrp", "basePrice" + ${fee})`,
  );
  await db.$executeRawUnsafe(`
    UPDATE "products" p SET
      "minPrice" = c."price",
      "maxMrp" = c."mrp",
      "discountPct" = CASE WHEN c."mrp" > c."price" THEN ROUND((c."mrp" - c."price") * 100.0 / c."mrp") ELSE 0 END
    FROM (
      SELECT DISTINCT ON ("productId") "productId", "price", "mrp"
      FROM "product_variants" WHERE "isActive" = true
      ORDER BY "productId", "price" ASC
    ) c
    WHERE p."id" = c."productId"`);
}
