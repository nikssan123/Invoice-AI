export interface ExtractedFields {
  supplierName: string | null;
  supplierVatNumber: string | null;
  supplierAddress: string | null;
  supplierEIK: string | null;
  clientName: string | null;
  clientEIK: string | null;
  clientVatNumber: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  serviceDescription: string | null;
  quantity: string | null;
  unitPrice: number | null;
  serviceTotal: number | null;
  accountingAccount: string | null;
  currency: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  confidenceScores: Record<string, number>;
}

export declare function extractInvoice(
  invoiceId: string,
  fullPath: string,
  mimeType: string
): Promise<ExtractedFields>;

