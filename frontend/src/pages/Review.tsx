import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { getInvoice, extractInvoice, updateInvoiceFields, approveInvoice, fileUrl } from "../api/client";
import type { Invoice } from "../types/api";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const FIELD_KEYS = [
  "supplierName",
  "supplierVatNumber",
  "invoiceNumber",
  "invoiceDate",
  "currency",
  "netAmount",
  "vatAmount",
  "totalAmount",
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

const LABELS: Record<FieldKey, string> = {
  supplierName: "Supplier Name",
  supplierVatNumber: "Supplier VAT Number",
  invoiceNumber: "Invoice Number",
  invoiceDate: "Invoice Date",
  currency: "Currency",
  netAmount: "Net Amount",
  vatAmount: "VAT Amount",
  totalAmount: "Total Amount",
};

type FormState = Partial<Record<FieldKey, string>>;

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getInvoice(id);
      setInvoice(data);
      if (data.fields) {
        setForm({
          supplierName: data.fields.supplierName ?? "",
          supplierVatNumber: data.fields.supplierVatNumber ?? "",
          invoiceNumber: data.fields.invoiceNumber ?? "",
          invoiceDate: data.fields.invoiceDate ?? "",
          currency: data.fields.currency ?? "",
          netAmount: data.fields.netAmount != null ? String(data.fields.netAmount) : "",
          vatAmount: data.fields.vatAmount != null ? String(data.fields.vatAmount) : "",
          totalAmount: data.fields.totalAmount != null ? String(data.fields.totalAmount) : "",
        });
      } else {
        setForm(Object.fromEntries(FIELD_KEYS.map((k) => [k, ""])) as FormState);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onFieldChange = (key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveFields = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string | number> = { ...form };
      if (payload.netAmount !== "" && payload.netAmount !== undefined)
        payload.netAmount = parseFloat(String(payload.netAmount));
      if (payload.vatAmount !== "" && payload.vatAmount !== undefined)
        payload.vatAmount = parseFloat(String(payload.vatAmount));
      if (payload.totalAmount !== "" && payload.totalAmount !== undefined)
        payload.totalAmount = parseFloat(String(payload.totalAmount));
      await updateInvoiceFields(id, payload);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runExtract = async () => {
    if (!id) return;
    setExtracting(true);
    setError(null);
    try {
      await extractInvoice(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const handleApprove = async (action: "approved" | "needs_review") => {
    if (!id) return;
    setApproving(true);
    setError(null);
    try {
      await approveInvoice(id, { approvedBy: "user", action });
      setInvoice((prev) => (prev ? { ...prev, status: action } : null));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) return <div className="card">Loading...</div>;
  if (error && !invoice) return <div className="card error">Error: {error}</div>;
  if (!invoice) return null;

  const confidenceScores = invoice.fields?.confidenceScores || {};
  const isApproved = invoice.status === "approved";
  const isImage = invoice.filename && /\.(png|jpg|jpeg|gif|webp)$/i.test(invoice.filename);
  const fileSrc = id ? fileUrl(id) : "";

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>{invoice.filename}</h2>
        <span className={`badge badge-${invoice.status}`}>{invoice.status.replace("_", " ")}</span>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="review-layout">
        <div>
          <h3 style={{ marginTop: 0 }}>Preview</h3>
          <div className="preview-box">
            {isImage ? (
              <img src={fileSrc} alt="Invoice" />
            ) : (
              <Document file={fileSrc}>
                <Page
                  pageNumber={1}
                  className="pdf-page"
                  width={Math.min(560, typeof window !== "undefined" ? window.innerWidth - 80 : 560)}
                />
              </Document>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Extracted fields</h3>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            Fields marked with confidence were extracted by AI/OCR. You can edit and save until approved.
          </p>
          {!invoice.fields && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={runExtract}
              disabled={extracting}
              style={{ marginBottom: "1rem" }}
            >
              {extracting ? "Extracting..." : "Extract fields (mock)"}
            </button>
          )}
          {FIELD_KEYS.map((key) => (
            <div key={key} className="form-row">
              <label>{LABELS[key]}</label>
              <input
                type={key.includes("Date") ? "date" : key.includes("Amount") ? "number" : "text"}
                step={key.includes("Amount") ? "0.01" : undefined}
                value={form[key] ?? ""}
                onChange={(e) => onFieldChange(key, e.target.value)}
                disabled={isApproved}
              />
              {confidenceScores[key] != null && (
                <span className="confidence" title="Confidence">
                  {Math.round(confidenceScores[key] * 100)}%
                </span>
              )}
            </div>
          ))}
          {!isApproved && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={saveFields}
              disabled={saving}
              style={{ marginRight: "0.5rem" }}
            >
              {saving ? "Saving..." : "Save edits"}
            </button>
          )}
          {!isApproved && (
            <>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => handleApprove("approved")}
                disabled={approving}
                style={{ marginRight: "0.5rem" }}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => handleApprove("needs_review")}
                disabled={approving}
              >
                Flag for review
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
