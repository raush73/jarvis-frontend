"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type TradeStatus = "Active" | "Inactive";
type TradeCategory = "Mechanical" | "Electrical" | "Structural" | "Other";

type Trade = {
  id: string;
  name: string;
  code: string;
  category: TradeCategory;
  description: string;
  status: TradeStatus;
  notes: string;
  wcClassCode: string; // WC Class Code (Trade metadata) — UI shell only
  createdAt: string;
  updatedAt: string;
};

// Deterministic mock data — MW4H-relevant trades
const CATEGORIES: TradeCategory[] = ["Mechanical", "Electrical", "Structural", "Other"];

const MOCK_TRADES: Trade[] = [
  {
    id: "TRD-001",
    name: "Millwright",
    code: "MILLWRIGHT",
    category: "Mechanical",
    description: "Industrial machinery installation, maintenance, and repair. Alignment and precision work.",
    status: "Active",
    notes: "Core MW4H trade. High demand across all regions.",
    wcClassCode: "3724",
    createdAt: "2025-01-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-002",
    name: "Welder",
    code: "WELDER",
    category: "Mechanical",
    description: "Metal fabrication and joining using various welding processes (MIG, TIG, Stick, Flux-Core).",
    status: "Active",
    notes: "Certifications tracked separately (6G, etc.).",
    wcClassCode: "3620",
    createdAt: "2025-01-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-003",
    name: "Pipefitter",
    code: "PIPEFITTER",
    category: "Mechanical",
    description: "Industrial piping systems installation and maintenance. Process piping and steam systems.",
    status: "Active",
    notes: "",
    wcClassCode: "5183",
    createdAt: "2025-01-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-004",
    name: "Electrician",
    code: "ELECTRICIAN",
    category: "Electrical",
    description: "Electrical systems installation, maintenance, and troubleshooting. Industrial controls.",
    status: "Active",
    notes: "Requires state licensure verification.",
    wcClassCode: "5190",
    createdAt: "2025-01-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-005",
    name: "Crane Operator",
    code: "CRANE_OP",
    category: "Mechanical",
    description: "Operation of mobile and overhead cranes for lifting and rigging operations.",
    status: "Active",
    notes: "NCCCO certification required.",
    wcClassCode: "7219",
    createdAt: "2025-03-01",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-006",
    name: "Ironworker",
    code: "IRONWORKER",
    category: "Structural",
    description: "Structural steel erection, reinforcing steel placement, and metal decking installation.",
    status: "Active",
    notes: "",
    wcClassCode: "5040",
    createdAt: "2025-03-01",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-007",
    name: "Rigger",
    code: "RIGGER",
    category: "Structural",
    description: "Load calculation, rigging equipment selection, and safe lifting operations.",
    status: "Active",
    notes: "Often combined with Millwright or Ironworker skills.",
    wcClassCode: "5057",
    createdAt: "2025-03-01",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-008",
    name: "Instrument Technician",
    code: "INST_TECH",
    category: "Electrical",
    description: "Calibration and maintenance of process control instruments and PLCs.",
    status: "Active",
    notes: "",
    wcClassCode: "3681",
    createdAt: "2025-06-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-009",
    name: "Boilermaker",
    code: "BOILERMAKER",
    category: "Mechanical",
    description: "Fabrication, assembly, and repair of boilers, tanks, and pressure vessels.",
    status: "Active",
    notes: "",
    wcClassCode: "3620",
    createdAt: "2025-06-15",
    updatedAt: "2026-01-20",
  },
  {
    id: "TRD-010",
    name: "Carpenter",
    code: "CARPENTER",
    category: "Structural",
    description: "Forming, framing, and general carpentry for industrial construction.",
    status: "Inactive",
    notes: "Low demand. Kept for historical orders.",
    wcClassCode: "5403",
    createdAt: "2025-01-15",
    updatedAt: "2025-12-01",
  },
];

export default function TradesPage() {
  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal state
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter logic
  const filteredTrades = MOCK_TRADES.filter((trade) => {
    if (categoryFilter !== "All" && trade.category !== categoryFilter) return false;
    if (statusFilter !== "All" && trade.status !== statusFilter) return false;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      if (
        !trade.name.toLowerCase().includes(query) &&
        !trade.code.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  // Category badge style
  const getCategoryStyle = (category: TradeCategory) => {
    switch (category) {
      case "Mechanical":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "Electrical":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "Structural":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" };
      case "Other":
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  // Status badge style
  const getStatusStyle = (status: TradeStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  // Open view/edit modal
  const handleViewTrade = (trade: Trade) => {
    setSelectedTrade(trade);
    setIsViewModalOpen(true);
  };

  // Close view modal
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setTimeout(() => setSelectedTrade(null), 200);
  };

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
          <button className="btn-add" onClick={() => setIsAddModalOpen(true)}>
            + Add Trade
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="categoryFilter">Category</label>
          <select
            id="categoryFilter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
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

        <div className="filter-group search-group">
          <label htmlFor="searchInput">Search</label>
          <input
            id="searchInput"
            type="text"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-results">
          {filteredTrades.length} trade{filteredTrades.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Trades Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="trades-table">
            <thead>
              <tr>
                <th>Trade Name</th>
                <th>Trade Code</th>
                <th>WC Class Code</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade) => (
                <tr key={trade.id}>
                  <td className="cell-name">{trade.name}</td>
                  <td className="cell-code">{trade.code}</td>
                  <td className="cell-wc-code">{trade.wcClassCode || "—"}</td>
                  <td className="cell-category">
                    <span
                      className="category-badge"
                      style={{
                        backgroundColor: getCategoryStyle(trade.category).bg,
                        color: getCategoryStyle(trade.category).color,
                        borderColor: getCategoryStyle(trade.category).border,
                      }}
                    >
                      {trade.category}
                    </span>
                  </td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(trade.status).bg,
                        color: getStatusStyle(trade.status).color,
                        borderColor: getStatusStyle(trade.status).border,
                      }}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <Link
                      href={`/admin/trades/${trade.id}`}
                      className="action-btn"
                    >
                      View
                    </Link>
                    <button
                      className="action-btn"
                      onClick={() => handleViewTrade(trade)}
                    >
                      View/Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTrades.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No trades match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View/Edit Modal */}
      {isViewModalOpen && selectedTrade && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Trade Details</h2>
              <button className="modal-close" onClick={handleCloseViewModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Trade Name</label>
                  <input type="text" defaultValue={selectedTrade.name} />
                </div>

                <div className="form-field">
                  <label>Trade Code / Slug</label>
                  <input type="text" defaultValue={selectedTrade.code} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Category</label>
                  <select defaultValue={selectedTrade.category}>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>WC Class Code (Trade metadata)</label>
                  <input type="text" defaultValue={selectedTrade.wcClassCode} placeholder="e.g. 3724" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Status</label>
                  <div className="toggle-group">
                    <button
                      className={`toggle-btn ${selectedTrade.status === "Active" ? "active" : ""}`}
                      type="button"
                    >
                      Active
                    </button>
                    <button
                      className={`toggle-btn ${selectedTrade.status === "Inactive" ? "active" : ""}`}
                      type="button"
                    >
                      Inactive
                    </button>
                  </div>
                </div>
                <div className="form-field" />
              </div>

              <div className="form-field">
                <label>Description</label>
                <textarea
                  placeholder="Trade description..."
                  rows={2}
                  defaultValue={selectedTrade.description}
                />
              </div>

              <div className="form-field">
                <label>Notes</label>
                <textarea
                  placeholder="Optional internal notes..."
                  rows={2}
                  defaultValue={selectedTrade.notes}
                />
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">{selectedTrade.createdAt}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Updated</span>
                    <span className="audit-value">{selectedTrade.updatedAt}</span>
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

      {/* Add Trade Modal (UI shell only) */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Trade</h2>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Trade Name</label>
                  <input type="text" placeholder="e.g., Millwright" />
                </div>

                <div className="form-field">
                  <label>Trade Code / Slug</label>
                  <input type="text" placeholder="e.g., MILLWRIGHT" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Category</label>
                  <select defaultValue="">
                    <option value="" disabled>
                      Select Category
                    </option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>WC Class Code (Trade metadata)</label>
                  <input type="text" placeholder="e.g. 3724" />
                </div>
              </div>

              <div className="form-row">
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
                <div className="form-field" />
              </div>

              <div className="form-field">
                <label>Description</label>
                <textarea
                  placeholder="Trade description..."
                  rows={2}
                />
              </div>

              <div className="form-field">
                <label>Notes</label>
                <textarea
                  placeholder="Optional internal notes..."
                  rows={2}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={() => setIsAddModalOpen(false)}>
                Add Trade
              </button>
            </div>
          </div>
        </div>
      )}

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

