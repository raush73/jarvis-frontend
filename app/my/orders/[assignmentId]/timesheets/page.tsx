'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Employee Timesheets Page - Official Snapshot View
 * 
 * Employee-facing timesheet view for order-scoped timesheet snapshot.
 * READ-ONLY view showing ONLY the logged-in employee's approved hours.
 * 
 * EMPLOYEE MAY SEE (READ-ONLY):
 * - Regular hours (REG)
 * - Overtime hours (OT)
 * - Double-time hours (DT)
 * - Holiday hours (H)
 * - Per diem days (PD)
 * - Bonus dollars (BONUS)
 * - Travel / Reimbursement if present
 * - Total Hours = REG + OT + DT + H
 * 
 * EMPLOYEE MAY NOT SEE:
 * - Other workers' hours
 * - Reference hours they entered
 * - Historical submissions
 * - Customer approvals or disputes
 * - Rates, gross pay, taxes, deductions
 * 
 * Route: /my/orders/[assignmentId]/timesheets
 * 
 * Build 2A: Employee Timesheet Snapshot
 */

// DEMO MODE toggle - set to false to hide demo data
const DEMO_MODE = true;

// ============================================================================
// DATA MODEL (UI-ONLY, SAME AS CUSTOMER/ORDERS)
// ============================================================================

type EarningCode = 'REG' | 'OT' | 'DT' | 'H' | 'PD' | 'TRV' | 'BONUS' | 'REM';
type UnitType = 'HOURS' | 'DAYS' | 'DOLLARS';

interface DemoLineItem {
  id: string;
  workerName: string;
  earningCode: EarningCode;
  unit: UnitType;
  quantity: number;
  amount: number | null;
}

interface WorkerRollup {
  workerName: string;
  regHours: number;
  otHours: number;
  dtHours: number;
  holidayHours: number;
  perDiemDays: number;
  bonusDollars: number;
  travelDollars: number;
  reimbDollars: number;
  totalHours: number;
}

// ============================================================================
// DEMO DATA - SINGLE WORKER ONLY (LOGGED-IN EMPLOYEE)
// ============================================================================

const DEMO_LINE_ITEMS: DemoLineItem[] = [
  { id: '1', workerName: 'J. Martinez', earningCode: 'REG', unit: 'HOURS', quantity: 40, amount: null },
  { id: '2', workerName: 'J. Martinez', earningCode: 'OT', unit: 'HOURS', quantity: 8, amount: null },
  { id: '3', workerName: 'J. Martinez', earningCode: 'DT', unit: 'HOURS', quantity: 4, amount: null },
  { id: '4', workerName: 'J. Martinez', earningCode: 'H', unit: 'HOURS', quantity: 8, amount: null },
  { id: '5', workerName: 'J. Martinez', earningCode: 'PD', unit: 'DAYS', quantity: 5, amount: null },
  { id: '6', workerName: 'J. Martinez', earningCode: 'BONUS', unit: 'DOLLARS', quantity: 100, amount: 100 },
];

// ============================================================================
// ROLLUP LOGIC (EMPLOYEE SNAPSHOT)
// ============================================================================

function deriveEmployeeSnapshot(items: DemoLineItem[]): WorkerRollup {
  const rollup: WorkerRollup = {
    workerName: '',
    regHours: 0,
    otHours: 0,
    dtHours: 0,
    holidayHours: 0,
    perDiemDays: 0,
    bonusDollars: 0,
    travelDollars: 0,
    reimbDollars: 0,
    totalHours: 0,
  };

  for (const item of items) {
    // Capture worker name from first item
    if (!rollup.workerName && item.workerName) {
      rollup.workerName = item.workerName;
    }

    // HOURS -> REG / OT / DT / H
    if (item.unit === 'HOURS') {
      switch (item.earningCode) {
        case 'REG':
          rollup.regHours += item.quantity;
          break;
        case 'OT':
          rollup.otHours += item.quantity;
          break;
        case 'DT':
          rollup.dtHours += item.quantity;
          break;
        case 'H':
          rollup.holidayHours += item.quantity;
          break;
        // Ignore mismatched unit/code combos
      }
    }

    // DAYS -> PD
    if (item.unit === 'DAYS' && item.earningCode === 'PD') {
      rollup.perDiemDays += item.quantity;
    }

    // DOLLARS -> BONUS / TRV / REM
    if (item.unit === 'DOLLARS') {
      switch (item.earningCode) {
        case 'BONUS':
          rollup.bonusDollars += item.quantity;
          break;
        case 'TRV':
          rollup.travelDollars += item.quantity;
          break;
        case 'REM':
          rollup.reimbDollars += item.quantity;
          break;
        // Ignore mismatched unit/code combos
      }
    }
  }

  // Total Hours = REG + OT + DT + H
  rollup.totalHours = rollup.regHours + rollup.otHours + rollup.dtHours + rollup.holidayHours;

  return rollup;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EmployeeTimesheetsPage() {
  const params = useParams();
  const router = useRouter();
  // Note: uses assignmentId param internally but NEVER displays it in UI
  const assignmentId = params?.assignmentId as string;

  // Derive snapshot from demo data
  const snapshot = deriveEmployeeSnapshot(DEMO_LINE_ITEMS);

  // Determine if TRV/REM columns should show (only if non-zero)
  const showTravel = snapshot.travelDollars > 0;
  const showReimb = snapshot.reimbDollars > 0;

  // ============================================================================
  // OFFICIAL SNAPSHOT VIEW (DEMO_MODE = true)
  // ============================================================================
  if (DEMO_MODE) {
    return (
      <div className="employee-timesheets-page">
        {/* DEMO MODE Banner */}
        <div className="demo-banner">
          <span className="demo-icon">[!]</span>
          <span className="demo-text">DEMO DATA - UI ONLY (toggle: DEMO_MODE)</span>
        </div>

        {/* Breadcrumb Navigation */}
        <nav className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => router.push('/my/orders')}>
            My Orders
          </button>
          <span className="breadcrumb-sep">&gt;</span>
          <button className="breadcrumb-link" onClick={() => router.push(`/my/orders/${assignmentId}`)}>
            Order Details
          </button>
          <span className="breadcrumb-sep">&gt;</span>
          <span className="breadcrumb-current">Timesheets</span>
        </nav>

        {/* Page Header */}
        <header className="page-header">
          <h1 className="page-title">[T] Timesheet (Official Snapshot)</h1>
          <p className="page-subtitle">
            This reflects the hours MW4H and the customer have approved for this assignment.
          </p>
        </header>

        {/* Snapshot Mode Indicator */}
        <div className="snapshot-indicator">
          <span className="snapshot-icon">[R]</span>
          <span className="snapshot-label">READ-ONLY</span>
        </div>

        {/* Snapshot Table */}
        <section className="snapshot-section">
          <div className="snapshot-table-wrap">
            <table className="snapshot-table">
              <thead>
                <tr>
                  <th className="th-worker">Worker</th>
                  <th className="th-hours">REG</th>
                  <th className="th-hours">OT</th>
                  <th className="th-hours">DT</th>
                  <th className="th-hours">H</th>
                  <th className="th-days">PD</th>
                  <th className="th-dollars">BONUS</th>
                  {showTravel && <th className="th-dollars">TRV</th>}
                  {showReimb && <th className="th-dollars">REM</th>}
                  <th className="th-total">Total Hrs</th>
                </tr>
              </thead>
              <tbody>
                <tr className="snapshot-row">
                  <td className="td-worker">{snapshot.workerName}</td>
                  <td className="td-hours">{snapshot.regHours}</td>
                  <td className="td-hours">{snapshot.otHours}</td>
                  <td className="td-hours">{snapshot.dtHours}</td>
                  <td className="td-hours">{snapshot.holidayHours}</td>
                  <td className="td-days">{snapshot.perDiemDays}</td>
                  <td className="td-dollars">${snapshot.bonusDollars}</td>
                  {showTravel && <td className="td-dollars">${snapshot.travelDollars}</td>}
                  {showReimb && <td className="td-dollars">${snapshot.reimbDollars}</td>}
                  <td className="td-total">{snapshot.totalHours}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="snapshot-legend">
            <span className="legend-item">REG = Regular</span>
            <span className="legend-sep">-</span>
            <span className="legend-item">OT = Overtime</span>
            <span className="legend-sep">-</span>
            <span className="legend-item">DT = Double-time</span>
            <span className="legend-sep">-</span>
            <span className="legend-item">H = Holiday</span>
            <span className="legend-sep">-</span>
            <span className="legend-item">PD = Per Diem (days)</span>
          </div>
        </section>

        {/* Footer */}
        <footer className="page-footer">
          <button className="back-link" onClick={() => router.push('/my/orders')}>
            &lt;- Back to My Orders
          </button>
        </footer>

        <style jsx>{`
          .employee-timesheets-page {
            min-height: 100vh;
            background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
            color: #fff;
            padding: 24px 40px 60px;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
          }

          /* DEMO Banner */
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
            max-width: 800px;
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
            margin-bottom: 20px;
            max-width: 800px;
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
            font-size: 14px;
            color: rgba(255, 255, 255, 0.6);
            line-height: 1.5;
          }

          /* Snapshot Mode Indicator */
          .snapshot-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 14px;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.25);
            border-radius: 6px;
            margin-bottom: 24px;
          }

          .snapshot-icon {
            font-size: 12px;
            color: #818cf8;
          }

          .snapshot-label {
            font-size: 11px;
            font-weight: 700;
            color: #818cf8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* Snapshot Section */
          .snapshot-section {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            max-width: 800px;
          }

          .snapshot-table-wrap {
            overflow-x: auto;
          }

          .snapshot-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }

          .snapshot-table th {
            padding: 12px 16px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.5);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            white-space: nowrap;
          }

          .th-worker {
            min-width: 140px;
          }

          .th-hours,
          .th-days,
          .th-dollars,
          .th-total {
            text-align: right;
            min-width: 70px;
          }

          .th-total {
            min-width: 90px;
            color: rgba(255, 255, 255, 0.7);
          }

          .snapshot-row td {
            padding: 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .td-worker {
            font-weight: 600;
            color: rgba(255, 255, 255, 0.9);
          }

          .td-hours,
          .td-days,
          .td-dollars {
            text-align: right;
            color: rgba(255, 255, 255, 0.8);
            font-variant-numeric: tabular-nums;
          }

          .td-total {
            text-align: right;
            font-weight: 700;
            color: #60a5fa;
            font-variant-numeric: tabular-nums;
          }

          /* Legend */
          .snapshot-legend {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
          }

          .legend-item {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.45);
          }

          .legend-sep {
            font-size: 11px;
            color: rgba(255, 255, 255, 0.2);
          }

          /* Footer */
          .page-footer {
            padding-top: 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            margin-top: 12px;
            max-width: 800px;
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

  // ============================================================================
  // SUBMIT-ONLY REFERENCE ENTRY VIEW (DEMO_MODE = false)
  // This code path is preserved but does NOT render when snapshot mode is active
  // ============================================================================

  // Client-only state for reference entry (no persistence, no API)
  const [hours, setHours] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const hoursValue = parseFloat(hours);
  const canSubmit = !isNaN(hoursValue) && hoursValue > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setHours('');
    setSubmitted(false);
  };

  // CONFIRMATION VIEW - shows ONLY after submit (NO submitted values displayed)
  if (submitted) {
    return (
      <div className="employee-timesheets-page">
        {/* Breadcrumb Navigation */}
        <nav className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => router.push('/my/orders')}>
            My Orders
          </button>
          <span className="breadcrumb-sep">&gt;</span>
          <button className="breadcrumb-link" onClick={() => router.push(`/my/orders/${assignmentId}`)}>
            Order Details
          </button>
          <span className="breadcrumb-sep">&gt;</span>
          <span className="breadcrumb-current">Timesheets</span>
        </nav>

        {/* Page Header */}
        <header className="page-header">
          <h1 className="page-title">[T] Timesheets</h1>
        </header>

        {/* Confirmation View - NO values displayed (VISIBILITY LOCK) */}
        <section className="confirmation-card">
          <div className="confirmation-icon-wrap">
            <span className="confirmation-check">✓</span>
          </div>
          <h2 className="confirmation-title">Hours submitted (reference only).</h2>
          <p className="confirmation-reminder">
            Official hours must be entered and approved by your customer or MW4H separately.
          </p>
          <button className="reset-btn" onClick={handleReset}>
            Submit another entry
          </button>
        </section>

        {/* Footer */}
        <footer className="page-footer">
          <button className="back-link" onClick={() => router.push('/my/orders')}>
            &lt;- Back to My Orders
          </button>
        </footer>

        <style jsx>{`
          .employee-timesheets-page {
            min-height: 100vh;
            background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
            color: #fff;
            padding: 24px 40px 60px;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
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
            max-width: 500px;
          }

          .page-title {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          /* Confirmation Card */
          .confirmation-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 48px 32px;
            background: rgba(34, 197, 94, 0.06);
            border: 1px solid rgba(34, 197, 94, 0.2);
            border-radius: 12px;
            max-width: 500px;
          }

          .confirmation-icon-wrap {
            width: 56px;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(34, 197, 94, 0.15);
            border-radius: 50%;
            margin-bottom: 20px;
          }

          .confirmation-check {
            font-size: 28px;
            color: #22c55e;
          }

          .confirmation-title {
            margin: 0 0 12px 0;
            font-size: 18px;
            font-weight: 600;
            color: #fff;
          }

          .confirmation-reminder {
            margin: 0 0 28px 0;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.6);
            line-height: 1.5;
            max-width: 360px;
          }

          .reset-btn {
            padding: 14px 28px;
            background: rgba(59, 130, 246, 0.12);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #60a5fa;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .reset-btn:hover {
            background: rgba(59, 130, 246, 0.2);
            border-color: rgba(59, 130, 246, 0.5);
          }

          /* Footer */
          .page-footer {
            padding-top: 32px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            margin-top: 32px;
            max-width: 500px;
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

  // ENTRY VIEW - submit-only form
  return (
    <div className="employee-timesheets-page">
      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <button className="breadcrumb-link" onClick={() => router.push('/my/orders')}>
          My Orders
        </button>
        <span className="breadcrumb-sep">&gt;</span>
        <button className="breadcrumb-link" onClick={() => router.push(`/my/orders/${assignmentId}`)}>
          Order Details
        </button>
        <span className="breadcrumb-sep">&gt;</span>
        <span className="breadcrumb-current">Timesheets</span>
      </nav>

      {/* Page Header */}
      <header className="page-header">
        <h1 className="page-title">[T] Timesheets</h1>
      </header>

      {/* Reference Hours Notice - Prominent */}
      <div className="reference-notice">
        <span className="notice-icon">[!]</span>
        <div className="notice-content">
          <span className="notice-title">Reference-Only Hours</span>
          <ul className="notice-list">
            <li>Not official</li>
            <li>Not billable</li>
            <li>Not visible to customer</li>
          </ul>
          <p className="notice-official">
            Official hours must be entered and approved by your customer or MW4H.
          </p>
        </div>
      </div>

      {/* Submit Form */}
      <section className="form-section">
        <h2 className="section-title">
          <span className="section-icon">[H]</span>
          Enter Hours
        </h2>
        
        <div className="form-content">
          {/* Input Field */}
          <div className="input-group">
            <label className="input-label" htmlFor="hours-input">
              Total hours (reference only)
            </label>
            <input 
              id="hours-input"
              type="number" 
              className="input-field"
              placeholder="0.0"
              min="0"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <button 
            className={`submit-btn ${canSubmit ? 'submit-btn--enabled' : ''}`}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Submit
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="page-footer">
        <button className="back-link" onClick={() => router.push('/my/orders')}>
          &lt;- Back to My Orders
        </button>
      </footer>

      <style jsx>{`
        .employee-timesheets-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          padding: 24px 40px 60px;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
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
          margin-bottom: 24px;
          max-width: 500px;
        }

        .page-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Reference Notice - Prominent */
        .reference-notice {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 18px 22px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 10px;
          margin-bottom: 24px;
          max-width: 500px;
        }

        .notice-icon {
          font-size: 22px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .notice-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .notice-title {
          font-size: 15px;
          font-weight: 700;
          color: #fbbf24;
        }

        .notice-list {
          margin: 0;
          padding-left: 18px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.6;
        }

        .notice-list li {
          margin-bottom: 2px;
        }

        .notice-official {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.5;
        }

        /* Form Section */
        .form-section {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
          max-width: 500px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin: 0 0 20px 0;
        }

        .section-icon {
          font-size: 18px;
        }

        .form-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
        }

        .input-field {
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          font-size: 16px;
          color: #fff;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .input-field::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .input-field:focus {
          border-color: rgba(59, 130, 246, 0.5);
        }

        .submit-btn {
          padding: 14px 24px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(96, 165, 250, 0.4);
          cursor: not-allowed;
          transition: all 0.15s ease;
        }

        .submit-btn--enabled {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
          color: #60a5fa;
          cursor: pointer;
        }

        .submit-btn--enabled:hover {
          background: rgba(59, 130, 246, 0.3);
          border-color: rgba(59, 130, 246, 0.6);
        }

        /* Footer */
        .page-footer {
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 12px;
          max-width: 500px;
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
