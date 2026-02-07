import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStats, getInvoices } from "../api/client";
import type { Stats, InvoiceListItem } from "../types/api";

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, list] = await Promise.all([getStats(), getInvoices()]);
        if (!cancelled) {
          setStats(s);
          setInvoices(list);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="card">Loading...</div>;
  if (error) return <div className="card error">Error: {error}</div>;
  if (!stats) return null;

  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Summary</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="value">{stats.total}</div>
            <div className="label">Total Processed</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.approved}</div>
            <div className="label">Approved</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.pending}</div>
            <div className="label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.needs_review}</div>
            <div className="label">Needs Review</div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Invoices</h3>
        {invoices.length === 0 ? (
          <p>No invoices yet. Upload some from the Upload page.</p>
        ) : (
          <ul className="invoice-list">
            {invoices.map((inv) => (
              <li key={inv.id}>
                <Link to={`/invoice/${inv.id}`}>{inv.filename}</Link>
                <span className={`badge badge-${inv.status}`}>{inv.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
