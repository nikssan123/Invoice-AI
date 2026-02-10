export type ExportColumnKey =
  | "id"
  | "fileName"
  | "invoiceNumber"
  | "invoiceDate"
  | "supplierName"
  | "supplierVatNumber"
  | "supplierAddress"
  | "supplierEIK"
  | "clientName"
  | "clientEIK"
  | "clientVatNumber"
  | "currency"
  | "netAmount"
  | "vatAmount"
  | "totalAmount"
  | "status"
  | "extractedAt"
  | "uploadedAt";

export type ExportColumnConfig = {
  key: ExportColumnKey;
  defaultLabel: string;
  width: number;
};

export const EXPORT_COLUMNS: ExportColumnConfig[] = [
  { key: "id", defaultLabel: "Invoice ID", width: 24 },
  { key: "fileName", defaultLabel: "File name", width: 40 },
  { key: "invoiceNumber", defaultLabel: "Invoice number", width: 20 },
  { key: "invoiceDate", defaultLabel: "Invoice date", width: 18 },
  { key: "supplierName", defaultLabel: "Supplier name", width: 32 },
  { key: "supplierVatNumber", defaultLabel: "Supplier VAT", width: 24 },
  { key: "supplierAddress", defaultLabel: "Supplier address", width: 40 },
  { key: "supplierEIK", defaultLabel: "Supplier EIK", width: 24 },
  { key: "clientName", defaultLabel: "Client name", width: 32 },
  { key: "clientEIK", defaultLabel: "Client EIK", width: 24 },
  { key: "clientVatNumber", defaultLabel: "Client VAT", width: 24 },
  { key: "currency", defaultLabel: "Currency", width: 10 },
  { key: "netAmount", defaultLabel: "Net amount", width: 16 },
  { key: "vatAmount", defaultLabel: "VAT amount", width: 16 },
  { key: "totalAmount", defaultLabel: "Total amount", width: 16 },
  { key: "status", defaultLabel: "Status", width: 14 },
  { key: "extractedAt", defaultLabel: "Extracted at", width: 24 },
  { key: "uploadedAt", defaultLabel: "Uploaded at", width: 24 },
];

export type ExportColumnLabelsOverride = Partial<Record<ExportColumnKey, string>>;

export function mergeExportColumnLabels(
  overrides: ExportColumnLabelsOverride | null | undefined
): { key: ExportColumnKey; header: string; width: number }[] {
  const safeOverrides: Record<string, string> =
    overrides && typeof overrides === "object" ? (overrides as Record<string, string>) : {};

  return EXPORT_COLUMNS.map((col) => {
    const raw = safeOverrides[col.key];
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    const header = trimmed.length > 0 ? trimmed : col.defaultLabel;
    return {
      key: col.key,
      header,
      width: col.width,
    };
  });
}

