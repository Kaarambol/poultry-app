/*
  Warnings:

  - You are about to drop the column `feedCurrency` on the `Crop` table. All the data in the column will be lost.
  - You are about to drop the column `finisherFeedPricePerTonne` on the `Crop` table. All the data in the column will be lost.
  - You are about to drop the column `growerFeedPricePerTonne` on the `Crop` table. All the data in the column will be lost.
  - You are about to drop the column `starterFeedPricePerTonne` on the `Crop` table. All the data in the column will be lost.
  - You are about to drop the column `wheatPricePerTonne` on the `Crop` table. All the data in the column will be lost.
  - You are about to drop the column `withdrawalFeedPricePerTonne` on the `Crop` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Crop" DROP COLUMN "feedCurrency",
DROP COLUMN "finisherFeedPricePerTonne",
DROP COLUMN "growerFeedPricePerTonne",
DROP COLUMN "starterFeedPricePerTonne",
DROP COLUMN "wheatPricePerTonne",
DROP COLUMN "withdrawalFeedPricePerTonne",
ADD COLUMN     "chickenPricePerKg" DOUBLE PRECISION,
ADD COLUMN     "currency" TEXT DEFAULT 'GBP',
ADD COLUMN     "salePricePerKgAllIn" DOUBLE PRECISION;
