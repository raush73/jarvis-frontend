"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import LockedSnapshotPanel from "@/components/LockedSnapshotPanel";

// Mock invoice data (same as list page for consistency)
const MOCK_INVOICES: Record<string, InvoiceData> = {
  "INV-2024-0001": {
    id: "INV-2024-0001",
    customer: "Turner Construction",
    customerAddress: "123 Main St, Los Angeles, CA 90012",
    orderRef: "ORD-2024-001",
    billingPeriod: "Jan 1 – Jan 15, 2024",
    invoiceDate: "2024-01-15",
    dueDate: "2024-02-15",
    lineItems: [
      { description: "Pipefitter - Regular Hours (320 hrs @ $85)", qty: 320, rate: 85, amount: 27200 },
      { description: "Millwright - Regular Hours (180 hrs @ $95)", qty: 180, rate: 95, amount: 17100 },
      { description: "Per Diem Allowance", qty: 1, rate: 1450, amount: 1450 },
    ],
    subtotal: 45750,
    tax: 0,
    total: 45750,
    initialPayments: [
      { id: "PMT-001", date: "2024-01-25", amount: 25000, method: "ACH", reference: "ACH-8827361" },
      { id: "PMT-002", date: "2024-02-10", amount: 20750, method: "Check", reference: "CHK-4492" },
    ],
  },
  "INV-2024-0002": {
    id: "INV-2024-0002",
    customer: "Skanska USA",
    customerAddress: "456 Harbor Blvd, San Diego, CA 92101",
    orderRef: "ORD-2024-002",
    billingPeriod: "Jan 15 – Jan 22, 2024",
    invoiceDate: "2024-01-22",
    dueDate: "2024-02-22",
    lineItems: [
      { description: "Pipefitter - Regular Hours (240 hrs @ $85)", qty: 240, rate: 85, amount: 20400 },
      { description: "Millwright - Regular Hours (120 hrs @ $95)", qty: 120, rate: 95, amount: 11400 },
      { description: "Equipment Rental", qty: 1, rate: 600, amount: 600 },
    ],
    subtotal: 32400,
    tax: 0,
    total: 32400,
    initialPayments: [
      { id: "PMT-003", date: "2024-02-01", amount: 15000, method: "Wire", reference: "WIR-2024-0201" },
    ],
  },
  "INV-2024-0003": {
    id: "INV-2024-0003",
    customer: "McCarthy Building",
    customerAddress: "789 Desert Rd, Phoenix, AZ 85001",
    orderRef: "ORD-2024-003",
    billingPeriod: "Jan 22 – Feb 1, 2024",
    invoiceDate: "2024-02-01",
    dueDate: "2024-03-01",
    lineItems: [
      { description: "Pipefitter - Regular Hours (480 hrs @ $85)", qty: 480, rate: 85, amount: 40800 },
      { description: "Millwright - Regular Hours (240 hrs @ $95)", qty: 240, rate: 95, amount: 22800 },
      { description: "Safety Equipment", qty: 1, rate: 3600, amount: 3600 },
    ],
    subtotal: 67200,
    tax: 0,
    total: 67200,
    initialPayments: [],
  },
  "INV-2024-0004": {
    id: "INV-2024-0004",
    customer: "DPR Construction",
    customerAddress: "321 Strip Ave, Las Vegas, NV 89101",
    orderRef: "ORD-2024-004",
    billingPeriod: "Feb 1 – Feb 5, 2024",
    invoiceDate: "2024-02-05",
    dueDate: "2024-03-05",
    lineItems: [
      { description: "Millwright - Regular Hours (280 hrs @ $95)", qty: 280, rate: 95, amount: 26600 },
      { description: "Travel Expenses", qty: 1, rate: 2300, amount: 2300 },
    ],
    subtotal: 28900,
    tax: 0,
    total: 28900,
    initialPayments: [
      { id: "PMT-004", date: "2024-02-20", amount: 28900, method: "ACH", reference: "ACH-9912847" },
    ],
  },
  "INV-2024-0005": {
    id: "INV-2024-0005",
    customer: "Hensel Phelps",
    customerAddress: "555 Airport Way, Denver, CO 80249",
    orderRef: "ORD-2024-005",
    billingPeriod: "Feb 5 – Feb 10, 2024",
    invoiceDate: "2024-02-10",
    dueDate: "2024-03-10",
    lineItems: [
      { description: "Pipefitter - Regular Hours (400 hrs @ $85)", qty: 400, rate: 85, amount: 34000 },
      { description: "Millwright - Regular Hours (200 hrs @ $95)", qty: 200, rate: 95, amount: 19000 },
      { description: "Per Diem Allowance", qty: 1, rate: 1600, amount: 1600 },
    ],
    subtotal: 54600,
    tax: 0,
    total: 54600,
    initialPayments: [
      { id: "PMT-005", date: "2024-02-25", amount: 20000, method: "Check", reference: "CHK-5501" },
    ],
  },
  "INV-2024-0006": {
    id: "INV-2024-0006",
    customer: "Holder Construction",
    customerAddress: "888 Tech Dr, Austin, TX 78701",
    orderRef: "ORD-2024-006",
    billingPeriod: "Feb 10 – Feb 12, 2024",
    invoiceDate: "2024-02-12",
    dueDate: "2024-03-12",
    lineItems: [
      { description: "Pipefitter - Regular Hours (160 hrs @ $85)", qty: 160, rate: 85, amount: 13600 },
      { description: "Millwright - Regular Hours (60 hrs @ $95)", qty: 60, rate: 95, amount: 5700 },
      { description: "Materials Markup", qty: 1, rate: 500, amount: 500 },
    ],
    subtotal: 19800,
    tax: 0,
    total: 19800,
    initialPayments: [],
  },
};

interface LineItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

interface PaymentEvent {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
  note?: string;
}

interface InvoiceData {
  id: string;
  customer: string;
  customerAddress: string;
  orderRef: string;
  billingPeriod: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  initialPayments: PaymentEvent[];
}

type PaymentMethod = "Check" | "ACH" | "Wire" | "Card" | "Other";

function getStatus(total: number, paidToDate: number): "Unpaid" | "Partially Paid" | "Paid" {
  if (paidToDate <= 0) return "Unpaid";
  if (paidToDate >= total) return "Paid";
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
      padding: "6px 14px",
      borderRadius: "6px",
      fontSize: "13px",
      fontWeight: 600,
      ...styles[status],
    }}>
      {status}
    </span>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.invoiceId as string;

  const invoiceData = MOCK_INVOICES[invoiceId];

  // Payment events state (seeded from mock data)
  const [payments, setPayments] = useState<PaymentEvent[]>(
    invoiceData?.initialPayments || []
  );

  // Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split("T")[0],
    amount: "",
    method: "Check" as PaymentMethod,
    reference: "",
    note: "",
  });

  // Computed values
  const paidToDate = useMemo(() => {
    const sum = payments.reduce((acc, p) => acc + p.amount, 0);
    return invoiceData ? Math.min(sum, invoiceData.total) : sum;
  }, [payments, invoiceData]);

  const balance = useMemo(() => {
    if (!invoiceData) return 0;
    return Math.max(0, invoiceData.total - paidToDate);
  }, [invoiceData, paidToDate]);

  const status = useMemo(() => {
    if (!invoiceData) return "Unpaid";
    return getStatus(invoiceData.total, paidToDate);
  }, [invoiceData, paidToDate]);

  // Handlers
  const handleRecordPayment = () => {
    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) return;

    const newPayment: PaymentEvent = {
      id: `PMT-${Date.now()}`,
      date: paymentForm.date,
      amount,
      method: paymentForm.method,
      reference: paymentForm.reference || "—",
      note: paymentForm.note || undefined,
    };

    setPayments((prev) => [...prev, newPayment]);
    setShowPaymentModal(false);
    setPaymentForm({
      date: new Date().toISOString().split("T")[0],
      amount: "",
      method: "Check",
      reference: "",
      note: "",
    });
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  // Not found state
  if (!invoiceData) {
    return (
      <div style={{
        padding: "24px 40px 60px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}>
        <button
          onClick={() => router.push("/accounting/invoicing")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(255, 255, 255, 0.7)",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "6px",
            cursor: "pointer",
            marginBottom: "24px",
          }}
        >
          ← Back to Invoices
        </button>
        <div style={{
          padding: "60px",
          textAlign: "center",
          color: "rgba(255, 255, 255, 0.5)",
        }}>
          <h2 style={{ color: "#fff", marginBottom: "8px" }}>Invoice Not Found</h2>
          <p>Invoice {invoiceId} does not exist in the system.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: "24px 40px 60px",
      maxWidth: "1200px",
      margin: "0 auto",
    }}>
      {/* Back Button */}
      <button
        onClick={() => router.push("/accounting/invoicing")}
        style={{
          padding: "8px 16px",
          fontSize: "13px",
          fontWeight: 500,
          color: "rgba(255, 255, 255, 0.7)",
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "6px",
          cursor: "pointer",
          marginBottom: "24px",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
        }}
      >
        ← Back to Invoices
      </button>

      {/* Invoice Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: "32px",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
            <h1 style={{
              fontSize: "26px",
              fontWeight: 600,
              color: "#fff",
              margin: 0,
              letterSpacing: "-0.5px",
              fontFamily: "var(--font-geist-mono), monospace",
            }}>
              {invoiceData.id}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p style={{
            fontSize: "14px",
            color: "rgba(255, 255, 255, 0.5)",
            margin: 0,
          }}>
            {invoiceData.customer}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)" }}>Total Amount</span>
            <p style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#fff",
              margin: "4px 0 0 0",
              fontFamily: "var(--font-geist-mono), monospace",
            }}>
              {formatCurrency(invoiceData.total)}
            </p>
          </div>
          <div style={{ marginTop: "12px" }}>
            <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)" }}>Balance Due</span>
            <p style={{
              fontSize: "18px",
              fontWeight: 600,
              color: balance > 0 ? "#f59e0b" : "#22c55e",
              margin: "4px 0 0 0",
              fontFamily: "var(--font-geist-mono), monospace",
            }}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: "24px",
      }}>
        {/* Left Column - Invoice Details */}
        <div>
          {/* Invoice Info Card */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
          }}>
            <h3 style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.7)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginTop: 0,
              marginBottom: "20px",
            }}>
              Invoice Details
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Customer</span>
                <p style={{ fontSize: "14px", color: "#fff", margin: "6px 0 0 0", fontWeight: 500 }}>{invoiceData.customer}</p>
                <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)", margin: "4px 0 0 0" }}>{invoiceData.customerAddress}</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Order Reference</span>
                <p style={{ fontSize: "14px", color: "#3b82f6", margin: "6px 0 0 0", fontFamily: "var(--font-geist-mono), monospace" }}>{invoiceData.orderRef}</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Billing Period</span>
                <p style={{ fontSize: "14px", color: "#fff", margin: "6px 0 0 0" }}>{invoiceData.billingPeriod}</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Invoice Date</span>
                <p style={{ fontSize: "14px", color: "#fff", margin: "6px 0 0 0" }}>{formatDate(invoiceData.invoiceDate)}</p>
              </div>
              <div>
                <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Due Date</span>
                <p style={{ fontSize: "14px", color: "#fff", margin: "6px 0 0 0" }}>{formatDate(invoiceData.dueDate)}</p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "12px",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 24px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            }}>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.7)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                margin: 0,
              }}>
                Line Items
              </h3>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255, 255, 255, 0.02)" }}>
                  <th style={{ ...thStyle, paddingLeft: "24px" }}>Description</th>
                  <th style={{ ...thStyle, textAlign: "right", width: "80px" }}>Qty</th>
                  <th style={{ ...thStyle, textAlign: "right", width: "100px" }}>Rate</th>
                  <th style={{ ...thStyle, textAlign: "right", width: "120px", paddingRight: "24px" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ ...tdStyle, paddingLeft: "24px" }}>{item.description}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono), monospace" }}>{item.qty}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono), monospace" }}>{formatCurrency(item.rate)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontFamily: "var(--font-geist-mono), monospace", paddingRight: "24px" }}>{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              background: "rgba(255, 255, 255, 0.02)",
            }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "48px" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)" }}>Subtotal</span>
                    <span style={{ marginLeft: "24px", fontSize: "14px", color: "#fff", fontFamily: "var(--font-geist-mono), monospace" }}>{formatCurrency(invoiceData.subtotal)}</span>
                  </div>
                  {invoiceData.tax > 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)" }}>Tax</span>
                      <span style={{ marginLeft: "24px", fontSize: "14px", color: "#fff", fontFamily: "var(--font-geist-mono), monospace" }}>{formatCurrency(invoiceData.tax)}</span>
                    </div>
                  )}
                  <div style={{ paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>Total</span>
                    <span style={{ marginLeft: "24px", fontSize: "16px", fontWeight: 600, color: "#fff", fontFamily: "var(--font-geist-mono), monospace" }}>{formatCurrency(invoiceData.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Payment Events */}
        <div>
          {/* Payment Summary Card */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "16px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)" }}>Paid To Date</span>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#22c55e", fontFamily: "var(--font-geist-mono), monospace" }}>{formatCurrency(paidToDate)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)" }}>Balance Due</span>
              <span style={{ fontSize: "14px", fontWeight: 600, color: balance > 0 ? "#f59e0b" : "#22c55e", fontFamily: "var(--font-geist-mono), monospace" }}>{formatCurrency(balance)}</span>
            </div>
          </div>

          {/* Record Payment Button */}
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={balance <= 0}
            style={{
              width: "100%",
              padding: "14px 20px",
              fontSize: "14px",
              fontWeight: 600,
              color: balance > 0 ? "#fff" : "rgba(255, 255, 255, 0.4)",
              background: balance > 0 ? "#3b82f6" : "rgba(255, 255, 255, 0.04)",
              border: "none",
              borderRadius: "8px",
              cursor: balance > 0 ? "pointer" : "not-allowed",
              marginBottom: "16px",
              transition: "all 0.15s ease",
            }}
          >
            {balance > 0 ? "Record Payment" : "Fully Paid"}
          </button>

          {/* Payment Events Panel */}
          <div style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "12px",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.7)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                margin: 0,
              }}>
                Payment Events
              </h3>
              <span style={{
                fontSize: "12px",
                color: "rgba(255, 255, 255, 0.4)",
              }}>
                {payments.length} recorded
              </span>
            </div>

            {payments.length === 0 ? (
              <div style={{
                padding: "32px 20px",
                textAlign: "center",
                color: "rgba(255, 255, 255, 0.4)",
                fontSize: "13px",
              }}>
                No payments recorded yet.
              </div>
            ) : (
              <div style={{ maxHeight: "320px", overflowY: "auto" }}>
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#22c55e", fontFamily: "var(--font-geist-mono), monospace" }}>
                        {formatCurrency(payment.amount)}
                      </span>
                      <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
                        {formatDate(payment.date)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        background: "rgba(255, 255, 255, 0.06)",
                        borderRadius: "4px",
                        color: "rgba(255, 255, 255, 0.6)",
                      }}>
                        {payment.method}
                      </span>
                      <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontFamily: "var(--font-geist-mono), monospace" }}>
                        {payment.reference}
                      </span>
                    </div>
                    {payment.note && (
                      <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", margin: "8px 0 0 0", fontStyle: "italic" }}>
                        {payment.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Audit Note */}
            <div style={{
              padding: "12px 20px",
              background: "rgba(255, 255, 255, 0.02)",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            }}>
              <p style={{
                fontSize: "11px",
                color: "rgba(255, 255, 255, 0.35)",
                margin: 0,
                lineHeight: 1.5,
              }}>
                Recorded payments are audit events (no deletion).
              </p>
            </div>
          </div>

          {/* Void / Credit Note Buttons */}
          <div style={{
            display: "flex",
            gap: "8px",
            marginTop: "16px",
          }}>
            <button
              disabled
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: "12px",
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.3)",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "6px",
                cursor: "not-allowed",
              }}
            >
              Void Invoice (Coming Soon)
            </button>
            <button
              disabled
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: "12px",
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.3)",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "6px",
                cursor: "not-allowed",
              }}
            >
              Credit Note (Coming Soon)
            </button>
          </div>

          {/* Locked Snapshot Panel (Slice C) */}
          <LockedSnapshotPanel invoiceId={invoiceId} />
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            style={{
              background: "#1a1a2e",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              padding: "32px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#fff",
              margin: "0 0 24px 0",
            }}>
              Record Payment
            </h2>

            {/* Payment Date */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}>
                Payment Date
              </label>
              <input
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  fontSize: "14px",
                  color: "#fff",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            </div>

            {/* Amount */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}>
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={balance}
                placeholder={`Max: ${formatCurrency(balance)}`}
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  fontSize: "14px",
                  color: "#fff",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            </div>

            {/* Method */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}>
                Method
              </label>
              <select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  fontSize: "14px",
                  color: "#fff",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="Check">Check</option>
                <option value="ACH">ACH</option>
                <option value="Wire">Wire</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Reference */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}>
                Reference
              </label>
              <input
                type="text"
                placeholder="e.g., CHK-12345, ACH-9876"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  fontSize: "14px",
                  color: "#fff",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            </div>

            {/* Note */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}>
                Note (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Any additional notes..."
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  fontSize: "14px",
                  color: "#fff",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  outline: "none",
                  resize: "none",
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "rgba(255, 255, 255, 0.7)",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={!paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#fff",
                  background: (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) ? "rgba(59, 130, 246, 0.3)" : "#3b82f6",
                  border: "none",
                  borderRadius: "8px",
                  cursor: (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) ? "not-allowed" : "pointer",
                }}
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 600,
  color: "rgba(255, 255, 255, 0.45)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: "14px",
  color: "rgba(255, 255, 255, 0.85)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
};

