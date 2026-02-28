"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type RiskFlag = "Low" | "Med" | "High";
type OrderStatus = "Open" | "Closed";

type WipRecord = {
  id: string;
  order: string;
  customer: string;
  state: string;
  approvedHours: number;
  unapprovedHours: number;
  billedToDate: number;
  wipValue: number;
  riskFlag: RiskFlag;
  status: OrderStatus;
};

// Mock data
const MOCK_WIP_DATA: WipRecord[] = [
  { id: "WIP-001", order: "ORD-1234", customer: "Acme Construction", state: "TX", approvedHours: 120, unapprovedHours: 24, billedToDate: 45000, wipValue: 8500, riskFlag: "Low", status: "Open" },
  { id: "WIP-002", order: "ORD-1236", customer: "Metro Builders", state: "CA", approvedHours: 80, unapprovedHours: 48, billedToDate: 32000, wipValue: 15200, riskFlag: "Med", status: "Open" },
  { id: "WIP-003", order: "ORD-1237", customer: "Summit Contractors", state: "FL", approvedHours: 40, unapprovedHours: 72, billedToDate: 18000, wipValue: 22400, riskFlag: "High", status: "Open" },
  { id: "WIP-004", order: "ORD-1239", customer: "Tech Campus LLC", state: "CA", approvedHours: 200, unapprovedHours: 16, billedToDate: 88000, wipValue: 4800, riskFlag: "Low", status: "Open" },
  { id: "WIP-005", order: "ORD-1241", customer: "City Hospital", state: "TX", approvedHours: 160, unapprovedHours: 64, billedToDate: 72000, wipValue: 19200, riskFlag: "Med", status: "Open" },
  { id: "WIP-006", order: "ORD-1242", customer: "Harbor View Hotel", state: "FL", approvedHours: 96, unapprovedHours: 88, billedToDate: 41000, wipValue: 28600, riskFlag: "High", status: "Open" },
  { id: "WIP-007", order: "ORD-1243", customer: "Industrial Park Co", state: "TX", approvedHours: 240, unapprovedHours: 8, billedToDate: 105000, wipValue: 2400, riskFlag: "Low", status: "Open" },
  { id: "WIP-008", order: "ORD-1244", customer: "Precision Plumbing", state: "TX", approvedHours: 64, unapprovedHours: 32, billedToDate: 28000, wipValue: 9600, riskFlag: "Med", status: "Open" },
];

const CUSTOMERS = ["All", "Acme Construction", "Metro Builders", "Summit Contractors", "Tech Campus LLC", "City Hospital"];
const STATES = ["All", "TX", "CA", "FL", "NY", "IL"];
const DATE_RANGES = ["This Week", "Last Week", "This Month", "Last Month", "This Quarter", "Custom"];

export default function WipReportPage() {
  // Filter state (UI only)
  const [dateRange, setDateRange] = useState("This Month");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<string>("Open");

  // Filter data
  const filteredData = MOCK_WIP_DATA.filter((r) => {
    if (customerFilter !== "All" && r.customer !== customerFilter) return false;
    if (stateFilter !== "All" && r.state !== stateFilter) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    return true;
  });

  // Calculate summary tiles
  const openOrders = filteredData.filter((r) => r.status === "Open").length;
  const totalUnapprovedHours = filteredData.reduce((sum, r) => sum + r.unapprovedHours, 0);
  const totalWipValue = filteredData.reduce((sum, r) => sum + r.wipValue, 0);

  // Risk badge style
  const getRiskStyle = (risk: RiskFlag) => {
    switch (risk) {
      case "Low":
        return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
      case "Med":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "High":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
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
        <h1>WIP Report</h1>
        <p className="subtitle">
          Work-in-progress analysis: unapproved hours, billing status, and risk assessment.
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
          <label htmlFor="stateFilter">State</label>
          <select
            id="stateFilter"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            {STATES.map((state) => (
              <option key={state} value={state}>{state === "All" ? "All States" : state}</option>
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
          <div className="tile-label">Open Orders</div>
          <div className="tile-value">{openOrders}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Unapproved Hours</div>
          <div className="tile-value warning">{totalUnapprovedHours.toLocaleString()}</div>
          <div className="tile-sub">pending approval</div>
        </div>
        <div className="tile">
          <div className="tile-label">WIP Value $</div>
          <div className="tile-value">${totalWipValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          <div className="tile-sub">unbilled work</div>
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
                <th>State</th>
                <th>Approved Hours</th>
                <th>Unapproved Hours</th>
                <th>Billed To Date $</th>
                <th>WIP Value $</th>
                <th>Risk Flag</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row.id}>
                  <td className="cell-order">{row.order}</td>
                  <td className="cell-customer">{row.customer}</td>
                  <td className="cell-state">{row.state}</td>
                  <td className="cell-approved">{row.approvedHours}</td>
                  <td className="cell-unapproved">{row.unapprovedHours}</td>
                  <td className="cell-billed">${row.billedToDate.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="cell-wip">${row.wipValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                  <td className="cell-risk">
                    <span
                      className="risk-badge"
                      style={{
                        backgroundColor: getRiskStyle(row.riskFlag).bg,
                        color: getRiskStyle(row.riskFlag).color,
                        borderColor: getRiskStyle(row.riskFlag).border,
                      }}
                    >
                      {row.riskFlag}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">
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
        WIP is management-only; not visible to Sales roles.
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

        .tile-value.warning {
          color: #f59e0b;
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

        .cell-state {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .cell-approved {
          color: #22c55e !important;
          font-weight: 500;
        }

        .cell-unapproved {
          color: #f59e0b !important;
          font-weight: 500;
        }

        .cell-billed {
          color: rgba(255, 255, 255, 0.8) !important;
        }

        .cell-wip {
          font-weight: 600;
          color: #ef4444 !important;
        }

        .risk-badge {
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
