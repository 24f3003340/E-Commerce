-- Seller automation: optionally book the courier automatically when an order is confirmed.
ALTER TABLE "sellers" ADD COLUMN "autoShip" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sellers" ADD COLUMN "defaultWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE "sellers" ADD COLUMN "defaultLengthCm" DOUBLE PRECISION NOT NULL DEFAULT 25;
ALTER TABLE "sellers" ADD COLUMN "defaultBreadthCm" DOUBLE PRECISION NOT NULL DEFAULT 20;
ALTER TABLE "sellers" ADD COLUMN "defaultHeightCm" DOUBLE PRECISION NOT NULL DEFAULT 5;
