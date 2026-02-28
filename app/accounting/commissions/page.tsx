"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

// localStorage key (same as admin)
const CONFIG_KEY = "jarvisPrimeCommissionConfig.v1";

// Locked basis label
const LOCKED_BASIS_LABEL =
  "Trade labor gross margin (REG/OT/DT hours only; excludes per diem/bonus/travel/mob/demob/reimbursements/discounts/credits)";

// Types
type TierConfig = {
  minDays: number;
  maxDays: number | null;
  multiplierPct: number;
};

type CommissionConfig = {
  basis: {
    type: string;
    label: string;
  };
  defaultRatePct: number;
  tiers: TierConfig[];
  salespersonOverrides: Record<string, number>;
};

// Default configuration (same as admin)
const DEFAULT_CONFIG: CommissionConfig = {
  basis: {
    type: "gross_margin",
    label: LOCKED_BASIS_LABEL,
  },
  defaultRatePct: 10,
  tiers: [
    { minDays: 0, maxDays: 40, multiplierPct: 100 },
    { minDays: 41, maxDays: 60, multiplierPct: 75 },
    { minDays: 61, maxDays: 90, multiplierPct: 50 },
    { minDays: 91, maxDays: null, multiplierPct: 0 },
  ],
  salespersonOverrides: {},
};

// Mock commission events with invoice issue date, payment date, gross margin, salesperson
const MOCK_EVENTS = [
  {
    id: "EVT-001",
    invoiceId: "INV-2024-0001",
    customer: "Turner Construction",
    salesperson: "Jordan Miles",
    invoiceIssueDate: "2024-01-10",
    paymentDate: "2024-01-22",
    grossMargin: 12500.0,
    status: "Paid",
  },
  {
    id: "EVT-002",
    invoiceId: "INV-2024-0002",
    customer: "Skanska USA",
    salesperson: "Taylor Brooks",
    invoiceIssueDate: "2024-01-15",
    paymentDate: "2024-02-28",
    grossMargin: 8400.0,
    status: "Paid",
  },
  {
    id: "EVT-003",
    invoiceId: "INV-2024-0003",
    customer: "DPR Construction",
    salesperson: "Steve",
    invoiceIssueDate: "2024-02-01",
    paymentDate: "2024-02-12",
    grossMargin: 7200.0,
    status: "Paid",
  },
  {
    id: "EVT-004",
    invoiceId: "INV-2024-0004",
    customer: "Hensel Phelps",
    salesperson: "Jordan Miles",
    invoiceIssueDate: "2024-02-05",
    paymentDate: "2024-03-20",
    grossMargin: 14200.0,
    status: "Paid",
  },
  {
    id: "EVT-005",
    invoiceId: "INV-2024-0005",
    customer: "Holder Construction",
    salesperson: "Casey Rivera",
    invoiceIssueDate: "2024-02-10",
    paymentDate: "2024-02-20",
    grossMargin: 5100.0,
    status: "Paid",
  },
  {
    id: "EVT-006",
    invoiceId: "INV-2024-0006",
    customer: "McCarthy Building",
    salesperson: "Steve",
    invoiceIssueDate: "2024-01-20",
    paymentDate: "2024-05-15",
    grossMargin: 9800.0,
    status: "Paid",
  },
  {
    id: "EVT-007",
    invoiceId: "INV-2024-0007",
    customer: "Brasfield & Gorrie",
    salesperson: "Taylor Brooks",
    invoiceIssueDate: "2024-02-15",
    paymentDate: "2024-02-28",
    grossMargin: 6300.0,
    status: "Pending",
  },
  {
    id: "EVT-008",
    invoiceId: "INV-2024-0008",
    customer: "Whiting-Turner",
    salesperson: "Jordan Miles",
    invoiceIssueDate: "2024-02-20",
    paymentDate: "2024-03-05",
    grossMargin: 11200.0,
    status: "Pending",
  },
];

type FilterType = "all" | "pending" | "paid";

function loadConfig(): CommissionConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        typeof parsed.defaultRatePct === "number" &&
        Array.isArray(parsed.tiers) &&
        parsed.basis &&
        typeof parsed.salespersonOverrides === "object"
      ) {
        return parsed as CommissionConfig;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

// Calculate days between two date strings
function getDaysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Get tier multiplier for a given number of days
function getTierMultiplier(days: number, tiers: TierConfig[]): number {
  for (const tier of tiers) {
    const inMin = days >= tier.minDays;
    const inMax = tier.maxDays === null || days <= tier.maxDays;
    if (inMin && inMax) {
      return tier.multiplierPct;
    }
  }
  return 0;
}

// Get rate for a salesperson (override or default)
function getRateForSalesperson(
  salesperson: string,
  config: CommissionConfig
): number {
  for (const [name, pct] of Object.entries(config.salespersonOverrides)) {
    if (name.toLowerCase() === salesperson.toLowerCase()) {
      return pct;
    }
  }
  return config.defaultRatePct;
}

// Get Monday of the week for a given date (local time)
function getWeekMonday(dateStr: string): Date {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

// Generate week start key like "wk_2024_02_05"
function getWeekStartKey(dateStr: string): string {
  const monday = getWeekMonday(dateStr);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `wk_${year}_${month}_${day}`;
}

// Generate display label like "Week of Feb 5, 2024"
function getWeekDisplayLabel(weekKey: string): string {
  const parts = weekKey.split("_");
  const year = parseInt(parts[1], 10);
  const month = parseInt(parts[2], 10) - 1;
  const day = parseInt(parts[3], 10);
  const date = new Date(year, month, day);
  return `Week of ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export default function AccountingCommissionsHubPage() {
  const [config, setConfig] = useState<CommissionConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  // Load config on mount
  useEffect(() => {
    const savedConfig = loadConfig();
    setConfig(savedConfig);
    setLoaded(true);
  }, []);

  // Compute commission data for each event
  const computedEvents = useMemo(() => {
    return MOCK_EVENTS.map((evt) => {
      const daysToPaid = getDaysBetween(evt.invoiceIssueDate, evt.paymentDate);
      const tierMultiplierPct = getTierMultiplier(daysToPaid, config.tiers);
      const ratePct = getRateForSalesperson(evt.salesperson, config);
      const earnedCommission =
        evt.grossMargin * (ratePct / 100) * (tierMultiplierPct / 100);

      return {
        ...evt,
        daysToPaid,
        tierMultiplierPct,
        ratePct,
        earnedCommission,
        weekKey: getWeekStartKey(evt.paymentDate),
      };
    });
  }, [config]);

  // Filtered events by status
  const filteredEvents = useMemo(() => {
    return computedEvents.filter((evt) => {
      return filter === "all" || evt.status.toLowerCase() === filter;
    });
  }, [computedEvents, filter]);

  // Group by week, then by salesperson for summary
  const weekSummaries = useMemo(() => {
    // Group by week
    const weekGroups: Record<
      string,
      {
        weekKey: string;
        label: string;
        salespersonSummaries: {
          salesperson: string;
          earnedTotal: number;
          eventCount: number;
        }[];
        weekTotal: number;
      }
    > = {};

    filteredEvents.forEach((evt) => {
      if (!weekGroups[evt.weekKey]) {
        weekGroups[evt.weekKey] = {
          weekKey: evt.weekKey,
          label: getWeekDisplayLabel(evt.weekKey),
          salespersonSummaries: [],
          weekTotal: 0,
        };
      }
    });

    // Group events within each week by salesperson
    filteredEvents.forEach((evt) => {
      const week = weekGroups[evt.weekKey];
      let spSummary = week.salespersonSummaries.find(
        (s) => s.salesperson === evt.salesperson
      );
      if (!spSummary) {
        spSummary = { salesperson: evt.salesperson, earnedTotal: 0, eventCount: 0 };
        week.salespersonSummaries.push(spSummary);
      }
      spSummary.earnedTotal += evt.earnedCommission;
      spSummary.eventCount += 1;
      week.weekTotal += evt.earnedCommission;
    });

    // Sort salespeople alphabetically within each week
    Object.values(weekGroups).forEach((week) => {
      week.salespersonSummaries.sort((a, b) =>
        a.salesperson.localeCompare(b.salesperson)
      );
    });

    // Sort weeks newest first
    const sortedKeys = Object.keys(weekGroups).sort().reverse();
    return sortedKeys.map((key) => weekGroups[key]);
  }, [filteredEvents]);

  // Limit weeks shown if not showing all
  const displayedWeeks = useMemo(() => {
    if (showAllWeeks || weekSummaries.length <= 4) {
      return weekSummaries;
    }
    return weekSummaries.slice(0, 4);
  }, [weekSummaries, showAllWeeks]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  // Grand totals
  const grandTotal = useMemo(() => {
    return filteredEvents.reduce((sum, e) => sum + e.earnedCommission, 0);
  }, [filteredEvents]);

  // Format overrides for display
  const overridesDisplay = useMemo(() => {
    const entries = Object.entries(config.salespersonOverrides);
    if (entries.length === 0) return "None";
    return entries.map(([name, pct]) => `${name}: ${pct}%`).join(", ");
  }, [config.salespersonOverrides]);

  if (!loaded) {
    return (
      <div className="commissions-container">
        <div className="loading">Loading commission data...</div>
        <style jsx>{`
          .commissions-container {
            padding: 24px 40px 60px;
            max-width: 1100px;
            margin: 0 auto;
          }
          .loading {
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="commissions-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/accounting" className="back-link">
            ← Back to Money
          </Link>
          <h1>Commissions Hub</h1>
          <p className="subtitle">
            Weekly payable summaries by salesperson. Click to view detail.
          </p>
        </div>
      </div>

      {/* Config Info (Read-only) */}
      <div className="config-info-box">
        <div className="config-row">
          <span className="config-label">Basis:</span>
          <span className="config-value basis-label">{config.basis.label}</span>
        </div>
        <div className="config-row-inline">
          <div className="config-item">
            <span className="config-label">Default Rate:</span>
            <span className="config-value">{config.defaultRatePct}%</span>
          </div>
          <div className="config-item">
            <span className="config-label">Overrides:</span>
            <span className="config-value">{overridesDisplay}</span>
          </div>
          <Link href="/admin/commissions" className="config-edit-link">
            Edit in Admin →
          </Link>
        </div>
      </div>

      {/* Summary Card */}
      <div className="summary-card-single">
        <span className="card-label">Total Earned (Filtered)</span>
        <span className="card-value">{formatCurrency(grandTotal)}</span>
      </div>

      {/* Filter Row */}
      <div className="controls-row">
        <div className="filters-left">
          <div className="filter-tabs">
            {[
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "paid", label: "Paid" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as FilterType)}
                className={`filter-tab ${filter === tab.key ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {weekSummaries.length > 4 && (
          <button
            className="toggle-weeks-btn"
            onClick={() => setShowAllWeeks(!showAllWeeks)}
          >
            {showAllWeeks ? "Show Last 4 Weeks" : `Show All (${weekSummaries.length})`}
          </button>
        )}
      </div>

      {/* Weekly Summaries */}
      {displayedWeeks.length > 0 ? (
        displayedWeeks.map((week) => (
          <div key={week.weekKey} className="week-section">
            <div className="week-header">
              <span className="week-label">{week.label}</span>
              <span className="week-total">{formatCurrency(week.weekTotal)}</span>
            </div>
            <div className="table-wrap">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Salesperson</th>
                    <th style={{ textAlign: "right" }}>Earned Commission</th>
                    <th style={{ textAlign: "center" }}>Events</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {week.salespersonSummaries.map((sp) => (
                    <tr key={sp.salesperson}>
                      <td className="cell-salesperson">{sp.salesperson}</td>
                      <td className="cell-earned">{formatCurrency(sp.earnedTotal)}</td>
                      <td className="cell-count">{sp.eventCount}</td>
                      <td className="cell-action">
                        <Link
                          href={`/accounting/commissions/${week.weekKey}/${encodeURIComponent(sp.salesperson)}`}
                          className="view-link"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="table-wrap">
          <div className="empty-state">
            No commission events match the selected filter.
          </div>
        </div>
      )}

      {/* Explainer Note */}
      <div className="explainer">
        <span className="explainer-icon">i</span>
        <span>
          <strong>Formula:</strong> Earned = Gross Margin × Rate% × Tier Multiplier%.
          Click "View" to see event-level detail for a salesperson's weekly packet.
        </span>
      </div>

      <style jsx>{`
        .commissions-container {
          padding: 24px 40px 60px;
          max-width: 1100px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 20px;
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
          font-size: 26px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        /* Config Info Box (Read-only) */
        .config-info-box {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          margin-bottom: 20px;
        }

        .config-row {
          margin-bottom: 12px;
        }

        .config-row-inline {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .config-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .config-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .config-value {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 500;
        }

        .config-value.basis-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 400;
          line-height: 1.4;
        }

        .config-edit-link {
          margin-left: auto;
          font-size: 12px;
          color: rgba(59, 130, 246, 0.8);
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .config-edit-link:hover {
          color: #3b82f6;
        }

        /* Summary Card */
        .summary-card-single {
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 24px;
        }

        .card-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-value {
          font-size: 32px;
          font-weight: 700;
          font-family: var(--font-geist-mono), monospace;
          color: #3b82f6;
        }

        /* Controls Row */
        .controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .filters-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .filter-tabs {
          display: flex;
          gap: 8px;
        }

        .filter-tab {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-tab:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .filter-tab.active {
          color: #fff;
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .toggle-weeks-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toggle-weeks-btn:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.15);
        }

        /* Week Section */
        .week-section {
          margin-bottom: 20px;
        }

        .week-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 8px 8px 0 0;
        }

        .week-label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .week-total {
          font-size: 15px;
          font-weight: 700;
          font-family: var(--font-geist-mono), monospace;
          color: #3b82f6;
        }

        .week-section .table-wrap {
          border-top: none;
          border-radius: 0 0 12px 12px;
        }

        /* Table */
        .table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .summary-table {
          width: 100%;
          border-collapse: collapse;
        }

        .summary-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .summary-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .summary-table td {
          padding: 14px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .summary-table tr:last-child td {
          border-bottom: none;
        }

        .cell-salesperson {
          font-weight: 500;
          color: #fff;
        }

        .cell-earned {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
          color: #22c55e;
        }

        .cell-count {
          text-align: center;
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.6);
        }

        .cell-action {
          text-align: center;
        }

        .view-link {
          display: inline-block;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .view-link:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
        }

        /* Explainer */
        .explainer {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 20px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .explainer strong {
          color: rgba(255, 255, 255, 0.7);
        }

        .explainer-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.18);
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
