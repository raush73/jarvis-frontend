'use client';
import { useEffect, useMemo, useState } from "react";
import { useRouter } from 'next/navigation';
// Mock job orders data
const MOCK_ORDERS = [
  {
    id: "ORD-2024-001",
    customer: "Turner Construction",
    site: "Downtown Tower - Los Angeles, CA",
    startDate: "2024-02-15",
    trades: { mw: { filled: 7, total: 10 }, pw: { filled: 18, total: 30 } },
    lastUpdated: "2 hours ago",
  },
  {
    id: "ORD-2024-002",
    customer: "Skanska USA",
    site: "Metro Hospital - San Diego, CA",
    startDate: "2024-02-18",
    trades: { mw: { filled: 4, total: 6 }, pw: { filled: 12, total: 15 } },
    lastUpdated: "5 hours ago",
  },
  {
    id: "ORD-2024-003",
    customer: "McCarthy Building",
    site: "Tech Campus Phase 2 - Phoenix, AZ",
    startDate: "2024-02-20",
    trades: { mw: { filled: 10, total: 12 }, pw: { filled: 25, total: 40 } },
    lastUpdated: "1 day ago",
  },
  {
    id: "ORD-2024-004",
    customer: "DPR Construction",
    site: "Data Center NV-01 - Las Vegas, NV",
    startDate: "2024-02-22",
    trades: { mw: { filled: 15, total: 20 }, pw: { filled: 8, total: 10 } },
    lastUpdated: "3 days ago",
  },
  {
    id: "ORD-2024-005",
    customer: "Hensel Phelps",
    site: "Airport Terminal Expansion - Denver, CO",
    startDate: "2024-03-01",
    trades: { mw: { filled: 0, total: 8 }, pw: { filled: 5, total: 20 } },
    lastUpdated: "5 days ago",
  },
  {
    id: "ORD-2024-006",
    customer: "Holder Construction",
    site: "University Research Lab - Austin, TX",
    startDate: "2024-03-05",
    trades: { mw: { filled: 3, total: 5 }, pw: { filled: 10, total: 12 } },
    lastUpdated: "1 week ago",
  },
];

// Orders source (UI-only). If/when backend wiring exists, replace with fetched orders.
const orders = MOCK_ORDERS;


function TradeBadge({ label, filled, total }: { label: string; filled: number; total: number }) {
  const pct = total > 0 ? (filled / total) * 100 : 0;
  const color = pct >= 100 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <span className="trade-badge" style={{ borderColor: color }}>
      <span className="trade-label">{label}</span>
      <span className="trade-count" style={{ color }}>
        {filled}/{total}
      </span>
    </span>
  );
}

export default function OrdersPage() {
  const router = useRouter();

  // HARD TOKEN GATE (safe version)
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

  // Helper: calculate total openings for an order
  const getOpenSlots = (order: any) => {
    const trades =
      order?.trades && typeof order.trades === "object" ? order.trades : {};
    return Object.values(trades).reduce((sum: number, t: any) => {
      const total = Number(t?.total ?? 0);
      const filled = Number(t?.filled ?? 0);
      return sum + (total - filled);
    }, 0);
  };

  const visibleOrders = useMemo(() => {
    switch (activeFilter) {
      case "has-openings":
        // Orders where Openings O > 0 (some slots still unfilled)
        return orders.filter((order) => getOpenSlots(order) > 0);
      case "fully-staffed":
        // Orders where Openings O = 0 (all slots filled)
        return orders.filter((order) => getOpenSlots(order) === 0);
      default:
        // All Active: show all orders
        return orders;
    }
  }, [activeFilter]);


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

      {/* Staffing Status Dropdown */}
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
      </div>

      {/* Orders Table */}
      <div className="orders-table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Site / Location</th>
              <th>Start Date</th>
              <th>Trade Summary</th>
              <th>Staffing Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((order) => (
              <tr
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="order-row"
              >
                <td className="order-id">{order.id}</td>
                <td className="customer">{order.customer}</td>
                <td className="site">{order.site}</td>
                <td className="start-date">
                  {new Date(order.startDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="trades">
                  <TradeBadge label="MW" filled={order.trades.mw.filled} total={order.trades.mw.total} />
                  <TradeBadge label="PW" filled={order.trades.pw.filled} total={order.trades.pw.total} />
                </td>
                <td className="staffing-status">
                  {getOpenSlots(order) > 0 ? (
                    <span className="staffing-badge has-openings">Has Openings</span>
                  ) : (
                    <span className="staffing-badge fully-staffed">Fully Staffed</span>
                  )}
                </td>
                <td className="last-updated">{order.lastUpdated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .orders-container {
          padding: 32px 40px;
          max-width: 1400px;
          margin: 0 auto;
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
          font-weight: 600;
          color: #fff;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .order-count {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .header-right {
          display: flex;
          gap: 12px;
        }

        .logout-btn {
          padding: 8px 18px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .logout-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .staffing-filter {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
        }

        .staffing-filter label {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
        }

        .staffing-filter select {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          color: #fff;
          cursor: pointer;
          outline: none;
        }

        .staffing-filter select:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }

        .staffing-filter select:focus {
          border-color: #3b82f6;
        }

        .staffing-filter select option {
          background: #1a1a2e;
          color: #fff;
        }

        .orders-table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .orders-table {
          width: 100%;
          border-collapse: collapse;
        }

        .orders-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .orders-table th {
          padding: 14px 20px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .orders-table td {
          padding: 16px 20px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .order-row {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .order-row:hover {
          background: rgba(59, 130, 246, 0.08);
        }

        .order-row:last-child td {
          border-bottom: none;
        }

        .order-id {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 500;
          color: #3b82f6 !important;
        }

        .customer {
          font-weight: 500;
        }

        .site {
          color: rgba(255, 255, 255, 0.6) !important;
          max-width: 280px;
        }

        .start-date {
          white-space: nowrap;
        }

        .trades {
          display: flex;
          gap: 10px;
        }

        .last-updated {
          color: rgba(255, 255, 255, 0.45) !important;
          font-size: 13px !important;
          white-space: nowrap;
        }

        .staffing-status {
          white-space: nowrap;
        }

        .staffing-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 600;
        }

        .staffing-badge.has-openings {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .staffing-badge.fully-staffed {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
      `}</style>

      <style jsx global>{`
        .trade-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid;
          border-radius: 5px;
          font-size: 12px;
        }

        .trade-label {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
        }

        .trade-count {
          font-weight: 600;
          font-family: var(--font-geist-mono), monospace;
        }
      `}</style>
    </div>
  );
}



