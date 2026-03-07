-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "House" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorAreaM2" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cropNumber" TEXT NOT NULL,
    "placementDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRecord" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mort" INTEGER NOT NULL,
    "culls" INTEGER NOT NULL,
    "feedKg" DOUBLE PRECISION NOT NULL,
    "waterL" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DailyRecord_pkey" PRIMARY KEY ("id")
);
