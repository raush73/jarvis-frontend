"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Specialization = { id: string; name: string; isActive: boolean };

type Trade = {
  id: string;
  name: string;
  wcClassCode: string;
  description?: string;
  isActive: boolean;
  specializations?: Specialization[];
};

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch<Trade[]>("/trades?include=structure");
        if (!cancelled) setTrades(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
        setTrades([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    let list = trades;
    if (statusFilter === "active") list = list.filter((t) => t.isActive);
    if (statusFilter === "inactive") list = list.filter((t) => !t.isActive);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.wcClassCode.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [trades, statusFilter, search]);

  return (
    <div className="trades-container">
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">← Back to Admin</Link>
          <h1>Trades</h1>
          <p className="subtitle">
            Define and manage the skilled trades used across Jarvis Prime for orders, quotes, staffing, and compliance.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/admin/trades/new" className="btn-add">+ Add Trade</Link>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="filter-group search-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Search trades…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-results">
          {!loading && !error && `${filtered.length} trade${filtered.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      <div className="table-section">
        <div className="table-wrap">
          <table className="trades-table">
            <thead>
              <tr>
                <th>Trade Name</th>
                <th>WC Class Code</th>
                <th>Specializations</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="empty-row">Loading trades…</td></tr>
              )}
              {!loading && error && (
                <tr><td colSpan={4} className="empty-row">Failed to load trades: {error}</td></tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={4} className="empty-row">No trades found</td></tr>
              )}
              {!loading && !error && filtered.map((trade) => {
                const specCount = trade.specializations?.length ?? 0;
                return (
                  <tr key={trade.id}>
                    <td>
                      <Link href={`/admin/trades/${trade.id}`} className="cell-name trade-link">
                        {trade.name}
                      </Link>
                    </td>
                    <td className="cell-wc-code">{trade.wcClassCode || "—"}</td>
                    <td className="cell-count">{specCount}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: trade.isActive ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.12)",
                          color: trade.isActive ? "#22c55e" : "#6b7280",
                          borderColor: trade.isActive ? "rgba(34,197,94,0.25)" : "rgba(107,114,128,0.25)",
                        }}
                      >
                        {trade.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .trades-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .back-link {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          transition: color 0.15s ease;
          display: inline-block;
          margin-bottom: 12px;
        }
        .back-link:hover { color: #3b82f6; }
        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }
        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.55);
          margin: 0;
          max-width: 520px;
          line-height: 1.5;
        }
        .header-actions { padding-top: 28px; }
        .btn-add {
          display: inline-block;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s ease;
        }
        .btn-add:hover { background: #2563eb; }

        .filters-section {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 20px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .filter-group label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .filter-group select,
        .filter-group input {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: #fff;
          min-width: 140px;
        }
        .filter-group select:focus,
        .filter-group input:focus { outline: none; border-color: #3b82f6; }
        .filter-group select option { background: #1a1d24; color: #fff; }
        .filter-group input::placeholder { color: rgba(255, 255, 255, 0.35); }
        .search-group input { min-width: 220px; }
        .filter-results {
          margin-left: auto;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          padding-bottom: 8px;
        }

        .table-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }
        .table-wrap { overflow-x: auto; }
        .trades-table { width: 100%; border-collapse: collapse; }
        .trades-table thead { background: rgba(255, 255, 255, 0.03); }
        .trades-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .trades-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .trades-table tr:last-child td { border-bottom: none; }
        .trades-table tbody tr:hover { background: rgba(59, 130, 246, 0.04); }
        .cell-name { font-weight: 500; color: #fff !important; }
        .trade-link { color: inherit; text-decoration: none; }
        .trade-link:hover { text-decoration: underline; }
        .cell-wc-code {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px !important;
          color: rgba(139, 92, 246, 0.9) !important;
        }
        .cell-count {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.6) !important;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
        }
        .empty-row {
          text-align: center;
          color: rgba(255, 255, 255, 0.4) !important;
          padding: 32px 16px !important;
        }
      `}</style>
    </div>
  );
}
