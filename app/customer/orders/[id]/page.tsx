"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Status = "Dispatched" | "Scheduled" | "Pending";

type Order = {
  id: string;
  orderName: string;
  site: string;
  address: string;
  startDate: string;
  endDate: string;
  status: Status;
  pmContact: { name: string; email: string; phone: string };
  customerNotes: string[];
  customerVisibleSummary: Array<{ k: string; v: string }>;
};

type TabKey = "overview" | "trades" | "safety" | "time" | "invoices" | "changeOrders";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "trades", label: "Trades" },
  { key: "safety", label: "Safety" },
  { key: "time", label: "Time" },
  { key: "invoices", label: "Invoices" },
  { key: "changeOrders", label: "Change Orders" },
];

// Change Order types and mock data (Customer Portal - Read-only)
type ChangeOrderStatus = "Draft" | "Pending" | "Approved" | "Rejected";
type ApprovalMethod = "Portal" | "Email Authorization";

type ChangeOrder = {
  id: string;
  status: ChangeOrderStatus;
  employee: string;
  changeType: string;
  delta: string;
  effectiveDate: string;
  requestedBy: string;
  approvalMethod: ApprovalMethod;
  proof: string;
  dispatchAmendment: string;
  requestedOn: string;
  fullSummary: string;
};

const MOCK_CHANGE_ORDERS: ChangeOrder[] = [
  {
    id: "CO-001",
    status: "Approved",
    employee: "Marcus Johnson",
    changeType: "Rate Change",
    delta: "+$3.00 / hr",
    effectiveDate: "2024-03-01",
    requestedBy: "Casey Rivers (PM)",
    approvalMethod: "Portal",
    proof: "Portal Approval",
    dispatchAmendment: "v2",
    requestedOn: "2024-02-25",
    fullSummary: "Rate increase for Marcus Johnson from $28.00/hr to $31.00/hr due to expanded scope including lead responsibilities on night shift crew.",
  },
  {
    id: "CO-002",
    status: "Approved",
    employee: "Sarah Chen",
    changeType: "Rate Change",
    delta: "+$150 / shift",
    effectiveDate: "2024-02-20",
    requestedBy: "Jordan Miles (Sales)",
    approvalMethod: "Email Authorization",
    proof: "Email Uploaded",
    dispatchAmendment: "v2",
    requestedOn: "2024-02-18",
    fullSummary: "Shift differential added for Sarah Chen for weekend coverage. Customer authorized via email on 2024-02-18.",
  },
  {
    id: "CO-003",
    status: "Pending",
    employee: "David Martinez",
    changeType: "Rate Change",
    delta: "+$2.50 / hr",
    effectiveDate: "2024-03-15",
    requestedBy: "Casey Rivers (PM)",
    approvalMethod: "Portal",
    proof: "Awaiting Approval",
    dispatchAmendment: "—",
    requestedOn: "2024-03-01",
    fullSummary: "Rate adjustment request for David Martinez to match market rate for certified welders. Pending customer approval.",
  },
  {
    id: "CO-004",
    status: "Draft",
    employee: "Emily Rodriguez",
    changeType: "Rate Change",
    delta: "+$4.00 / hr",
    effectiveDate: "2024-03-20",
    requestedBy: "Internal",
    approvalMethod: "Portal",
    proof: "—",
    dispatchAmendment: "—",
    requestedOn: "2024-03-05",
    fullSummary: "Draft rate change for Emily Rodriguez for hazard pay classification. Not yet submitted to customer.",
  },
  {
    id: "CO-005",
    status: "Rejected",
    employee: "James Wilson",
    changeType: "Rate Change",
    delta: "+$5.00 / hr",
    effectiveDate: "2024-02-15",
    requestedBy: "Jordan Miles (Sales)",
    approvalMethod: "Email Authorization",
    proof: "—",
    dispatchAmendment: "—",
    requestedOn: "2024-02-10",
    fullSummary: "Rate increase request for James Wilson was rejected by customer. Original rate to remain in effect.",
  },
];

// Mock Trades Data
const MOCK_TRADES = [
  { trade: "Pipefitter", required: 12, filled: 10 },
  { trade: "Welder", required: 8, filled: 4 },
  { trade: "Electrician", required: 6, filled: 3 },
  { trade: "Ironworker", required: 10, filled: 0 },
  { trade: "Millwright", required: 5, filled: 0 },
  { trade: "Boilermaker", required: 7, filled: 0 },
  { trade: "Rigger", required: 5, filled: 0 },
];

// Mock Safety Data
const MOCK_PPE = ["Hard Hat", "Safety Glasses", "Steel-Toe Boots", "High-Vis Vest", "Gloves", "Hearing Protection"];
const MOCK_TOOLS = ["Hand Tools (provided by worker)", "Power Tools (site-provided)", "Fall Protection Harness"];
const MOCK_READINESS = [
  { item: "Safety orientation", status: "complete" },
  { item: "Background check", status: "complete" },
  { item: "Drug screening", status: "complete" },
  { item: "Site credentials issued", status: "pending" },
  { item: "Tool allocation confirmed", status: "pending" },
];

// Mock Invoices Data
const MOCK_INVOICES = [
  { id: "INV-2026-0041", period: "Jan 27 – Feb 2, 2026", amount: "$42,350.00", status: "Paid" },
  { id: "INV-2026-0035", period: "Jan 20 – Jan 26, 2026", amount: "$38,120.00", status: "Paid" },
  { id: "INV-2026-0029", period: "Jan 13 – Jan 19, 2026", amount: "$29,875.00", status: "Sent" },
  { id: "INV-2026-0023", period: "Jan 6 – Jan 12, 2026", amount: "$15,640.00", status: "Draft" },
];

// Mock Timesheet Periods for Time Tab
type TimesheetPeriod = {
  id: string;
  label: string;
  status: "Draft" | "Submitted" | "Finalized";
};

const MOCK_TIMESHEET_PERIODS: TimesheetPeriod[] = [
  { id: "ts_004", label: "Week of Jan 27 – Feb 2, 2026", status: "Submitted" },
  { id: "ts_003", label: "Week of Jan 20 – Jan 26, 2026", status: "Finalized" },
  { id: "ts_002", label: "Week of Jan 13 – Jan 19, 2026", status: "Finalized" },
  { id: "ts_001", label: "Week of Jan 6 – Jan 12, 2026", status: "Finalized" },
];

const MOCK_ORDERS: Record<string, Order> = {
  cust_ord_001: {
    id: "cust_ord_001",
    orderName: "Refinery Turnaround Q1",
    site: "Marathon Petroleum Refinery — Texas City, TX",
    address: "Texas City, TX (Mock)",
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    status: "Dispatched",
    pmContact: { name: "Casey Rivers", email: "pm@example.com", phone: "(000) 000-0000" },
    customerNotes: [
      "Customer Portal is read-only (UI Shell / Mock Data).",
      "Use the tabs above to view Dispatch and Time for this order.",
      "For changes, contact your MW4H account representative.",
    ],
    customerVisibleSummary: [
      { k: "Order ID", v: "cust_ord_001" },
      { k: "Site / Location", v: "Marathon Petroleum Refinery — Texas City, TX" },
      { k: "Status", v: "Dispatched" },
      { k: "Date Range", v: "Feb 1 — Feb 28, 2026" },
    ],
  },
  cust_ord_002: {
    id: "cust_ord_002",
    orderName: "Power Plant Maintenance",
    site: "NRG W.A. Parish Generating Station — Thompsons, TX",
    address: "Thompsons, TX (Mock)",
    startDate: "2026-03-05",
    endDate: "2026-03-20",
    status: "Scheduled",
    pmContact: { name: "Jordan Miles", email: "pm@example.com", phone: "(000) 000-0000" },
    customerNotes: ["Customer Portal is read-only (UI Shell / Mock Data)."],
    customerVisibleSummary: [
      { k: "Order ID", v: "cust_ord_002" },
      { k: "Site / Location", v: "NRG W.A. Parish Generating Station — Thompsons, TX" },
      { k: "Status", v: "Scheduled" },
      { k: "Date Range", v: "Mar 5 — Mar 20, 2026" },
    ],
  },
};

function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startStr} — ${endStr}`;
  } catch {
    return `${startDate} — ${endDate}`;
  }
}

function getStatusStyle(status: Status): { bg: string; text: string; border: string } {
  switch (status) {
    case "Dispatched":
      return { bg: "rgba(34, 197, 94, 0.12)", text: "#4ade80", border: "rgba(34, 197, 94, 0.3)" };
    case "Scheduled":
      return { bg: "rgba(59, 130, 246, 0.12)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" };
    default:
      return { bg: "rgba(245, 158, 11, 0.12)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" };
  }
}

// Status badge styling for change orders
function getChangeOrderStatusStyle(status: ChangeOrderStatus) {
  switch (status) {
    case "Approved":
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#4ade80", border: "rgba(34, 197, 94, 0.3)" };
    case "Pending":
      return { bg: "rgba(245, 158, 11, 0.12)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" };
    case "Rejected":
      return { bg: "rgba(239, 68, 68, 0.12)", color: "#f87171", border: "rgba(239, 68, 68, 0.3)" };
    default: // Draft
      return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.3)" };
  }
}

export default function CustomerOrderPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || "cust_ord_001";
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  
  // Change Order detail panel state (read-only)
  const [selectedChangeOrder, setSelectedChangeOrder] = useState<ChangeOrder | null>(null);

  const order: Order =
    MOCK_ORDERS[id] ?? {
      id,
      orderName: "Customer Order (Mock)",
      site: "Site / Location (Mock)",
      address: "Address (Mock)",
      startDate: "2026-01-01",
      endDate: "2026-01-15",
      status: "Pending",
      pmContact: { name: "PM (Mock)", email: "pm@example.com", phone: "(000) 000-0000" },
      customerNotes: ["Customer Portal is read-only (UI Shell / Mock Data)."],
      customerVisibleSummary: [
        { k: "Order ID", v: id },
        { k: "Site / Location", v: "Site / Location (Mock)" },
        { k: "Status", v: "Pending" },
        { k: "Date Range", v: formatDateRange("2026-01-01", "2026-01-15") },
      ],
    };

  const status = getStatusStyle(order.status);

  // Trades calculations
  const totalRequired = MOCK_TRADES.reduce((sum, t) => sum + t.required, 0);
  const totalFilled = MOCK_TRADES.reduce((sum, t) => sum + t.filled, 0);

  return (
    <div className="customer-order-page">
      <div className="customer-order-container">
        {/* Crumb */}
        <div className="crumbs">
          <button className="crumb" onClick={() => router.push("/customer/orders")}>
            ← Your Orders
          </button>
          <span className="crumb-sep">/</span>
          <span className="crumb-current">{order.orderName}</span>
        </div>

        {/* Header */}
        <header className="header">
          <div className="badge-row">
            <span className="portal-badge">Customer Portal (Read-only)</span>
            <span
              className="status"
              style={{ background: status.bg, color: status.text, borderColor: status.border }}
              aria-label={`Status: ${order.status}`}
            >
              {order.status}
            </span>
          </div>

          <h1 className="title">{order.orderName}</h1>

          <div className="meta">
            <div className="meta-line">{order.site}</div>
            <div className="meta-line muted">{formatDateRange(order.startDate, order.endDate)}</div>
          </div>

          {/* Tab Bar */}
          <div className="tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`tab-btn ${activeTab === tab.key ? "tab-btn-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Tab Content */}
        <div className="tab-content">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="grid">
              <section className="card">
                <h2>Order Summary</h2>
                <div className="rows">
                  {order.customerVisibleSummary.map((r) => (
                    <div className="row" key={r.k}>
                      <span className="k">{r.k}</span>
                      <span className="v">{r.v}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card">
                <h2>PM Contact</h2>
                <div className="rows">
                  <div className="row">
                    <span className="k">Name</span>
                    <span className="v">{order.pmContact.name}</span>
                  </div>
                  <div className="row">
                    <span className="k">Email</span>
                    <span className="v">{order.pmContact.email}</span>
                  </div>
                  <div className="row">
                    <span className="k">Phone</span>
                    <span className="v">{order.pmContact.phone}</span>
                  </div>
                </div>
              </section>

              <section className="card">
                <h2>Trades Snapshot</h2>
                <div className="snapshot-row">
                  <span className="snapshot-label">Filled / Required</span>
                  <span className="snapshot-value">{totalFilled} / {totalRequired}</span>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${totalRequired > 0 ? (totalFilled / totalRequired) * 100 : 0}%` }}
                  />
                </div>
                <div className="snapshot-hint">See the Trades tab for full breakdown.</div>
              </section>

              <section className="card">
                <h2>Quick Actions</h2>
                <div className="action-btns">
                  <button
                    className="action-btn action-btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/customer/orders/${order.id}/dispatch`);
                    }}
                  >
                    View Dispatch
                  </button>
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/customer/orders/${order.id}/timesheets`);
                    }}
                  >
                    View Time
                  </button>
                </div>
              </section>

              <section className="card card-wide">
                <h2>Customer Notes</h2>
                <ul className="notes">
                  {order.customerNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </section>

              <section className="card card-wide subtle">
                <div className="transparency-note">
                  <span className="transparency-icon">ℹ</span>
                  <span className="transparency-text">
                    Read-only transparency: This portal displays the same order information visible to MW4H internally (customer-safe view).
                  </span>
                </div>
              </section>
            </div>
          )}

          {/* TRADES TAB */}
          {activeTab === "trades" && (
            <div className="grid">
              <section className="card card-wide">
                <h2>Trade Requirements</h2>
                <div className="trades-summary">
                  <span className="trades-summary-label">Total Filled / Required:</span>
                  <span className="trades-summary-value">{totalFilled} / {totalRequired}</span>
                </div>
                <div className="trades-table">
                  <div className="trades-header">
                    <span className="trades-col-trade">Trade</span>
                    <span className="trades-col-num">Required</span>
                    <span className="trades-col-num">Filled</span>
                    <span className="trades-col-progress">Progress</span>
                  </div>
                  {MOCK_TRADES.map((t) => {
                    const pct = t.required > 0 ? (t.filled / t.required) * 100 : 0;
                    return (
                      <div className="trades-row" key={t.trade}>
                        <span className="trades-col-trade">{t.trade}</span>
                        <span className="trades-col-num">{t.required}</span>
                        <span className="trades-col-num">{t.filled}</span>
                        <span className="trades-col-progress">
                          <div className="mini-progress">
                            <div className="mini-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="mini-progress-pct">{Math.round(pct)}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="card card-wide subtle">
                <div className="transparency-note">
                  <span className="transparency-icon">ℹ</span>
                  <span className="transparency-text">
                    Trade requirements are updated as workers are dispatched. This view is read-only.
                  </span>
                </div>
              </section>
            </div>
          )}

          {/* SAFETY TAB */}
          {activeTab === "safety" && (
            <div className="grid">
              <section className="card">
                <h2>PPE Requirements</h2>
                <ul className="safety-list">
                  {MOCK_PPE.map((item) => (
                    <li key={item} className="safety-item">
                      <span className="safety-check">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card">
                <h2>Tools Required</h2>
                <ul className="safety-list">
                  {MOCK_TOOLS.map((item) => (
                    <li key={item} className="safety-item">
                      <span className="safety-check">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card card-wide">
                <h2>Dispatch Readiness Checklist</h2>
                <div className="readiness-list">
                  {MOCK_READINESS.map((r) => (
                    <div className="readiness-item" key={r.item}>
                      <span className={`readiness-status ${r.status === "complete" ? "readiness-complete" : "readiness-pending"}`}>
                        {r.status === "complete" ? "✓" : "○"}
                      </span>
                      <span className="readiness-label">{r.item}</span>
                      <span className={`readiness-badge ${r.status === "complete" ? "badge-complete" : "badge-pending"}`}>
                        {r.status === "complete" ? "Complete" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card card-wide subtle">
                <div className="transparency-note">
                  <span className="transparency-icon">ℹ</span>
                  <span className="transparency-text">
                    Safety requirements are site-specific. All dispatched workers meet these requirements before arrival.
                  </span>
                </div>
              </section>
            </div>
          )}

          {/* TIME TAB */}
          {activeTab === "time" && (
            <div className="grid">
              <section className="card card-wide">
                <h2>Weekly Timesheets</h2>
                <div className="timesheet-periods-list">
                  {MOCK_TIMESHEET_PERIODS.map((period) => (
                    <button
                      key={period.id}
                      type="button"
                      className="timesheet-period-card"
                      onClick={() => router.push(`/customer/orders/${order.id}/timesheets/${period.id}`)}
                    >
                      <div className="timesheet-period-info">
                        <span className="timesheet-period-label">{period.label}</span>
                        <span className="timesheet-period-id">{period.id}</span>
                      </div>
                      <div className="timesheet-period-status" data-status={period.status.toLowerCase()}>
                        {period.status}
                      </div>
                      <span className="timesheet-period-arrow">→</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === "invoices" && (
            <div className="grid">
              <section className="card card-wide">
                <h2>Invoice History</h2>
                <div className="invoices-table">
                  <div className="invoices-header">
                    <span className="inv-col-id">Invoice #</span>
                    <span className="inv-col-period">Period</span>
                    <span className="inv-col-amount">Amount</span>
                    <span className="inv-col-status">Status</span>
                  </div>
                  {MOCK_INVOICES.map((inv) => (
                    <div className="invoices-row" key={inv.id}>
                      <span className="inv-col-id">{inv.id}</span>
                      <span className="inv-col-period">{inv.period}</span>
                      <span className="inv-col-amount">{inv.amount}</span>
                      <span className="inv-col-status">
                        <span className={`inv-status-badge inv-status-${inv.status.toLowerCase()}`}>
                          {inv.status}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card card-wide subtle">
                <div className="transparency-note">
                  <span className="transparency-icon">ℹ</span>
                  <span className="transparency-text">
                    Invoices are generated based on approved timesheets. Contact your account representative for billing questions.
                  </span>
                </div>
              </section>
            </div>
          )}

          {/* CHANGE ORDERS TAB (Read-only) */}
          {activeTab === "changeOrders" && (
            <div className="grid">
              <section className="card card-wide">
                <h2>Change Orders</h2>
                <div className="co-table">
                  <div className="co-table-header">
                    <span className="co-col-status">Status</span>
                    <span className="co-col-employee">Employee</span>
                    <span className="co-col-type">Change Type</span>
                    <span className="co-col-delta">Delta</span>
                    <span className="co-col-effective">Effective Date</span>
                    <span className="co-col-requested-by">Requested By</span>
                    <span className="co-col-method">Approval Method</span>
                    <span className="co-col-proof">Proof</span>
                    <span className="co-col-amendment">Amendment</span>
                    <span className="co-col-requested-on">Requested On</span>
                  </div>
                  {MOCK_CHANGE_ORDERS.map((co) => {
                    const statusStyle = getChangeOrderStatusStyle(co.status);
                    const isApproved = co.status === "Approved";
                    return (
                      <button
                        key={co.id}
                        type="button"
                        className={`co-table-row ${isApproved ? "co-row-approved" : ""}`}
                        onClick={() => setSelectedChangeOrder(co)}
                      >
                        <span className="co-col-status">
                          <span
                            className="co-status-badge"
                            style={{
                              background: statusStyle.bg,
                              color: statusStyle.color,
                              borderColor: statusStyle.border,
                            }}
                          >
                            {co.status}
                          </span>
                        </span>
                        <span className="co-col-employee">{co.employee}</span>
                        <span className="co-col-type">{co.changeType}</span>
                        <span className="co-col-delta">{co.delta}</span>
                        <span className="co-col-effective">{co.effectiveDate}</span>
                        <span className="co-col-requested-by">{co.requestedBy}</span>
                        <span className="co-col-method">{co.approvalMethod}</span>
                        <span className="co-col-proof">{co.proof}</span>
                        <span className="co-col-amendment">{co.dispatchAmendment}</span>
                        <span className="co-col-requested-on">{co.requestedOn}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="card card-wide subtle">
                <div className="transparency-note">
                  <span className="transparency-icon">ℹ</span>
                  <span className="transparency-text">
                    Change orders reflect rate adjustments approved for this order. This view is read-only. Contact your MW4H representative for questions.
                  </span>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Change Order Detail Panel (Side Panel - Read-only) */}
        {selectedChangeOrder && (
          <div className="co-detail-overlay" onClick={() => setSelectedChangeOrder(null)}>
            <div className="co-detail-panel" onClick={(e) => e.stopPropagation()}>
              <div className="co-detail-header">
                <div className="co-detail-header-left">
                  <h3>Change Order Details</h3>
                  <span className="co-readonly-badge">Read-only</span>
                </div>
                <button
                  type="button"
                  className="co-detail-close"
                  onClick={() => setSelectedChangeOrder(null)}
                >
                  ×
                </button>
              </div>
              <div className="co-detail-body">
                {/* Status Badge */}
                <div className="co-detail-status-row">
                  {(() => {
                    const statusStyle = getChangeOrderStatusStyle(selectedChangeOrder.status);
                    const isApproved = selectedChangeOrder.status === "Approved";
                    return (
                      <>
                        <span
                          className="co-detail-status-badge"
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            borderColor: statusStyle.border,
                          }}
                        >
                          {selectedChangeOrder.status}
                        </span>
                        {isApproved && (
                          <span className="co-immutable-badge">Immutable</span>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Full Summary */}
                <div className="co-detail-section">
                  <h4>Change Summary</h4>
                  <p className={`co-detail-summary ${selectedChangeOrder.status === "Approved" ? "co-summary-muted" : ""}`}>
                    {selectedChangeOrder.fullSummary}
                  </p>
                </div>

                {/* Details Grid */}
                <div className="co-detail-section">
                  <h4>Details</h4>
                  <div className="co-detail-grid">
                    <div className="co-detail-item">
                      <span className="co-detail-label">Employee</span>
                      <span className="co-detail-value">{selectedChangeOrder.employee}</span>
                    </div>
                    <div className="co-detail-item">
                      <span className="co-detail-label">Change Type</span>
                      <span className="co-detail-value">{selectedChangeOrder.changeType}</span>
                    </div>
                    <div className="co-detail-item">
                      <span className="co-detail-label">Delta</span>
                      <span className="co-detail-value co-delta-value">{selectedChangeOrder.delta}</span>
                    </div>
                    <div className="co-detail-item">
                      <span className="co-detail-label">Effective Date</span>
                      <span className="co-detail-value">{selectedChangeOrder.effectiveDate}</span>
                    </div>
                    <div className="co-detail-item">
                      <span className="co-detail-label">Requested By</span>
                      <span className="co-detail-value">{selectedChangeOrder.requestedBy}</span>
                    </div>
                    <div className="co-detail-item">
                      <span className="co-detail-label">Requested On</span>
                      <span className="co-detail-value">{selectedChangeOrder.requestedOn}</span>
                    </div>
                  </div>
                </div>

                {/* Approval Info */}
                <div className="co-detail-section">
                  <h4>Approval Information</h4>
                  <div className="co-detail-grid">
                    <div className="co-detail-item">
                      <span className="co-detail-label">Approval Method</span>
                      <span className="co-detail-value">{selectedChangeOrder.approvalMethod}</span>
                    </div>
                    <div className="co-detail-item">
                      <span className="co-detail-label">Proof</span>
                      <span className="co-detail-value">{selectedChangeOrder.proof}</span>
                    </div>
                  </div>
                </div>

                {/* Dispatch Amendment */}
                {selectedChangeOrder.dispatchAmendment !== "—" && (
                  <div className="co-detail-section">
                    <h4>Dispatch Amendment</h4>
                    <div className="co-amendment-badge">
                      Dispatch Amendment: {selectedChangeOrder.dispatchAmendment}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="footer-note">
          <span className="i">i</span>
          <span className="t">
            This is a UI shell. No customer editing is available here.
          </span>
        </div>
      </div>

      <style jsx>{`
        .customer-order-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
        }

        /* MATCH INTERNAL CONTAINER + CENTER CONTENT */
        .customer-order-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }

        .crumbs {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .crumb {
          background: none;
          border: none;
          padding: 0;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          font-size: 13px;
        }
        .crumb:hover {
          color: #60a5fa;
        }
        .crumb-sep {
          color: rgba(255, 255, 255, 0.35);
          font-size: 12px;
        }
        .crumb-current {
          color: rgba(255, 255, 255, 0.55);
          font-size: 13px;
        }

        .header {
          margin-bottom: 22px;
        }

        .badge-row {
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .portal-badge {
          font-size: 11px;
          font-weight: 700;
          color: #86efac;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          padding: 6px 10px;
          border-radius: 999px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .status {
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          white-space: nowrap;
        }

        .title {
          margin: 10px 0 8px 0;
          font-size: 34px;
          font-weight: 800;
          letter-spacing: -0.6px;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .meta {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: center;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .meta-line.muted {
          color: rgba(255, 255, 255, 0.55);
        }

        /* Tab Bar */
        .tab-bar {
          display: flex;
          gap: 6px;
          margin: 22px 0 0 0;
          justify-content: center;
          flex-wrap: wrap;
        }

        .tab-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.65);
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s ease;
        }

        .tab-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.85);
        }

        .tab-btn-active {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.35);
          color: #93c5fd;
        }

        .tab-btn-active:hover {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(59, 130, 246, 0.4);
          color: #93c5fd;
        }

        .tab-content {
          margin-top: 18px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 18px;
          text-align: left;
        }

        .card-wide {
          grid-column: span 2;
        }

        .subtle {
          background: rgba(255, 255, 255, 0.015);
          border-style: dashed;
        }

        .card h2 {
          margin: 0 0 12px 0;
          font-size: 12px;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.55);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .rows {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .k {
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          white-space: nowrap;
        }

        .v {
          text-align: right;
          color: rgba(255, 255, 255, 0.85);
        }

        .notes {
          margin: 0;
          padding: 0 0 0 18px;
          color: rgba(255, 255, 255, 0.75);
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 14px;
        }

        /* Overview - Snapshot */
        .snapshot-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .snapshot-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .snapshot-value {
          font-size: 18px;
          font-weight: 700;
          color: #93c5fd;
        }

        .progress-bar-container {
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .snapshot-hint {
          margin-top: 10px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }

        /* Action Buttons */
        .action-btns {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .action-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.85);
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .action-btn-primary {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.3);
          color: #93c5fd;
        }

        .action-btn-primary:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
        }

        /* Transparency Note */
        .transparency-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .transparency-icon {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .transparency-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.5;
        }

        /* Trades Tab */
        .trades-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          background: rgba(59, 130, 246, 0.08);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .trades-summary-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .trades-summary-value {
          font-size: 16px;
          font-weight: 700;
          color: #93c5fd;
        }

        .trades-table {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .trades-header,
        .trades-row {
          display: grid;
          grid-template-columns: 1.5fr 0.8fr 0.8fr 1.5fr;
          gap: 12px;
          padding: 10px 12px;
          align-items: center;
        }

        .trades-header {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .trades-row {
          background: rgba(255, 255, 255, 0.015);
          border-radius: 6px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .trades-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .trades-col-trade {
          font-weight: 600;
        }

        .trades-col-num {
          text-align: center;
        }

        .trades-col-progress {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mini-progress {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          overflow: hidden;
        }

        .mini-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
          border-radius: 3px;
        }

        .mini-progress-pct {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          min-width: 36px;
          text-align: right;
        }

        /* Safety Tab */
        .safety-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .safety-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .safety-check {
          color: #4ade80;
          font-size: 14px;
          font-weight: 700;
        }

        .readiness-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .readiness-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }

        .readiness-status {
          font-size: 16px;
          width: 24px;
          text-align: center;
        }

        .readiness-complete {
          color: #4ade80;
        }

        .readiness-pending {
          color: rgba(255, 255, 255, 0.35);
        }

        .readiness-label {
          flex: 1;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .readiness-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .badge-complete {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
        }

        .badge-pending {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
        }

        /* Time Tab - Timesheet Periods List */
        .timesheet-periods-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .timesheet-period-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .timesheet-period-card:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.25);
        }

        .timesheet-period-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .timesheet-period-label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .timesheet-period-id {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-family: monospace;
        }

        .timesheet-period-status {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .timesheet-period-status[data-status="draft"] {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .timesheet-period-status[data-status="submitted"] {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        .timesheet-period-status[data-status="finalized"] {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .timesheet-period-arrow {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.4);
          transition: color 0.15s ease;
        }

        .timesheet-period-card:hover .timesheet-period-arrow {
          color: #60a5fa;
        }

        /* Invoices Tab */
        .invoices-table {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .invoices-header,
        .invoices-row {
          display: grid;
          grid-template-columns: 1.2fr 1.5fr 1fr 0.8fr;
          gap: 12px;
          padding: 10px 12px;
          align-items: center;
        }

        .invoices-header {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .invoices-row {
          background: rgba(255, 255, 255, 0.015);
          border-radius: 6px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .invoices-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .inv-col-id {
          font-weight: 600;
          font-family: monospace;
        }

        .inv-col-amount {
          font-weight: 600;
          color: #4ade80;
        }

        .inv-status-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .inv-status-paid {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
        }

        .inv-status-sent {
          background: rgba(59, 130, 246, 0.12);
          color: #60a5fa;
        }

        .inv-status-draft {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.6);
        }

        .inv-status-partial {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
        }

        /* Change Orders Tab */
        .co-table {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-x: auto;
        }

        .co-table-header,
        .co-table-row {
          display: grid;
          grid-template-columns: 100px 140px 100px 110px 110px 150px 130px 120px 90px 110px;
          gap: 8px;
          padding: 12px 14px;
          align-items: center;
          min-width: 1160px;
        }

        .co-table-header {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .co-table-row {
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid transparent;
          border-radius: 6px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
          width: 100%;
        }

        .co-table-row:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.2);
        }

        .co-row-approved {
          opacity: 0.75;
        }

        .co-row-approved:hover {
          opacity: 1;
        }

        .co-status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .co-col-delta {
          font-weight: 600;
          color: #4ade80;
        }

        .co-col-amendment {
          font-family: monospace;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Change Order Detail Panel (Side Panel) */
        .co-detail-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
        }

        .co-detail-panel {
          width: 480px;
          max-width: 90vw;
          height: 100%;
          background: #111827;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .co-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .co-detail-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .co-detail-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #fff;
        }

        .co-readonly-badge {
          font-size: 9px;
          padding: 3px 8px;
          background: rgba(34, 197, 94, 0.1);
          color: #86efac;
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-weight: 700;
        }

        .co-detail-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          transition: color 0.15s ease;
        }

        .co-detail-close:hover {
          color: #fff;
        }

        .co-detail-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .co-detail-status-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .co-detail-status-badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .co-immutable-badge {
          display: inline-block;
          padding: 4px 10px;
          background: rgba(148, 163, 184, 0.15);
          color: rgba(148, 163, 184, 0.8);
          border: 1px dashed rgba(148, 163, 184, 0.3);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .co-detail-section {
          margin-bottom: 24px;
        }

        .co-detail-section h4 {
          margin: 0 0 12px 0;
          font-size: 12px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .co-detail-summary {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.85);
          padding: 14px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .co-summary-muted {
          opacity: 0.7;
          border-style: dashed;
        }

        .co-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .co-detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .co-detail-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .co-detail-value {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .co-delta-value {
          color: #4ade80;
          font-weight: 600;
        }

        .co-amendment-badge {
          display: inline-block;
          padding: 8px 14px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #93c5fd;
        }

        .footer-note {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 10px;
          margin-top: 22px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          text-align: left;
        }

        .i {
          font-size: 16px;
          opacity: 0.8;
          margin-top: 1px;
        }

        .t {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.5;
        }

        @media (max-width: 860px) {
          .customer-order-container {
            padding: 20px;
          }
          .grid {
            grid-template-columns: 1fr;
          }
          .card-wide {
            grid-column: span 1;
          }
          .v {
            text-align: left;
          }
          .row {
            flex-direction: column;
            align-items: flex-start;
          }
          .footer-note {
            justify-content: flex-start;
          }
          .trades-header,
          .trades-row {
            grid-template-columns: 1fr 0.6fr 0.6fr 1fr;
            font-size: 12px;
          }
          .invoices-header,
          .invoices-row {
            grid-template-columns: 1fr 1fr 0.8fr 0.7fr;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
