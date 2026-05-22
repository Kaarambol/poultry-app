-- CreateTable
CREATE TABLE "FeedBin" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityTonnes" DOUBLE PRECISION NOT NULL DEFAULT 13.5,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeedBin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedBinAssignment" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "binId" TEXT NOT NULL,

    CONSTRAINT "FeedBinAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedBin_farmId_name_key" ON "FeedBin"("farmId", "name");

-- CreateIndex
CREATE INDEX "FeedBin_farmId_sortOrder_idx" ON "FeedBin"("farmId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FeedBinAssignment_houseId_binId_key" ON "FeedBinAssignment"("houseId", "binId");

-- CreateIndex
CREATE INDEX "FeedBinAssignment_farmId_idx" ON "FeedBinAssignment"("farmId");

-- AddForeignKey
ALTER TABLE "FeedBin" ADD CONSTRAINT "FeedBin_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedBinAssignment" ADD CONSTRAINT "FeedBinAssignment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedBinAssignment" ADD CONSTRAINT "FeedBinAssignment_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedBinAssignment" ADD CONSTRAINT "FeedBinAssignment_binId_fkey" FOREIGN KEY ("binId") REFERENCES "FeedBin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
