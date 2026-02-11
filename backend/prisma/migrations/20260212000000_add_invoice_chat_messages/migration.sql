-- CreateTable
CREATE TABLE "InvoiceChatMessage" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceChatMessage_invoiceId_idx" ON "InvoiceChatMessage"("invoiceId");

-- AddForeignKey
ALTER TABLE "InvoiceChatMessage" ADD CONSTRAINT "InvoiceChatMessage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
