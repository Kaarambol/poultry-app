-- Fix: thinBirds column was in schema but missing from all migrations
ALTER TABLE "CropHousePlacement" ADD COLUMN IF NOT EXISTS "thinBirds" INTEGER;
