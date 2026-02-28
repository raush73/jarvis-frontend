"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
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

// Mock commission events (same as hub)
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    Pending: {
      background: "rgba(245, 158, 11, 0.15)",
      color: "#f59e0b",
      border: "1px solid rgba(245, 158, 11, 0.3)",
    },
    Paid: {
      background: "rgba(34, 197, 94, 0.15)",
      color: "#22c55e",
      border: "1px solid rgba(34, 197, 94, 0.3)",
    },
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: "5px",
        fontSize: "11px",
        fontWeight: 600,
        ...styles[status],
      }}
    >
      {status}
    </span>
  );
}

export default function CommissionDetailPage() {
  const params = useParams();
  const weekKey = params.weekKey as string;
  const salespersonKey = decodeURIComponent(params.salespersonKey as string);

  const [config, setConfig] = useState<CommissionConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

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

  // Filter to matching week and salesperson
  const filteredEvents = useMemo(() => {
    return computedEvents.filter((evt) => {
      const weekMatch = evt.weekKey === weekKey;
      const spMatch = evt.salesperson.toLowerCase() === salespersonKey.toLowerCase();
      const statusMatch = filter === "all" || evt.status.toLowerCase() === filter;
      return weekMatch && spMatch && statusMatch;
    });
  }, [computedEvents, weekKey, salespersonKey, filter]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const totalEarned = useMemo(() => {
    return filteredEvents.reduce((sum, e) => sum + e.earnedCommission, 0);
  }, [filteredEvents]);

  const weekLabel = getWeekDisplayLabel(weekKey);

  if (!loaded) {
    return (
      <div className="detail-container">
        <div className="loading">Loading commission data...</div>
        <style jsx>{`
          .detail-container {
            padding: 24px 40px 60px;
            max-width: 1200px;
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
    <div className="detail-container">
      {/* Header */}
      <div className="page-header">
        <Link href="/accounting/commissions" className="back-link">
          ← Back to Commissions Hub
        </Link>
        <h1>{salespersonKey}</h1>
        <p className="subtitle">{weekLabel}</p>
      </div>

      {/* Summary Card */}
      <div className="summary-row">
        <div className="summary-card">
          <span className="card-label">Total Earned</span>
          <span className="card-value">{formatCurrency(totalEarned)}</span>
        </div>
        <div className="summary-card secondary">
          <span className="card-label">Events</span>
          <span className="card-value-sm">{filteredEvents.length}</span>
        </div>
        <div className="summary-card secondary">
          <span className="card-label">Rate Applied</span>
          <span className="card-value-sm">
            {getRateForSalesperson(salespersonKey, config)}%
          </span>
        </div>
      </div>

      {/* Filter */}
      <div className="controls-row">
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

      {/* Detail Table */}
      <div className="table-wrap">
        {filteredEvents.length > 0 ? (
          <table className="detail-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Issue Date</th>
                <th>Payment Date</th>
                <th>Days-to-Paid</th>
                <th>Tier %</th>
                <th>Rate %</th>
                <th>Gross Margin</th>
                <th style={{ textAlign: "right" }}>Earned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt) => (
                <tr key={evt.id}>
                  <td className="cell-invoice">{evt.invoiceId}</td>
                  <td className="cell-customer">{evt.customer}</td>
                  <td className="cell-date">{formatDate(evt.invoiceIssueDate)}</td>
                  <td className="cell-date">{formatDate(evt.paymentDate)}</td>
                  <td className="cell-days">
                    <span className="days-badge">{evt.daysToPaid} days</span>
                  </td>
                  <td className="cell-tier">
                    <span className={`tier-badge ${evt.tierMultiplierPct === 0 ? "zero" : ""}`}>
                      {evt.tierMultiplierPct}%
                    </span>
                  </td>
                  <td className="cell-rate">{evt.ratePct}%</td>
                  <td className="cell-gm">{formatCurrency(evt.grossMargin)}</td>
                  <td className={`cell-earned ${evt.earnedCommission === 0 ? "zero" : ""}`}>
                    {formatCurrency(evt.earnedCommission)}
                  </td>
                  <td className="cell-status">
                    <StatusBadge status={evt.status} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8} className="total-label">Total Earned</td>
                <td className="total-value">{formatCurrency(totalEarned)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="empty-state">
            No commission events found for this week and salesperson.
          </div>
        )}
      </div>

      <style jsx>{`
        .detail-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }

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
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.55);
          margin: 0;
        }

        /* Summary Row */
        .summary-row {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card {
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .summary-card.secondary {
          flex: 0 0 auto;
          min-width: 120px;
        }

        .summary-card:first-child {
          flex: 1;
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
          color: #22c55e;
        }

        .card-value-sm {
          font-size: 24px;
          font-weight: 600;
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.85);
        }

        /* Controls Row */
        .controls-row {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
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

        /* Table */
        .table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow-x: auto;
        }

        .detail-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1000px;
        }

        .detail-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .detail-table th {
          padding: 14px 12px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          white-space: nowrap;
        }

        .detail-table td {
          padding: 12px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .detail-table tbody tr:last-child td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .detail-table tfoot td {
          padding: 14px 12px;
          background: rgba(255, 255, 255, 0.03);
        }

        .total-label {
          text-align: right;
          font-weight: 600;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .total-value {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 700;
          font-size: 14px;
          color: #22c55e;
        }

        .cell-invoice {
          font-family: var(--font-geist-mono), monospace;
          color: #3b82f6;
          font-weight: 500;
        }

        .cell-customer {
          font-weight: 500;
        }

        .cell-date {
          color: rgba(255, 255, 255, 0.65);
          font-size: 12px;
        }

        .days-badge {
          font-size: 11px;
          padding: 3px 8px;
          background: rgba(148, 163, 184, 0.12);
          color: rgba(148, 163, 184, 0.9);
          border-radius: 4px;
          font-family: var(--font-geist-mono), monospace;
        }

        .tier-badge {
          font-size: 11px;
          padding: 3px 8px;
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border-radius: 4px;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
        }

        .tier-badge.zero {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
        }

        .cell-rate {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
        }

        .cell-gm {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .cell-earned {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
          color: #22c55e;
        }

        .cell-earned.zero {
          color: rgba(255, 255, 255, 0.3);
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

