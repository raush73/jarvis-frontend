"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type WorkCompRecord = {
  id: string;
  period: string;
  state: string;
  trade: string;
  jobSite: string;
  order: string;
  hours: number;
  wcRate: number;
  wcBurden: number;
};

// Mock data
const MOCK_WC_DATA: WorkCompRecord[] = [
  { id: "WC-001", period: "2026-W05", state: "TX", trade: "Electrician", jobSite: "Downtown Tower", order: "ORD-1234", hours: 120, wcRate: 4.25, wcBurden: 1836.00 },
  { id: "WC-002", period: "2026-W05", state: "TX", trade: "Plumber", jobSite: "Metro Mall", order: "ORD-1235", hours: 80, wcRate: 3.80, wcBurden: 1094.40 },
  { id: "WC-003", period: "2026-W05", state: "CA", trade: "Electrician", jobSite: "Tech Campus", order: "ORD-1236", hours: 160, wcRate: 5.10, wcBurden: 2937.60 },
  { id: "WC-004", period: "2026-W05", state: "FL", trade: "HVAC", jobSite: "Beach Resort", order: "ORD-1237", hours: 96, wcRate: 4.50, wcBurden: 1555.20 },
  { id: "WC-005", period: "2026-W04", state: "TX", trade: "Welder", jobSite: "Industrial Park", order: "ORD-1230", hours: 200, wcRate: 6.20, wcBurden: 4464.00 },
  { id: "WC-006", period: "2026-W04", state: "CA", trade: "Plumber", jobSite: "Office Complex", order: "ORD-1231", hours: 64, wcRate: 4.10, wcBurden: 944.64 },
  { id: "WC-007", period: "2026-W04", state: "TX", trade: "Electrician", jobSite: "Hospital Wing", order: "ORD-1232", hours: 144, wcRate: 4.25, wcBurden: 2203.20 },
  { id: "WC-008", period: "2026-W04", state: "FL", trade: "Electrician", jobSite: "Condo Project", order: "ORD-1233", hours: 88, wcRate: 4.80, wcBurden: 1520.64 },
];

const STATES = ["All", "TX", "CA", "FL", "NY", "IL"];
const TRADES = ["All", "Electrician", "Plumber", "HVAC", "Welder", "Carpenter"];
const GROUP_BY_OPTIONS = ["Job Site", "Customer", "Trade"];
const DATE_RANGES = ["This Week", "Last Week", "This Month", "Last Month", "Custom"];

export default function WorkCompReportPage() {
  // Filter state (UI only)
  const [dateRange, setDateRange] = useState("This Week");
  const [stateFilter, setStateFilter] = useState("All");
  const [tradeFilter, setTradeFilter] = useState("All");
  const [groupBy, setGroupBy] = useState("Job Site");

  // Calculate summary tiles
  const totalWcBurden = MOCK_WC_DATA.reduce((sum, r) => sum + r.wcBurden, 0);
  const stateGroups = MOCK_WC_DATA.reduce((acc, r) => {
    acc[r.state] = (acc[r.state] || 0) + r.wcBurden;
    return acc;
  }, {} as Record<string, number>);
  const topState = Object.entries(stateGroups).sort((a, b) => b[1] - a[1])[0];
  const tradeGroups = MOCK_WC_DATA.reduce((acc, r) => {
    acc[r.trade] = (acc[r.trade] || 0) + r.wcBurden;
    return acc;
  }, {} as Record<string, number>);
  const topTrade = Object.entries(tradeGroups).sort((a, b) => b[1] - a[1])[0];

  // Filter data (UI only - just for show)
  const filteredData = MOCK_WC_DATA.filter((r) => {
    if (stateFilter !== "All" && r.state !== stateFilter) return false;
    if (tradeFilter !== "All" && r.trade !== tradeFilter) return false;
    return true;
  });

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
        <h1>Work Comp Report</h1>
        <p className="subtitle">
          Workers&apos; compensation burden analysis by state, trade, and job site.
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
          <label htmlFor="tradeFilter">Trade</label>
          <select
            id="tradeFilter"
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
          >
            {TRADES.map((trade) => (
              <option key={trade} value={trade}>{trade === "All" ? "All Trades" : trade}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="groupBy">Group By</label>
          <select
            id="groupBy"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
          >
            {GROUP_BY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="summary-tiles">
        <div className="tile">
          <div className="tile-label">Total WC Burden (Period)</div>
          <div className="tile-value">${totalWcBurden.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Top State by WC</div>
          <div className="tile-value">{topState[0]}</div>
          <div className="tile-sub">${topState[1].toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Top Trade by WC</div>
          <div className="tile-value">{topTrade[0]}</div>
          <div className="tile-sub">${topTrade[1].toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>State</th>
                <th>Trade</th>
                <th>Job Site / Order</th>
                <th>Hours</th>
                <th>WC Rate %</th>
                <th>WC Burden $</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => (
                <tr key={row.id}>
                  <td className="cell-period">{row.period}</td>
                  <td className="cell-state">{row.state}</td>
                  <td className="cell-trade">{row.trade}</td>
                  <td className="cell-site">
                    <span className="site-name">{row.jobSite}</span>
                    <span className="order-id">{row.order}</span>
                  </td>
                  <td className="cell-hours">{row.hours}</td>
                  <td className="cell-rate">{row.wcRate.toFixed(2)}%</td>
                  <td className="cell-burden">${row.wcBurden.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
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
        Powered by approved snapshots (future wiring).
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

        .cell-period {
          font-family: monospace;
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.6) !important;
        }

        .cell-state {
          font-weight: 600;
          color: #3b82f6 !important;
        }

        .cell-trade {
          color: rgba(255, 255, 255, 0.8) !important;
        }

        .cell-site {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .site-name {
          font-weight: 500;
          color: #fff;
        }

        .order-id {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-family: monospace;
        }

        .cell-hours {
          font-weight: 500;
        }

        .cell-rate {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .cell-burden {
          font-weight: 600;
          color: #22c55e !important;
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
