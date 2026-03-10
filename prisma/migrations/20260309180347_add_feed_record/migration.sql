/*
  Warnings:

  - You are about to drop the column `administratorName` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `animalIdentity` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `batchNo` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `birdsTreated` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `dose` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `expireDate` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `finishDate` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `housesTreated` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `methodOfTreatment` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `prescription` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `quantityPurchased` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `quantityUsed` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `reasonForTreatment` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `report` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `safeSlaughterDate` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `supplier` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `totalMgPcu` on the `MedicationRecord` table. All the data in the column will be lost.
  - You are about to drop the column `withdrawalPeriod` on the `MedicationRecord` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ChangeLog_createdAt_idx";

-- DropIndex
DROP INDEX "ChangeLog_farmId_idx";

-- AlterTable
ALTER TABLE "MedicationRecord" DROP COLUMN "administratorName",
DROP COLUMN "animalIdentity",
DROP COLUMN "batchNo",
DROP COLUMN "birdsTreated",
DROP COLUMN "createdAt",
DROP COLUMN "dose",
DROP COLUMN "expireDate",
DROP COLUMN "finishDate",
DROP COLUMN "housesTreated",
DROP COLUMN "methodOfTreatment",
DROP COLUMN "prescription",
DROP COLUMN "quantityPurchased",
DROP COLUMN "quantityUsed",
DROP COLUMN "reasonForTreatment",
DROP COLUMN "report",
DROP COLUMN "safeSlaughterDate",
DROP COLUMN "supplier",
DROP COLUMN "totalMgPcu",
DROP COLUMN "withdrawalPeriod";

-- CreateTable
CREATE TABLE "FeedRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "houseId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "feedProduct" TEXT NOT NULL,
    "feedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wheatKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ticketNumber" TEXT NOT NULL,
    "feedPricePerTonneGbp" DOUBLE PRECISION,
    "wheatPricePerTonneGbp" DOUBLE PRECISION,
    "supplier" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedRecord_cropId_idx" ON "FeedRecord"("cropId");

-- CreateIndex
CREATE INDEX "FeedRecord_date_idx" ON "FeedRecord"("date");

-- AddForeignKey
ALTER TABLE "FeedRecord" ADD CONSTRAINT "FeedRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedRecord" ADD CONSTRAINT "FeedRecord_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedRecord" ADD CONSTRAINT "FeedRecord_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;
