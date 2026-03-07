-- CreateTable
CREATE TABLE "public"."AvaraExport" (
    "id" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaraExport_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."AvaraExport" ADD CONSTRAINT "AvaraExport_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "public"."Crop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
