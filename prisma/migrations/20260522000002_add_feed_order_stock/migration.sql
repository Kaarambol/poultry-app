-- CreateTable
CREATE TABLE "FeedOrderStock" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "activeStockTonnes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingBinId" TEXT,
    "closingBinTonnes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedOrderStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedOrderStock_farmId_key" ON "FeedOrderStock"("farmId");

-- AddForeignKey
ALTER TABLE "FeedOrderStock" ADD CONSTRAINT "FeedOrderStock_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedOrderStock" ADD CONSTRAINT "FeedOrderStock_closingBinId_fkey" FOREIGN KEY ("closingBinId") REFERENCES "FeedBin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
