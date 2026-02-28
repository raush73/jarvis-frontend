"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";

// Trade line type
type TradeLine = {
  trade: string;
  projectName: string;
  projectPO: string;
  headcount: number;
  hours: number;
  basePay: number;
  billRate: number;
  otMultiplier: number;
  burdenedPay: number;
  gmPerHr: number;
  gmPct: number;
  health: "Good" | "Watch" | "Risk";
};

// Commission split type
type CommissionSplit = {
  person: string;
  role: string;
  splitPct: number;
};

// Order modifiers type
type OrderModifiers = {
  perDiem: number;
  travel: number;
  bonuses: number;
};

// SD delta rates type
type SDDeltaRates = {
  sdPayDeltaRate: number | null;
  sdBillDeltaRate: number | null;
};

// Order payload type
type OrderPayload = {
  orderId: string;
  customerId: string;
  orderName: string;
  site: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  status: string;
  tradeLines: TradeLine[];
  modifiers: OrderModifiers;
  sdPayDeltaRate?: number | null;
  sdBillDeltaRate?: number | null;
  commissionSplits: CommissionSplit[];
  origin: {
    type: string;
    quoteId?: string;
  };
};

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const customerId = params.id as string;
  const orderId = params.orderId as string;
  const fromQuote = searchParams.get("fromQuote");

  const [order, setOrder] = useState<OrderPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from sessionStorage
    const storageKey = `jp.orderDraft.${customerId}.${orderId}`;
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try {
        setOrder(JSON.parse(stored));
      } catch {
        setOrder(null);
      }
    }
    setLoading(false);
  }, [customerId, orderId]);

  const handleBackToCustomer = () => {
    router.push(`/customers/${customerId}`);
  };

  // Health map for display
  const healthMap: Record<string, "green" | "yellow" | "red"> = {
    Good: "green",
    Watch: "yellow",
    Risk: "red",
  };

  // Calculate overall order health (worst-of trade health)
  const getOverallHealth = (tradeLines: TradeLine[]): "green" | "yellow" | "red" => {
    if (tradeLines.some((t) => t.health === "Risk")) return "red";
    if (tradeLines.some((t) => t.health === "Watch")) return "yellow";
    return "green";
  };

  if (loading) {
    return (
      <div className="order-detail-container">
        <div className="loading-state">Loading...</div>
        <style jsx>{`
          .order-detail-container {
            padding: 24px 40px 60px;
            max-width: 1400px;
            margin: 0 auto;
          }
          .loading-state {
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="order-detail-container">
        <div className="not-found-state">
          <h2>Order Not Found</h2>
          <p>UI-only draft not found in session storage.</p>
          <button className="back-btn-primary" onClick={handleBackToCustomer}>
            Back to Customer
          </button>
        </div>
        <style jsx>{`
          .order-detail-container {
            padding: 24px 40px 60px;
            max-width: 1400px;
            margin: 0 auto;
          }
          .not-found-state {
            text-align: center;
            padding: 60px 20px;
          }
          .not-found-state h2 {
            font-size: 20px;
            font-weight: 600;
            color: #fff;
            margin: 0 0 12px;
          }
          .not-found-state p {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
            margin: 0 0 24px;
          }
          .back-btn-primary {
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 500;
            color: #fff;
            background: #3b82f6;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.15s ease;
          }
          .back-btn-primary:hover {
            background: #2563eb;
          }
        `}</style>
      </div>
    );
  }

  const overallHealth = getOverallHealth(order.tradeLines);
  const totalCommissionPct = order.commissionSplits.reduce((sum, s) => sum + s.splitPct, 0);

  return (
    <div className="order-detail-container">
      {/* Page Header */}
      <div className="page-header">
        <button className="back-btn" onClick={handleBackToCustomer}>
          ← Back to Customer
        </button>
        <div className="header-title">
          <h1>{order.orderName}</h1>
          <span className="order-id-badge">{order.orderId}</span>
          <span className="status-badge draft">{order.status}</span>
          {fromQuote && (
            <span className="origin-badge">Origin: Quote {fromQuote}</span>
          )}
        </div>
      </div>

      {/* Summary Row */}
      <div className="summary-row">
        <div className="summary-item">
          <span className="summary-label">Site / Location</span>
          <span className="summary-value">{order.site || "—"}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Start Date</span>
          <span className="summary-value">
            {order.startDate
              ? new Date(order.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">End Date</span>
          <span className="summary-value">
            {order.endDate
              ? new Date(order.endDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Status</span>
          <span className="summary-value">
            <span className="status-badge-inline draft">{order.status}</span>
            <span className="system-owned-hint">System-owned</span>
          </span>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="notes-section">
          <span className="notes-label">Notes</span>
          <p className="notes-text">{order.notes}</p>
        </div>
      )}

      {/* Trade Lines Section */}
      <div className="detail-section">
        <h2>Trade Lines</h2>
        <div className="trades-table-wrap">
          <table className="trades-table">
            <thead>
              <tr>
                <th>Trade</th>
                <th>Project Name</th>
                <th>Project PO</th>
                <th>Headcount</th>
                <th>Hours</th>
                <th>Base Pay</th>
                <th>Bill Rate</th>
                <th>OT Mult</th>
                <th>Burdened Pay</th>
                <th>GM $/HR</th>
                <th>GM %</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {order.tradeLines.map((line, idx) => (
                <tr key={idx}>
                  <td>{line.trade}</td>
                  <td>{line.projectName || "—"}</td>
                  <td>{line.projectPO || "—"}</td>
                  <td>{line.headcount}</td>
                  <td>{line.hours}</td>
                  <td>${line.basePay}</td>
                  <td>${line.billRate}</td>
                  <td>{line.otMultiplier}</td>
                  <td className="system-owned-cell">${line.burdenedPay}</td>
                  <td className="system-owned-cell">${line.gmPerHr}</td>
                  <td className="system-owned-cell">{line.gmPct}%</td>
                  <td>
                    <span className={`health-dot ${healthMap[line.health]}`} title={line.health} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modifiers Section */}
      <div className="detail-section">
        <h2>Modifiers</h2>
        <div className="modifiers-list">
          <div className="modifier-row">
            <span className="modifier-label">Per Diem</span>
            <span className="modifier-value">${order.modifiers.perDiem}/day</span>
          </div>
          <div className="modifier-row">
            <span className="modifier-label">Travel</span>
            <span className="modifier-value">${order.modifiers.travel}/mi</span>
          </div>
          <div className="modifier-row">
            <span className="modifier-label">Bonuses / Premiums</span>
            <span className="modifier-value">${order.modifiers.bonuses}/hr</span>
          </div>
        </div>
      </div>

      {/* Required Tools (Snapshot) Section */}
      {(() => {
        const tools = (order as any)?.jobRequirements?.tools
          || (order as any)?.requirements?.tools
          || (order as any)?.tools;
        const hasTools = Array.isArray(tools) && tools.length > 0;
        return (
          <div className="detail-section tools-snapshot-section">
            <h2>Required Tools (Snapshot)</h2>
            <p className="tools-helper-text">Tools are shown as a snapshot on the Job Order.</p>
            {hasTools ? (
              <div className="tools-list">
                {tools.map((tool: string, idx: number) => (
                  <span key={idx} className="tool-tag">{tool}</span>
                ))}
              </div>
            ) : (
              <div className="tools-empty-state">
                Tools snapshot is not yet wired to this Job Order Detail view. (UI-only)
              </div>
            )}
          </div>
        );
      })()}

{/* Shift Differential */}
{(order.sdPayDeltaRate !== null && order.sdPayDeltaRate !== undefined) ||
 (order.sdBillDeltaRate !== null && order.sdBillDeltaRate !== undefined) ? (
  <div className="sd-delta-display">
    <h3>Shift Differential</h3>
    <div className="modifiers-list">
      <div className="modifier-row">
        <span className="modifier-label">SD Pay Delta</span>
        <span className="modifier-value">
          {order.sdPayDeltaRate !== null && order.sdPayDeltaRate !== undefined
            ? `$${order.sdPayDeltaRate}/hr`
            : "—"}
        </span>
      </div>
      <div className="modifier-row">
        <span className="modifier-label">SD Bill Delta</span>
        <span className="modifier-value">
          {order.sdBillDeltaRate !== null && order.sdBillDeltaRate !== undefined
            ? `$${order.sdBillDeltaRate}/hr`
            : "—"}
        </span>
      </div>
    </div>
    <p className="sd-helper-text">
      Additive delta applied only to SD hours. Base rates remain on trade lines.
    </p>
  </div>
) : null}

      {/* Commission Splits Section */}
      <div className="detail-section">
        <h2>Commission Splits</h2>
        <div className="commission-table-wrap">
          <table className="commission-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Split %</th>
              </tr>
            </thead>
            <tbody>
              {order.commissionSplits.map((split, idx) => (
                <tr key={idx}>
                  <td>{split.person}</td>
                  <td>{split.role}</td>
                  <td>{split.splitPct}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="total-label">Total</td>
                <td className="total-value">{totalCommissionPct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* System-Owned Placeholders Panel */}
      <div className="system-panel">
        <div className="system-panel-header">
          <span className="system-panel-title">System-Owned Fields</span>
          <span className="system-panel-note">Auto-calculated — display only</span>
        </div>
        <div className="system-rows">
          <div className="system-row">
            <span className="system-label">Order Health</span>
            <span className="system-value health-value">
              <span className={`health-dot-lg ${overallHealth}`} />
              <span>Auto-calculated</span>
            </span>
          </div>
          <div className="system-row">
            <span className="system-label">Burdened Pay</span>
            <span className="system-value placeholder">System-owned placeholder</span>
          </div>
          <div className="system-row">
            <span className="system-label">GM $/HR</span>
            <span className="system-value placeholder">System-owned placeholder</span>
          </div>
          <div className="system-row">
            <span className="system-label">GM %</span>
            <span className="system-value placeholder">System-owned placeholder</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .order-detail-container {
          padding: 24px 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 28px;
        }

        .back-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          margin-bottom: 12px;
          transition: color 0.15s ease;
        }

        .back-btn:hover {
          color: #3b82f6;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .header-title h1 {
          font-size: 24px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .order-id-badge {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          padding: 4px 10px;
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
          border-radius: 6px;
        }

        .status-badge {
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-badge.draft {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .origin-badge {
          font-size: 11px;
          padding: 4px 10px;
          background: rgba(139, 92, 246, 0.15);
          color: #a78bfa;
          border-radius: 6px;
        }

        .summary-row {
          display: flex;
          gap: 32px;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .summary-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          font-size: 14px;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-badge-inline {
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 600;
          border-radius: 10px;
          text-transform: uppercase;
        }

        .status-badge-inline.draft {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .system-owned-hint {
          font-size: 9px;
          color: rgba(245, 158, 11, 0.7);
        }

        .notes-section {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          margin-bottom: 24px;
        }

        .notes-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .notes-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          margin: 8px 0 0;
          line-height: 1.5;
        }

        .detail-section {
          margin-bottom: 24px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .detail-section h2 {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin: 0 0 16px;
        }

        .trades-table-wrap,
        .commission-table-wrap {
          overflow-x: auto;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .trades-table,
        .commission-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .trades-table th,
        .commission-table th {
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .trades-table td,
        .commission-table td {
          padding: 10px 12px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .trades-table tr:last-child td,
        .commission-table tbody tr:last-child td {
          border-bottom: none;
        }

        .system-owned-cell {
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }

        .health-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .health-dot.green {
          background: #22c55e;
        }

        .health-dot.yellow {
          background: #f59e0b;
        }

        .health-dot.red {
          background: #ef4444;
        }

        .commission-table tfoot td {
          padding: 10px 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 600;
        }

        .total-label {
          text-align: right;
          color: rgba(255, 255, 255, 0.7);
        }

        .total-value {
          color: #22c55e;
        }

        .modifiers-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .modifier-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 6px;
        }

        .modifier-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .modifier-value {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
        }

        .sd-delta-display {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .sd-delta-display h3 {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 12px;
        }

        .sd-helper-text {
          margin: 12px 0 0;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }

        .system-panel {
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 12px;
        }

        .system-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .system-panel-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }

        .system-panel-note {
          font-size: 10px;
          color: rgba(245, 158, 11, 0.7);
          font-style: italic;
        }

        .system-rows {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .system-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 6px;
        }

        .system-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .system-value {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .system-value.placeholder {
          font-style: italic;
          color: rgba(255, 255, 255, 0.35);
        }

        .system-value.health-value {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .health-dot-lg {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .health-dot-lg.green {
          background: #22c55e;
        }

        .health-dot-lg.yellow {
          background: #f59e0b;
        }

        .health-dot-lg.red {
          background: #ef4444;
        }

        /* Required Tools (Snapshot) Section */
        .tools-snapshot-section {
          margin-bottom: 24px;
        }

        .tools-helper-text {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          margin: 0 0 12px;
          font-style: italic;
        }

        .tools-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tool-tag {
          display: inline-block;
          padding: 6px 12px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 6px;
        }

        .tools-empty-state {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
          font-style: italic;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
