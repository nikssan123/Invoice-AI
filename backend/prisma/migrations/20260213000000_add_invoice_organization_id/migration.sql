-- AlterTable: add organizationId as nullable
ALTER TABLE "Invoice" ADD COLUMN "organizationId" TEXT;

-- Backfill from User (uploader's organization)
UPDATE "Invoice" i
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE i."userId" = u.id AND i."organizationId" IS NULL;

-- Backfill from Folder for rows still null
UPDATE "Invoice" i
SET "organizationId" = f."organizationId"
FROM "Folder" f
WHERE i."folderId" = f.id AND i."organizationId" IS NULL;

-- Fallback: assign any remaining nulls to first organization (legacy orphan rows)
UPDATE "Invoice"
SET "organizationId" = (SELECT id FROM "Organization" LIMIT 1)
WHERE "organizationId" IS NULL;

-- Make column non-nullable and add FK
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
