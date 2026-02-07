/**
 * Mock extraction service. Replace with real AI/OCR later.
 * Returns deterministic data based on invoiceId and filename.
 */
export interface ExtractedFields {
  supplierName: string;
  supplierVatNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  confidenceScores: Record<string, number>;
}

export async function extractInvoice(
  invoiceId: string,
  filePath: string,
  mimeType: string
): Promise<ExtractedFields> {
  const seed = (invoiceId + filePath).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const n = Math.abs(seed % 1000) + 100;
  const net = (n % 500) + 50;
  const vatRate = 0.21;
  const vat = Math.round(net * vatRate * 100) / 100;
  const total = Math.round((net + vat) * 100) / 100;

  const suppliers = ["Acme Corp", "Global Supplies Ltd", "TechVendor Inc", "Office Essentials"];
  const supplier = suppliers[Math.abs(seed % suppliers.length)];

  const confidence = (): number => 0.85 + Math.abs(seed % 15) / 100;

  return {
    supplierName: supplier,
    supplierVatNumber: `GB${String(seed).padStart(9, "0").slice(-9)}`,
    invoiceNumber: `INV-${String(Math.abs(seed)).slice(-6)}`,
    invoiceDate: new Date(2025, seed % 12, (seed % 28) + 1).toISOString().slice(0, 10),
    currency: "EUR",
    netAmount: net,
    vatAmount: vat,
    totalAmount: total,
    confidenceScores: {
      supplierName: confidence(),
      supplierVatNumber: confidence() - 0.05,
      invoiceNumber: confidence(),
      invoiceDate: confidence(),
      currency: 0.98,
      netAmount: confidence(),
      vatAmount: confidence(),
      totalAmount: confidence(),
    },
  };
}
