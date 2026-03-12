"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

type Trade = {
  id: string;
  name: string;
  wcClassCode: string;
  isActive: boolean;
};

type BurdenRateSet = {
  id: string;
  state: string;
  tradeCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  wcRate: number | null;
  glRate: number | null;
  sutaRate: number | null;
  futaRate: number | null;
  ficaRate: number | null;
  createdAt: string;
  updatedAt: string;
};

type WCStatus = "Active" | "Inactive";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("jp_accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function deriveStatus(row: BurdenRateSet): WCStatus {
  if (!row.effectiveTo) return "Active";
  return new Date(row.effectiveTo) > new Date() ? "Active" : "Inactive";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export default function WorkCompRatesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [rates, setRates] = useState<BurdenRateSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [stateFilter, setStateFilter] = useState<string>("All");
  const [tradeFilter, setTradeFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const [selectedRate, setSelectedRate] = useState<BurdenRateSet | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editWcRate, setEditWcRate] = useState("");
  const [editEffectiveTo, setEditEffectiveTo] = useState("");

  const [addState, setAddState] = useState("");
  const [addTradeCode, setAddTradeCode] = useState("");
  const [addWcRate, setAddWcRate] = useState("");
  const [addEffectiveFrom, setAddEffectiveFrom] = useState("");

    const distinctStates = useMemo(() => { const set = new Set(rates.map((r) => r.state)); return Array.from(set).sort(); }, [rates]);

  const distinctTradeCodes = useMemo(() => {
    const set = new Set(rates.map((r) => r.tradeCode));
    return Array.from(set).sort();
  }, [rates]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = { ...getAuthHeaders() };
      const [tradesRes, ratesRes] = await Promise.all([
        fetch("/api/trades", { headers, cache: "no-store" }),
        fetch("/api/burden-rate-sets", { headers, cache: "no-store" }),
      ]);
      if (tradesRes.ok) {
        setTrades(await tradesRes.json());
      }
      if (ratesRes.ok) {
        setRates(await ratesRes.json());
      }
    } catch {
      // network error -- leave empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRates = useMemo(() => {
    return rates.filter((row) => {
      if (stateFilter !== "All" && row.state !== stateFilter) return false;
      if (tradeFilter !== "All" && row.tradeCode !== tradeFilter) return false;
      if (statusFilter !== "All" && deriveStatus(row) !== statusFilter) return false;
      return true;
    });
  }, [rates, stateFilter, tradeFilter, statusFilter]);

  const getStatusStyle = (status: WCStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

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

  const openEditModal = (row: BurdenRateSet) => {
    setSelectedRate(row);
    setEditWcRate(row.wcRate != null ? String(row.wcRate) : "");
    setEditEffectiveTo(fmtDate(row.effectiveTo));
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setTimeout(() => setSelectedRate(null), 200);
  };

  const handleSaveEdit = async () => {
    if (!selectedRate) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      const newWc = parseFloat(editWcRate);
      if (!isNaN(newWc) && newWc !== selectedRate.wcRate) {
        body.wcRate = newWc;
      }
      const newTo = editEffectiveTo || null;
      const oldTo = fmtDate(selectedRate.effectiveTo) || null;
      if (newTo !== oldTo) {
        body.effectiveTo = newTo;
      }
      if (Object.keys(body).length === 0) {
        closeEditModal();
        return;
      }
      const res = await fetch(`/api/burden-rate-sets/${selectedRate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await loadData();
        closeEditModal();
      }
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setAddState("");
    setAddTradeCode("");
    setAddWcRate("");
    setAddEffectiveFrom("");
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleSaveAdd = async () => {
    if (!addState || !addTradeCode || !addWcRate || !addEffectiveFrom) return;
    setSaving(true);
    try {
      const res = await fetch("/api/burden-rate-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          state: addState,
          tradeCode: addTradeCode,
          effectiveFrom: addEffectiveFrom,
          wcRate: parseFloat(addWcRate),
        }),
      });
      if (res.ok) {
        await loadData();
        closeAddModal();
      }
    } finally {
      setSaving(false);
    }
  };

  const activeTrades = trades.filter((t) => t.isActive);

  const codeToTrades = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of trades) {
      const code = (t.wcClassCode || "").trim();
      if (!code) continue;
      if (!map[code]) map[code] = [];
      map[code].push(t.name);
    }
    for (const code of Object.keys(map)) {
      map[code] = Array.from(new Set(map[code])).sort();
    }
    return map;
  }, [trades]);

  return (
    <div className="wc-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            &larr; Back to Admin
          </Link>
          <h1>Work Comp Rates</h1>
          <p className="subtitle">
            Configure workers&apos; compensation rates by State and WC Class Code. These rates are used for burden and margin calculations.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={openAddModal}>
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
            {distinctStates.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="tradeFilter">WC Class Code</label>
          <select
            id="tradeFilter"
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
          >
            <option value="All">All Codes</option>
            {distinctTradeCodes.map((tc) => (
              <option key={tc} value={tc}>
                {tc}
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
          {isLoading ? "Loading..." : `${filteredRates.length} rate${filteredRates.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Rates Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="rates-table">
            <thead>
              <tr>
                <th>State</th>
                <th>Code</th>                <th>Trades</th>                <th>WC Rate (%)</th>
                <th>Status</th>
                <th>Effective From</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRates.map((row) => {
                const status = deriveStatus(row);
                return (
                  <tr key={row.id}>
                    <td className="cell-state">
                      <span
                        className="state-badge"
                        style={{
                          backgroundColor: getStateBadgeStyle(row.state).bg,
                          color: getStateBadgeStyle(row.state).color,
                          borderColor: getStateBadgeStyle(row.state).border,
                        }}
                      >
                        {row.state}
                      </span>
                    </td>
                    <td className="cell-trade">{row.tradeCode}</td>                    <td className="cell-trades">{(codeToTrades[row.tradeCode] || []).join(", ") || "-"}</td>                    <td className="cell-rate">{row.wcRate != null ? row.wcRate.toFixed(2) + "%" : "-"}</td>
                    <td className="cell-status">
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor: getStatusStyle(status).bg,
                          color: getStatusStyle(status).color,
                          borderColor: getStatusStyle(status).border,
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="cell-date">{fmtDate(row.effectiveFrom)}</td>
                    <td className="cell-actions">
                      <button className="action-btn" onClick={() => openEditModal(row)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filteredRates.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {rates.length === 0 ? "No Work Comp rates yet. Click \"+ Add Rate\" to create one." : "No rates match your filters"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && selectedRate && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Work Comp Rate</h2>
              <button className="modal-close" onClick={closeEditModal}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>State</label>
                  <input type="text" value={selectedRate.state} readOnly className="readonly" />
                </div>
                <div className="form-field">
                  <label>WC Class Code</label>
                  <input
                    type="text"
                    value={selectedRate.tradeCode}
                    readOnly
                    className="readonly"
                  />
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
                    value={editWcRate}
                    onChange={(e) => setEditWcRate(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Effective From</label>
                  <input type="text" value={fmtDate(selectedRate.effectiveFrom)} readOnly className="readonly" />
                </div>
              </div>

              <div className="form-field">
                <label>Effective To (leave empty for active)</label>
                <input
                  type="date"
                  value={editEffectiveTo}
                  onChange={(e) => setEditEffectiveTo(e.target.value)}
                />
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">{fmtDate(selectedRate.createdAt)}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Updated</span>
                    <span className="audit-value">{fmtDate(selectedRate.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeEditModal}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Rate Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Work Comp Rate</h2>
              <button className="modal-close" onClick={closeAddModal}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>State</label>
                  <select value={addState} onChange={(e) => setAddState(e.target.value)}>
                    <option value="" disabled>Select State</option>
                    {distinctStates.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>

                <div className="form-field">
                  <label>WC Class Code</label>
                  <select value={addTradeCode} onChange={(e) => setAddTradeCode(e.target.value)}>
                    <option value="" disabled>Select Code</option>
                    {activeTrades.map((t) => (
                      <option key={t.id} value={t.wcClassCode}>
                        {t.wcClassCode}
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
                    value={addWcRate}
                    onChange={(e) => setAddWcRate(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Effective From</label>
                  <input
                    type="date"
                    value={addEffectiveFrom}
                    onChange={(e) => setAddEffectiveFrom(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeAddModal}>
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleSaveAdd}
                disabled={saving || !addState || !addTradeCode || !addWcRate || !addEffectiveFrom}
              >
                {saving ? "Saving..." : "Add Rate"}
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

        .cell-trades {
          color: rgba(255, 255, 255, 0.72) !important;
          max-width: 280px;
          white-space: normal;
          line-height: 1.35;
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

        .form-field .readonly {
          opacity: 0.5;
          cursor: not-allowed;
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

        .btn-save:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}





