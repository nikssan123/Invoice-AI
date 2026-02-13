-- AlterTable
ALTER TABLE "User" ADD COLUMN     "excelExportIncludeAdditionalFields" BOOLEAN,
ADD COLUMN     "excelExportEnabledColumnKeys" JSONB;
