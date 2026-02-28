"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

// Mock invoice data
const MOCK_INVOICES = [
  {
    id: "INV-2024-0001",
    customer: "Turner Construction",
    orderRef: "ORD-2024-001",
    invoiceDate: "2024-01-15",
    amount: 45750.00,
    paidToDate: 45750.00,
  },
  {
    id: "INV-2024-0002",
    customer: "Skanska USA",
    orderRef: "ORD-2024-002",
    invoiceDate: "2024-01-22",
    amount: 32400.00,
    paidToDate: 15000.00,
  },
  {
    id: "INV-2024-0003",
    customer: "McCarthy Building",
    orderRef: "ORD-2024-003",
    invoiceDate: "2024-02-01",
    amount: 67200.00,
    paidToDate: 0,
  },
  {
    id: "INV-2024-0004",
    customer: "DPR Construction",
    orderRef: "ORD-2024-004",
    invoiceDate: "2024-02-05",
    amount: 28900.00,
    paidToDate: 28900.00,
  },
  {
    id: "INV-2024-0005",
    customer: "Hensel Phelps",
    orderRef: "ORD-2024-005",
    invoiceDate: "2024-02-10",
    amount: 54600.00,
    paidToDate: 20000.00,
  },
  {
    id: "INV-2024-0006",
    customer: "Holder Construction",
    orderRef: "ORD-2024-006",
    invoiceDate: "2024-02-12",
    amount: 19800.00,
    paidToDate: 0,
  },
];

type FilterType = "all" | "unpaid" | "partial" | "paid";

function getStatus(amount: number, paidToDate: number): "Unpaid" | "Partially Paid" | "Paid" {
  if (paidToDate <= 0) return "Unpaid";
  if (paidToDate >= amount) return "Paid";
  return "Partially Paid";
}

function StatusBadge({ status }: { status: "Unpaid" | "Partially Paid" | "Paid" }) {
  const styles: Record<string, React.CSSProperties> = {
    Unpaid: {
      background: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    },
    "Partially Paid": {
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
    <span style={{
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: "5px",
      fontSize: "12px",
      fontWeight: 600,
      ...styles[status],
    }}>
      {status}
    </span>
  );
}

export default function InvoicingPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredInvoices = useMemo(() => {
    return MOCK_INVOICES.filter((inv) => {
      const status = getStatus(inv.amount, inv.paidToDate);
      switch (filter) {
        case "unpaid":
          return status === "Unpaid";
        case "partial":
          return status === "Partially Paid";
        case "paid":
          return status === "Paid";
        default:
          return true;
      }
    });
  }, [filter]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div style={{
      padding: "24px 40px 60px",
      maxWidth: "1200px",
      margin: "0 auto",
    }}>
      {/* Page Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "24px",
      }}>
        <div>
          <h1 style={{
            fontSize: "26px",
            fontWeight: 600,
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.5px",
          }}>
            Invoices
          </h1>
          <p style={{
            fontSize: "14px",
            color: "rgba(255, 255, 255, 0.5)",
            marginTop: "6px",
          }}>
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "20px",
      }}>
        {[
          { key: "all", label: "All" },
          { key: "unpaid", label: "Unpaid" },
          { key: "partial", label: "Partial" },
          { key: "paid", label: "Paid" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as FilterType)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: filter === tab.key ? "#fff" : "rgba(255, 255, 255, 0.55)",
              background: filter === tab.key ? "rgba(59, 130, 246, 0.15)" : "rgba(255, 255, 255, 0.04)",
              border: filter === tab.key ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoices Table */}
      <div style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "12px",
        overflow: "hidden",
      }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
        }}>
          <thead>
            <tr style={{ background: "rgba(255, 255, 255, 0.03)" }}>
              <th style={thStyle}>Invoice #</th>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Job / Order Ref</th>
              <th style={thStyle}>Invoice Date</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Paid To Date</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Balance</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => {
              const status = getStatus(inv.amount, inv.paidToDate);
              const balance = Math.max(0, inv.amount - inv.paidToDate);

              return (
                <tr
                  key={inv.id}
                  onClick={() => router.push(`/accounting/invoicing/${inv.id}`)}
                  style={{
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={{ ...tdStyle, fontFamily: "var(--font-geist-mono), monospace", fontWeight: 500, color: "#3b82f6" }}>
                    {inv.id}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{inv.customer}</td>
                  <td style={{ ...tdStyle, color: "rgba(255, 255, 255, 0.6)" }}>{inv.orderRef}</td>
                  <td style={tdStyle}>{formatDate(inv.invoiceDate)}</td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono), monospace" }}>
                    {formatCurrency(inv.amount)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono), monospace", color: "rgba(255, 255, 255, 0.6)" }}>
                    {formatCurrency(inv.paidToDate)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono), monospace" }}>
                    {formatCurrency(balance)}
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredInvoices.length === 0 && (
          <div style={{
            padding: "40px",
            textAlign: "center",
            color: "rgba(255, 255, 255, 0.4)",
            fontSize: "14px",
          }}>
            No invoices match the selected filter.
          </div>
        )}
      </div>

      {/* Audit Note */}
      <div style={{
        marginTop: "24px",
        padding: "12px 16px",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "8px",
      }}>
        <p style={{
          fontSize: "12px",
          color: "rgba(255, 255, 255, 0.4)",
          margin: 0,
        }}>
          <strong style={{ color: "rgba(255, 255, 255, 0.55)" }}>Audit:</strong>{" "}
          Invoice numbers are consecutive. Paid invoices cannot be deleted (void/credit note required).
        </p>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "14px 20px",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: 600,
  color: "rgba(255, 255, 255, 0.5)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
};

const tdStyle: React.CSSProperties = {
  padding: "16px 20px",
  fontSize: "14px",
  color: "rgba(255, 255, 255, 0.85)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
};

