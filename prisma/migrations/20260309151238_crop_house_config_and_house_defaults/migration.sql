/*
  Warnings:

  - A unique constraint covering the columns `[farmId,code]` on the table `House` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Crop" ADD COLUMN     "feedCurrency" TEXT,
ADD COLUMN     "finisherFeedPricePerTonne" DOUBLE PRECISION,
ADD COLUMN     "growerFeedPricePerTonne" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "starterFeedPricePerTonne" DOUBLE PRECISION,
ADD COLUMN     "wheatPricePerTonne" DOUBLE PRECISION,
ADD COLUMN     "withdrawalFeedPricePerTonne" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CropHousePlacement" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "parentAgeWeeks" INTEGER;

-- AlterTable
ALTER TABLE "House" ADD COLUMN     "code" TEXT,
ADD COLUMN     "defaultCapacityBirds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultDrinkerLineCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultFanCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultFeederPanCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultHeaterCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultMaxAmmoniaPpm" DOUBLE PRECISION,
ADD COLUMN     "defaultMaxCo2Ppm" INTEGER,
ADD COLUMN     "defaultMaxTempC" DOUBLE PRECISION,
ADD COLUMN     "defaultMinTempC" DOUBLE PRECISION,
ADD COLUMN     "defaultNippleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defaultTargetHumidityPct" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "usableAreaM2" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "CropHouseConfig" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "activeFloorAreaM2" DOUBLE PRECISION,
    "activeCapacityBirds" INTEGER,
    "activeDrinkerLineCount" INTEGER,
    "activeNippleCount" INTEGER,
    "activeFeederPanCount" INTEGER,
    "activeFanCount" INTEGER,
    "activeHeaterCount" INTEGER,
    "notes" TEXT,

    CONSTRAINT "CropHouseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CropHouseConfig_cropId_houseId_key" ON "CropHouseConfig"("cropId", "houseId");

-- CreateIndex
CREATE UNIQUE INDEX "House_farmId_code_key" ON "House"("farmId", "code");

-- AddForeignKey
ALTER TABLE "CropHouseConfig" ADD CONSTRAINT "CropHouseConfig_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropHouseConfig" ADD CONSTRAINT "CropHouseConfig_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;
