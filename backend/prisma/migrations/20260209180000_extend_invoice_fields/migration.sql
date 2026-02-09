-- AlterTable
ALTER TABLE "InvoiceFields" ADD COLUMN "supplierAddress" TEXT;
ALTER TABLE "InvoiceFields" ADD COLUMN "supplierEIK" TEXT;
ALTER TABLE "InvoiceFields" ADD COLUMN "clientName" TEXT;
ALTER TABLE "InvoiceFields" ADD COLUMN "clientEIK" TEXT;
ALTER TABLE "InvoiceFields" ADD COLUMN "clientVatNumber" TEXT;
ALTER TABLE "InvoiceFields" ADD COLUMN "serviceDescription" TEXT;
ALTER TABLE "InvoiceFields" ADD COLUMN "quantity" TEXT;
ALTER TABLE "InvoiceFields" ADD COLUMN "unitPrice" DECIMAL(12,2);
ALTER TABLE "InvoiceFields" ADD COLUMN "serviceTotal" DECIMAL(12,2);
ALTER TABLE "InvoiceFields" ADD COLUMN "accountingAccount" TEXT;
