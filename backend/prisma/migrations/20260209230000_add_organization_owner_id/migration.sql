-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "ownerId" TEXT;

-- Backfill: set ownerId to first user (by createdAt) per organization
UPDATE "Organization" o
SET "ownerId" = (
  SELECT u.id FROM "User" u
  WHERE u."organizationId" = o.id
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE o."ownerId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_ownerId_key" ON "Organization"("ownerId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
