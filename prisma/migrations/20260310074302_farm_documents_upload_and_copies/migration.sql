-- AlterTable
ALTER TABLE "FarmDocument" ADD COLUMN     "documentFormat" TEXT NOT NULL DEFAULT 'ELECTRONIC',
ADD COLUMN     "electronicCopy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gateHouseCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "officeCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalFileName" TEXT,
ADD COLUMN     "storedFileName" TEXT;
