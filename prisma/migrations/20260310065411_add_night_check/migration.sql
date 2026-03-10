-- CreateTable
CREATE TABLE "NightCheck" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "checkedByUserId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "checkTime" TEXT,
    "checkedByName" TEXT,
    "temperatureMinC" DOUBLE PRECISION,
    "temperatureMaxC" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "co2Ppm" INTEGER,
    "ammoniaPpm" DOUBLE PRECISION,
    "litterScore" INTEGER,
    "wetAreas" BOOLEAN NOT NULL DEFAULT false,
    "capping" BOOLEAN NOT NULL DEFAULT false,
    "litterNotes" TEXT,
    "waterSystemOk" BOOLEAN NOT NULL DEFAULT false,
    "feedSystemOk" BOOLEAN NOT NULL DEFAULT false,
    "ventilationOk" BOOLEAN NOT NULL DEFAULT false,
    "alarmOk" BOOLEAN NOT NULL DEFAULT false,
    "generatorOk" BOOLEAN NOT NULL DEFAULT false,
    "lightingOk" BOOLEAN NOT NULL DEFAULT false,
    "birdsOk" BOOLEAN NOT NULL DEFAULT false,
    "cropFillOk" BOOLEAN NOT NULL DEFAULT false,
    "unusualBehaviour" BOOLEAN NOT NULL DEFAULT false,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NightCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NightCheck_farmId_date_idx" ON "NightCheck"("farmId", "date");

-- CreateIndex
CREATE INDEX "NightCheck_cropId_date_idx" ON "NightCheck"("cropId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "NightCheck_cropId_houseId_date_key" ON "NightCheck"("cropId", "houseId", "date");

-- AddForeignKey
ALTER TABLE "NightCheck" ADD CONSTRAINT "NightCheck_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightCheck" ADD CONSTRAINT "NightCheck_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightCheck" ADD CONSTRAINT "NightCheck_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightCheck" ADD CONSTRAINT "NightCheck_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
