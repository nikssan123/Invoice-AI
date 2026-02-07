import { useState, FormEvent, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFiles, extractInvoice } from "../api/client";

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(
      (f) =>
        /\.(pdf|png|jpg|jpeg|gif|webp)$/i.test(f.name) ||
        f.type.startsWith("image/") ||
        f.type === "application/pdf"
    );
    setFiles(valid);
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError("Select at least one PDF or image file.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { ids } = await uploadFiles(files);
      for (const id of ids) {
        try {
          await extractInvoice(id);
        } catch (_) {}
      }
      if (ids.length === 1) navigate(`/invoice/${ids[0]}`);
      else navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Upload Invoices</h2>
      <form onSubmit={onSubmit}>
        <label className="upload-zone">
          <input type="file" multiple accept=".pdf,image/*" onChange={onFileChange} />
          {files.length ? `${files.length} file(s) selected` : "Click or drop PDF / image files here"}
        </label>
        {files.length > 0 && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#6b7280" }}>
            {files.map((f) => f.name).join(", ")}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: "1rem" }}
          disabled={uploading || files.length === 0}
        >
          {uploading ? "Uploading..." : "Upload & Extract"}
        </button>
      </form>
    </div>
  );
}
