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

function emptyExtractedFields(): ExtractedFields {
  return {
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
}

/** Map rule-style response (ExtractResponse) to ExtractedFields. Used for both vision and legacy rule-based. */
function mapRuleResponseToFields(r: OcrExtractRuleResponse): ExtractedFields {
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
}

/**
 * Legacy extraction: OCR (PaddleOCR) → rule-based POST /extract-invoice.
 * Used when vision endpoint is unavailable (503) or fails.
 */
export async function extractLegacy(
  invoiceId: string,
  fullPath: string,
  mimeType: string
): Promise<ExtractedFields> {
  const ocrBase = getOcrBaseUrl();
  const filename = path.basename(fullPath);
  const empty = emptyExtractedFields();

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
    if (!ocrData?.pages?.length) {
      return empty;
    }

    const ocrText = ocrData.pages.map((p) => p.text).join("\n");

    try {
      const ruleRes = await axios.post<OcrExtractRuleResponse>(`${ocrBase}/extract-invoice`, { ocrText }, { timeout: OCR_TIMEOUT_MS });
      return mapRuleResponseToFields(ruleRes.data);
    } catch (_ruleErr) {
      return empty;
    }
  } catch (err) {
    console.error("extractLegacy: OCR/rule extraction failed for", invoiceId, err);
    return empty;
  }
}

/**
 * Extract invoice fields: tries POST /extract-vision (OpenAI vision + image) first;
 * on 503/500 or other failure falls back to extractLegacy (OCR + rule-based).
 */
export async function extractInvoice(
  invoiceId: string,
  fullPath: string,
  mimeType: string
): Promise<ExtractedFields> {
  const ocrBase = getOcrBaseUrl();
  const filename = path.basename(fullPath);
  const empty = emptyExtractedFields();

  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(fullPath), {
      filename,
      contentType: mimeType,
    });
    const visionRes = await axios.post<OcrExtractRuleResponse>(`${ocrBase}/extract-vision`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: OCR_TIMEOUT_MS,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    return mapRuleResponseToFields(visionRes.data);
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    const useLegacy =
      status === 503 ||
      status === 500 ||
      status === 400 ||
      isRetryableNetworkError(err);
    if (useLegacy) {
      console.log("extractInvoice: vision unavailable or failed, using legacy extraction for", invoiceId);
      return extractLegacy(invoiceId, fullPath, mimeType);
    }
    console.error("extractInvoice: vision request failed for", invoiceId, err);
    return empty;
  }
}

export type InvoiceChatHistoryItem = { role: "user" | "assistant"; content: string };

/** Call ocr-service POST /invoice-chat for accountant Q&A over extraction JSON. */
export async function invoiceChat(
  extraction: Record<string, unknown>,
  message: string,
  history: InvoiceChatHistoryItem[],
  plan: "starter" | "pro" | "enterprise"
): Promise<string> {
  const base = (config.ocrServiceUrl ?? "http://localhost:8000").replace(/\/$/, "");
  const { data } = await axios.post<{ content: string }>(
    `${base}/invoice-chat`,
    { extraction, message, history, plan },
    { timeout: OCR_TIMEOUT_MS }
  );
  return data.content;
}

