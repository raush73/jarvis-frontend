"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type BurdenScope = "Global" | "State" | "State×Trade";
type BurdenBasis = "Total wages" | "Base wage only";

type BurdenComponent = {
  id: string;
  name: string;
  scope: BurdenScope;
  basis: BurdenBasis;
  followsPremium: boolean;
  includedInGM: boolean;
  ratePct: number | null; // null for WC (managed elsewhere)
  editable: boolean;
  notes: string;
};

type SUTARate = {
  state: string;
  ratePct: number;
};

// Deterministic mock data - Burden Model v1.0 components
const MOCK_BURDEN_COMPONENTS: BurdenComponent[] = [
  {
    id: "BURDEN-001",
    name: "FICA (Employer)",
    scope: "Global",
    basis: "Total wages",
    followsPremium: true,
    includedInGM: true,
    ratePct: 7.65,
    editable: true,
    notes: "Social Security (6.2%) + Medicare (1.45%)",
  },
  {
    id: "BURDEN-002",
    name: "FUTA",
    scope: "Global",
    basis: "Total wages",
    followsPremium: true,
    includedInGM: true,
    ratePct: 0.6,
    editable: true,
    notes: "Federal Unemployment Tax (0.6% after state credit)",
  },
  {
    id: "BURDEN-003",
    name: "SUTA",
    scope: "State",
    basis: "Total wages",
    followsPremium: true,
    includedInGM: true,
    ratePct: null, // State-specific
    editable: false, // Managed in SUTA table below
    notes: "State Unemployment Tax — see state rates below",
  },
  {
    id: "BURDEN-004",
    name: "Workers' Comp",
    scope: "State×Trade",
    basis: "Base wage only",
    followsPremium: false,
    includedInGM: true,
    ratePct: null, // State×Trade specific
    editable: false, // Managed in Work Comp Rates page
    notes: "Managed in Work Comp Rates",
  },
  {
    id: "BURDEN-005",
    name: "Admin / PEO",
    scope: "Global",
    basis: "Total wages",
    followsPremium: true,
    includedInGM: true,
    ratePct: 2.5,
    editable: true,
    notes: "Administrative overhead / PEO fees",
  },
  {
    id: "BURDEN-006",
    name: "GL / Overhead",
    scope: "Global",
    basis: "Total wages",
    followsPremium: true,
    includedInGM: true,
    ratePct: 1.5,
    editable: true,
    notes: "General liability / operational overhead",
  },
  {
    id: "BURDEN-007",
    name: "Bank / Time Value of Money",
    scope: "Global",
    basis: "Total wages",
    followsPremium: true,
    includedInGM: true,
    ratePct: 0.75,
    editable: true,
    notes: "Financing cost / payment timing adjustment",
  },
];

// Mock SUTA rates by state
const MOCK_SUTA_RATES: SUTARate[] = [
  { state: "KY", ratePct: 2.7 },
  { state: "TN", ratePct: 2.5 },
  { state: "IN", ratePct: 2.5 },
  { state: "OH", ratePct: 2.7 },
  { state: "TX", ratePct: 2.7 },
  { state: "CA", ratePct: 3.4 },
  { state: "FL", ratePct: 2.7 },
  { state: "GA", ratePct: 2.64 },
  { state: "NC", ratePct: 1.0 },
  { state: "PA", ratePct: 3.6 },
  { state: "IL", ratePct: 3.175 },
  { state: "MI", ratePct: 2.7 },
];

export default function BurdenSettingsPage() {
  // Local state for editable rates (UI shell only)
  const [editingRates, setEditingRates] = useState<Record<string, number | null>>(() => {
    const initial: Record<string, number | null> = {};
    MOCK_BURDEN_COMPONENTS.forEach((c) => {
      initial[c.id] = c.ratePct;
    });
    return initial;
  });

  // SUTA state
  const [sutaRates, setSutaRates] = useState<SUTARate[]>(MOCK_SUTA_RATES);
  const [sutaSearch, setSutaSearch] = useState("");

  // Filtered SUTA rates
  const filteredSutaRates = sutaRates.filter((s) =>
    s.state.toLowerCase().includes(sutaSearch.toLowerCase())
  );

  // Handle burden rate change (UI shell only)
  const handleRateChange = (id: string, value: string) => {
    const parsed = parseFloat(value);
    setEditingRates((prev) => ({
      ...prev,
      [id]: isNaN(parsed) ? null : parsed,
    }));
  };

  // Handle SUTA rate change (UI shell only)
  const handleSutaChange = (state: string, value: string) => {
    const parsed = parseFloat(value);
    setSutaRates((prev) =>
      prev.map((s) =>
        s.state === state ? { ...s, ratePct: isNaN(parsed) ? 0 : parsed } : s
      )
    );
  };

  // Scope badge style
  const getScopeStyle = (scope: BurdenScope) => {
    switch (scope) {
      case "Global":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "State":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "State×Trade":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  return (
    <div className="burden-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Burden Settings</h1>
          <p className="subtitle">
            Configure employer burden components for standard cost calculations. All rates are percentages.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/admin/burden/preview" className="btn-preview">
            Burden Preview Utility →
          </Link>
        </div>
      </div>

      {/* UI Shell Notice */}
      <div className="shell-notice">
        <span className="shell-icon">ℹ</span>
        <span>UI shell (mocked) — Changes are not persisted. Burden Model v1.0</span>
      </div>

      {/* Burden Components Registry */}
      <div className="section">
        <div className="section-header">
          <h2>Burden Components</h2>
          <span className="section-count">{MOCK_BURDEN_COMPONENTS.length} components</span>
        </div>

        <div className="table-section">
          <div className="table-wrap">
            <table className="burden-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Scope</th>
                  <th>Basis</th>
                  <th>Follows OT/DT Premium</th>
                  <th>Included in GM</th>
                  <th>Rate (%)</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_BURDEN_COMPONENTS.map((component) => (
                  <tr key={component.id} className={component.name === "Workers' Comp" ? "wc-row" : ""}>
                    <td className="cell-name">
                      <div className="name-col">
                        <span className="component-name">{component.name}</span>
                        {component.notes && (
                          <span className="component-notes">{component.notes}</span>
                        )}
                      </div>
                    </td>
                    <td className="cell-scope">
                      <span
                        className="scope-badge"
                        style={{
                          backgroundColor: getScopeStyle(component.scope).bg,
                          color: getScopeStyle(component.scope).color,
                          borderColor: getScopeStyle(component.scope).border,
                        }}
                      >
                        {component.scope}
                      </span>
                    </td>
                    <td className="cell-basis">{component.basis}</td>
                    <td className="cell-premium">
                      <span className={`premium-badge ${component.followsPremium ? "yes" : "no"}`}>
                        {component.followsPremium ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="cell-gm">
                      <span className="gm-badge">Yes</span>
                    </td>
                    <td className="cell-rate">
                      {component.name === "Workers' Comp" ? (
                        <Link href="/admin/safety/work-comp" className="wc-link">
                          Manage in Work Comp Rates →
                        </Link>
                      ) : component.name === "SUTA" ? (
                        <span className="rate-hint">See SUTA table below</span>
                      ) : component.editable ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="rate-input"
                          value={editingRates[component.id] ?? ""}
                          onChange={(e) => handleRateChange(component.id, e.target.value)}
                        />
                      ) : (
                        <span className="rate-value">
                          {editingRates[component.id]?.toFixed(2) ?? "—"}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SUTA Rates by State */}
      <div className="section">
        <div className="section-header">
          <h2>SUTA Rates by State</h2>
          <span className="section-count">{filteredSutaRates.length} states</span>
        </div>

        <div className="suta-filter">
          <label htmlFor="sutaSearch">Filter States</label>
          <input
            id="sutaSearch"
            type="text"
            placeholder="Search state..."
            value={sutaSearch}
            onChange={(e) => setSutaSearch(e.target.value)}
          />
        </div>

        <div className="suta-grid">
          {filteredSutaRates.map((suta) => (
            <div key={suta.state} className="suta-card">
              <div className="suta-state">{suta.state}</div>
              <div className="suta-rate-field">
                <label>Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="20"
                  value={suta.ratePct}
                  onChange={(e) => handleSutaChange(suta.state, e.target.value)}
                />
              </div>
            </div>
          ))}
          {filteredSutaRates.length === 0 && (
            <div className="suta-empty">No states match your filter</div>
          )}
        </div>
      </div>

      {/* Rules Summary */}
      <div className="section rules-section">
        <div className="section-header">
          <h2>Burden Model v1.0 Rules</h2>
        </div>
        <ul className="rules-list">
          <li>Burden is <strong>standard cost</strong> (not actual), used for pricing/margin/commissions.</li>
          <li>Burden outputs are <strong>REG/OT/DT</strong> (no blended rate).</li>
          <li>All burden inputs are <strong>% based</strong> (no flat fees in v1.0).</li>
          <li>All burden rolls into <strong>Gross Margin</strong>.</li>
          <li>FUTA + SUTA wage caps are <strong>intentionally ignored</strong> (simplification for v1.0).</li>
          <li><strong>WC</strong> = base-wage-only; does NOT follow OT/DT premium.</li>
          <li><strong>All others</strong> = total-wage; DO follow OT/DT premium.</li>
        </ul>
      </div>

      <style jsx>{`
        .burden-container {
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

        .btn-preview {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .btn-preview:hover {
          background: rgba(139, 92, 246, 0.25);
          border-color: rgba(139, 92, 246, 0.5);
        }

        /* Shell Notice */
        .shell-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #f59e0b;
        }

        .shell-icon {
          font-size: 16px;
        }

        /* Sections */
        .section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .section-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .section-count {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
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

        .burden-table {
          width: 100%;
          border-collapse: collapse;
        }

        .burden-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .burden-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .burden-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          vertical-align: middle;
        }

        .burden-table tr:last-child td {
          border-bottom: none;
        }

        .burden-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .wc-row {
          background: rgba(139, 92, 246, 0.04);
        }

        .name-col {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .component-name {
          font-weight: 500;
          color: #fff;
        }

        .component-notes {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
        }

        .scope-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .cell-basis {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .premium-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
        }

        .premium-badge.yes {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .premium-badge.no {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .gm-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .rate-input {
          width: 80px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 5px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          text-align: right;
        }

        .rate-input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .rate-value {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 500;
        }

        .rate-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .wc-link {
          font-size: 12px;
          color: #8b5cf6;
          text-decoration: none;
          font-weight: 500;
        }

        .wc-link:hover {
          text-decoration: underline;
        }

        /* SUTA Section */
        .suta-filter {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
          max-width: 220px;
        }

        .suta-filter label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .suta-filter input {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: #fff;
        }

        .suta-filter input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .suta-filter input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .suta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }

        .suta-card {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
        }

        .suta-state {
          font-size: 14px;
          font-weight: 700;
          color: #f59e0b;
          margin-bottom: 10px;
        }

        .suta-rate-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .suta-rate-field label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
        }

        .suta-rate-field input {
          width: 100%;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 5px;
          font-size: 13px;
          color: #fff;
          text-align: right;
        }

        .suta-rate-field input:focus {
          outline: none;
          border-color: #f59e0b;
        }

        .suta-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 24px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
        }

        /* Rules Section */
        .rules-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }

        .rules-section .section-header {
          margin-bottom: 12px;
        }

        .rules-list {
          margin: 0;
          padding: 0 0 0 20px;
        }

        .rules-list li {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.7;
          margin-bottom: 4px;
        }

        .rules-list li strong {
          color: #fff;
        }
      `}</style>
    </div>
  );
}

