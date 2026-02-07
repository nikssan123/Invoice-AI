import type { Invoice, InvoiceListItem, Stats, UpdateFieldsPayload, ApprovePayload } from "../types/api";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers as HeadersInit) },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface UploadResponse {
  ids: string[];
  files: { id: string; filename: string }[];
}

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const url = `${API_BASE}/api/invoices/upload`;
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<UploadResponse>;
}

export async function extractInvoice(id: string): Promise<unknown> {
  return request(`/api/invoices/${id}/extract`, { method: "POST" });
}

export async function getInvoice(id: string): Promise<Invoice> {
  return request<Invoice>(`/api/invoices/${id}`);
}

export async function getInvoices(params: { status?: string } = {}): Promise<InvoiceListItem[]> {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  return request<InvoiceListItem[]>(`/api/invoices${q ? `?${q}` : ""}`);
}

export async function getStats(): Promise<Stats> {
  return request<Stats>("/api/invoices/stats");
}

export async function updateInvoiceFields(id: string, fields: UpdateFieldsPayload): Promise<unknown> {
  return request(`/api/invoices/${id}/fields`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

export async function approveInvoice(id: string, payload: ApprovePayload): Promise<unknown> {
  return request(`/api/invoices/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fileUrl(id: string): string {
  return `${API_BASE}/api/invoices/${id}/file`;
}
