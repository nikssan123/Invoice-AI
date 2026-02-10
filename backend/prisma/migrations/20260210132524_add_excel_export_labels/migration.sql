-- AlterTable
ALTER TABLE "User" ADD COLUMN     "excelExportColumnLabels" JSONB;

-- CreateIndex
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");
