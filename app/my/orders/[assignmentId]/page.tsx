'use client';

import { useParams, useRouter } from 'next/navigation';

/**
 * Assignment Details - UI Shell / Demo Only
 *
 * READ-ONLY, employee-scoped assignment details page.
 * Includes a Compensation panel (Rates + Per Diem) for transparency,
 * but avoids payroll language and avoids timesheet/earnings totals.
 *
 * Route: /my/orders/[assignmentId]
 */

type AssignmentStatus = 'current' | 'completed';

type Assignment = {
  id: string;
  orderId: string;
  jobName: string;
  customerName: string;
  site: string;
  dispatchedAt: string;              // when MW4H issued/sent this assignment
  plannedStartDate: string;          // estimate
  plannedEndDate: string;            // estimate
  actualFirstDayWorked?: string;     // optional until known
  actualLastDayWorked?: string;      // optional until known
  status: AssignmentStatus;

  // Compensation (read-only display for this assignment)
  rateReg: number;
  rateOt: number;
  rateDt: number;

  perDiemEligible: boolean;
  perDiemDaily: number;
  perDiemNotes: string;
};

const MOCK_ASSIGNMENTS: Record<string, Assignment> = {
  'assign_001': {
    id: 'assign_001',
    orderId: 'ord_001',
    jobName: 'Refinery Turnaround Q1',
    customerName: 'Marathon Petroleum',
    site: 'Marathon Petroleum Refinery - 2401 5th Ave S, Texas City, TX 77590',
    dispatchedAt: '2026-01-29',
    plannedStartDate: '2026-02-01',
    plannedEndDate: '2026-02-28',
    actualFirstDayWorked: '2026-02-01',
    actualLastDayWorked: undefined,
    status: 'current',

    rateReg: 42.00,
    rateOt: 63.00,
    rateDt: 84.00,

    perDiemEligible: true,
    perDiemDaily: 120.00,
    perDiemNotes: 'Per diem applies on eligible workdays per dispatch rules.',
  },
  'assign_002': {
    id: 'assign_002',
    orderId: 'ord_002',
    jobName: 'Power Plant Maintenance',
    customerName: 'NRG Energy',
    site: 'NRG W.A. Parish Generating Station - 2500 S FM 521, Thompsons, TX 77481',
    dispatchedAt: '2026-03-01',
    plannedStartDate: '2026-03-05',
    plannedEndDate: '2026-03-20',
    actualFirstDayWorked: undefined,
    actualLastDayWorked: undefined,
    status: 'current',

    rateReg: 39.50,
    rateOt: 59.25,
    rateDt: 79.00,

    perDiemEligible: false,
    perDiemDaily: 0,
    perDiemNotes: 'Per diem not enabled for this assignment.',
  },
};

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function MyAssignmentDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const assignmentId = String(params?.assignmentId ?? '');
  const assignment = MOCK_ASSIGNMENTS[assignmentId];

  if (!assignment) {
    return (
      <div className="assignment-page">
        <div className="not-found-container">
          <div className="not-found-icon">🧾</div>
          <h1>Assignment Not Found</h1>
          <p>
            The assignment <strong>{assignmentId}</strong> could not be located.
          </p>
          <button className="back-btn" onClick={() => router.push('/my/orders')}>
            ← Back to My Assignments
          </button>
        </div>

        <style jsx>{`
          .assignment-page {
            min-height: 100vh;
            background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
            color: #fff;
            padding: 24px;
          }
          .not-found-container {
            max-width: 720px;
            margin: 80px auto 0;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
          }
          .not-found-icon {
            font-size: 40px;
            margin-bottom: 12px;
          }
          .back-btn {
            margin-top: 16px;
            padding: 10px 14px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            cursor: pointer;
          }
          .back-btn:hover {
            background: rgba(255, 255, 255, 0.12);
          }
        `}</style>
      </div>
    );
  }

  const isCurrent = assignment.status === 'current';

  return (
    <div className="assignment-page">
      {/* Read-Only Notice */}
      <div className="readonly-banner">
        <span className="readonly-icon">👁️</span>
        <div className="readonly-content">
          <span className="readonly-title">Assignment Details (Read-Only)</span>
          <span className="readonly-note">
            This page reflects your assignment information and compensation terms for this assignment.
          </span>
        </div>
      </div>

      {/* Demo Banner */}
      <div className="demo-banner">
        <span className="demo-icon">⚠️</span>
        <span className="demo-text">UI Shell / Mock Data / Demo Only</span>
      </div>

      {/* Dispatch Snapshot (Read-Only) */}
      <div className="snapshot-section">
        <div className="snapshot-title">Dispatch Snapshot (Read-Only)</div>
        <div className="snapshot-grid">
          <div className="snapshot-item">
            <div className="snapshot-label">Pay Rate (at dispatch)</div>
            <div className="snapshot-value">{formatMoney(assignment.rateReg)}/hr</div>
          </div>
          <div className="snapshot-item">
            <div className="snapshot-label">Per Diem (at dispatch)</div>
            <div className="snapshot-value">
              {assignment.perDiemEligible ? formatMoney(assignment.perDiemDaily) + '/day' : 'Not Eligible'}
            </div>
          </div>
        </div>
        <div className="snapshot-note">
          These values reflect the terms at the time of dispatch and are read-only.
        </div>
      </div>

      {/* Header */}
      <div className="header">
        <div className="title-block">
          <h1 className="page-title">{assignment.jobName}</h1>
          <div className="subtitle">
            <span className="badge">{isCurrent ? 'CURRENT' : 'COMPLETED'}</span>
            <span className="dot">•</span>
            <span>{assignment.customerName}</span>
          </div>
        </div>

        <div className="actions">
          <button
            className="nav-btn"
            onClick={() => router.push(`/my/orders/${assignment.id}/dispatch`)}
          >
            View Dispatch Packet
          </button>
          <button
            className="nav-btn secondary"
            onClick={() => router.push(`/my/orders/${assignment.id}/timesheets`)}
          >
            View Timesheet Snapshot
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="grid">
        <div className="card">
          <div className="card-title">Assignment Summary</div>
          <div className="kv">
            <div className="kv-row">
              <div className="k">Dispatched To</div>
              <div className="v">
                {assignment.jobName}
                <br />
                <span className="site-line">{assignment.site}</span>
              </div>
            </div>
            <div className="kv-row">
              <div className="k">Dispatched On</div>
              <div className="v">{assignment.dispatchedAt}</div>
            </div>
            <div className="kv-row">
              <div className="k">Planned Dates</div>
              <div className="v">
                {assignment.plannedStartDate} to {assignment.plannedEndDate}
                <div className="muted small inline-note">Planned dates are estimates and may change.</div>
              </div>
            </div>
            <div className="kv-row">
              <div className="k">Actual Work</div>
              <div className="v">
                First day worked: {assignment.actualFirstDayWorked ?? '—'}
                <br />
                Last day worked: {assignment.actualLastDayWorked ?? '—'}
                <div className="muted small inline-note">Actual dates are recorded after work begins/ends.</div>
              </div>
            </div>
            <div className="kv-row">
              <div className="k">Order ID</div>
              <div className="v mono">{assignment.orderId}</div>
            </div>
            <div className="kv-row">
              <div className="k">Assignment ID</div>
              <div className="v mono">{assignment.id}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Compensation (Read-Only)</div>

          <div className="section">
            <div className="section-title">Rates</div>
            <div className="rate-grid">
              <div className="rate-item">
                <div className="rate-label">REG</div>
                <div className="rate-value">{formatMoney(assignment.rateReg)}/hr</div>
              </div>
              <div className="rate-item">
                <div className="rate-label">OT</div>
                <div className="rate-value">{formatMoney(assignment.rateOt)}/hr</div>
              </div>
              <div className="rate-item">
                <div className="rate-label">DT</div>
                <div className="rate-value">{formatMoney(assignment.rateDt)}/hr</div>
              </div>
            </div>
            <div className="muted">
              Note: This page shows assignment terms only. It does not display gross pay, taxes, deductions, or payroll totals.
            </div>
          </div>

          <div className="divider" />

          <div className="section">
            <div className="section-title">Per Diem</div>
            <div className="kv">
              <div className="kv-row">
                <div className="k">Eligible</div>
                <div className="v">
                  <span className={assignment.perDiemEligible ? 'pill yes' : 'pill no'}>
                    {assignment.perDiemEligible ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="kv-row">
                <div className="k">Daily Amount</div>
                <div className="v">{assignment.perDiemEligible ? formatMoney(assignment.perDiemDaily) : '—'}</div>
              </div>

              <div className="kv-row">
                <div className="k">Rule</div>
                <div className="v">{assignment.perDiemNotes}</div>
              </div>
            </div>
          </div>

          <div className="muted small">
            If you believe these terms are incorrect, contact MW4H. Do not rely on this demo UI for official confirmation.
          </div>
        </div>
      </div>

      <style jsx>{`
        .assignment-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          padding: 24px 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .snapshot-section {
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 18px;
        }
        .snapshot-title {
          font-weight: 800;
          font-size: 14px;
          margin-bottom: 12px;
          color: rgba(255, 255, 255, 0.95);
        }
        .snapshot-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 10px;
        }
        @media (max-width: 520px) {
          .snapshot-grid {
            grid-template-columns: 1fr;
          }
        }
        .snapshot-item {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 10px;
          padding: 12px;
        }
        .snapshot-label {
          font-size: 11px;
          font-weight: 700;
          opacity: 0.75;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .snapshot-value {
          font-size: 18px;
          font-weight: 900;
        }
        .snapshot-note {
          font-size: 11px;
          opacity: 0.7;
          font-style: italic;
        }

        .readonly-banner {
          display: flex;
          gap: 12px;
          align-items: center;
          background: rgba(59, 130, 246, 0.14);
          border: 1px solid rgba(59, 130, 246, 0.35);
          border-radius: 14px;
          padding: 12px 14px;
          margin-bottom: 12px;
        }
        .readonly-icon {
          font-size: 18px;
        }
        .readonly-content {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .readonly-title {
          font-weight: 700;
          font-size: 14px;
        }
        .readonly-note {
          opacity: 0.85;
          font-size: 12px;
          margin-top: 2px;
        }

        .demo-banner {
          display: flex;
          gap: 10px;
          align-items: center;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 14px;
          padding: 10px 14px;
          margin-bottom: 18px;
        }
        .demo-icon {
          font-size: 16px;
        }
        .demo-text {
          font-size: 12px;
          opacity: 0.95;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }
        .page-title {
          font-size: 24px;
          font-weight: 800;
          margin: 0;
        }
        .subtitle {
          display: flex;
          align-items: center;
          gap: 10px;
          opacity: 0.9;
          margin-top: 6px;
          font-size: 13px;
        }
        .badge {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .dot {
          opacity: 0.6;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .nav-btn {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          cursor: pointer;
          font-weight: 700;
          font-size: 12px;
        }
        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        .nav-btn.secondary {
          background: rgba(255, 255, 255, 0.06);
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 16px;
        }
        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 16px;
        }
        .card-title {
          font-weight: 800;
          margin-bottom: 12px;
        }

        .kv {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .kv-row {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 12px;
          align-items: start;
        }
        .k {
          opacity: 0.75;
          font-size: 12px;
        }
        .v {
          font-size: 13px;
          line-height: 1.35;
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          opacity: 0.95;
        }

        .section {
          margin-top: 6px;
        }
        .section-title {
          font-weight: 800;
          margin-bottom: 10px;
        }
        .rate-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        @media (max-width: 520px) {
          .rate-grid {
            grid-template-columns: 1fr;
          }
        }
        .rate-item {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 14px;
          padding: 12px;
        }
        .rate-label {
          opacity: 0.75;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .rate-value {
          margin-top: 6px;
          font-size: 16px;
          font-weight: 900;
        }

        .divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.10);
          margin: 14px 0;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.08);
        }
        .pill.yes {
          border-color: rgba(34, 197, 94, 0.35);
          background: rgba(34, 197, 94, 0.12);
        }
        .pill.no {
          border-color: rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.10);
        }

        .muted {
          opacity: 0.78;
          font-size: 12px;
          margin-top: 8px;
          line-height: 1.35;
        }
        .muted.small {
          font-size: 11px;
          margin-top: 12px;
        }
        .muted.small.inline-note {
          margin-top: 4px;
        }
        .site-line {
          opacity: 0.85;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
