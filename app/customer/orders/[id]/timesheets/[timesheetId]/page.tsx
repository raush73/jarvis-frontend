'use client';

import { useParams, useRouter } from 'next/navigation';

/**
 * Customer Timesheet DETAIL Page - Slice C
 * 
 * Customer-facing timesheet view for order-scoped hours.
 * Shows official hours rollup by PayrollEarningCode and project breakdown.
 * 
 * VISIBILITY LOCKS (ABSOLUTE - CUSTOMER MAY NOT SEE):
 * - Employee-entered reference hours
 * - Discrepancies
 * - Internal notes
 * - Review history
 * 
 * Route: /customer/orders/[id]/timesheets/[timesheetId]
 */

// DEMO MODE toggle - set to false to hide demo data
const DEMO_MODE = true;

// DEMO: Static status for demonstration
const DEMO_STATUS: 'Draft' | 'Submitted' | 'Finalized' = 'Submitted';

// PayrollEarningCode types
type EarningCode = 'REG' | 'OT' | 'DT' | 'H' | 'PD' | 'TRV' | 'BONUS' | 'REM';
type UnitType = 'HOURS' | 'DAYS' | 'DOLLARS';

// DEMO: Line item type for Project/PO breakdown with PayrollEarningCode fields
type DemoLineItem = {
  id: string;
  workerName: string;
  projectLabel: string;
  poNumber: string;
  earningCode: EarningCode;
  unit: UnitType;
  quantity: number;
  amount: number | null; // optional; for DOLLARS you may use quantity as dollars if amount absent
  notes: string; // CUSTOMER LOCK: notes exist but must NOT render in customer UI
};

// DEMO: Line items data - workers can appear on MULTIPLE Project/POs
// Each line represents an HoursEntryLine-like record with earningCode + unit
// NOTE: Each worker has H: 8 HOURS and BONUS: 100 DOLLARS per requirement
const DEMO_LINE_ITEMS: DemoLineItem[] = [
  // J. Martinez on Main Building Electrical
  { id: 'line-001', workerName: 'J. Martinez', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'REG', unit: 'HOURS', quantity: 32.0, amount: null, notes: '' },
  { id: 'line-002', workerName: 'J. Martinez', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'OT', unit: 'HOURS', quantity: 8.0, amount: null, notes: 'Weekend overtime' },
  { id: 'line-003', workerName: 'J. Martinez', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'PD', unit: 'DAYS', quantity: 5, amount: null, notes: '' },
  { id: 'line-004', workerName: 'J. Martinez', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'TRV', unit: 'DOLLARS', quantity: 150.00, amount: 150.00, notes: '' },
  { id: 'line-005', workerName: 'J. Martinez', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'H', unit: 'HOURS', quantity: 8.0, amount: null, notes: 'MLK Day' },
  { id: 'line-006', workerName: 'J. Martinez', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'BONUS', unit: 'DOLLARS', quantity: 100.00, amount: 100.00, notes: '' },

  // R. Chen on Main Building Electrical
  { id: 'line-010', workerName: 'R. Chen', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'REG', unit: 'HOURS', quantity: 28.5, amount: null, notes: '' },
  { id: 'line-011', workerName: 'R. Chen', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'OT', unit: 'HOURS', quantity: 4.0, amount: null, notes: '' },
  { id: 'line-012', workerName: 'R. Chen', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'PD', unit: 'DAYS', quantity: 4, amount: null, notes: '' },
  { id: 'line-013', workerName: 'R. Chen', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'REM', unit: 'DOLLARS', quantity: 50.00, amount: 50.00, notes: 'Hazard pay reimbursement' },
  { id: 'line-014', workerName: 'R. Chen', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'H', unit: 'HOURS', quantity: 8.0, amount: null, notes: 'MLK Day' },
  { id: 'line-015', workerName: 'R. Chen', projectLabel: 'Main Building Electrical', poNumber: 'PO-2026-0142', earningCode: 'BONUS', unit: 'DOLLARS', quantity: 100.00, amount: 100.00, notes: '' },

  // R. Chen on HVAC Installation (worker on MULTIPLE projects)
  { id: 'line-020', workerName: 'R. Chen', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'REG', unit: 'HOURS', quantity: 10.0, amount: null, notes: 'Cross-trained HVAC support' },
  { id: 'line-021', workerName: 'R. Chen', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'PD', unit: 'DAYS', quantity: 1, amount: null, notes: '' },
  { id: 'line-022', workerName: 'R. Chen', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'H', unit: 'HOURS', quantity: 8.0, amount: null, notes: 'MLK Day' },
  { id: 'line-023', workerName: 'R. Chen', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'BONUS', unit: 'DOLLARS', quantity: 100.00, amount: 100.00, notes: '' },

  // S. Thompson on HVAC Installation
  { id: 'line-030', workerName: 'S. Thompson', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'REG', unit: 'HOURS', quantity: 24.0, amount: null, notes: '' },
  { id: 'line-031', workerName: 'S. Thompson', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'DT', unit: 'HOURS', quantity: 4.0, amount: null, notes: 'Sunday double-time' },
  { id: 'line-032', workerName: 'S. Thompson', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'PD', unit: 'DAYS', quantity: 4, amount: null, notes: '' },
  { id: 'line-033', workerName: 'S. Thompson', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'TRV', unit: 'DOLLARS', quantity: 200.00, amount: 200.00, notes: '' },
  { id: 'line-034', workerName: 'S. Thompson', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'H', unit: 'HOURS', quantity: 8.0, amount: null, notes: 'MLK Day' },
  { id: 'line-035', workerName: 'S. Thompson', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'BONUS', unit: 'DOLLARS', quantity: 100.00, amount: 100.00, notes: '' },

  // M. Davis on HVAC Installation (worker on MULTIPLE projects)
  { id: 'line-040', workerName: 'M. Davis', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'REG', unit: 'HOURS', quantity: 14.0, amount: null, notes: '' },
  { id: 'line-041', workerName: 'M. Davis', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'PD', unit: 'DAYS', quantity: 2, amount: null, notes: '' },
  { id: 'line-042', workerName: 'M. Davis', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'H', unit: 'HOURS', quantity: 8.0, amount: null, notes: 'MLK Day' },
  { id: 'line-043', workerName: 'M. Davis', projectLabel: 'HVAC Installation - Wing B', poNumber: 'PO-2026-0156', earningCode: 'BONUS', unit: 'DOLLARS', quantity: 100.00, amount: 100.00, notes: '' },

  // M. Davis on Carpentry (worker on MULTIPLE projects)
  { id: 'line-050', workerName: 'M. Davis', projectLabel: 'Carpentry - Office Renovation', poNumber: 'PO-2026-0163', earningCode: 'REG', unit: 'HOURS', quantity: 8.0, amount: null, notes: '' },
  { id: 'line-051', workerName: 'M. Davis', projectLabel: 'Carpentry - Office Renovation', poNumber: 'PO-2026-0163', earningCode: 'OT', unit: 'HOURS', quantity: 2.0, amount: null, notes: '' },
  { id: 'line-052', workerName: 'M. Davis', projectLabel: 'Carpentry - Office Renovation', poNumber: 'PO-2026-0163', earningCode: 'PD', unit: 'DAYS', quantity: 1, amount: null, notes: '' },
  { id: 'line-053', workerName: 'M. Davis', projectLabel: 'Carpentry - Office Renovation', poNumber: 'PO-2026-0163', earningCode: 'H', unit: 'HOURS', quantity: 8.0, amount: null, notes: 'MLK Day' },
  { id: 'line-054', workerName: 'M. Davis', projectLabel: 'Carpentry - Office Renovation', poNumber: 'PO-2026-0163', earningCode: 'BONUS', unit: 'DOLLARS', quantity: 100.00, amount: 100.00, notes: 'Completion bonus for early finish' },
];

// Official rollup type per worker
type WorkerRollup = {
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
};

// Helper: Group line items by Project/PO
function groupByProject(items: DemoLineItem[]): Map<string, DemoLineItem[]> {
  const groups = new Map<string, DemoLineItem[]>();
  for (const item of items) {
    const key = `${item.projectLabel}|||${item.poNumber}`;
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }
  return groups;
}

// Helper: Derive official rollup from line items (group by worker, sum by earning code bucket)
// Rollup rules:
// - Only count HOURS units into hour buckets (REG/OT/DT/H)
// - Only count DAYS into PD
// - Only count DOLLARS into BONUS/TRV/REM
// - Ignore mismatched unit/code combos safely
function deriveOfficialRollup(items: DemoLineItem[]): WorkerRollup[] {
  const workerMap = new Map<string, Omit<WorkerRollup, 'workerName' | 'totalHours'>>();
  
  for (const item of items) {
    const existing = workerMap.get(item.workerName) || {
      regHours: 0,
      otHours: 0,
      dtHours: 0,
      holidayHours: 0,
      perDiemDays: 0,
      bonusDollars: 0,
      travelDollars: 0,
      reimbDollars: 0,
    };

    // Only process valid unit/code combinations
    switch (item.earningCode) {
      case 'REG':
        if (item.unit === 'HOURS') existing.regHours += item.quantity;
        break;
      case 'OT':
        if (item.unit === 'HOURS') existing.otHours += item.quantity;
        break;
      case 'DT':
        if (item.unit === 'HOURS') existing.dtHours += item.quantity;
        break;
      case 'H':
        if (item.unit === 'HOURS') existing.holidayHours += item.quantity;
        break;
      case 'PD':
        if (item.unit === 'DAYS') existing.perDiemDays += item.quantity;
        break;
      case 'BONUS':
        if (item.unit === 'DOLLARS') existing.bonusDollars += item.amount ?? item.quantity;
        break;
      case 'TRV':
        if (item.unit === 'DOLLARS') existing.travelDollars += item.amount ?? item.quantity;
        break;
      case 'REM':
        if (item.unit === 'DOLLARS') existing.reimbDollars += item.amount ?? item.quantity;
        break;
    }

    workerMap.set(item.workerName, existing);
  }

  return Array.from(workerMap.entries()).map(([workerName, data]) => ({
    workerName,
    ...data,
    totalHours: data.regHours + data.otHours + data.dtHours + data.holidayHours,
  }));
}

// Helper: Derive worker rollup for a single project's items (project-level grouping)
function deriveProjectWorkerRollup(items: DemoLineItem[]): WorkerRollup[] {
  const workerMap = new Map<string, Omit<WorkerRollup, 'workerName' | 'totalHours'>>();
  
  for (const item of items) {
    const existing = workerMap.get(item.workerName) || {
      regHours: 0,
      otHours: 0,
      dtHours: 0,
      holidayHours: 0,
      perDiemDays: 0,
      bonusDollars: 0,
      travelDollars: 0,
      reimbDollars: 0,
    };

    // Only process valid unit/code combinations (same rules as deriveOfficialRollup)
    switch (item.earningCode) {
      case 'REG':
        if (item.unit === 'HOURS') existing.regHours += item.quantity;
        break;
      case 'OT':
        if (item.unit === 'HOURS') existing.otHours += item.quantity;
        break;
      case 'DT':
        if (item.unit === 'HOURS') existing.dtHours += item.quantity;
        break;
      case 'H':
        if (item.unit === 'HOURS') existing.holidayHours += item.quantity;
        break;
      case 'PD':
        if (item.unit === 'DAYS') existing.perDiemDays += item.quantity;
        break;
      case 'BONUS':
        if (item.unit === 'DOLLARS') existing.bonusDollars += item.amount ?? item.quantity;
        break;
      case 'TRV':
        if (item.unit === 'DOLLARS') existing.travelDollars += item.amount ?? item.quantity;
        break;
      case 'REM':
        if (item.unit === 'DOLLARS') existing.reimbDollars += item.amount ?? item.quantity;
        break;
    }

    workerMap.set(item.workerName, existing);
  }

  return Array.from(workerMap.entries()).map(([workerName, data]) => ({
    workerName,
    ...data,
    totalHours: data.regHours + data.otHours + data.dtHours + data.holidayHours,
  }));
}

// Helper: Calculate project total hours (only HOURS unit with hour-based earning codes)
function calcProjectTotal(items: DemoLineItem[]): number {
  return items.reduce((sum, item) => {
    if (item.unit === 'HOURS' && ['REG', 'OT', 'DT', 'H'].includes(item.earningCode)) {
      return sum + item.quantity;
    }
    return sum;
  }, 0);
}

// DEMO: Hours entry placeholder hint (not prefilling input, just a hint)
const DEMO_HOURS_HINT = 'Demo: 42.0 hours for current period';

// DEMO: MW4H submitted summary (read-only, no employee reference data)
const DEMO_MW4H_SUMMARY = 'MW4H submitted: 42.0 hours (demo)';

export default function CustomerTimesheetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;
  const timesheetId = params?.timesheetId as string;

  // Derived: Project groups from DEMO_LINE_ITEMS
  const projectGroups = groupByProject(DEMO_LINE_ITEMS);

  // Derived: Official rollup from DEMO_LINE_ITEMS (order-level)
  const officialRollup = deriveOfficialRollup(DEMO_LINE_ITEMS);

  // Check if any worker in order-level rollup has TRV or REM
  const showTrvColumnGlobal = officialRollup.some(w => w.travelDollars > 0);
  const showRemColumnGlobal = officialRollup.some(w => w.reimbDollars > 0);

  return (
    <div className="customer-timesheets-page">
      {/* DEMO MODE Banner */}
      {DEMO_MODE && (
        <div className="demo-banner">
          <span className="demo-icon">[!]</span>
          <span className="demo-text">DEMO DATA - UI ONLY (toggle: DEMO_MODE)</span>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <button className="breadcrumb-link" onClick={() => router.push('/customer/orders')}>
          Your Orders
        </button>
        <span className="breadcrumb-sep">&gt;</span>
        <button className="breadcrumb-link" onClick={() => router.push(`/customer/orders/${orderId}`)}>
          {orderId}
        </button>
        <span className="breadcrumb-sep">&gt;</span>
        <button className="breadcrumb-link" onClick={() => router.push(`/customer/orders/${orderId}/timesheets`)}>
          Timesheets
        </button>
        <span className="breadcrumb-sep">&gt;</span>
        <span className="breadcrumb-current">{timesheetId}</span>
      </nav>

      {/* Page Header */}
      <header className="page-header">
        <div className="header-row">
          <div className="header-text">
            <h1 className="page-title">[T] Timesheet Detail</h1>
            <p className="page-subtitle">Official hours (customer view) — {timesheetId}</p>
          </div>
          {/* Status Badge (demo/static UI only) */}
          <div className="status-badge" data-status={DEMO_STATUS.toLowerCase()}>
            {DEMO_STATUS}
          </div>
        </div>
        <p className="visibility-notice">Employee reference hours are not visible to customers.</p>
      </header>

      {/* Section: Official Hours (Submitted) - Customer Read-Only View */}
      {DEMO_MODE && (
        <section className="content-section">
          <h2 className="section-title">
            <span className="section-icon">[O]</span>
            Official Hours (Submitted)
          </h2>
          <p className="section-helper">These are official hours submitted by MW4H for customer review.</p>
          <div className="section-body">
            <div className="official-hours-table">
              {/* Column Headers */}
              <div className="oh-header">
                <div className="oh-col oh-col-name">Worker</div>
                <div className="oh-col oh-col-hours">REG</div>
                <div className="oh-col oh-col-hours">OT</div>
                <div className="oh-col oh-col-hours">DT</div>
                <div className="oh-col oh-col-hours">H</div>
                <div className="oh-col oh-col-days">PD</div>
                <div className="oh-col oh-col-dollars">BONUS</div>
                {showTrvColumnGlobal && <div className="oh-col oh-col-dollars">TRV</div>}
                {showRemColumnGlobal && <div className="oh-col oh-col-dollars">REM</div>}
                <div className="oh-col oh-col-total">Total Hrs</div>
              </div>
              {/* Worker Rows */}
              {officialRollup.map((worker, idx) => (
                <div key={idx} className="oh-row">
                  <div className="oh-col oh-col-name">
                    <span className="oh-worker-name">{worker.workerName}</span>
                  </div>
                  <div className="oh-col oh-col-hours">{worker.regHours > 0 ? worker.regHours.toFixed(1) : '-'}</div>
                  <div className="oh-col oh-col-hours">{worker.otHours > 0 ? worker.otHours.toFixed(1) : '-'}</div>
                  <div className="oh-col oh-col-hours">{worker.dtHours > 0 ? worker.dtHours.toFixed(1) : '-'}</div>
                  <div className="oh-col oh-col-hours oh-holiday">{worker.holidayHours > 0 ? worker.holidayHours.toFixed(1) : '-'}</div>
                  <div className="oh-col oh-col-days">{worker.perDiemDays > 0 ? worker.perDiemDays : '-'}</div>
                  <div className="oh-col oh-col-dollars oh-bonus">{worker.bonusDollars > 0 ? `$${worker.bonusDollars.toFixed(0)}` : '-'}</div>
                  {showTrvColumnGlobal && <div className="oh-col oh-col-dollars">{worker.travelDollars > 0 ? `$${worker.travelDollars.toFixed(0)}` : '-'}</div>}
                  {showRemColumnGlobal && <div className="oh-col oh-col-dollars">{worker.reimbDollars > 0 ? `$${worker.reimbDollars.toFixed(0)}` : '-'}</div>}
                  <div className="oh-col oh-col-total">{worker.totalHours.toFixed(1)}</div>
                </div>
              ))}
            </div>
            <p className="demo-note">DEMO: Order-level rollup by PayrollEarningCode (REG/OT/DT/H/PD/BONUS + optional TRV/REM).</p>
          </div>
        </section>
      )}

      {/* Section: Projects & Job Sites - Customer Read-Only View */}
      {DEMO_MODE && (
        <section className="content-section">
          <h2 className="section-title">
            <span className="section-icon">[P]</span>
            Projects &amp; Job Sites
          </h2>
          <div className="section-body">
            {Array.from(projectGroups.entries()).map(([key, items]) => {
              const [projectLabel, poNumber] = key.split('|||');
              const projectTotal = calcProjectTotal(items);
              // Derive project-level worker rollups (one row per worker)
              const projectWorkerRollup = deriveProjectWorkerRollup(items);
              // Check if any worker in this project has TRV or REM
              const showTrvColumn = projectWorkerRollup.some(w => w.travelDollars > 0);
              const showRemColumn = projectWorkerRollup.some(w => w.reimbDollars > 0);
              // Calculate column count for grid
              const baseColCount = 8; // Worker + REG + OT + DT + H + PD + BONUS + Total Hrs
              const colCount = baseColCount + (showTrvColumn ? 1 : 0) + (showRemColumn ? 1 : 0);

              return (
                <div key={key} className="project-card">
                  {/* Project Header */}
                  <div className="project-header">
                    <div className="project-title">{projectLabel}</div>
                    <div className="project-po">PO: {poNumber}</div>
                    <div className="project-total">Project Total: {projectTotal.toFixed(1)} hrs</div>
                  </div>
                  {/* Worker Rollup Table (one row per worker) */}
                  <div
                    className="project-table-header"
                    style={{
                      gridTemplateColumns: `2fr repeat(${colCount - 1}, 1fr)`,
                    }}
                  >
                    <div className="pt-col pt-col-header">Worker</div>
                    <div className="pt-col pt-col-header">REG</div>
                    <div className="pt-col pt-col-header">OT</div>
                    <div className="pt-col pt-col-header">DT</div>
                    <div className="pt-col pt-col-header">H</div>
                    <div className="pt-col pt-col-header">PD</div>
                    <div className="pt-col pt-col-header">BONUS</div>
                    {showTrvColumn && <div className="pt-col pt-col-header">TRV</div>}
                    {showRemColumn && <div className="pt-col pt-col-header">REM</div>}
                    <div className="pt-col pt-col-header">Total Hrs</div>
                  </div>
                  {/* Worker Rows */}
                  {projectWorkerRollup.map((worker, idx) => (
                    <div
                      key={`${key}-${worker.workerName}`}
                      className={`project-table-row ${idx === projectWorkerRollup.length - 1 ? 'last-row' : ''}`}
                      style={{
                        gridTemplateColumns: `2fr repeat(${colCount - 1}, 1fr)`,
                      }}
                    >
                      <div className="pt-col pt-col-name">{worker.workerName}</div>
                      <div className="pt-col pt-col-value">{worker.regHours > 0 ? worker.regHours.toFixed(1) : '-'}</div>
                      <div className="pt-col pt-col-value">{worker.otHours > 0 ? worker.otHours.toFixed(1) : '-'}</div>
                      <div className="pt-col pt-col-value">{worker.dtHours > 0 ? worker.dtHours.toFixed(1) : '-'}</div>
                      <div className="pt-col pt-col-value pt-holiday">{worker.holidayHours > 0 ? worker.holidayHours.toFixed(1) : '-'}</div>
                      <div className="pt-col pt-col-value pt-days">{worker.perDiemDays > 0 ? worker.perDiemDays : '-'}</div>
                      <div className="pt-col pt-col-value pt-bonus">{worker.bonusDollars > 0 ? `$${worker.bonusDollars.toFixed(0)}` : '-'}</div>
                      {showTrvColumn && <div className="pt-col pt-col-value pt-dollars">{worker.travelDollars > 0 ? `$${worker.travelDollars.toFixed(0)}` : '-'}</div>}
                      {showRemColumn && <div className="pt-col pt-col-value pt-dollars">{worker.reimbDollars > 0 ? `$${worker.reimbDollars.toFixed(0)}` : '-'}</div>}
                      <div className="pt-col pt-col-value pt-total">{worker.totalHours.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
            <p className="demo-note">DEMO: Workers appear once per project (project-level rollup). A worker can appear in multiple projects.</p>
          </div>
        </section>
      )}

      {/* Section: Enter Official Hours */}
      <section className="content-section">
        <h2 className="section-title">
          <span className="section-icon">[E]</span>
          Enter Official Hours
        </h2>
        <div className="section-body">
          <div className="hours-entry-shell">
            <label className="hours-label" htmlFor="total-hours">Total Hours</label>
            {DEMO_MODE && (
              <p className="demo-hint">{DEMO_HOURS_HINT}</p>
            )}
            <input
              id="total-hours"
              type="number"
              className="hours-input"
              placeholder="0.00"
              disabled
              aria-label="Total hours input (disabled placeholder)"
            />
            <p className="input-hint">Hours entry will be enabled in a future build.</p>
          </div>
        </div>
      </section>

      {/* Section: Approve / Reject MW4H Hours */}
      <section className="content-section">
        <h2 className="section-title">
          <span className="section-icon">[A]</span>
          Approve or Reject MW4H Hours
        </h2>
        <div className="section-body">
          <p className="section-description">
            Review and confirm the submitted hours for this order.
          </p>
          {DEMO_MODE && (
            <div className="demo-summary-card">
              <span className="demo-summary-text">{DEMO_MW4H_SUMMARY}</span>
              <p className="demo-card-note">DEMO: Read-only summary - no employee reference data shown.</p>
            </div>
          )}
          <div className="action-buttons">
            <button
              type="button"
              className="action-btn approve-btn"
              disabled
              aria-label="Approve hours (disabled)"
            >
              Approve
            </button>
            <button
              type="button"
              className="action-btn reject-btn"
              disabled
              aria-label="Reject hours (disabled)"
            >
              Reject
            </button>
          </div>
          <p className="input-hint">Approval actions will be enabled in a future build.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="page-footer">
        <button className="back-link" onClick={() => router.push(`/customer/orders/${orderId}/timesheets`)}>
          &lt;- Back to Timesheets
        </button>
      </footer>

      <style jsx>{`
        .customer-timesheets-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          padding: 24px 40px 60px;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
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

        .demo-hint {
          margin: 0 0 8px 0;
          padding: 8px 12px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 6px;
          font-size: 12px;
          color: #60a5fa;
          font-style: italic;
        }

        .demo-summary-card {
          padding: 16px 20px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .demo-summary-text {
          display: block;
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin-bottom: 8px;
        }

        .demo-card-note {
          margin: 0;
          font-size: 11px;
          color: #fbbf24;
          font-style: italic;
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

        .header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 12px;
        }

        .header-text {
          flex: 1;
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

        /* Status Badge */
        .status-badge {
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        .status-badge[data-status="draft"] {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        .status-badge[data-status="submitted"] {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .status-badge[data-status="finalized"] {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .visibility-notice {
          margin: 0;
          padding: 10px 14px;
          background: rgba(100, 116, 139, 0.1);
          border-left: 3px solid rgba(100, 116, 139, 0.4);
          border-radius: 0 6px 6px 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
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

        .section-helper {
          margin: 0 0 16px 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }

        .section-body {
          padding: 16px 0 0 0;
        }

        .section-description {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Official Hours Table */
        .official-hours-table {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .oh-header {
          display: grid;
          grid-template-columns: 2fr repeat(6, 1fr) ${showTrvColumnGlobal ? '1fr' : ''} ${showRemColumnGlobal ? '1fr' : ''} 1.2fr;
          gap: 4px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px 8px 0 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: none;
        }

        .oh-header .oh-col {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .oh-row {
          display: grid;
          grid-template-columns: 2fr repeat(6, 1fr) ${showTrvColumnGlobal ? '1fr' : ''} ${showRemColumnGlobal ? '1fr' : ''} 1.2fr;
          gap: 4px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: none;
        }

        .oh-row:last-of-type {
          border-radius: 0 0 8px 8px;
        }

        .oh-row:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .oh-col {
          display: flex;
          align-items: center;
          font-size: 13px;
        }

        .oh-col-name {
          justify-content: flex-start;
        }

        .oh-col-hours,
        .oh-col-days,
        .oh-col-dollars,
        .oh-col-total {
          justify-content: flex-end;
          font-variant-numeric: tabular-nums;
        }

        .oh-worker-name {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .oh-col-hours {
          color: rgba(255, 255, 255, 0.7);
        }

        .oh-col-days {
          color: #60a5fa;
        }

        .oh-col-dollars {
          color: #4ade80;
        }

        .oh-col-total {
          color: #60a5fa;
          font-weight: 600;
        }

        .oh-holiday {
          color: #a78bfa;
        }

        .oh-bonus {
          color: #4ade80;
        }

        /* Project Cards */
        .project-card {
          margin-bottom: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .project-header {
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .project-title {
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .project-po {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 4px;
        }

        .project-total {
          font-size: 13px;
          color: #60a5fa;
          margin-top: 4px;
        }

        .project-table-header {
          display: grid;
          gap: 4px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px 8px 0 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: none;
        }

        .project-table-row {
          display: grid;
          gap: 4px;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: none;
        }

        .project-table-row.last-row {
          border-radius: 0 0 8px 8px;
        }

        .project-table-row:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .pt-col {
          font-size: 13px;
        }

        .pt-col-header {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          text-align: right;
        }

        .pt-col-header:first-child {
          text-align: left;
        }

        .pt-col-name {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .pt-col-value {
          text-align: right;
          color: rgba(255, 255, 255, 0.7);
          font-variant-numeric: tabular-nums;
        }

        .pt-holiday {
          color: #a78bfa;
        }

        .pt-days {
          color: #60a5fa;
        }

        .pt-bonus,
        .pt-dollars {
          color: #4ade80;
        }

        .pt-total {
          color: #60a5fa;
          font-weight: 600;
        }

        /* Hours Entry Shell */
        .hours-entry-shell {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 280px;
        }

        .hours-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
        }

        .hours-input {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 16px;
          color: rgba(255, 255, 255, 0.4);
          outline: none;
          transition: border-color 0.15s ease;
        }

        .hours-input:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .input-hint {
          margin: 8px 0 0 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
        }

        /* Action Buttons */
        .action-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .action-btn {
          padding: 12px 28px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: not-allowed;
          transition: all 0.15s ease;
        }

        .approve-btn {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #4ade80;
        }

        .approve-btn:disabled {
          opacity: 0.5;
        }

        .reject-btn {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        .reject-btn:disabled {
          opacity: 0.5;
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

