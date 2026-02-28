"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// Mock payment events data (deterministic)
const MOCK_PAYMENT_EVENTS = [
  {
    id: "PAY-001",
    invoiceId: "INV-2024-0001",
    customer: "Turner Construction",
    paymentDate: "2024-01-22",
    amount: 45750.0,
    method: "ACH",
    status: "Paid",
    daysToPaid: 12,
    notes: "Full payment received",
  },
  {
    id: "PAY-002",
    invoiceId: "INV-2024-0002",
    customer: "Skanska USA",
    paymentDate: "2024-02-10",
    amount: 15000.0,
    method: "Check",
    status: "Partial",
    daysToPaid: 19,
    notes: "Partial payment - balance due",
  },
  {
    id: "PAY-003",
    invoiceId: "INV-2024-0003",
    customer: "McCarthy Building",
    paymentDate: null,
    amount: 0,
    method: "-",
    status: "Unpaid",
    daysToPaid: null,
    notes: "",
  },
  {
    id: "PAY-004",
    invoiceId: "INV-2024-0004",
    customer: "DPR Construction",
    paymentDate: "2024-02-12",
    amount: 28900.0,
    method: "Wire",
    status: "Paid",
    daysToPaid: 7,
    notes: "",
  },
  {
    id: "PAY-005",
    invoiceId: "INV-2024-0005",
    customer: "Hensel Phelps",
    paymentDate: "2024-02-25",
    amount: 20000.0,
    method: "ACH",
    status: "Partial",
    daysToPaid: 15,
    notes: "First installment",
  },
  {
    id: "PAY-006",
    invoiceId: "INV-2024-0006",
    customer: "Holder Construction",
    paymentDate: null,
    amount: 0,
    method: "-",
    status: "Unpaid",
    daysToPaid: null,
    notes: "",
  },
  {
    id: "PAY-007",
    invoiceId: "INV-2024-0007",
    customer: "Brasfield & Gorrie",
    paymentDate: "2024-02-28",
    amount: 42500.0,
    method: "Card",
    status: "Paid",
    daysToPaid: 13,
    notes: "",
  },
  {
    id: "PAY-008",
    invoiceId: "INV-2024-0008",
    customer: "Whiting-Turner",
    paymentDate: "2024-03-05",
    amount: 38200.0,
    method: "Cash",
    status: "Paid",
    daysToPaid: 13,
    notes: "Cash deposit at branch",
  },
];

type FilterType = "all" | "unpaid" | "partial" | "paid";

function StatusBadge({ status }: { status: "Unpaid" | "Partial" | "Paid" }) {
  const styles: Record<string, React.CSSProperties> = {
    Unpaid: {
      background: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    },
    Partial: {
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
        fontSize: "12px",
        fontWeight: 600,
        ...styles[status],
      }}
    >
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        background: "rgba(255, 255, 255, 0.06)",
        color: "rgba(255, 255, 255, 0.75)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        textTransform: "uppercase",
        letterSpacing: "0.3px",
      }}
    >
      {method}
    </span>
  );
}

export default function PaymentsHubPage() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = useMemo(() => {
    return MOCK_PAYMENT_EVENTS.filter((evt) => {
      // Status filter
      if (filter !== "all") {
        if (filter === "unpaid" && evt.status !== "Unpaid") return false;
        if (filter === "partial" && evt.status !== "Partial") return false;
        if (filter === "paid" && evt.status !== "Paid") return false;
      }

      // Date range filter (client-side, simple)
      if (dateFrom && evt.paymentDate) {
        if (evt.paymentDate < dateFrom) return false;
      }
      if (dateTo && evt.paymentDate) {
        if (evt.paymentDate > dateTo) return false;
      }

      // Search filter (Invoice # or Customer)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInvoice = evt.invoiceId.toLowerCase().includes(q);
        const matchCustomer = evt.customer.toLowerCase().includes(q);
        if (!matchInvoice && !matchCustomer) return false;
      }

      return true;
    });
  }, [filter, dateFrom, dateTo, searchQuery]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="payments-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/accounting" className="back-link">
            ← Back to Money
          </Link>
          <h1>Payments</h1>
          <p className="subtitle">
            {filteredEvents.length} payment event
            {filteredEvents.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Audit Note */}
      <div className="audit-note">
        <span className="note-icon">i</span>
        <span>
          Payments are entered on invoice detail. This hub is an accounting
          audit view.
        </span>
      </div>

      {/* Filter Controls */}
      <div className="controls-row">
        <div className="filters-left">
          {/* Status Tabs */}
          <div className="filter-tabs">
            {[
              { key: "all", label: "All" },
              { key: "unpaid", label: "Unpaid" },
              { key: "partial", label: "Partial" },
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

          {/* Date Range */}
          <div className="date-range">
            <label className="date-label">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="date-input"
            />
            <label className="date-label">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="date-input"
            />
          </div>
        </div>

        {/* Search */}
        <div className="search-box">
          <input
            type="text"
            placeholder="Search Invoice # / Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="table-wrap">
        <table className="payments-table">
          <thead>
            <tr>
              <th>Payment Date</th>
              <th>Invoice #</th>
              <th>Customer</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "center" }}>Method</th>
              <th style={{ textAlign: "center" }}>Status</th>
              <th style={{ textAlign: "center" }}>Days-to-Paid</th>
              <th>Notes</th>
              <th style={{ textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((evt) => (
              <tr key={evt.id}>
                <td className="cell-date">{formatDate(evt.paymentDate)}</td>
                <td className="cell-invoice">{evt.invoiceId}</td>
                <td className="cell-customer">{evt.customer}</td>
                <td className="cell-amount">
                  {evt.amount > 0 ? formatCurrency(evt.amount) : "—"}
                </td>
                <td className="cell-method">
                  {evt.method !== "-" ? (
                    <MethodBadge method={evt.method} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="cell-status">
                  <StatusBadge
                    status={evt.status as "Unpaid" | "Partial" | "Paid"}
                  />
                </td>
                <td className="cell-days">
                  {evt.daysToPaid !== null ? evt.daysToPaid : "—"}
                </td>
                <td className="cell-notes">{evt.notes || "—"}</td>
                <td className="cell-action">
                  <Link
                    href={`/accounting/invoicing/${evt.invoiceId}`}
                    className="view-link"
                  >
                    View Invoice →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEvents.length === 0 && (
          <div className="empty-state">
            No payment events match the selected filters.
          </div>
        )}
      </div>

      {/* Explainer */}
      <div className="explainer">
        <span className="explainer-icon">i</span>
        <span>
          <strong>Audit:</strong> Payment events are recorded on each invoice.
          This hub aggregates all payment activity for accounting review.
          Days-to-Paid is calculated from invoice issue date to payment date.
        </span>
      </div>

      <style jsx>{`
        .payments-container {
          padding: 24px 40px 60px;
          max-width: 1300px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 16px;
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

        /* Audit Note */
        .audit-note {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.75);
        }

        .note-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(59, 130, 246, 0.4);
          font-size: 11px;
          font-weight: 700;
          color: #3b82f6;
          flex-shrink: 0;
        }

        /* Controls Row */
        .controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .filters-left {
          display: flex;
          align-items: center;
          gap: 20px;
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

        /* Date Range */
        .date-range {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .date-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .date-input {
          padding: 7px 10px;
          font-size: 13px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.85);
          outline: none;
          transition: border-color 0.15s ease;
        }

        .date-input:focus {
          border-color: rgba(59, 130, 246, 0.5);
        }

        /* Search */
        .search-box {
          flex-shrink: 0;
        }

        .search-input {
          padding: 8px 14px;
          font-size: 13px;
          width: 240px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.85);
          outline: none;
          transition: border-color 0.15s ease;
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .search-input:focus {
          border-color: rgba(59, 130, 246, 0.5);
        }

        /* Table */
        .table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .payments-table {
          width: 100%;
          border-collapse: collapse;
        }

        .payments-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .payments-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .payments-table td {
          padding: 14px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .payments-table tr:last-child td {
          border-bottom: none;
        }

        .cell-date {
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
        }

        .cell-invoice {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 500;
          color: #3b82f6;
        }

        .cell-customer {
          font-weight: 500;
          color: #fff;
        }

        .cell-amount {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
        }

        .cell-method {
          text-align: center;
        }

        .cell-status {
          text-align: center;
        }

        .cell-days {
          text-align: center;
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.6);
        }

        .cell-notes {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cell-action {
          text-align: center;
        }

        .view-link {
          display: inline-block;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s ease;
          white-space: nowrap;
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

