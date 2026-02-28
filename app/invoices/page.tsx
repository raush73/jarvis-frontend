"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Invoice status type
type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue" | "Void";

// Mock invoice data
type Invoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  orderId: string | null;
  orderNumber: string | null;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  total: string;
  lineItemCount: number;
};

// Mock invoices data
const MOCK_INVOICES: Invoice[] = [
  {
    id: "INV-2024-0001",
    invoiceNumber: "INV-2024-0001",
    customerId: "CUST-001",
    customerName: "Turner Construction",
    orderId: "ORD-2024-001",
    orderNumber: "ORD-2024-001",
    status: "Paid",
    invoiceDate: "2024-02-01",
    dueDate: "2024-03-01",
    total: "$12,450.00",
    lineItemCount: 3,
  },
  {
    id: "INV-2024-0002",
    invoiceNumber: "INV-2024-0002",
    customerId: "CUST-001",
    customerName: "Turner Construction",
    orderId: "ORD-2024-001",
    orderNumber: "ORD-2024-001",
    status: "Sent",
    invoiceDate: "2024-02-15",
    dueDate: "2024-03-15",
    total: "$8,320.00",
    lineItemCount: 2,
  },
  {
    id: "INV-2024-0003",
    invoiceNumber: "INV-2024-0003",
    customerId: "CUST-001",
    customerName: "Turner Construction",
    orderId: "ORD-2024-010",
    orderNumber: "ORD-2024-010",
    status: "Draft",
    invoiceDate: "2024-03-01",
    dueDate: "2024-04-01",
    total: "$5,680.00",
    lineItemCount: 1,
  },
  {
    id: "INV-2024-0004",
    invoiceNumber: "INV-2024-0004",
    customerId: "CUST-001",
    customerName: "Turner Construction",
    orderId: null,
    orderNumber: null,
    status: "Overdue",
    invoiceDate: "2024-01-15",
    dueDate: "2024-02-15",
    total: "$3,200.00",
    lineItemCount: 1,
  },
  {
    id: "INV-2024-0005",
    invoiceNumber: "INV-2024-0005",
    customerId: "CUST-002",
    customerName: "Bechtel Corporation",
    orderId: "ORD-2024-020",
    orderNumber: "ORD-2024-020",
    status: "Paid",
    invoiceDate: "2024-02-10",
    dueDate: "2024-03-10",
    total: "$22,100.00",
    lineItemCount: 5,
  },
  {
    id: "INV-2024-0006",
    invoiceNumber: "INV-2024-0006",
    customerId: "CUST-002",
    customerName: "Bechtel Corporation",
    orderId: "ORD-2024-020",
    orderNumber: "ORD-2024-020",
    status: "Sent",
    invoiceDate: "2024-03-01",
    dueDate: "2024-04-01",
    total: "$18,750.00",
    lineItemCount: 4,
  },
];

// Mock customer names lookup
const MOCK_CUSTOMERS: Record<string, string> = {
  "CUST-001": "Turner Construction",
  "CUST-002": "Bechtel Corporation",
};

// Status badge styling
function getStatusStyle(status: InvoiceStatus) {
  switch (status) {
    case "Paid":
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#4ade80", border: "rgba(34, 197, 94, 0.3)" };
    case "Sent":
      return { bg: "rgba(59, 130, 246, 0.12)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" };
    case "Draft":
      return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.3)" };
    case "Overdue":
      return { bg: "rgba(239, 68, 68, 0.12)", color: "#f87171", border: "rgba(239, 68, 68, 0.3)" };
    case "Void":
      return { bg: "rgba(107, 114, 128, 0.12)", color: "#9ca3af", border: "rgba(107, 114, 128, 0.3)" };
    default:
      return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.3)" };
  }
}

// Inner component that uses useSearchParams
function InvoiceHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read query params
  const customerId = searchParams.get("customerId");
  const orderId = searchParams.get("orderId");

  // Get customer name for context chip
  const customerName = customerId ? MOCK_CUSTOMERS[customerId] || customerId : null;

  // Filter invoices based on context (UI-only filtering)
  const filteredInvoices = MOCK_INVOICES.filter((inv) => {
    // If customerId is provided, filter by customer
    if (customerId && inv.customerId !== customerId) {
      return false;
    }
    // If orderId is provided, filter by order
    if (orderId && inv.orderId !== orderId) {
      return false;
    }
    return true;
  });

  // Handle back navigation
  const handleBack = () => {
    if (orderId && customerId) {
      // Came from Order Detail
      router.push(`/orders/${orderId}/view?from=customer&customerId=${customerId}`);
    } else if (customerId) {
      // Came from Customer Profile
      router.push(`/customers/${customerId}`);
    } else {
      // Default fallback
      router.push("/");
    }
  };

  // Handle invoice click
  const handleInvoiceClick = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}`);
  };

  return (
    <div className="invoice-hub-container">
      {/* Page Header */}
      <div className="hub-header">
        <div className="header-left">
          <button className="back-btn" onClick={handleBack}>
            ← Back
          </button>
          <h1>Invoices</h1>
        </div>
      </div>

      {/* Context Chips */}
      {(customerName || orderId) && (
        <div className="context-chips">
          {customerName && (
            <div className="context-chip customer-chip">
              <span className="chip-label">Customer</span>
              <span className="chip-value">{customerName}</span>
            </div>
          )}
          {orderId && (
            <div className="context-chip order-chip">
              <span className="chip-label">Order</span>
              <span className="chip-value">{orderId}</span>
            </div>
          )}
        </div>
      )}

      {/* Invoices Table */}
      <div className="invoices-section">
        <div className="section-header">
          <h2>Invoice List</h2>
          <span className="invoice-count">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? "s" : ""}</span>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📄</span>
            <span className="empty-text">No invoices found for this context.</span>
          </div>
        ) : (
          <div className="invoices-table">
            <div className="table-header">
              <span className="col-status">Status</span>
              <span className="col-number">Invoice #</span>
              <span className="col-date">Invoice Date</span>
              <span className="col-due">Due Date</span>
              <span className="col-order">Order</span>
              <span className="col-total">Total</span>
              <span className="col-items">Items</span>
            </div>
            {filteredInvoices.map((invoice) => {
              const statusStyle = getStatusStyle(invoice.status);
              return (
                <button
                  key={invoice.id}
                  type="button"
                  className="table-row"
                  onClick={() => handleInvoiceClick(invoice.id)}
                >
                  <span className="col-status">
                    <span
                      className="status-badge"
                      style={{
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        borderColor: statusStyle.border,
                      }}
                    >
                      {invoice.status}
                    </span>
                  </span>
                  <span className="col-number">{invoice.invoiceNumber}</span>
                  <span className="col-date">{new Date(invoice.invoiceDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span className="col-due">{new Date(invoice.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span className="col-order">{invoice.orderNumber || "—"}</span>
                  <span className="col-total">{invoice.total}</span>
                  <span className="col-items">{invoice.lineItemCount}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .invoice-hub-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
        }

        .hub-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .back-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s ease;
        }

        .back-btn:hover {
          color: #3b82f6;
        }

        .hub-header h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0;
          letter-spacing: -0.5px;
        }

        /* Context Chips */
        .context-chips {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .context-chip {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 18px;
          border-radius: 10px;
          min-width: 140px;
        }

        .customer-chip {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
        }

        .order-chip {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.25);
        }

        .chip-label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .chip-value {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }

        .customer-chip .chip-value {
          color: #60a5fa;
        }

        .order-chip .chip-value {
          color: #a78bfa;
          font-family: var(--font-geist-mono), monospace;
        }

        /* Invoices Section */
        .invoices-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .section-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .invoice-count {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Empty State */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          gap: 12px;
        }

        .empty-icon {
          font-size: 40px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Invoices Table */
        .invoices-table {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .table-header,
        .table-row {
          display: grid;
          grid-template-columns: 100px 160px 120px 120px 140px 120px 80px;
          gap: 12px;
          padding: 12px 16px;
          align-items: center;
        }

        .table-header {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .table-row {
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

        .table-row:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.2);
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .col-number {
          font-family: var(--font-geist-mono), monospace;
          color: #3b82f6;
          font-weight: 500;
        }

        .col-order {
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
        }

        .col-total {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
          color: #fff;
        }

        .col-items {
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
        }

        .col-date,
        .col-due {
          color: rgba(255, 255, 255, 0.7);
        }
      `}</style>
    </div>
  );
}

// Main component with Suspense boundary
export default function InvoiceHubPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", color: "rgba(255,255,255,0.5)" }}>Loading...</div>}>
      <InvoiceHubContent />
    </Suspense>
  );
}
