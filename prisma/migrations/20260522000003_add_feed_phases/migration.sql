-- CreateTable
CREATE TABLE "FeedPhaseTemplate" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,

    CONSTRAINT "FeedPhaseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedPhase" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "feedProduct" TEXT NOT NULL,
    "dayFrom" INTEGER NOT NULL,
    "dayTo" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeedPhase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedPhaseTemplate_farmId_key" ON "FeedPhaseTemplate"("farmId");

-- CreateIndex
CREATE INDEX "FeedPhase_templateId_sortOrder_idx" ON "FeedPhase"("templateId", "sortOrder");

-- AddForeignKey
ALTER TABLE "FeedPhaseTemplate" ADD CONSTRAINT "FeedPhaseTemplate_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedPhase" ADD CONSTRAINT "FeedPhase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FeedPhaseTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
