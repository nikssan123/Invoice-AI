export type ExportColumnKey =
  | 'id'
  | 'fileName'
  | 'invoiceNumber'
  | 'invoiceDate'
  | 'supplierName'
  | 'supplierVatNumber'
  | 'supplierAddress'
  | 'supplierEIK'
  | 'clientName'
  | 'clientEIK'
  | 'clientVatNumber'
  | 'currency'
  | 'netAmount'
  | 'vatAmount'
  | 'totalAmount'
  | 'status'
  | 'extractedAt'
  | 'uploadedAt';

export type ExportColumnConfig = {
  key: ExportColumnKey;
  defaultLabel: string;
  currentLabel: string;
};

