"use client";

/**
 * LockedSnapshotPanel — Slice C UI Shell (Internal Only)
 * 
 * Displays locked margin snapshot data (read-only, mocked).
 * No UI math. No recomputation. No backend imports.
 * 
 * Shows:
 * - Final Gross Margin % (locked)
 * - Final Margin per Labor Hour ($/hr)
 * - Per-trade $/hr ratios with stoplight health indicators
 * - Guardrail text
 */

interface TradeSnapshot {
  trade: string;
  marginPerHour: number; // $/hr
  health: "green" | "yellow" | "red";
}

interface LockedSnapshotData {
  invoiceId: string;
  grossMarginPct: number; // e.g., 28.5 for 28.5%
  marginPerLaborHour: number; // $/hr across all trades
  trades: TradeSnapshot[];
  lockedAt: string; // ISO date string
}

// Mocked snapshot data (embedded, no backend)
const MOCK_SNAPSHOTS: Record<string, LockedSnapshotData> = {
  "INV-2024-0001": {
    invoiceId: "INV-2024-0001",
    grossMarginPct: 28.5,
    marginPerLaborHour: 24.18,
    trades: [
      { trade: "Pipefitter", marginPerHour: 26.50, health: "green" },
      { trade: "Millwright", marginPerHour: 21.20, health: "yellow" },
    ],
    lockedAt: "2024-01-16T14:32:00Z",
  },
  "INV-2024-0002": {
    invoiceId: "INV-2024-0002",
    grossMarginPct: 31.2,
    marginPerLaborHour: 28.44,
    trades: [
      { trade: "Pipefitter", marginPerHour: 30.10, health: "green" },
      { trade: "Millwright", marginPerHour: 25.80, health: "green" },
    ],
    lockedAt: "2024-01-23T09:15:00Z",
  },
  "INV-2024-0003": {
    invoiceId: "INV-2024-0003",
    grossMarginPct: 22.8,
    marginPerLaborHour: 18.90,
    trades: [
      { trade: "Pipefitter", marginPerHour: 20.40, health: "yellow" },
      { trade: "Millwright", marginPerHour: 16.50, health: "red" },
    ],
    lockedAt: "2024-02-02T11:45:00Z",
  },
  "INV-2024-0004": {
    invoiceId: "INV-2024-0004",
    grossMarginPct: 25.1,
    marginPerLaborHour: 22.30,
    trades: [
      { trade: "Millwright", marginPerHour: 22.30, health: "yellow" },
    ],
    lockedAt: "2024-02-06T08:20:00Z",
  },
  "INV-2024-0005": {
    invoiceId: "INV-2024-0005",
    grossMarginPct: 29.7,
    marginPerLaborHour: 25.60,
    trades: [
      { trade: "Pipefitter", marginPerHour: 27.80, health: "green" },
      { trade: "Millwright", marginPerHour: 22.10, health: "yellow" },
    ],
    lockedAt: "2024-02-11T16:00:00Z",
  },
  "INV-2024-0006": {
    invoiceId: "INV-2024-0006",
    grossMarginPct: 24.3,
    marginPerLaborHour: 20.15,
    trades: [
      { trade: "Pipefitter", marginPerHour: 21.50, health: "yellow" },
      { trade: "Millwright", marginPerHour: 17.80, health: "red" },
    ],
    lockedAt: "2024-02-13T10:30:00Z",
  },
};

function StoplightIndicator({ health }: { health: "green" | "yellow" | "red" }) {
  const colors = {
    green: { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.4)", fill: "#22c55e" },
    yellow: { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)", fill: "#f59e0b" },
    red: { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.4)", fill: "#ef4444" },
  };
  const c = colors[health];

  return (
    <span
      style={{
        display: "inline-block",
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: c.fill,
        boxShadow: `0 0 6px ${c.fill}40`,
      }}
      title={health === "green" ? "Healthy" : health === "yellow" ? "Monitor" : "At Risk"}
    />
  );
}

interface LockedSnapshotPanelProps {
  invoiceId: string;
}

export default function LockedSnapshotPanel({ invoiceId }: LockedSnapshotPanelProps) {
  const snapshot = MOCK_SNAPSHOTS[invoiceId];

  if (!snapshot) {
    return null; // No snapshot available for this invoice
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "12px",
        padding: "20px",
        marginTop: "16px",
      }}
    >
      {/* Header with Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "rgba(255, 255, 255, 0.7)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            margin: 0,
          }}
        >
          Locked Snapshot
        </h3>
        <span
          style={{
            display: "inline-block",
            padding: "4px 10px",
            fontSize: "10px",
            fontWeight: 700,
            color: "#3b82f6",
            background: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "4px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          LOCKED SNAPSHOT
        </span>
      </div>

      {/* Summary Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        {/* Gross Margin % */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "8px",
            padding: "14px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255, 255, 255, 0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Final Gross Margin
          </span>
          <p
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#fff",
              margin: "6px 0 0 0",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            {snapshot.grossMarginPct.toFixed(1)}%
          </p>
        </div>

        {/* Margin per Labor Hour */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "8px",
            padding: "14px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "rgba(255, 255, 255, 0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Margin / Labor Hour
          </span>
          <p
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: "#fff",
              margin: "6px 0 0 0",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            ${snapshot.marginPerLaborHour.toFixed(2)}/hr
          </p>
        </div>
      </div>

      {/* Per-Trade Breakdown */}
      <div style={{ marginBottom: "16px" }}>
        <span
          style={{
            display: "block",
            fontSize: "11px",
            color: "rgba(255, 255, 255, 0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "10px",
          }}
        >
          Per-Trade Margin
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {snapshot.trades.map((t) => (
            <div
              key={t.trade}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "6px",
                border: "1px solid rgba(255, 255, 255, 0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <StoplightIndicator health={t.health} />
                <span style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.85)" }}>
                  {t.trade}
                </span>
              </div>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#fff",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                ${t.marginPerHour.toFixed(2)}/hr
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Guardrail Text */}
      <div
        style={{
          padding: "12px",
          background: "rgba(59, 130, 246, 0.06)",
          border: "1px solid rgba(59, 130, 246, 0.12)",
          borderRadius: "6px",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            color: "rgba(255, 255, 255, 0.5)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Locked from approved hours and finalized burden. No recomputation.
        </p>
        <p
          style={{
            fontSize: "10px",
            color: "rgba(255, 255, 255, 0.35)",
            margin: "6px 0 0 0",
          }}
        >
          Snapshot locked: {formatDate(snapshot.lockedAt)}
        </p>
      </div>
    </div>
  );
}

