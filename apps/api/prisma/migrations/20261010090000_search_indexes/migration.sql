-- Trigram search (case-insensitive "contains") and a plain createdAt index for the admin order list.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_orderNumber_trgm_idx" ON "orders" USING GIN ("orderNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "product_variants_sku_trgm_idx" ON "product_variants" USING GIN ("sku" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_brand_trgm_idx" ON "products" USING GIN ("brand" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "products_tags_idx" ON "products" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "users_name_trgm_idx" ON "users" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "users_phone_trgm_idx" ON "users" USING GIN ("phone" gin_trgm_ops);

