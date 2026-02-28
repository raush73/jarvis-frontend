'use client';

import { useParams, useRouter } from 'next/navigation';

/**
 * Employee Dispatch Packet — UI Shell / Demo Only
 * 
 * A READ-ONLY, privacy-safe view of the dispatch packet for the employee.
 * Shows ONLY employee-scoped information:
 * - Job site & dates
 * - Required certifications
 * - Required PPE
 * - Required tools
 * - This employee's name ONLY
 * 
 * DOES NOT show:
 * - Other workers
 * - Internal notes
 * - Pay, rates, or billing
 * - Staffing decisions
 * 
 * Route: /my/orders/[assignmentId]/dispatch
 */

// Mock employee data (the currently "logged in" employee for demo)
const MOCK_EMPLOYEE = {
  id: 'emp_001',
  name: 'Marcus Thompson',
  trade: 'Millwright',
};

// Mock assignments keyed by assignment ID (inline, no external fetching)
const MOCK_ASSIGNMENTS: Record<string, {
  id: string;
  orderId: string;
  jobName: string;
  customerName: string;
  site: string;
  startDate: string;
  endDate: string;
  status: 'current' | 'completed';
  reportTime: string;
  siteContact: string;
  siteContactPhone: string;
  requiredCerts: string[];
  requiredPPE: string[];
  requiredTools: string[];
  specialInstructions: string;
}> = {
  'assign_001': {
    id: 'assign_001',
    orderId: 'ord_001',
    jobName: 'Refinery Turnaround Q1',
    customerName: 'Marathon Petroleum',
    site: 'Marathon Petroleum Refinery — 2401 5th Ave S, Texas City, TX 77590',
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    status: 'current',
    reportTime: '6:00 AM',
    siteContact: 'Robert Chen',
    siteContactPhone: '(409) 555-0142',
    requiredCerts: [
      'OSHA 30',
      'First Aid/CPR',
      'Confined Space Entry',
      'TWIC Card',
    ],
    requiredPPE: [
      'Hard Hat (with company sticker)',
      'Safety Glasses (ANSI Z87.1)',
      'Hi-Vis Vest (Class 2 minimum)',
      'Steel-Toe Boots',
      'FR Clothing (minimum 8.7 cal rating)',
      'Hearing Protection',
      'Work Gloves',
      'Face Shield (for grinding operations)',
    ],
    requiredTools: [
      'Torque Wrenches (assorted)',
      'Dial Indicators',
      'Feeler Gauges',
      'Precision Level',
      'Rigging Equipment (personal slings)',
      'Hand Tools (standard millwright kit)',
    ],
    specialInstructions: 'Report to Gate 7 for badge check. Mandatory safety orientation at 6:30 AM on first day. Parking in Lot C only. No cell phones permitted in process areas.',
  },
  'assign_002': {
    id: 'assign_002',
    orderId: 'ord_002',
    jobName: 'Power Plant Maintenance',
    customerName: 'NRG Energy',
    site: 'NRG W.A. Parish Generating Station — 2500 S FM 521, Thompsons, TX 77481',
    startDate: '2026-03-05',
    endDate: '2026-03-20',
    status: 'current',
    reportTime: '5:30 AM',
    siteContact: 'Lisa Martinez',
    siteContactPhone: '(281) 555-0198',
    requiredCerts: [
      'OSHA 30',
      'First Aid/CPR',
      'Confined Space Entry',
      'Fall Protection Certified',
    ],
    requiredPPE: [
      'Hard Hat',
      'Safety Glasses',
      'Hi-Vis Vest (Class 3)',
      'Steel-Toe Boots',
      'FR Clothing (minimum 12 cal rating)',
      'Hearing Protection',
      'Work Gloves',
      'Full Body Harness (for elevated work)',
    ],
    requiredTools: [
      'Torque Wrenches',
      'Laser Alignment Kit',
      'Dial Indicators',
      'Micrometers',
      'Hand Tools (standard kit)',
    ],
    specialInstructions: 'Enter via main security gate. Daily toolbox talk at 6:00 AM. Hot work permits required for all welding/grinding. Escorts required in restricted areas.',
  },
  'assign_003': {
    id: 'assign_003',
    orderId: 'ord_003',
    jobName: 'Chemical Plant Expansion',
    customerName: 'BASF Corporation',
    site: 'BASF Freeport Site — 602 Copper Rd, Freeport, TX 77541',
    startDate: '2025-11-10',
    endDate: '2025-12-15',
    status: 'completed',
    reportTime: '6:00 AM',
    siteContact: 'David Wilson',
    siteContactPhone: '(979) 555-0167',
    requiredCerts: [
      'OSHA 30',
      'First Aid/CPR',
      'Confined Space Entry',
      'TWIC Card',
      'H2S Awareness',
    ],
    requiredPPE: [
      'Hard Hat',
      'Safety Glasses',
      'Hi-Vis Vest',
      'Steel-Toe Boots',
      'FR Clothing',
      'Chemical Resistant Gloves',
      'Portable Gas Monitor',
    ],
    requiredTools: [
      'Torque Wrenches',
      'Dial Indicators',
      'Precision Levels',
      'Hand Tools',
    ],
    specialInstructions: 'Chemical plant protocols apply. Shower facilities required before leaving site. Report all chemical exposures immediately.',
  },
  'assign_004': {
    id: 'assign_004',
    orderId: 'ord_004',
    jobName: 'Offshore Platform Retrofit',
    customerName: 'Chevron',
    site: 'Chevron Platform Bravo — Gulf of Mexico (Helicopter transport from Galveston)',
    startDate: '2025-09-01',
    endDate: '2025-10-30',
    status: 'completed',
    reportTime: '4:30 AM (heliport)',
    siteContact: 'James O\'Brien',
    siteContactPhone: '(409) 555-0234',
    requiredCerts: [
      'OSHA 30',
      'BOSIET/HUET',
      'First Aid/CPR',
      'Confined Space Entry',
      'TWIC Card',
      'SafeGulf',
    ],
    requiredPPE: [
      'Hard Hat',
      'Safety Glasses',
      'Hi-Vis Coveralls',
      'Steel-Toe Boots (non-sparking)',
      'FR Clothing',
      'Life Jacket (provided)',
      'Work Gloves',
    ],
    requiredTools: [
      'Non-sparking Hand Tools',
      'Torque Wrenches',
      'Portable Alignment Equipment',
    ],
    specialInstructions: 'Helicopter weight limit: 250 lbs with gear. 14/14 rotation schedule. No personal electronics on platform. Mandatory helicopter safety briefing before each flight.',
  },
  'assign_005': {
    id: 'assign_005',
    orderId: 'ord_005',
    jobName: 'LNG Terminal Commissioning',
    customerName: 'Cheniere Energy',
    site: 'Sabine Pass LNG — 500 N LNG Pkwy, Sabine Pass, TX 77655',
    startDate: '2025-06-15',
    endDate: '2025-08-20',
    status: 'completed',
    reportTime: '5:00 AM',
    siteContact: 'Sarah Johnson',
    siteContactPhone: '(409) 555-0311',
    requiredCerts: [
      'OSHA 30',
      'First Aid/CPR',
      'Confined Space Entry',
      'TWIC Card',
      'LNG Awareness',
    ],
    requiredPPE: [
      'Hard Hat',
      'Safety Glasses',
      'Hi-Vis Vest',
      'Steel-Toe Boots',
      'FR Clothing (minimum 8 cal)',
      'Cryogenic Gloves (when required)',
      'Face Shield',
    ],
    requiredTools: [
      'Torque Wrenches',
      'Dial Indicators',
      'Laser Alignment Kit',
      'Hand Tools',
    ],
    specialInstructions: 'Cryogenic safety protocols in effect. No jewelry or watches in process areas. Emergency evacuation drills every Tuesday.',
  },
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function EmployeeDispatchPacketPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params?.assignmentId as string;

  const assignment = MOCK_ASSIGNMENTS[assignmentId];

  // Assignment not found state
  if (!assignment) {
    return (
      <div className="dispatch-packet-page">
        <div className="not-found-container">
          <div className="not-found-icon">📋</div>
          <h1>Assignment Not Found</h1>
          <p>The assignment <strong>{assignmentId}</strong> could not be located.</p>
          <button className="back-btn" onClick={() => router.push('/my/orders')}>
            ← Back to My Assignments
          </button>
        </div>

        <style jsx>{`
          .dispatch-packet-page {
            min-height: 100vh;
            background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
            color: #fff;
            padding: 40px;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .not-found-container {
            text-align: center;
            max-width: 400px;
          }

          .not-found-icon {
            font-size: 64px;
            margin-bottom: 24px;
            opacity: 0.5;
          }

          .not-found-container h1 {
            font-size: 28px;
            font-weight: 600;
            margin: 0 0 12px 0;
            color: #fff;
          }

          .not-found-container p {
            font-size: 15px;
            color: rgba(255, 255, 255, 0.6);
            margin: 0 0 24px 0;
          }

          .back-btn {
            padding: 12px 24px;
            background: rgba(59, 130, 246, 0.15);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 8px;
            color: #60a5fa;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .back-btn:hover {
            background: rgba(59, 130, 246, 0.25);
            border-color: rgba(59, 130, 246, 0.5);
          }
        `}</style>
      </div>
    );
  }

  const isCurrent = assignment.status === 'current';

  return (
    <div className="dispatch-packet-page">
      {/* Read-Only Notice */}
      <div className="readonly-banner">
        <span className="readonly-icon">👁️</span>
        <div className="readonly-content">
          <span className="readonly-title">Employee Dispatch Packet (Read-Only)</span>
          <span className="readonly-note">This reflects the dispatch packet that was sent to you.</span>
        </div>
      </div>

      {/* Demo Banner */}
      <div className="demo-banner">
        <span className="demo-icon">⚠️</span>
        <span className="demo-text">UI Shell / Mock Data / Demo Only</span>
      </div>

      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <button className="breadcrumb-link" onClick={() => router.push('/my/orders')}>
          My Assignments
        </button>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{assignment.jobName}</span>
      </nav>

      {/* Main Content */}
      <div className="packet-content">
        {/* Header Section */}
        <header className="packet-header">
          <div className="header-main">
            <div className="status-indicator">
              <span className={`status-dot ${isCurrent ? 'active' : 'completed'}`} />
              <span className="status-text">{isCurrent ? 'Active Assignment' : 'Completed Assignment'}</span>
            </div>
            <h1 className="job-title">{assignment.jobName}</h1>
            <p className="customer-name">{assignment.customerName}</p>
          </div>
        </header>

        {/* Employee Info Card */}
        <section className="info-card employee-card">
          <h2 className="card-title">
            <span className="card-icon">👤</span>
            Your Assignment
          </h2>
          <div className="employee-info">
            <div className="employee-name">{MOCK_EMPLOYEE.name}</div>
            <div className="employee-trade">{MOCK_EMPLOYEE.trade}</div>
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="two-columns">
          {/* Job Site Details */}
          <section className="info-card">
            <h2 className="card-title">
              <span className="card-icon">📍</span>
              Job Site
            </h2>
            <div className="info-rows">
              <div className="info-row">
                <span className="info-label">Location</span>
                <span className="info-value">{assignment.site}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Report Time</span>
                <span className="info-value highlight">{assignment.reportTime}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Site Contact</span>
                <span className="info-value">{assignment.siteContact}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Contact Phone</span>
                <span className="info-value mono">{assignment.siteContactPhone}</span>
              </div>
            </div>
          </section>

          {/* Assignment Dates */}
          <section className="info-card">
            <h2 className="card-title">
              <span className="card-icon">📅</span>
              Assignment Dates
            </h2>
            <div className="info-rows">
              <div className="info-row">
                <span className="info-label">Start Date</span>
                <span className="info-value">{formatDate(assignment.startDate)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">End Date</span>
                <span className="info-value">{formatDate(assignment.endDate)}</span>
              </div>
              <div className="info-row duration-row">
                <span className="info-label">Duration</span>
                <span className="info-value">
                  {formatShortDate(assignment.startDate)} — {formatShortDate(assignment.endDate)}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Required Certifications */}
        <section className="requirements-card">
          <h2 className="card-title">
            <span className="card-icon">📜</span>
            Required Certifications
            <span className="required-badge">REQUIRED</span>
          </h2>
          <p className="card-description">
            You must have the following certifications current and verified before reporting to the job site.
          </p>
          <ul className="requirements-list certs-list">
            {assignment.requiredCerts.map((cert, idx) => (
              <li key={idx} className="requirement-item">
                <span className="item-icon">✓</span>
                <span className="item-text">{cert}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Required PPE */}
        <section className="requirements-card">
          <h2 className="card-title">
            <span className="card-icon">🦺</span>
            Required PPE
            <span className="mandatory-badge">MANDATORY</span>
          </h2>
          <p className="card-description">
            All listed personal protective equipment is mandatory for site access. Bring all items on your first day.
          </p>
          <ul className="requirements-list ppe-list">
            {assignment.requiredPPE.map((item, idx) => (
              <li key={idx} className="requirement-item">
                <span className="item-icon">🛡️</span>
                <span className="item-text">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Required Tools */}
        <section className="requirements-card">
          <h2 className="card-title">
            <span className="card-icon">🔧</span>
            Required Tools
          </h2>
          <p className="card-description">
            Bring the following tools for this assignment. Coordinate with site supervisor if you need assistance.
          </p>
          <ul className="requirements-list tools-list">
            {assignment.requiredTools.map((tool, idx) => (
              <li key={idx} className="requirement-item">
                <span className="item-icon">🔧</span>
                <span className="item-text">{tool}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Special Instructions */}
        {assignment.specialInstructions && (
          <section className="instructions-card">
            <h2 className="card-title">
              <span className="card-icon">📢</span>
              Special Instructions
            </h2>
            <div className="instructions-content">
              {assignment.specialInstructions}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="packet-footer">
          <button className="back-link" onClick={() => router.push('/my/orders')}>
            ← Back to My Assignments
          </button>
        </footer>
      </div>

      <style jsx>{`
        .dispatch-packet-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          padding: 24px 40px 60px;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Read-Only Banner */
        .readonly-banner {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .readonly-icon {
          font-size: 24px;
        }

        .readonly-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .readonly-title {
          font-size: 15px;
          font-weight: 600;
          color: #93c5fd;
        }

        .readonly-note {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
        }

        /* Demo Banner */
        .demo-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 20px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .demo-icon {
          font-size: 14px;
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

        /* Packet Content */
        .packet-content {
          max-width: 900px;
        }

        /* Header */
        .packet-header {
          margin-bottom: 28px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.active {
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
        }

        .status-dot.completed {
          background: rgba(255, 255, 255, 0.4);
        }

        .status-text {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.55);
        }

        .job-title {
          margin: 0 0 8px 0;
          font-size: 34px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }

        .customer-name {
          margin: 0;
          font-size: 16px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Cards */
        .info-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .employee-card {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 18px 0;
        }

        .card-icon {
          font-size: 16px;
        }

        .employee-info {
          text-align: center;
          padding: 16px 0;
        }

        .employee-name {
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }

        .employee-trade {
          font-size: 15px;
          color: #4ade80;
          font-weight: 500;
        }

        /* Two Columns */
        .two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .two-columns {
            grid-template-columns: 1fr;
          }
        }

        .info-rows {
          display: flex;
          flex-direction: column;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
        }

        .info-value {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          text-align: right;
          max-width: 65%;
        }

        .info-value.highlight {
          color: #fbbf24;
          font-weight: 600;
        }

        .info-value.mono {
          font-family: 'SF Mono', monospace;
          color: rgba(255, 255, 255, 0.8);
        }

        /* Requirements Cards */
        .requirements-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .required-badge {
          margin-left: auto;
          padding: 3px 10px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #f87171;
          letter-spacing: 0.5px;
        }

        .mandatory-badge {
          margin-left: auto;
          padding: 3px 10px;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #60a5fa;
          letter-spacing: 0.5px;
        }

        .card-description {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          margin: 0 0 18px 0;
          line-height: 1.5;
        }

        .requirements-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 10px;
        }

        .requirement-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .item-icon {
          font-size: 15px;
          flex-shrink: 0;
        }

        .certs-list .item-icon {
          color: #4ade80;
        }

        .item-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        /* Instructions Card */
        .instructions-card {
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .instructions-card .card-title {
          color: #fbbf24;
        }

        .instructions-content {
          font-size: 14px;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.8);
        }

        /* Footer */
        .packet-footer {
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 12px;
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

        /* Print Styles */
        @media print {
          .dispatch-packet-page {
            background: #fff;
            color: #000;
            padding: 20px;
          }

          .demo-banner,
          .packet-footer {
            display: none;
          }

          .readonly-banner {
            background: #f0f7ff;
            border-color: #3b82f6;
          }

          .readonly-title {
            color: #1e40af;
          }

          .job-title {
            -webkit-text-fill-color: #000;
            background: none;
            color: #000;
          }

          .info-card,
          .requirements-card,
          .instructions-card {
            border-color: #e5e7eb;
            background: #f9fafb;
          }
        }
      `}</style>
    </div>
  );
}

