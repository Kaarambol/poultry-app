-- Add isClosingStock flag to FeedBin
ALTER TABLE "FeedBin" ADD COLUMN "isClosingStock" BOOLEAN NOT NULL DEFAULT false;

-- Remove closing bin columns from FeedOrderStock (now tracked on FeedBin directly)
ALTER TABLE "FeedOrderStock" DROP COLUMN IF EXISTS "closingBinId";
ALTER TABLE "FeedOrderStock" DROP COLUMN IF EXISTS "closingBinTonnes";
