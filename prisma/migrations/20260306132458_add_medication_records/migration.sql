-- CreateTable
CREATE TABLE "public"."MedicationRecord" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "medicineName" TEXT NOT NULL,
    "supplier" TEXT,
    "batchNo" TEXT,
    "expireDate" TIMESTAMP(3),
    "quantityPurchased" TEXT,
    "quantityUsed" TEXT,
    "animalIdentity" TEXT,
    "housesTreated" TEXT,
    "birdsTreated" INTEGER,
    "finishDate" TIMESTAMP(3),
    "withdrawalPeriod" TEXT,
    "safeSlaughterDate" TIMESTAMP(3),
    "administratorName" TEXT,
    "reasonForTreatment" TEXT,
    "methodOfTreatment" TEXT,
    "dose" TEXT,
    "totalMgPcu" TEXT,
    "report" TEXT,
    "prescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."MedicationRecord" ADD CONSTRAINT "MedicationRecord_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "public"."Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
