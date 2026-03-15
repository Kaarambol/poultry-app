/*
  Warnings:

  - The `role` column on the `FarmUser` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[cropId,houseId,batchNo]` on the table `CropHousePlacement` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `Farm` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "FarmRole" AS ENUM ('OWNER', 'MANAGER', 'ASSISTANT_MANAGER', 'VIEWER');

-- AlterTable
ALTER TABLE "CropHousePlacement" ADD COLUMN     "batchNo" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "clearDate" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "thinDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DailyRecord" ADD COLUMN     "birdsTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "co2MaxPpm" INTEGER,
ADD COLUMN     "co2MinPpm" INTEGER,
ADD COLUMN     "cullsLeg" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cullsSmall" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "humidityMaxPct" DOUBLE PRECISION,
ADD COLUMN     "humidityMinPct" DOUBLE PRECISION,
ADD COLUMN     "temperatureMaxC" DOUBLE PRECISION,
ADD COLUMN     "temperatureMinC" DOUBLE PRECISION,
ADD COLUMN     "weightPercent" DOUBLE PRECISION,
ALTER COLUMN "mort" SET DEFAULT 0,
ALTER COLUMN "culls" SET DEFAULT 0,
ALTER COLUMN "feedKg" SET DEFAULT 0,
ALTER COLUMN "waterL" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "chickenPrice" DOUBLE PRECISION,
ADD COLUMN     "chickenSupplier" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "feedContractor" TEXT,
ADD COLUMN     "feedPrice1" DOUBLE PRECISION,
ADD COLUMN     "feedPrice2" DOUBLE PRECISION,
ADD COLUMN     "feedPrice3" DOUBLE PRECISION,
ADD COLUMN     "feedPrice4" DOUBLE PRECISION,
ADD COLUMN     "feedPrice5" DOUBLE PRECISION,
ADD COLUMN     "liveWeightPricePerKg" DOUBLE PRECISION,
ADD COLUMN     "wheatPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "FarmDocument" ADD COLUMN     "blobPath" TEXT;

-- AlterTable
ALTER TABLE "FarmUser" DROP COLUMN "role",
ADD COLUMN     "role" "FarmRole" NOT NULL DEFAULT 'OWNER';

-- CreateIndex
CREATE INDEX "CropHousePlacement_cropId_houseId_idx" ON "CropHousePlacement"("cropId", "houseId");

-- CreateIndex
CREATE UNIQUE INDEX "CropHousePlacement_cropId_houseId_batchNo_key" ON "CropHousePlacement"("cropId", "houseId", "batchNo");

-- CreateIndex
CREATE INDEX "DailyRecord_houseId_date_idx" ON "DailyRecord"("houseId", "date");

-- CreateIndex
CREATE INDEX "DailyRecord_cropId_date_idx" ON "DailyRecord"("cropId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Farm_code_key" ON "Farm"("code");

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
