export interface InvoiceFieldsShape {
  supplierName: string | null;
  supplierVatNumber: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  confidenceScores: Record<string, number> | null;
}

export interface ApprovalEntry {
  approvedBy: string;
  approvedAt: string;
  action: string;
}

export interface Invoice {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
  fileUrl: string;
  fields: InvoiceFieldsShape | null;
  approvals: ApprovalEntry[];
}

export interface Stats {
  total: number;
  approved: number;
  pending: number;
  needs_review: number;
}

export interface InvoiceListItem {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
  hasFields: boolean;
}

export type ApprovePayload = { approvedBy: string; action: "approved" | "needs_review" };

export type UpdateFieldsPayload = Partial<{
  supplierName: string;
  supplierVatNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
}>;
