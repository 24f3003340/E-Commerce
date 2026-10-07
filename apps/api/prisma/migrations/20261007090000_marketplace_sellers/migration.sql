-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "ProductStatus" ADD VALUE 'REJECTED';

-- DropIndex
DROP INDEX "payments_providerOrderId_key";

-- DropIndex
DROP INDEX "payments_providerPaymentId_key";

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "sellerId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "sellerId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "checkoutId" TEXT,
ADD COLUMN     "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "payoutId" TEXT,
ADD COLUMN     "sellerId" TEXT;

-- CreateTable
CREATE TABLE "sellers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "upiId" TEXT,
    "status" "SellerStatus" NOT NULL DEFAULT 'PENDING',
    "statusNote" TEXT,
    "commissionPct" DOUBLE PRECISION,
    "approvedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_payouts" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_email_key" ON "sellers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_phone_key" ON "sellers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sellers_slug_key" ON "sellers"("slug");

-- CreateIndex
CREATE INDEX "sellers_status_createdAt_idx" ON "sellers"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "seller_payouts_payoutNumber_key" ON "seller_payouts"("payoutNumber");

-- CreateIndex
CREATE INDEX "seller_payouts_sellerId_createdAt_idx" ON "seller_payouts"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_sellerId_idx" ON "refresh_tokens"("sellerId");

-- CreateIndex
CREATE INDEX "products_sellerId_status_idx" ON "products"("sellerId", "status");

-- CreateIndex
CREATE INDEX "orders_sellerId_createdAt_idx" ON "orders"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_checkoutId_idx" ON "orders"("checkoutId");

-- CreateIndex
CREATE INDEX "payments_providerOrderId_idx" ON "payments"("providerOrderId");

-- CreateIndex
CREATE INDEX "payments_providerPaymentId_idx" ON "payments"("providerPaymentId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_payouts" ADD CONSTRAINT "seller_payouts_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "seller_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

