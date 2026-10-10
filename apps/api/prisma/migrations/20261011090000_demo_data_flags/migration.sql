-- Sample records created by the seed script are flagged so the admin can remove them in one click
-- (Admin → Settings → Demo data).
ALTER TABLE "products" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "coupons" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "banners" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Flag the sample data that already exists in running databases. The seed's artwork lives under
-- /assets/seed/, which no real product or banner uses.
UPDATE "products" SET "isDemo" = true
WHERE "id" IN (SELECT "productId" FROM "product_images" WHERE "url" LIKE '%/assets/seed/%');
UPDATE "coupons" SET "isDemo" = true WHERE "code" IN ('WELCOME10', 'FLAT200', 'FOOTWEAR15');
UPDATE "banners" SET "isDemo" = true WHERE "imageUrl" LIKE '%/assets/seed/banner-%';
