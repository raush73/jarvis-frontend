"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type OrderStatus = "Open" | "Closed";

type GmRecord = {
  id: string;
  order: string;
  customer: string;
  salesperson: string;
  estimatedGm: number;
  actualGm: number;
  variance: number;
  status: OrderStatus;
};

// Mock data
const MOCK_GM_DATA: GmRecord[] = [
  { id: "GM-001", order: "ORD-1234", customer: "Acme Construction", salesperson: "Steve Mitchell", estimatedGm: 12500, actualGm: 11800, variance: -700, status: "Closed" },
  { id: "GM-002", order: "ORD-1235", customer: "BuildRight Inc", salesperson: "David Park", estimatedGm: 8200, actualGm: 8450, variance: 250, status: "Closed" },
  { id: "GM-003", order: "ORD-1236", customer: "Metro Builders", salesperson: "Steve Mitchell", estimatedGm: 15800, actualGm: 14200, variance: -1600, status: "Closed" },
  { id: "GM-004", order: "ORD-1237", customer: "Summit Contractors", salesperson: "Marcus Chen", estimatedGm: 6400, actualGm: 0, variance: -6400, status: "Open" },
  { id: "GM-005", order: "ORD-1238", customer: "Precision Plumbing", salesperson: "Angela Torres", estimatedGm: 9100, actualGm: 9350, variance: 250, status: "Closed" },
  { id: "GM-006", order: "ORD-1239", customer: "Tech Campus LLC", salesperson: "David Park", estimatedGm: 22000, actualGm: 0, variance: -22000, status: "Open" },
  { id: "GM-007", order: "ORD-1240", customer: "Harbor View Hotel", salesperson: "Marcus Chen", estimatedGm: 18500, actualGm: 19200, variance: 700, status: "Closed" },
  { id: "GM-008", order: "ORD-1241", customer: "City Hospital", salesperson: "Steve Mitchell", estimatedGm: 31000, actualGm: 0, variance: -31000, status: "Open" },
];

const CUSTOMERS = ["All", "Acme Construction", "BuildRight Inc", "Metro Builders", "Summit Contractors", "Precision Plumbing"];
const SALESPEOPLE = ["All", "Steve Mitchell", "David Park", "Marcus Chen", "Angela Torres"];
const DATE_RANGES = ["This Week", "Last Week", "This Month", "Last Month", "This Quarter", "Custom"];

export default function GrossMarginReportPage() {
  // Filter state (UI only)
  const [dateRange, setDateRange] = useState("This Month");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [salespersonFilter, setSalespersonFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Filter data
  const filteredData = MOCK_GM_DATA.filter((r) => {
    if (customerFilter !== "All" && r.customer !== customerFilter) return false;
    if (salespersonFilter !== "All" && r.salesperson !== salespersonFilter) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    return true;
  });

  // Calculate summary tiles
  const totalEstimatedGm = filteredData.reduce((sum, r) => sum + r.estimatedGm, 0);
  const closedRecords = filteredData.filter((r) => r.status === "Closed");
  const totalActualGm = closedRecords.reduce((sum, r) => sum + r.actualGm, 0);
  const totalRevenue = totalEstimatedGm * 3.5; // Mock revenue multiplier
  const gmPercent = totalRevenue > 0 ? ((totalActualGm / totalRevenue) * 100) : 0;

  // Status badge style
  const getStatusStyle = (status: OrderStatus) => {
    if (status === "Closed") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
  };

  // Variance color
  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "#22c55e";
    if (variance < 0) return "#ef4444";
    return "rgba(255, 255, 255, 0.5)";
  };

  return (
    <div className="report-container">
      {/* UI Shell Banner */}
      <div className="shell-banner">
        UI shell (mocked) — Internal management view — not visible to Sales roles.
      </div>

      {/* Header */}
      <div className="page-header">
        <Link href="/admin" className="back-link">
          ← Back to Admin
        </Link>
        <h1>Gross Margin Report</h1>
        <p className="subtitle">
          Estimated vs actual gross margin analysis by order, customer, and salesperson.
        </p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="dateRange">Date Range</label>
          <select
            id="dateRange"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            {DATE_RANGES.map((range) => (
              <option key={range} value={range}>{range}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="customerFilter">Customer</label>
          <select
            id="customerFilter"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            {CUSTOMERS.map((cust) => (
              <option key={cust} value={cust}>{cust === "All" ? "All Customers" : cust}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="salespersonFilter">Salesperson</label>
          <select
            id="salespersonFilter"
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
          >
            {SALESPEOPLE.map((sp) => (
              <option key={sp} value={sp}>{sp === "All" ? "All Salespeople" : sp}</option>
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
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="summary-tiles">
        <div className="tile">
          <div className="tile-label">Estimated GM $</div>
          <div className="tile-value">${totalEstimatedGm.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Actual GM $</div>
          <div className="tile-value">${totalActualGm.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          <div className="tile-sub">{closedRecords.length} closed orders</div>
        </div>
        <div className="tile">
          <div className="tile-label">GM %</div>
          <div className="tile-value">{gmPercent.toFixed(1)}%</div>
          <div className="tile-sub">of estimated revenue</div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Salesperson</th>
                <th>Estimated GM $</th>
                <th>Actual GM $</th>
                <th>Variance $</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row.id}>
                  <td className="cell-order">{row.order}</td>
                  <td className="cell-customer">{row.customer}</td>
                  <td className="cell-salesperson">{row.salesperson}</td>
                  <td className="cell-estimated">${row.estimatedGm.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="cell-actual">
                    {row.actualGm > 0 
                      ? `$${row.actualGm.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "—"
                    }
                  </td>
                  <td className="cell-variance" style={{ color: getVarianceColor(row.variance) }}>
                    {row.status === "Closed" 
                      ? `${row.variance >= 0 ? "+" : ""}$${row.variance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "—"
                    }
                  </td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(row.status).bg,
                        color: getStatusStyle(row.status).color,
                        borderColor: getStatusStyle(row.status).border,
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No records match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Note */}
      <div className="footer-note">
        Actual GM requires approved hours (future wiring).
      </div>

      <style jsx>{`
        .report-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Shell Banner */
        .shell-banner {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 500;
          color: #f59e0b;
          text-align: center;
          margin-bottom: 24px;
        }

        /* Header */
        .page-header {
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
        }

        /* Filters */
        .filters-section {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 24px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          flex-wrap: wrap;
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

        /* Summary Tiles */
        .summary-tiles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .tile {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }

        .tile-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }

        .tile-value {
          font-size: 24px;
          font-weight: 600;
          color: #fff;
        }

        .tile-sub {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 4px;
        }

        /* Table */
        .table-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
        }

        .report-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .report-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .report-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .report-table tr:last-child td {
          border-bottom: none;
        }

        .report-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .cell-order {
          font-family: monospace;
          font-size: 12px !important;
          color: #3b82f6 !important;
          font-weight: 500;
        }

        .cell-customer {
          font-weight: 500;
          color: #fff !important;
        }

        .cell-salesperson {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .cell-estimated {
          color: rgba(255, 255, 255, 0.8) !important;
        }

        .cell-actual {
          font-weight: 500;
        }

        .cell-variance {
          font-weight: 600;
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

        /* Footer Note */
        .footer-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
