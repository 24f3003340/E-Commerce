-- COD fee is folded into the product price as well (default Rs 49), on top of the standard
-- shipping fee (default Rs 79). Recomputed from "basePrice", so it is safe whatever the previous
-- migration did. A different fee in Settings can be applied by saving Settings again.
UPDATE "product_variants" SET "price" = "basePrice" + 12800, "mrp" = GREATEST("mrp", "basePrice" + 12800) WHERE "basePrice" > 0;
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
