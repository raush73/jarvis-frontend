"use client";

import Link from "next/link";

// Mock data for working timesheets grouped by customer (UI-only)
const CUSTOMER_GROUPS = [
  {
    customerName: "Acme Manufacturing",
    orders: [
      {
        id: "wts-001",
        orderRef: "ORD-1042",
        weekEnding: "2026-02-08",
        workers: 12,
        status: "Draft" as const,
      },
      {
        id: "wts-009",
        orderRef: "ORD-1051",
        weekEnding: "2026-02-08",
        workers: 8,
        status: "Submitted" as const,
      },
    ],
  },
  {
    customerName: "Summit Industries",
    orders: [
      {
        id: "wts-002",
        orderRef: "ORD-1038",
        weekEnding: "2026-02-08",
        workers: 8,
        status: "Submitted" as const,
      },
    ],
  },
  {
    customerName: "Precision Parts Co",
    orders: [
      {
        id: "wts-003",
        orderRef: "ORD-1045",
        weekEnding: "2026-02-08",
        workers: 5,
        status: "Needs Customer" as const,
      },
      {
        id: "wts-010",
        orderRef: "ORD-1052",
        weekEnding: "2026-02-08",
        workers: 3,
        status: "Draft" as const,
      },
    ],
  },
  {
    customerName: "Delta Logistics",
    orders: [
      {
        id: "wts-004",
        orderRef: "ORD-1039",
        weekEnding: "2026-02-08",
        workers: 15,
        status: "Ready to Snapshot" as const,
      },
    ],
  },
  {
    customerName: "Northern Steel",
    orders: [
      {
        id: "wts-005",
        orderRef: "ORD-1041",
        weekEnding: "2026-02-08",
        workers: 10,
        status: "Draft" as const,
      },
    ],
  },
  {
    customerName: "Midwest Assembly",
    orders: [
      {
        id: "wts-006",
        orderRef: "ORD-1044",
        weekEnding: "2026-02-08",
        workers: 7,
        status: "Submitted" as const,
      },
      {
        id: "wts-011",
        orderRef: "ORD-1053",
        weekEnding: "2026-02-08",
        workers: 4,
        status: "Needs Customer" as const,
      },
      {
        id: "wts-012",
        orderRef: "ORD-1054",
        weekEnding: "2026-02-08",
        workers: 6,
        status: "Draft" as const,
      },
    ],
  },
  {
    customerName: "Harbor Freight Services",
    orders: [
      {
        id: "wts-007",
        orderRef: "ORD-1046",
        weekEnding: "2026-02-08",
        workers: 9,
        status: "Draft" as const,
      },
    ],
  },
  {
    customerName: "Central Fabrication",
    orders: [
      {
        id: "wts-008",
        orderRef: "ORD-1047",
        weekEnding: "2026-02-08",
        workers: 6,
        status: "Needs Customer" as const,
      },
    ],
  },
];

function getStatusColor(
  status: "Draft" | "Submitted" | "Needs Customer" | "Ready to Snapshot"
): string {
  switch (status) {
    case "Draft":
      return "#6b7280";
    case "Submitted":
      return "#2563eb";
    case "Needs Customer":
      return "#d97706";
    case "Ready to Snapshot":
      return "#059669";
    default:
      return "#6b7280";
  }
}

export default function TimeEntryHubPage() {
  return (
    <div style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 600, marginBottom: "8px" }}>
            Time Entry
          </h1>
          <p style={{ color: "#6b7280", fontSize: "14px" }}>
            Internal MW4H hub of open working timesheets — grouped by customer.
          </p>
        </div>

        {/* Status Legend */}
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            minWidth: "220px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "10px" }}>
            Status Legend
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#6b7280", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>Draft</span>
              <span style={{ fontSize: "11px", color: "#6b7280" }}>— Internal entry in progress</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#2563eb", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>Submitted</span>
              <span style={{ fontSize: "11px", color: "#6b7280" }}>— Submitted for customer review</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#d97706", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>Needs Customer</span>
              <span style={{ fontSize: "11px", color: "#6b7280" }}>— Waiting on customer confirmation</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#059669", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "#111827", fontWeight: 500 }}>Ready to Snapshot</span>
              <span style={{ fontSize: "11px", color: "#6b7280" }}>— Final review before snapshot</span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "32px" }}>
        {CUSTOMER_GROUPS.map((group) => (
          <div
            key={group.customerName}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              backgroundColor: "#fff",
              overflow: "hidden",
            }}
          >
            {/* Customer Header */}
            <div
              style={{
                padding: "16px 20px",
                backgroundColor: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#111827" }}>
                {group.customerName}
              </div>
              <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                {group.orders.length} open working timesheet{group.orders.length !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Order Rows */}
            <div>
              {group.orders.map((order, idx) => (
                <div
                  key={order.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 20px",
                    borderBottom: idx < group.orders.length - 1 ? "1px solid #f3f4f6" : "none",
                    gap: "16px",
                  }}
                >
                  {/* Order Ref */}
                  <div style={{ flex: "0 0 100px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                      {order.orderRef}
                    </div>
                  </div>

                  {/* Week Ending */}
                  <div style={{ flex: "0 0 140px" }}>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>
                      Week Ending: {order.weekEnding}
                    </div>
                  </div>

                  {/* Workers */}
                  <div style={{ flex: "0 0 80px" }}>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>
                      {order.workers} workers
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ flex: "1" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 500,
                        backgroundColor: `${getStatusColor(order.status)}15`,
                        color: getStatusColor(order.status),
                      }}
                    >
                      {order.status}
                    </span>
                  </div>

                  {/* Action */}
                  <div style={{ flex: "0 0 auto" }}>
                    <Link
                      href={`/time-entry/${order.id}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 16px",
                        backgroundColor: "#2563eb",
                        color: "#fff",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      Open Working Timesheet
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Boundary Note */}
      <div
        style={{
          padding: "16px 20px",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          color: "#6b7280",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
      >
        Snapshots remain under Customer → Orders → Order → Timesheets.
        <br />
        Time Entry is for working timesheets only.
      </div>
    </div>
  );
}
