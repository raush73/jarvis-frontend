"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type WCStatus = "Active" | "Inactive";

type WCRate = {
  id: string;
  state: string;
  trade: string;
  ratePct: number;
  status: WCStatus;
  effectiveDate: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
};

// Deterministic mock data
const STATES = ["KY", "TN", "IN", "OH"] as const;
const TRADES = ["Millwright", "Welder", "Pipefitter", "Electrician"] as const;

const MOCK_WC_RATES: WCRate[] = [
  {
    id: "WC-001",
    state: "KY",
    trade: "Millwright",
    ratePct: 4.25,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "Standard rate for Kentucky millwright classification.",
  },
  {
    id: "WC-002",
    state: "KY",
    trade: "Welder",
    ratePct: 5.10,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-003",
    state: "KY",
    trade: "Pipefitter",
    ratePct: 4.75,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-004",
    state: "KY",
    trade: "Electrician",
    ratePct: 3.85,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "Lower rate due to classification code.",
  },
  {
    id: "WC-005",
    state: "TN",
    trade: "Millwright",
    ratePct: 3.90,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-006",
    state: "TN",
    trade: "Welder",
    ratePct: 4.65,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-007",
    state: "TN",
    trade: "Pipefitter",
    ratePct: 4.30,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-008",
    state: "TN",
    trade: "Electrician",
    ratePct: 3.50,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-009",
    state: "IN",
    trade: "Millwright",
    ratePct: 4.00,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-010",
    state: "IN",
    trade: "Welder",
    ratePct: 4.85,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-011",
    state: "IN",
    trade: "Pipefitter",
    ratePct: 4.50,
    status: "Inactive",
    effectiveDate: "2025-06-01",
    createdAt: "2025-05-01",
    updatedAt: "2025-12-15",
    notes: "Superseded by updated rate. Kept for audit.",
  },
  {
    id: "WC-012",
    state: "IN",
    trade: "Electrician",
    ratePct: 3.65,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-013",
    state: "OH",
    trade: "Millwright",
    ratePct: 4.40,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "Ohio BWC rate schedule.",
  },
  {
    id: "WC-014",
    state: "OH",
    trade: "Welder",
    ratePct: 5.25,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-015",
    state: "OH",
    trade: "Pipefitter",
    ratePct: 4.90,
    status: "Active",
    effectiveDate: "2026-01-01",
    createdAt: "2025-11-15",
    updatedAt: "2025-12-20",
    notes: "",
  },
  {
    id: "WC-016",
    state: "OH",
    trade: "Electrician",
    ratePct: 3.95,
    status: "Inactive",
    effectiveDate: "2025-01-01",
    createdAt: "2024-11-15",
    updatedAt: "2025-12-01",
    notes: "Old rate. New rate pending entry.",
  },
];

export default function WorkCompRatesPage() {
  // Filter state
  const [stateFilter, setStateFilter] = useState<string>("All");
  const [tradeFilter, setTradeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Modal state
  const [selectedRate, setSelectedRate] = useState<WCRate | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter logic
  const filteredRates = MOCK_WC_RATES.filter((rate) => {
    if (stateFilter !== "All" && rate.state !== stateFilter) return false;
    if (tradeFilter !== "All" && rate.trade !== tradeFilter) return false;
    if (statusFilter !== "All" && rate.status !== statusFilter) return false;
    return true;
  });

  // Status badge style
  const getStatusStyle = (status: WCStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  // State badge style
  const getStateBadgeStyle = (state: string) => {
    switch (state) {
      case "KY":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "TN":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "IN":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" };
      case "OH":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  // Open view/edit modal
  const handleViewRate = (rate: WCRate) => {
    setSelectedRate(rate);
    setIsViewModalOpen(true);
  };

  // Close view modal
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setTimeout(() => setSelectedRate(null), 200);
  };

  return (
    <div className="wc-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Work Comp Rates</h1>
          <p className="subtitle">
            Configure workers&apos; compensation rates by State and Trade. These rates are used for burden and margin calculations.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={() => setIsAddModalOpen(true)}>
            + Add Rate
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="stateFilter">State</label>
          <select
            id="stateFilter"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="All">All States</option>
            {STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="tradeFilter">Trade</label>
          <select
            id="tradeFilter"
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
          >
            <option value="All">All Trades</option>
            {TRADES.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="statusFilter">Status</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="filter-results">
          {filteredRates.length} rate{filteredRates.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Rates Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="rates-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Trade</th>
                <th>WC Rate (%)</th>
                <th>Status</th>
                <th>Effective Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRates.map((rate) => (
                <tr key={rate.id}>
                  <td className="cell-state">
                    <span
                      className="state-badge"
                      style={{
                        backgroundColor: getStateBadgeStyle(rate.state).bg,
                        color: getStateBadgeStyle(rate.state).color,
                        borderColor: getStateBadgeStyle(rate.state).border,
                      }}
                    >
                      {rate.state}
                    </span>
                  </td>
                  <td className="cell-trade">{rate.trade}</td>
                  <td className="cell-rate">{rate.ratePct.toFixed(2)}%</td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(rate.status).bg,
                        color: getStatusStyle(rate.status).color,
                        borderColor: getStatusStyle(rate.status).border,
                      }}
                    >
                      {rate.status}
                    </span>
                  </td>
                  <td className="cell-date">{rate.effectiveDate}</td>
                  <td className="cell-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleViewRate(rate)}
                    >
                      View
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleViewRate(rate)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRates.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No rates match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View/Edit Modal */}
      {isViewModalOpen && selectedRate && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Work Comp Rate</h2>
              <button className="modal-close" onClick={handleCloseViewModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>State</label>
                  <select defaultValue={selectedRate.state}>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Trade</label>
                  <select defaultValue={selectedRate.trade}>
                    {TRADES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>WC Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue={selectedRate.ratePct}
                  />
                </div>

                <div className="form-field">
                  <label>Effective Date</label>
                  <input type="date" defaultValue={selectedRate.effectiveDate} />
                </div>
              </div>

              <div className="form-field">
                <label>Status</label>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${selectedRate.status === "Active" ? "active" : ""}`}
                    type="button"
                  >
                    Active
                  </button>
                  <button
                    className={`toggle-btn ${selectedRate.status === "Inactive" ? "active" : ""}`}
                    type="button"
                  >
                    Inactive
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Notes</label>
                <textarea
                  placeholder="Optional notes..."
                  rows={3}
                  defaultValue={selectedRate.notes}
                />
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">{selectedRate.createdAt}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Updated</span>
                    <span className="audit-value">{selectedRate.updatedAt}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseViewModal}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleCloseViewModal}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Rate Modal (UI shell only) */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Work Comp Rate</h2>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>State</label>
                  <select defaultValue="">
                    <option value="" disabled>
                      Select State
                    </option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Trade</label>
                  <select defaultValue="">
                    <option value="" disabled>
                      Select Trade
                    </option>
                    {TRADES.map((trade) => (
                      <option key={trade} value={trade}>
                        {trade}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>WC Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="e.g. 4.50"
                  />
                </div>

                <div className="form-field">
                  <label>Effective Date</label>
                  <input type="date" />
                </div>
              </div>

              <div className="form-field">
                <label>Status</label>
                <div className="toggle-group">
                  <button className="toggle-btn active" type="button">
                    Active
                  </button>
                  <button className="toggle-btn" type="button">
                    Inactive
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Notes</label>
                <textarea placeholder="Optional notes..." rows={3} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={() => setIsAddModalOpen(false)}>
                Add Rate
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .wc-container {
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
          max-width: 500px;
          line-height: 1.5;
        }

        .header-actions {
          padding-top: 28px;
        }

        .btn-add {
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

        .filter-group select {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: #fff;
          min-width: 140px;
        }

        .filter-group select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .filter-group select option {
          background: #1a1d24;
          color: #fff;
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

        .rates-table {
          width: 100%;
          border-collapse: collapse;
        }

        .rates-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .rates-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .rates-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .rates-table tr:last-child td {
          border-bottom: none;
        }

        .rates-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .state-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .cell-trade {
          font-weight: 500;
          color: #fff !important;
        }

        .cell-rate {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
          color: #fff !important;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
        }

        .cell-date {
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.5) !important;
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
          width: 520px;
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
          min-height: 80px;
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

