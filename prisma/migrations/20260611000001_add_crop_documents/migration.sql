-- CreateTable
CREATE TABLE "CropDocument" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "fileUrl" TEXT,
    "blobPath" TEXT,
    "originalFileName" TEXT,
    "storedFileName" TEXT,
    "mimeType" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CropDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CropDocument" ADD CONSTRAINT "CropDocument_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "CropDocument_cropId_category_idx" ON "CropDocument"("cropId", "category");

-- CreateIndex
CREATE INDEX "CropDocument_cropId_idx" ON "CropDocument"("cropId");
