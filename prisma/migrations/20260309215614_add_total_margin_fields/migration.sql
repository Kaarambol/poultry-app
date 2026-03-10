-- AlterTable
ALTER TABLE "Crop" ADD COLUMN     "finalAvgWeightKg" DOUBLE PRECISION,
ADD COLUMN     "finalBirdsSold" INTEGER,
ADD COLUMN     "finalNotes" TEXT,
ADD COLUMN     "finalRevenueGbp" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "MedicationRecord" ADD COLUMN     "administratorName" TEXT,
ADD COLUMN     "animalIdentity" TEXT,
ADD COLUMN     "batchNo" TEXT,
ADD COLUMN     "birdsTreated" INTEGER,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dose" TEXT,
ADD COLUMN     "expireDate" TIMESTAMP(3),
ADD COLUMN     "finishDate" TIMESTAMP(3),
ADD COLUMN     "housesTreated" TEXT,
ADD COLUMN     "methodOfTreatment" TEXT,
ADD COLUMN     "prescription" TEXT,
ADD COLUMN     "quantityPurchased" TEXT,
ADD COLUMN     "quantityUsed" TEXT,
ADD COLUMN     "reasonForTreatment" TEXT,
ADD COLUMN     "report" TEXT,
ADD COLUMN     "safeSlaughterDate" TIMESTAMP(3),
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "totalMgPcu" TEXT,
ADD COLUMN     "withdrawalPeriod" TEXT;
