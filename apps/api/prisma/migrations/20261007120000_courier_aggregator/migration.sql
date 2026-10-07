-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "courierPickup" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "labelUrl" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "providerOrderId" TEXT,
ADD COLUMN     "providerShipmentId" TEXT;

