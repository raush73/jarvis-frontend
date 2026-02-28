"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

// Mock salespeople list
const MOCK_SALESPEOPLE = [
  { id: "SP-001", name: "Jordan Miles" },
  { id: "SP-002", name: "Taylor Brooks" },
  { id: "SP-003", name: "Morgan Chen" },
  { id: "SP-004", name: "Casey Rivera" },
  { id: "SP-005", name: "Alex Nguyen" },
];

// Mock order data
const MOCK_ORDER_DATA: Record<
  string,
  { customer: string; site: string; defaultSalesperson: string }
> = {
  "ORD-2024-001": {
    customer: "Turner Construction",
    site: "Downtown Tower — Los Angeles, CA",
    defaultSalesperson: "SP-001",
  },
  "ORD-2024-002": {
    customer: "Skanska USA",
    site: "Airport Terminal B — Denver, CO",
    defaultSalesperson: "SP-002",
  },
};

const DEFAULT_ORDER_DATA = {
  customer: "Sample Customer",
  site: "Sample Site",
  defaultSalesperson: "SP-001",
};

type SplitRow = {
  id: string;
  salespersonId: string;
  percent: number;
  role: string;
};

const ROLE_OPTIONS = ["Primary", "Secondary", "Referral", "House"];

export default function OrderSalesPage() {
  const params = useParams();
  const orderId = params.id as string;

  const orderData = MOCK_ORDER_DATA[orderId] || DEFAULT_ORDER_DATA;

  const [splits, setSplits] = useState<SplitRow[]>([
    {
      id: "split-1",
      salespersonId: orderData.defaultSalesperson,
      percent: 100,
      role: "Primary",
    },
  ]);

  const totalPercent = splits.reduce((sum, s) => sum + s.percent, 0);
  const isValid = totalPercent === 100;

  const handleSalespersonChange = (id: string, value: string) => {
    setSplits((prev) =>
      prev.map((s) => (s.id === id ? { ...s, salespersonId: value } : s))
    );
  };

  const handlePercentChange = (id: string, value: string) => {
    const numVal = parseFloat(value) || 0;
    setSplits((prev) =>
      prev.map((s) => (s.id === id ? { ...s, percent: numVal } : s))
    );
  };

  const handleRoleChange = (id: string, value: string) => {
    setSplits((prev) =>
      prev.map((s) => (s.id === id ? { ...s, role: value } : s))
    );
  };

  const handleAddRow = () => {
    const newId = `split-${Date.now()}`;
    setSplits((prev) => [
      ...prev,
      { id: newId, salespersonId: "SP-001", percent: 0, role: "Secondary" },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (splits.length <= 1) return;
    setSplits((prev) => prev.filter((s) => s.id !== id));
  };

  const getSalespersonName = (spId: string) =>
    MOCK_SALESPEOPLE.find((sp) => sp.id === spId)?.name || "—";

  return (
    <div className="order-sales-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-info">
          <h1>Sales &amp; Commission Split</h1>
          <div className="order-badge-row">
            <span className="order-id">{orderId}</span>
            <span className="order-customer">{orderData.customer}</span>
            <span className="order-site">{orderData.site}</span>
          </div>
        </div>
      </div>

      {/* Default Salesperson Note */}
      <div className="default-note">
        <span className="note-label">Default from Customer:</span>
        <span className="note-value">
          {getSalespersonName(orderData.defaultSalesperson)}
        </span>
      </div>

      {/* Validation Warning */}
      {!isValid && (
        <div className="warning-banner">
          <span className="warning-icon">⚠</span>
          <span>
            Split total is <strong>{totalPercent}%</strong> — must equal 100%
          </span>
        </div>
      )}

      {/* Commission Split Table */}
      <section className="split-section">
        <div className="section-header">
          <h2>Commission Split</h2>
          <span className="section-note">
            Define how commission is divided among salespeople
          </span>
        </div>

        <div className="split-table-wrap">
          <table className="split-table">
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Split %</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {splits.map((row) => (
                <tr key={row.id}>
                  <td className="split-salesperson">
                    <select
                      value={row.salespersonId}
                      onChange={(e) =>
                        handleSalespersonChange(row.id, e.target.value)
                      }
                    >
                      {MOCK_SALESPEOPLE.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="split-percent">
                    <div className="input-wrap">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={row.percent}
                        onChange={(e) =>
                          handlePercentChange(row.id, e.target.value)
                        }
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </td>
                  <td className="split-role">
                    <select
                      value={row.role}
                      onChange={(e) => handleRoleChange(row.id, e.target.value)}
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="split-actions">
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveRow(row.id)}
                      disabled={splits.length <= 1}
                      title="Remove row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>
                  <button className="add-row-btn" onClick={handleAddRow}>
                    + Add Salesperson
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Total Row */}
        <div className={`total-row ${isValid ? "valid" : "invalid"}`}>
          <span className="total-label">Total Split:</span>
          <span className="total-value">{totalPercent}%</span>
        </div>
      </section>

      {/* Save Footer */}
      <div className="save-footer">
        <span className="ui-only-label">UI-only shell — no persistence</span>
        <button className="save-btn" disabled>
          Save Changes
        </button>
      </div>

      <style jsx>{`
        .order-sales-container {
          padding: 24px 40px 60px;
          max-width: 900px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .header-info h1 {
          font-size: 26px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 12px;
          letter-spacing: -0.5px;
        }

        .order-badge-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .order-id {
          font-family: var(--font-geist-mono), monospace;
          font-size: 13px;
          padding: 4px 10px;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border-radius: 5px;
        }

        .order-customer {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        .order-site {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Default Note */
        .default-note {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .note-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }

        .note-value {
          font-size: 14px;
          color: #fff;
          font-weight: 500;
        }

        /* Warning Banner */
        .warning-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #f59e0b;
        }

        .warning-icon {
          font-size: 16px;
        }

        .warning-banner strong {
          color: #fbbf24;
        }

        /* Split Section */
        .split-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .section-header {
          display: flex;
          align-items: baseline;
          gap: 16px;
          margin-bottom: 20px;
        }

        .section-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .section-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Split Table */
        .split-table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          overflow: hidden;
        }

        .split-table {
          width: 100%;
          border-collapse: collapse;
        }

        .split-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .split-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .split-table th:last-child {
          width: 50px;
        }

        .split-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .split-table tbody tr:last-child td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .split-table tfoot td {
          padding: 12px 16px;
          border-bottom: none;
        }

        .split-salesperson select,
        .split-role select {
          width: 100%;
          padding: 8px 10px;
          font-size: 13px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #fff;
          cursor: pointer;
        }

        .split-salesperson select:focus,
        .split-role select:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .input-wrap {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .input-wrap input {
          width: 70px;
          padding: 8px 10px;
          font-size: 14px;
          font-family: var(--font-geist-mono), monospace;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #fff;
          text-align: right;
        }

        .input-wrap input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .input-suffix {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .remove-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 6px;
          color: #ef4444;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .remove-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
        }

        .remove-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .add-row-btn {
          width: 100%;
          padding: 10px;
          font-size: 13px;
          font-weight: 500;
          color: #3b82f6;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .add-row-btn:hover {
          color: #60a5fa;
        }

        /* Total Row */
        .total-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 16px;
          padding: 12px 16px;
          border-radius: 8px;
        }

        .total-row.valid {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .total-row.invalid {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .total-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .total-value {
          font-size: 16px;
          font-weight: 700;
          font-family: var(--font-geist-mono), monospace;
        }

        .total-row.valid .total-value {
          color: #22c55e;
        }

        .total-row.invalid .total-value {
          color: #ef4444;
        }

        /* Save Footer */
        .save-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 16px;
          margin-top: 24px;
        }

        .ui-only-label {
          font-size: 11px;
          color: rgba(148, 163, 184, 0.7);
          padding: 4px 10px;
          background: rgba(148, 163, 184, 0.1);
          border: 1px dashed rgba(148, 163, 184, 0.25);
          border-radius: 6px;
        }

        .save-btn {
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

