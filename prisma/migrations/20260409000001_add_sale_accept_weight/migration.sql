-- AlterTable: add saleWeightKg and acceptWeightKg to Crop (safe: only if not exists)
ALTER TABLE "Crop" ADD COLUMN IF NOT EXISTS "saleWeightKg" DOUBLE PRECISION;
ALTER TABLE "Crop" ADD COLUMN IF NOT EXISTS "acceptWeightKg" DOUBLE PRECISION;
