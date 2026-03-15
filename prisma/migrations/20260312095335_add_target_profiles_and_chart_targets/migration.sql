-- CreateEnum
CREATE TYPE "TargetProfileScope" AS ENUM ('GLOBAL_TEMPLATE', 'CROP');

-- CreateTable
CREATE TABLE "TargetProfile" (
    "id" TEXT NOT NULL,
    "scope" "TargetProfileScope" NOT NULL DEFAULT 'GLOBAL_TEMPLATE',
    "farmId" TEXT NOT NULL,
    "cropId" TEXT,
    "name" TEXT NOT NULL,
    "source" TEXT DEFAULT 'ROSS_211',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "humidityTargetPct" DOUBLE PRECISION DEFAULT 55,
    "co2TargetPpm" INTEGER DEFAULT 3000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetProfileDay" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "weightTargetG" DOUBLE PRECISION,
    "feedTargetG" DOUBLE PRECISION,
    "waterTargetMl" DOUBLE PRECISION,
    "temperatureTargetC" DOUBLE PRECISION,
    "humidityTargetPct" DOUBLE PRECISION,
    "co2TargetPpm" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetProfileDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TargetProfile_farmId_scope_idx" ON "TargetProfile"("farmId", "scope");

-- CreateIndex
CREATE INDEX "TargetProfile_cropId_idx" ON "TargetProfile"("cropId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetProfile_cropId_key" ON "TargetProfile"("cropId");

-- CreateIndex
CREATE INDEX "TargetProfileDay_dayNumber_idx" ON "TargetProfileDay"("dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TargetProfileDay_profileId_dayNumber_key" ON "TargetProfileDay"("profileId", "dayNumber");

-- AddForeignKey
ALTER TABLE "TargetProfile" ADD CONSTRAINT "TargetProfile_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProfile" ADD CONSTRAINT "TargetProfile_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetProfileDay" ADD CONSTRAINT "TargetProfileDay_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TargetProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
