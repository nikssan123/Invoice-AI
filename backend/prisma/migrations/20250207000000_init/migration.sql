-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceFields" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "supplierName" TEXT,
    "supplierVatNumber" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TEXT,
    "currency" TEXT,
    "netAmount" DECIMAL(12,2),
    "vatAmount" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2),
    "confidenceScores" JSONB,
    "extractedAt" TIMESTAMP(3),

    CONSTRAINT "InvoiceFields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" SERIAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceFields_invoiceId_key" ON "InvoiceFields"("invoiceId");

-- CreateIndex
CREATE INDEX "Approval_invoiceId_idx" ON "Approval"("invoiceId");

-- AddForeignKey
ALTER TABLE "InvoiceFields" ADD CONSTRAINT "InvoiceFields_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
