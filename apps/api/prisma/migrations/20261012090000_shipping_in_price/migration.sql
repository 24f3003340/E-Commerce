-- Shipping is folded into the product price instead of being shown as a separate charge.
-- "basePrice" keeps what the seller typed in; "price" is what the customer pays (base + shipping).
ALTER TABLE "product_variants" ADD COLUMN "basePrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN "basePrice" INTEGER NOT NULL DEFAULT 0;

-- Existing orders: the seller's share was the whole unit price.
UPDATE "order_items" SET "basePrice" = "unitPrice";

-- Existing products: remember the current price as the base and add the default standard
-- shipping fee (Rs 79). If the store uses a different fee, saving it again in Settings re-prices
-- the whole catalogue from the base price.
UPDATE "product_variants" SET "basePrice" = "price";
UPDATE "product_variants" SET "price" = "basePrice" + 7900, "mrp" = GREATEST("mrp", "basePrice" + 7900);
UPDATE "products" p SET
  "minPrice" = c."price",
  "maxMrp" = c."mrp",
  "discountPct" = CASE WHEN c."mrp" > c."price" THEN ROUND((c."mrp" - c."price") * 100.0 / c."mrp") ELSE 0 END
FROM (
  SELECT DISTINCT ON ("productId") "productId", "price", "mrp"
  FROM "product_variants" WHERE "isActive" = true
  ORDER BY "productId", "price" ASC
) c
WHERE p."id" = c."productId";
