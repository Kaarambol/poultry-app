/*
  Warnings:

  - A unique constraint covering the columns `[farmId,cropNumber]` on the table `Crop` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cropId,houseId,date]` on the table `DailyRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."Crop" ADD COLUMN     "breed" TEXT,
ADD COLUMN     "hatchery" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "public"."DailyRecord" ADD COLUMN     "avgWeightG" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "public"."CropHousePlacement" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "birdsPlaced" INTEGER NOT NULL,

    CONSTRAINT "CropHousePlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CropHousePlacement_cropId_houseId_key" ON "public"."CropHousePlacement"("cropId", "houseId");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_farmId_cropNumber_key" ON "public"."Crop"("farmId", "cropNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecord_cropId_houseId_date_key" ON "public"."DailyRecord"("cropId", "houseId", "date");

-- AddForeignKey
ALTER TABLE "public"."House" ADD CONSTRAINT "House_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "public"."Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Crop" ADD CONSTRAINT "Crop_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "public"."Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CropHousePlacement" ADD CONSTRAINT "CropHousePlacement_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "public"."Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CropHousePlacement" ADD CONSTRAINT "CropHousePlacement_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyRecord" ADD CONSTRAINT "DailyRecord_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "public"."Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DailyRecord" ADD CONSTRAINT "DailyRecord_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "public"."House"("id") ON DELETE CASCADE ON UPDATE CASCADE;
