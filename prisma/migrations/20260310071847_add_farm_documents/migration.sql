-- CreateTable
CREATE TABLE "FarmDocument" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "fileUrl" TEXT,
    "referenceNo" TEXT,
    "issuer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmDocument_farmId_status_idx" ON "FarmDocument"("farmId", "status");

-- CreateIndex
CREATE INDEX "FarmDocument_farmId_documentType_idx" ON "FarmDocument"("farmId", "documentType");

-- CreateIndex
CREATE INDEX "FarmDocument_expiryDate_idx" ON "FarmDocument"("expiryDate");

-- CreateIndex
CREATE INDEX "FarmDocument_nextReviewDate_idx" ON "FarmDocument"("nextReviewDate");

-- AddForeignKey
ALTER TABLE "FarmDocument" ADD CONSTRAINT "FarmDocument_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
