"use client";

import { useParams, useRouter } from "next/navigation";

/**
 * Customer Timesheets HUB Page - Slice C
 * Route: /customer/orders/[id]/timesheets
 */

const DEMO_MODE = true;

type TimesheetPeriod = {
  id: string;
  label: string;
  status: "Draft" | "Submitted" | "Finalized";
};

const MOCK_TIMESHEET_PERIODS: TimesheetPeriod[] = [
  { id: "ts_001", label: "Week of Jan 27 – Feb 2, 2026", status: "Submitted" },
];

export default function CustomerTimesheetsHubPage({ __internal }: any) {
  const params = useParams();
  const router = useRouter();
  const raw = (params as any)?.id as string | string[] | undefined;
  const orderId = Array.isArray(raw) ? raw[0] : (raw as string);

  const handlePeriodClick = (timesheetId: string) => {
    router.push(
      __internal
        ? `/orders/${orderId}/timesheets/${timesheetId}`
        : `/customer/orders/${orderId}/timesheets/${timesheetId}`
    );
  };

  return (
    <div className="customer-timesheets-hub">
      {DEMO_MODE && (
        <div className="demo-banner">
          <span className="demo-icon">[!]</span>
          <span className="demo-text">DEMO DATA - UI ONLY (toggle: DEMO_MODE)</span>
        </div>
      )}

      {!__internal && (
        <nav className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => router.push("/customer/orders")}>
            Your Orders
          </button>
          <span className="breadcrumb-sep">&gt;</span>
          <button className="breadcrumb-link" onClick={() => router.push(`/customer/orders/${orderId}`)}>
            {orderId}
          </button>
          <span className="breadcrumb-sep">&gt;</span>
          <span className="breadcrumb-current">Timesheets</span>
        </nav>
      )}

      <header className="page-header">
        <h1 className="page-title">[T] Timesheets (Read-Only)</h1>
        <p className="page-subtitle">View submitted timesheet periods for this order.</p>
      </header>

      <section className="content-section">
        <h2 className="section-title">
          <span className="section-icon">[P]</span>
          Timesheet Periods
        </h2>

        <div className="section-body">
          <div className="periods-list">
            {MOCK_TIMESHEET_PERIODS.map((period) => (
              <button
                key={period.id}
                type="button"
                className="period-card"
                onClick={() => handlePeriodClick(period.id)}
              >
                <div className="period-info">
                  <span className="period-label">{period.label}</span>
                  <span className="period-id">{period.id}</span>
                </div>

                <div className="period-status" data-status={period.status.toLowerCase()}>
                  {period.status}
                </div>

                <span className="period-arrow">&rarr;</span>
              </button>
            ))}
          </div>

          {DEMO_MODE && <p className="demo-note">DEMO: Mock timesheet period. Click to view detail.</p>}
        </div>
      </section>

      {!__internal && (
        <footer className="page-footer">
          <button className="back-link" onClick={() => router.push(`/customer/orders/${orderId}`)}>
            &lt;- Back to Order
          </button>
        </footer>
      )}

      <style jsx>{`
        .customer-timesheets-hub {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          padding: 24px 40px 60px;
          font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Demo Banner */
        .demo-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 20px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .demo-icon {
          font-size: 14px;
          color: #fbbf24;
        }

        .demo-text {
          font-size: 12px;
          font-weight: 600;
          color: #fbbf24;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .demo-note {
          margin: 12px 0 0 0;
          padding: 8px 12px;
          background: rgba(245, 158, 11, 0.08);
          border-radius: 6px;
          font-size: 11px;
          color: #fbbf24;
          font-style: italic;
        }

        /* Breadcrumb */
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 28px;
        }

        .breadcrumb-link {
          background: none;
          border: none;
          padding: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .breadcrumb-link:hover {
          color: #60a5fa;
          text-decoration: underline;
        }

        .breadcrumb-sep {
          color: rgba(255, 255, 255, 0.3);
          font-size: 14px;
        }

        .breadcrumb-current {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
        }

        /* Page Header */
        .page-header {
          margin-bottom: 32px;
          max-width: 900px;
        }

        .page-title {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .page-subtitle {
          margin: 0;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Content Sections */
        .content-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
          max-width: 900px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin: 0 0 16px 0;
        }

        .section-icon {
          font-size: 18px;
        }

        .section-body {
          padding: 16px 0 0 0;
        }

        /* Periods List */
        .periods-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .period-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }

        .period-card:hover {
          background: rgba(59, 130, 246, 0.08);
          border-color: rgba(59, 130, 246, 0.25);
        }

        .period-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .period-label {
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .period-id {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-family: monospace;
        }

        .period-status {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .period-status[data-status="draft"] {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .period-status[data-status="submitted"] {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        .period-status[data-status="finalized"] {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .period-arrow {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.4);
          transition: color 0.15s ease;
        }

        .period-card:hover .period-arrow {
          color: #60a5fa;
        }

        /* Footer */
        .page-footer {
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 12px;
          max-width: 900px;
        }

        .back-link {
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .back-link:hover {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.25);
          color: #60a5fa;
        }
      `}</style>
    </div>
  );
}
