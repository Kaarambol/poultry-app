-- Fix: add all fields that exist in schema.prisma but were never added to migrations
-- These were previously added via prisma db push locally but not captured in migration files

-- Farm table: missing contractor/info fields
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "farmNumber" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "chpCode" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "rodentControl" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "disinfectProgramme" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "waterSanitizer" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "footDipDisinfectant" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "cleaningContractor" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "vetContractor" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "electricianContractor" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "generatorService" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "weedkiller" TEXT;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "security" TEXT;

-- NightCheck table: missing boolean ok-flag fields
ALTER TABLE "NightCheck" ADD COLUMN IF NOT EXISTS "humidityOk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NightCheck" ADD COLUMN IF NOT EXISTS "co2Ok" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NightCheck" ADD COLUMN IF NOT EXISTS "ammoniaOk" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NightCheck" ADD COLUMN IF NOT EXISTS "litterOk" BOOLEAN NOT NULL DEFAULT false;

-- Crop table: missing feed/wheat stock fields
ALTER TABLE "Crop" ADD COLUMN IF NOT EXISTS "openingFeedStockKg" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Crop" ADD COLUMN IF NOT EXISTS "openingWheatStockKg" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Crop" ADD COLUMN IF NOT EXISTS "closingFeedStockKg" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Crop" ADD COLUMN IF NOT EXISTS "closingWheatStockKg" DOUBLE PRECISION DEFAULT 0;

-- CropHousePlacement table: missing thinning 2 and clearance fields
ALTER TABLE "CropHousePlacement" ADD COLUMN IF NOT EXISTS "thin2Date" TIMESTAMP(3);
ALTER TABLE "CropHousePlacement" ADD COLUMN IF NOT EXISTS "thin2Birds" INTEGER;
ALTER TABLE "CropHousePlacement" ADD COLUMN IF NOT EXISTS "clearBirds" INTEGER;
ALTER TABLE "CropHousePlacement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CropHousePlacement" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
