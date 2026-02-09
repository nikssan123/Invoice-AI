import fs from "fs";
import path from "path";
import FormData from "form-data";
import axios from "axios";
import { config } from "../config.js";

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

interface OcrPageResult {
  page: number;
  text: string;
}

interface OcrResponse {
  documentId: string;
  pages: OcrPageResult[];
}

interface OcrExtractInvoiceFields {
  supplierName: string | null;
  supplierVat: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  currency: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
}

interface OcrExtractInvoiceResponse {
  documentId: string;
  fields: OcrExtractInvoiceFields;
  confidence: {
    supplierName?: number;
    invoiceNumber?: number;
    totalAmount?: number;
  };
  validation: {
    isConsistent: boolean;
    issues: string[];
  };
}

/** Rule-based POST /extract response (OCR service) */
interface OcrExtractRuleResponse {
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  supplier?: { name?: string | null; address?: string | null; eik?: string | null; vat?: string | null } | null;
  client?: { name?: string | null; eik?: string | null; vat?: string | null } | null;
  service?: {
    description?: string | null;
    quantity?: string | null;
    unitPrice?: number | null;
    total?: number | null;
  } | null;
  accountingAccount?: string | null;
  amounts?: {
    subtotal?: number | null;
    vat?: number | null;
    total?: number | null;
    currency?: string | null;
  } | null;
  confidenceScores?: Record<string, number> | null;
}

const OCR_TIMEOUT_MS = 60_000;
const OCR_MAX_RETRIES = 2;
const OCR_RETRY_DELAY_MS = 2000;

function getOcrBaseUrl(): string {
  return (config.ocrServiceUrl ?? "http://localhost:8000").replace(/\/$/, "");
}

function isRetryableNetworkError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND";
}

export async function extractInvoice(
  invoiceId: string,
  fullPath: string,
  mimeType: string
): Promise<ExtractedFields> {
  const ocrBase = getOcrBaseUrl();
  const filename = path.basename(fullPath);

  const emptyScores: Record<string, number> = {
    supplierName: 0,
    supplierVatNumber: 0,
    invoiceNumber: 0,
    invoiceDate: 0,
    currency: 0,
    netAmount: 0,
    vatAmount: 0,
    totalAmount: 0,
  };

  const empty: ExtractedFields = {
    supplierName: null,
    supplierVatNumber: null,
    supplierAddress: null,
    supplierEIK: null,
    clientName: null,
    clientEIK: null,
    clientVatNumber: null,
    invoiceNumber: null,
    invoiceDate: null,
    serviceDescription: null,
    quantity: null,
    unitPrice: null,
    serviceTotal: null,
    accountingAccount: null,
    currency: null,
    netAmount: null,
    vatAmount: null,
    totalAmount: null,
    confidenceScores: { ...emptyScores },
  };

  try {
    // 1) Send file to /ocr (retry on connection errors; new FormData/stream per attempt)
    let ocrRes: { data: OcrResponse };
    let lastErr: unknown;
    for (let attempt = 0; attempt <= OCR_MAX_RETRIES; attempt++) {
      const form = new FormData();
      form.append("file", fs.createReadStream(fullPath), {
        filename,
        contentType: mimeType,
      });
      try {
        ocrRes = await axios.post<OcrResponse>(`${ocrBase}/ocr`, form, {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: OCR_TIMEOUT_MS,
        });
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < OCR_MAX_RETRIES && isRetryableNetworkError(err)) {
          await new Promise((r) => setTimeout(r, OCR_RETRY_DELAY_MS));
          continue;
        }
        throw err;
      }
    }
    if (lastErr !== undefined) {
      throw lastErr;
    }

    const ocrData = ocrRes!.data;

    console.log("ocrData", ocrData);
    if (!ocrData?.pages?.length) {
      return empty;
    }

    const ocrText = ocrData.pages.map((p) => p.text).join("\n");

    // 2) Try rule-based POST /extract first; fallback to LLM POST /extract-invoice
    try {
      const ruleRes = await axios.post<OcrExtractRuleResponse>(`${ocrBase}/extract-invoice`, { ocrText }, { timeout: OCR_TIMEOUT_MS });
      const r = ruleRes.data;
      const scores = r.confidenceScores ?? {};
      return {
        supplierName: r.supplier?.name ?? null,
        supplierVatNumber: r.supplier?.vat ?? null,
        supplierAddress: r.supplier?.address ?? null,
        supplierEIK: r.supplier?.eik ?? null,
        clientName: r.client?.name ?? null,
        clientEIK: r.client?.eik ?? null,
        clientVatNumber: r.client?.vat ?? null,
        invoiceNumber: r.invoiceNumber ?? null,
        invoiceDate: r.invoiceDate ?? null,
        serviceDescription: r.service?.description ?? null,
        quantity: r.service?.quantity ?? null,
        unitPrice: r.service?.unitPrice ?? null,
        serviceTotal: r.service?.total ?? null,
        accountingAccount: r.accountingAccount ?? null,
        currency: r.amounts?.currency ?? null,
        netAmount: r.amounts?.subtotal ?? null,
        vatAmount: r.amounts?.vat ?? null,
        totalAmount: r.amounts?.total ?? null,
        confidenceScores: typeof scores === "object" && scores !== null ? scores : emptyScores,
      };
    } catch (_ruleErr) {
      // TODO: implement fallback logic
      // Fallback: LLM-based /extract-invoice
      const extractRes = await axios.post<OcrExtractInvoiceResponse>(
        `${ocrBase}/extract-llm`,
        { documentId: ocrData.documentId, ocrText },
        { timeout: OCR_TIMEOUT_MS }
      );
      const { fields, confidence } = extractRes.data;
      const confidenceScores: Record<string, number> = {
        supplierName: confidence.supplierName ?? 0,
        supplierVatNumber: 0,
        invoiceNumber: confidence.invoiceNumber ?? 0,
        invoiceDate: 0,
        currency: 0,
        netAmount: 0,
        vatAmount: 0,
        totalAmount: confidence.totalAmount ?? 0,
      };
      return {
        supplierName: fields.supplierName,
        supplierVatNumber: fields.supplierVat,
        supplierAddress: null,
        supplierEIK: null,
        clientName: null,
        clientEIK: null,
        clientVatNumber: null,
        invoiceNumber: fields.invoiceNumber,
        invoiceDate: fields.invoiceDate,
        serviceDescription: null,
        quantity: null,
        unitPrice: null,
        serviceTotal: null,
        accountingAccount: null,
        currency: fields.currency,
        netAmount: fields.netAmount,
        vatAmount: fields.vatAmount,
        totalAmount: fields.totalAmount,
        confidenceScores,
      };
      return empty;
    }
  } catch (err) {
    console.error("extractInvoice: OCR/LLM extraction failed for", invoiceId, err);
    // Fallback to empty structure so API contract is preserved
    return empty;
  }
}

