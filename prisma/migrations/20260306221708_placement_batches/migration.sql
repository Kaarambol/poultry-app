/*
  Warnings:

  - Added the required column `placementDate` to the `CropHousePlacement` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."CropHousePlacement_cropId_houseId_key";

-- AlterTable
ALTER TABLE "public"."CropHousePlacement" ADD COLUMN     "flockNumber" TEXT,
ADD COLUMN     "hatchery" TEXT,
ADD COLUMN     "placementDate" TIMESTAMP(3) NOT NULL;
