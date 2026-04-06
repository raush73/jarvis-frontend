'use client';
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { AddCandidateModal, TradeLineOption } from '@/components/vetting/AddCandidateModal';

/** Resolver staffing attached in listOrders (OrderStaffingResolverService); do not recompute openings client-side. */
type OrderStaffingSummary = {
  requested: number;
  dispatched: number;
  adjustments: number;
  open: number;
  hasOpenings: boolean;
  fullyStaffed: boolean;
};

/** Shape returned by GET /orders (see orders.service listOrders select). */
type OrderListRow = {
  id: string;
  title?: string | null;
  status?: string;
  approvalStatus?: string;
  customerId?: string;
  jobLocationCode?: string | null;
  jobSiteName?: string | null;
  jobSiteCity?: string | null;
  jobSiteState?: string | null;
  jobSiteZip?: string | null;
  customer?: { id: string; name: string } | null;
  location?: {
    id: string;
    name: string;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
  primaryCustomerContact?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  tradeRequirements?: Array<{
    startDate?: string | null;
    requestedHeadcount?: number | null;
    trade?: { name: string } | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
  marginHealth?: {
    orderHealthStatus?: string | null;
    orderBlendedMarginPct?: number | null;
  } | null;
  staffing?: {
    summary: OrderStaffingSummary;
    trades?: Array<{ tradeId: string; tradeName: string; open: number }>;
  };
};

const EM_DASH = "\u2014";

/** Title → job location code → id (no separate order-number field on Order today). */
function orderDisplayName(order: OrderListRow): string {
  const title = order.title?.trim();
  if (title) return title;
  const code = order.jobLocationCode?.trim();
  if (code) return code;
  return order.id;
}

function customerDisplayName(order: OrderListRow): string {
  const n = order.customer?.name?.trim();
  if (n) return n;
  return EM_DASH;
}

function siteDisplay(order: OrderListRow): string {
  const siteName = order.jobSiteName?.trim() || order.location?.name?.trim();
  const city = order.jobSiteCity?.trim() || order.location?.city?.trim();
  const state = order.jobSiteState?.trim() || order.location?.state?.trim();
  const zip = order.jobSiteZip?.trim() || order.location?.zip?.trim();
  const cityState = [city, state].filter(Boolean).join(", ");
  const tail = [cityState, zip].filter(Boolean).join(" ");

  if (siteName && tail) return `${siteName} — ${tail}`;
  if (siteName) return siteName;
  if (tail) return tail;
  const code = order.jobLocationCode?.trim();
  if (code) return code;
  return "Unknown site";
}

function startDateDisplay(order: OrderListRow): string {
  const reqs = order.tradeRequirements ?? [];
  const times = reqs
    .map((tr) => tr.startDate)
    .filter((s): s is string => Boolean(s))
    .map((s) => new Date(s).getTime())
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return "TBD";
  const min = new Date(Math.min(...times));
  return min.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function lastUpdatedDisplay(order: OrderListRow): string {
  const raw = order.updatedAt;
  if (!raw) return EM_DASH;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function needFromStaffing(order: OrderListRow): number | null {
  const open = order.staffing?.summary?.open;
  return typeof open === "number" ? open : null;
}

/** Resolver `staffing.trades` only — no client-side staffing math. */
function needDisplayFromTrades(order: OrderListRow): "unknown" | "zero" | { lines: { key: string; label: string; open: number }[] } {
  const staffing = order.staffing;
  if (!staffing) return "unknown";

  const trades = staffing.trades;
  if (!Array.isArray(trades)) {
    return typeof staffing.summary?.open === "number" && staffing.summary.open === 0 ? "zero" : "unknown";
  }

  const positive = trades.filter((t) => typeof t.open === "number" && t.open > 0);
  if (positive.length === 0) return "zero";

  const lines = positive.map((t) => ({
    key: t.tradeId,
    label: (t.tradeName?.trim() || "Trade").trim(),
    open: t.open,
  }));

  return { lines };
}

/** Demand-only summary from trade lines (requested headcount), not filled seats. */
function tradeSummaryDisplay(order: OrderListRow): string {
  const lines = order.tradeRequirements ?? [];
  if (lines.length === 0) return "No trade summary";
  return lines
    .map((tr) => {
      const name = tr.trade?.name?.trim() || "Trade";
      const n = Number(tr.requestedHeadcount ?? 0);
      return `${name} (${n})`;
    })
    .join("; ");
}

/** Deduped trade labels from structured row fields only (resolver trades + line items). */
function buildTradeFilterOptions(orders: OrderListRow[]): string[] {
  const byNorm = new Map<string, string>();
  for (const order of orders) {
    for (const t of order.staffing?.trades ?? []) {
      const raw = (t.tradeName ?? "").trim();
      if (!raw) continue;
      const norm = raw.toLowerCase();
      if (!byNorm.has(norm)) byNorm.set(norm, raw);
    }
    for (const tr of order.tradeRequirements ?? []) {
      const raw = (tr.trade?.name ?? "").trim();
      if (!raw) continue;
      const norm = raw.toLowerCase();
      if (!byNorm.has(norm)) byNorm.set(norm, raw);
    }
  }
  return [...byNorm.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

function orderIncludesTrade(order: OrderListRow, selectedDisplayName: string): boolean {
  const want = selectedDisplayName.trim().toLowerCase();
  if (!want) return true;
  for (const t of order.staffing?.trades ?? []) {
    if ((t.tradeName ?? "").trim().toLowerCase() === want) return true;
  }
  for (const tr of order.tradeRequirements ?? []) {
    if ((tr.trade?.name ?? "").trim().toLowerCase() === want) return true;
  }
  return false;
}

export default function OrdersPage() {
  const router = useRouter();

  // HARD TOKEN GATE (safe version)
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('jp_accessToken');
    if (!token) {
      router.replace('/login');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  const isAuthorized = authorized === true;

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiFetch<OrderListRow[]>('/orders');
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load orders', err);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadOrders();
    }
  }, [isAuthorized, loadOrders]);

// Force re-render on hash change
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const onHashChange = () => forceUpdate((n) => n + 1);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Read hash at render time (client only)
  const currentHash =
    typeof window !== "undefined"
      ? window.location.hash.replace("#", "")
      : "";

  // Determine active filter from currentHash
  // "recruiting" or "vetting" (backwards compat) -> Has Openings
  // "fully-staffed" or "staffed" -> Fully Staffed
  // otherwise -> All Active
  const activeFilter =
    currentHash === "recruiting" || currentHash === "vetting"
      ? "has-openings"
      : currentHash === "fully-staffed" || currentHash === "staffed"
      ? "fully-staffed"
      : "all-active";

  const [addCandidateOrderId, setAddCandidateOrderId] = useState<string | null>(null);
  const [addCandidateTradeLines, setAddCandidateTradeLines] = useState<TradeLineOption[]>([]);
  const [addCandidateLoading, setAddCandidateLoading] = useState(false);
  const [selectedTradeFilter, setSelectedTradeFilter] = useState("");

  const handleOpenAddCandidate = useCallback(async (orderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAddCandidateLoading(true);
    try {
      const order = await apiFetch<{
        id: string;
        tradeRequirements: Array<{
          id: string;
          tradeId: string;
          trade: { id: string; name: string };
          requestedHeadcount: number;
          startDate: string | null;
          expectedEndDate: string | null;
        }>;
      }>(`/orders/${orderId}`);
      const lines: TradeLineOption[] = (order.tradeRequirements ?? []).map((tr) => ({
        id: tr.id,
        tradeId: tr.tradeId,
        tradeName: tr.trade.name,
        startDate: tr.startDate,
        expectedEndDate: tr.expectedEndDate,
        requestedHeadcount: tr.requestedHeadcount,
      }));
      setAddCandidateTradeLines(lines);
      setAddCandidateOrderId(orderId);
    } catch {
      setAddCandidateTradeLines([]);
      setAddCandidateOrderId(orderId);
    } finally {
      setAddCandidateLoading(false);
    }
  }, []);

  const tradeFilterOptions = useMemo(() => buildTradeFilterOptions(orders), [orders]);

  useEffect(() => {
    if (!selectedTradeFilter) return;
    const still = tradeFilterOptions.some(
      (n) => n.toLowerCase() === selectedTradeFilter.toLowerCase(),
    );
    if (!still) setSelectedTradeFilter("");
  }, [tradeFilterOptions, selectedTradeFilter]);

  const visibleOrders = useMemo(() => {
    let list: OrderListRow[];
    switch (activeFilter) {
      case "has-openings":
        list = orders.filter((o) => o.staffing?.summary?.hasOpenings === true);
        break;
      case "fully-staffed":
        list = orders.filter((o) => o.staffing?.summary?.fullyStaffed === true);
        break;
      default:
        list = orders;
    }
    if (!selectedTradeFilter.trim()) return list;
    return list.filter((o) => orderIncludesTrade(o, selectedTradeFilter));
  }, [activeFilter, orders, selectedTradeFilter]);


  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="orders-container">
      {/* Page Header */}
      <div className="orders-header">
        <div className="header-left">
          <h1>
            {activeFilter === "has-openings"
              ? "Orders with Openings"
              : activeFilter === "fully-staffed"
              ? "Fully Staffed Orders"
              : "Job Orders"}
          </h1>
          <span className="order-count">
            {visibleOrders.length}{" "}
            {activeFilter === "has-openings"
              ? "orders needing fill"
              : activeFilter === "fully-staffed"
              ? "fully staffed"
              : "active orders"}
          </span>
        </div></div>

      {/* Staffing + trade filters */}
      <div className="staffing-filter">
        <label htmlFor="staffing-status-dropdown">Staffing Status:</label>
        <select
          id="staffing-status-dropdown"
          value={
            activeFilter === "has-openings"
              ? "has-openings"
              : activeFilter === "fully-staffed"
              ? "fully-staffed"
              : "all"
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === "has-openings") {
              window.location.hash = "recruiting";
            } else if (val === "fully-staffed") {
              window.location.hash = "fully-staffed";
            } else {
              window.location.hash = "";
            }
          }}
        >
          <option value="all">All</option>
          <option value="has-openings">Has Openings</option>
          <option value="fully-staffed">Fully Staffed</option>
        </select>
        <label htmlFor="trade-filter-dropdown">Trade:</label>
        <select
          id="trade-filter-dropdown"
          value={selectedTradeFilter}
          onChange={(e) => setSelectedTradeFilter(e.target.value)}
        >
          <option value="">All Trades</option>
          {tradeFilterOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Orders Table */}
      <div className="orders-table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Site / Location</th>
              <th>Start Date</th>
              <th>Trade Summary</th>
              <th>Need</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((order) => (
              <tr
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="order-row"
              >
                <td className="order-name">{orderDisplayName(order)}</td>
                <td className="customer">{customerDisplayName(order)}</td>
                <td className="site">{siteDisplay(order)}</td>
                <td className="start-date">{startDateDisplay(order)}</td>
                <td className="trades">
                  <span className="trade-summary-placeholder">{tradeSummaryDisplay(order)}</span>
                </td>
                <td className="need-cell">
                  {(() => {
                    const disp = needDisplayFromTrades(order);
                    if (disp === "unknown") return EM_DASH;
                    if (disp === "zero") return "0";
                    return (
                      <div className="need-by-trade">
                        {disp.lines.map((row) => (
                          <div key={row.key} className="need-trade-line">
                            <span className="need-trade-name">{row.label}</span>
                            <span className="need-trade-sep">: </span>
                            <span className="need-trade-open">{row.open}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </td>
                <td className="last-updated">{lastUpdatedDisplay(order)}</td>
                <td className="actions-cell">
                  {(() => {
                    const need = needFromStaffing(order);
                    if (need === 0) return null;
                    return (
                      <button
                        type="button"
                        className="add-candidate-btn"
                        onClick={(e) => handleOpenAddCandidate(order.id, e)}
                        disabled={addCandidateLoading}
                        title="Add a candidate to this order"
                      >
                        + Add Candidate
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addCandidateOrderId && (
        <AddCandidateModal
          key={addCandidateOrderId}
          orderId={addCandidateOrderId}
          tradeLines={addCandidateTradeLines}
          entrySource="OPENINGS_HUB"
          onClose={() => setAddCandidateOrderId(null)}
          onSuccess={() => {
            void loadOrders();
            setAddCandidateOrderId(null);
          }}
        />
      )}

      <style jsx>{`
        /* ============================================================
           INDUSTRIAL LIGHT V1 — Orders List Page
        ============================================================ */
        .orders-container {
          padding: 32px 40px;
          max-width: 1400px;
          margin: 0 auto;
          background: #f8fafc;
          min-height: 100vh;
        }

        .orders-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
        }

        .header-left {
          display: flex;
          align-items: baseline;
          gap: 16px;
        }

        .header-left h1 {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          letter-spacing: -0.3px;
        }

        .order-count {
          font-size: 14px;
          color: #6b7280;
        }

        .header-right {
          display: flex;
          gap: 12px;
        }

        /* Filter/control row */
        .staffing-filter {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .staffing-filter label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .staffing-filter select {
          padding: 7px 11px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          color: #111827;
          cursor: pointer;
          outline: none;
          transition: border-color 0.12s ease;
        }

        .staffing-filter select:hover {
          border-color: #9ca3af;
        }

        .staffing-filter select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
        }

        .staffing-filter select option {
          background: #ffffff;
          color: #111827;
        }

        /* Table */
        .orders-table-wrap {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .orders-table {
          width: 100%;
          border-collapse: collapse;
        }

        .orders-table thead {
          background: #f1f5f9;
        }

        .orders-table th {
          padding: 13px 20px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #d1d5db;
        }

        .orders-table td {
          padding: 15px 20px;
          font-size: 14px;
          color: #111827;
          border-bottom: 1px solid #f1f5f9;
        }

        .order-row {
          cursor: pointer;
          transition: background 0.12s ease;
        }

        .order-row:hover {
          background: #f9fafb;
        }

        .order-row:last-child td {
          border-bottom: none;
        }

        .order-name {
          font-weight: 600;
          color: #2563eb !important;
        }

        .customer {
          font-weight: 600;
          color: #111827;
        }

        .site {
          color: #6b7280 !important;
          max-width: 280px;
        }

        .start-date {
          white-space: nowrap;
          color: #374151;
        }

        .trades {
          display: flex;
          gap: 10px;
        }

        .last-updated {
          color: #9ca3af !important;
          font-size: 13px !important;
          white-space: nowrap;
        }

        .need-cell {
          white-space: normal;
          vertical-align: top;
          font-variant-numeric: tabular-nums;
          font-weight: 600;
          color: #111827;
        }

        .need-by-trade {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .need-trade-line {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.35;
          color: #111827;
        }

        .need-trade-name {
          font-weight: 600;
        }

        .need-trade-open {
          font-variant-numeric: tabular-nums;
        }

        .trade-summary-placeholder {
          color: #6b7280;
          font-size: 13px;
        }

        .actions-cell {
          white-space: nowrap;
        }

        .add-candidate-btn {
          padding: 5px 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 5px;
          color: #2563eb;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.12s ease, border-color 0.12s ease;
        }

        .add-candidate-btn:hover:not(:disabled) {
          background: #dbeafe;
          border-color: #93c5fd;
        }

        .add-candidate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

    </div>
  );
}






