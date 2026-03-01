"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Trade = {
  id: string;
  name: string;
  wcClassCode: string;
  description?: string;
  isActive: boolean;
};

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiFetch<Trade[]>("/trades");
        if (!cancelled) {
          setTrades(Array.isArray(data) ? data : []);
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ?? String(e);
        setError(msg);
        setTrades([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="trades-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Trades</h1>
          <p className="subtitle">
            Define and manage the skilled trades used across Jarvis Prime for orders, quotes, staffing, and compliance.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/admin/trades/new" className="btn-add">
            + Add Trade
          </Link>
        </div>
      </div>

      {/* Trades Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="trades-table">
            <thead>
              <tr>
                <th>Trade Name</th>
                <th>WC Class Code</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="empty-row">
                    Loading trades…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={3} className="empty-row">
                    Failed to load trades: {error}
                  </td>
                </tr>
              )}
              {!loading && !error && trades.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-row">
                    No trades found
                  </td>
                </tr>
              )}
              {!loading && !error && trades.map((trade) => (
                <tr key={trade.id}>
                  <td>
                    <Link href={`/admin/trades/${trade.id}`} className="cell-name trade-link">
                      {trade.name}
                    </Link>
                  </td>
                  <td className="cell-name">{trade.wcClassCode || "—"}</td>
                  <td>{trade.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
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

        /* Header */
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

        .back-link:hover {
          color: #3b82f6;
        }

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

        .header-actions {
          padding-top: 28px;
        }

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

        .btn-add:hover {
          background: #2563eb;
        }

        /* Filters */
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
        .filter-group input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .filter-group select option {
          background: #1a1d24;
          color: #fff;
        }

        .filter-group input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .search-group input {
          min-width: 220px;
        }

        .filter-results {
          margin-left: auto;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          padding-bottom: 8px;
        }

        /* Table */
        .table-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .trades-table {
          width: 100%;
          border-collapse: collapse;
        }

        .trades-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

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

        .trades-table tr:last-child td {
          border-bottom: none;
        }

        .trades-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .cell-name {
          font-weight: 500;
          color: #fff !important;
        }

        .trade-link {
          color: inherit;
          text-decoration: none;
        }

        .trade-link:hover {
          text-decoration: underline;
        }

        .cell-code {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.6) !important;
        }

        .cell-wc-code {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px !important;
          color: rgba(139, 92, 246, 0.9) !important;
        }

        .category-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
        }

        .cell-actions {
          white-space: nowrap;
        }

        .action-btn {
          padding: 6px 12px;
          margin-right: 8px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .action-btn:last-child {
          margin-right: 0;
        }

        .empty-row {
          text-align: center;
          color: rgba(255, 255, 255, 0.4) !important;
          padding: 32px 16px !important;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal {
          width: 560px;
          max-width: 90%;
          max-height: 90vh;
          background: #12151b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .modal-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-field {
          margin-bottom: 20px;
        }

        .form-field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          color: #fff;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-field input::placeholder,
        .form-field textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-field select option {
          background: #1a1d24;
          color: #fff;
        }

        .form-field textarea {
          resize: vertical;
          min-height: 60px;
        }

        .toggle-group {
          display: flex;
          gap: 0;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          overflow: hidden;
        }

        .toggle-btn {
          flex: 1;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toggle-btn:first-child {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-btn:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .toggle-btn.active {
          color: #fff;
          background: rgba(34, 197, 94, 0.15);
        }

        .audit-section {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          margin-top: 8px;
        }

        .audit-title {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 14px;
        }

        .audit-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .audit-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .audit-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
        }

        .audit-value {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .btn-cancel {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-cancel:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .btn-save {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-save:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
}

