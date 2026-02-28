"use client";

import Link from "next/link";

// Mock payroll weeks data
const MOCK_PAYROLL_WEEKS = [
  {
    weekKey: "2026-01-25",
    weekLabel: "Week Ending 2026-01-25",
    headcount: 12,
    totalRegHours: 432.0,
    totalOTHours: 48.5,
    totalDTHours: 8.0,
    totalPerDiem: 2400.0,
    status: "Exported",
  },
  {
    weekKey: "2026-01-18",
    weekLabel: "Week Ending 2026-01-18",
    headcount: 14,
    totalRegHours: 512.0,
    totalOTHours: 62.0,
    totalDTHours: 0,
    totalPerDiem: 2800.0,
    status: "Exported",
  },
  {
    weekKey: "2026-01-11",
    weekLabel: "Week Ending 2026-01-11",
    headcount: 10,
    totalRegHours: 360.0,
    totalOTHours: 28.0,
    totalDTHours: 4.0,
    totalPerDiem: 1600.0,
    status: "Ready",
  },
  {
    weekKey: "2026-01-04",
    weekLabel: "Week Ending 2026-01-04",
    headcount: 8,
    totalRegHours: 288.0,
    totalOTHours: 16.0,
    totalDTHours: 0,
    totalPerDiem: 1200.0,
    status: "Draft",
  },
  {
    weekKey: "2025-12-28",
    weekLabel: "Week Ending 2025-12-28",
    headcount: 6,
    totalRegHours: 192.0,
    totalOTHours: 12.0,
    totalDTHours: 0,
    totalPerDiem: 900.0,
    status: "Exported",
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    Draft: {
      background: "rgba(148, 163, 184, 0.15)",
      color: "#94a3b8",
      border: "1px solid rgba(148, 163, 184, 0.3)",
    },
    Ready: {
      background: "rgba(245, 158, 11, 0.15)",
      color: "#f59e0b",
      border: "1px solid rgba(245, 158, 11, 0.3)",
    },
    Exported: {
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

export default function PayrollHubPage() {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  const formatHours = (val: number) =>
    val.toFixed(1);

  return (
    <div className="payroll-container">
      {/* Header */}
      <div className="page-header">
        <Link href="/accounting" className="back-link">
          ← Back to Money
        </Link>
        <h1>Payroll Packet</h1>
        <p className="subtitle">
          Weekly payroll data packets for export to InnoWork.
        </p>
      </div>

      {/* Info Note */}
      <div className="info-box">
        <span className="info-icon">i</span>
        <span>
          <strong>Note:</strong> Jarvis Prime 1.0 does not run payroll; it generates an export-only Payroll Packet for InnoWork.
        </span>
      </div>

      {/* Weeks Table */}
      <div className="table-wrap">
        <table className="weeks-table">
          <thead>
            <tr>
              <th>Week</th>
              <th style={{ textAlign: "center" }}>Headcount</th>
              <th style={{ textAlign: "right" }}>Reg Hours</th>
              <th style={{ textAlign: "right" }}>OT Hours</th>
              <th style={{ textAlign: "right" }}>DT Hours</th>
              <th style={{ textAlign: "right" }}>Per Diem</th>
              <th style={{ textAlign: "center" }}>Status</th>
              <th style={{ textAlign: "center" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PAYROLL_WEEKS.map((week) => (
              <tr key={week.weekKey}>
                <td className="cell-week">{week.weekLabel}</td>
                <td className="cell-headcount">{week.headcount}</td>
                <td className="cell-hours">{formatHours(week.totalRegHours)}</td>
                <td className="cell-hours">{formatHours(week.totalOTHours)}</td>
                <td className="cell-hours">{formatHours(week.totalDTHours)}</td>
                <td className="cell-money">{formatCurrency(week.totalPerDiem)}</td>
                <td className="cell-status">
                  <StatusBadge status={week.status} />
                </td>
                <td className="cell-action">
                  <Link
                    href={`/accounting/payroll/${week.weekKey}`}
                    className="view-link"
                  >
                    View Week →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .payroll-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 20px;
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

        /* Info Box */
        .info-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          margin-bottom: 24px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.75);
        }

        .info-box strong {
          color: rgba(255, 255, 255, 0.9);
        }

        .info-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(59, 130, 246, 0.4);
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
          color: #3b82f6;
        }

        /* Table */
        .table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .weeks-table {
          width: 100%;
          border-collapse: collapse;
        }

        .weeks-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .weeks-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          white-space: nowrap;
        }

        .weeks-table td {
          padding: 14px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .weeks-table tr:last-child td {
          border-bottom: none;
        }

        .cell-week {
          font-weight: 500;
          color: #fff;
        }

        .cell-headcount {
          text-align: center;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
        }

        .cell-hours {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .cell-money {
          text-align: right;
          font-family: var(--font-geist-mono), monospace;
          font-size: 13px;
          font-weight: 500;
          color: #22c55e;
        }

        .cell-status {
          text-align: center;
        }

        .cell-action {
          text-align: center;
        }

        .view-link {
          display: inline-block;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .view-link:hover {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
        }
      `}</style>
    </div>
  );
}

