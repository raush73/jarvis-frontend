'use client';

import { useParams, useRouter } from 'next/navigation';

/**
 * Customer Dispatch View — UI Shell / Demo Only
 * 
 * A READ-ONLY, CUSTOMER-SAFE view of the dispatch document.
 * This is a filtered projection showing only:
 * - Job site & dates
 * - Overall status (Scheduled / Dispatched)
 * - Assigned workers (LIMITED to names/roles only)
 * - Required certifications (summary level)
 * - PPE expectations
 * - Tools (if applicable)
 * 
 * DOES NOT show (CUSTOMER MAY NOT SEE):
 * - Pay rates
 * - Worker contact info
 * - Internal notes
 * - Recruiting or staffing decisions
 * - Share actions
 * - Employee-only details
 * 
 * Route: /customer/orders/[id]/dispatch
 */

// Mock dispatch data keyed by order ID (inline, no external fetching)
const MOCK_DISPATCHES: Record<string, {
  id: string;
  orderName: string;
  site: string;
  siteAddress: string;
  startDate: string;
  endDate: string;
  status: 'Scheduled' | 'Dispatched' | 'Pending';
  reportTime: string;
  workers: {
    displayName: string; // Customer-safe name (e.g., "John R.")
    role: string;
  }[];
  workerSummary: string; // e.g., "Millwright (2), Welder (1)"
  requiredCertifications: string[];
  requiredPPE: string[];
  requiredTools: string[];
  specialInstructions?: string;
}> = {
  'cust_ord_001': {
    id: 'cust_ord_001',
    orderName: 'Refinery Turnaround Q1',
    site: 'Marathon Petroleum Refinery',
    siteAddress: '2401 5th Ave S, Texas City, TX 77590',
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    status: 'Dispatched',
    reportTime: '6:00 AM',
    workers: [
      { displayName: 'Marcus T.', role: 'Millwright' },
      { displayName: 'James W.', role: 'Millwright' },
      { displayName: 'Robert K.', role: 'Welder' },
    ],
    workerSummary: 'Millwright (2), Welder (1)',
    requiredCertifications: [
      'OSHA 30',
      'First Aid/CPR',
      'Confined Space Entry',
      'TWIC Card',
    ],
    requiredPPE: [
      'Hard Hat',
      'Safety Glasses (ANSI Z87.1)',
      'Hi-Vis Vest (Class 2)',
      'Steel-Toe Boots',
      'FR Clothing',
      'Hearing Protection',
      'Work Gloves',
    ],
    requiredTools: [
      'Torque Wrenches',
      'Dial Indicators',
      'Precision Level',
      'Rigging Equipment',
    ],
    specialInstructions: 'Report to Gate 7 for badge check. Parking in Lot C only.',
  },
  'cust_ord_002': {
    id: 'cust_ord_002',
    orderName: 'Power Plant Maintenance',
    site: 'NRG W.A. Parish Generating Station',
    siteAddress: '2500 S FM 521, Thompsons, TX 77481',
    startDate: '2026-03-05',
    endDate: '2026-03-20',
    status: 'Scheduled',
    reportTime: '5:30 AM',
    workers: [
      { displayName: 'Sarah M.', role: 'Millwright' },
      { displayName: 'David L.', role: 'Pipefitter' },
    ],
    workerSummary: 'Millwright (1), Pipefitter (1)',
    requiredCertifications: [
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
      'FR Clothing',
      'Full Body Harness',
    ],
    requiredTools: [
      'Torque Wrenches',
      'Laser Alignment Kit',
      'Dial Indicators',
    ],
    specialInstructions: 'Enter via main security gate. Daily toolbox talk at 6:00 AM.',
  },
  'cust_ord_003': {
    id: 'cust_ord_003',
    orderName: 'Chemical Plant Expansion',
    site: 'BASF Freeport Site',
    siteAddress: '602 Copper Rd, Freeport, TX 77541',
    startDate: '2026-04-10',
    endDate: '2026-05-15',
    status: 'Scheduled',
    reportTime: '6:00 AM',
    workers: [
      { displayName: 'Michael B.', role: 'Millwright' },
      { displayName: 'Jennifer S.', role: 'Welder' },
      { displayName: 'Kevin D.', role: 'Pipefitter' },
      { displayName: 'Amanda R.', role: 'Millwright' },
    ],
    workerSummary: 'Millwright (2), Welder (1), Pipefitter (1)',
    requiredCertifications: [
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
    ],
    requiredTools: [
      'Torque Wrenches',
      'Dial Indicators',
      'Precision Levels',
    ],
    specialInstructions: 'Chemical plant protocols apply. Report all chemical exposures immediately.',
  },
  'cust_ord_004': {
    id: 'cust_ord_004',
    orderName: 'LNG Terminal Commissioning',
    site: 'Sabine Pass LNG',
    siteAddress: '500 N LNG Pkwy, Sabine Pass, TX 77655',
    startDate: '2026-06-01',
    endDate: '2026-07-30',
    status: 'Pending',
    reportTime: '5:00 AM',
    workers: [],
    workerSummary: 'Workers not yet assigned',
    requiredCertifications: [
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
      'FR Clothing',
      'Cryogenic Gloves (when required)',
    ],
    requiredTools: [
      'Torque Wrenches',
      'Dial Indicators',
      'Laser Alignment Kit',
    ],
    specialInstructions: 'Cryogenic safety protocols in effect. No jewelry or watches in process areas.',
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

function getStatusStyles(status: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case 'Dispatched':
      return {
        bg: 'rgba(34, 197, 94, 0.12)',
        text: '#4ade80',
        dot: '#22c55e',
      };
    case 'Scheduled':
      return {
        bg: 'rgba(59, 130, 246, 0.12)',
        text: '#60a5fa',
        dot: '#3b82f6',
      };
    case 'Pending':
    default:
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        text: '#fbbf24',
        dot: '#f59e0b',
      };
  }
}

export default function CustomerDispatchPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const dispatch = MOCK_DISPATCHES[orderId];

  // Order/Dispatch not found state
  if (!dispatch) {
    return (
      <div className="customer-dispatch-page">
        <div className="not-found-container">
          <div className="not-found-icon">📋</div>
          <h1>Dispatch Not Found</h1>
          <p>The dispatch for order <strong>{orderId}</strong> could not be located.</p>
          <button className="back-btn" onClick={() => router.push('/customer/orders')}>
            ← Back to Your Orders
          </button>
        </div>

        <style jsx>{`
          .customer-dispatch-page {
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

  const statusStyles = getStatusStyles(dispatch.status);

  return (
    <div className="customer-dispatch-page">
      {/* Read-Only Notice */}
      <div className="readonly-banner">
        <span className="readonly-icon">👁️</span>
        <div className="readonly-content">
          <span className="readonly-title">Dispatch Details (Read-Only)</span>
          <span className="readonly-note">This view shows dispatch details for your order.</span>
        </div>
      </div>

      {/* Demo Banner */}
      <div className="demo-banner">
        <span className="demo-icon">⚠️</span>
        <span className="demo-text">UI Shell / Mock Data / Demo Only</span>
      </div>

      {/* Breadcrumb Navigation */}
      <nav className="breadcrumb">
        <button className="breadcrumb-link" onClick={() => router.push('/customer/orders')}>
          Your Orders
        </button>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{dispatch.orderName}</span>
      </nav>

      {/* Main Content */}
      <div className="dispatch-content">
        {/* Header Section */}
        <header className="dispatch-header">
          <div className="status-indicator">
            <span
              className="status-dot"
              style={{ background: statusStyles.dot }}
            />
            <span className="status-text">{dispatch.status}</span>
          </div>
          <h1 className="order-title">{dispatch.orderName}</h1>
          <p className="order-subtitle">Dispatch Details</p>
        </header>

        {/* Job Site Card */}
        <section className="info-card site-card">
          <h2 className="card-title">
            <span className="card-icon">📍</span>
            Job Site
          </h2>
          <div className="info-rows">
            <div className="info-row">
              <span className="info-label">Site</span>
              <span className="info-value">{dispatch.site}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Address</span>
              <span className="info-value">{dispatch.siteAddress}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Report Time</span>
              <span className="info-value highlight">{dispatch.reportTime}</span>
            </div>
          </div>
        </section>

        {/* Dates Card */}
        <section className="info-card">
          <h2 className="card-title">
            <span className="card-icon">📅</span>
            Schedule
          </h2>
          <div className="info-rows">
            <div className="info-row">
              <span className="info-label">Start Date</span>
              <span className="info-value">{formatDate(dispatch.startDate)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">End Date</span>
              <span className="info-value">{formatDate(dispatch.endDate)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Duration</span>
              <span className="info-value">
                {formatShortDate(dispatch.startDate)} — {formatShortDate(dispatch.endDate)}
              </span>
            </div>
          </div>
        </section>

        {/* Assigned Workers Card (Customer-Safe View) */}
        <section className="info-card workers-card">
          <h2 className="card-title">
            <span className="card-icon">👷</span>
            Assigned Workers
            <span className="worker-count">{dispatch.workers.length}</span>
          </h2>
          
          {dispatch.workers.length === 0 ? (
            <div className="no-workers">
              <span className="no-workers-icon">⏳</span>
              <span className="no-workers-text">Workers not yet assigned</span>
            </div>
          ) : (
            <>
              {/* Summary View */}
              <div className="workers-summary">
                <span className="summary-label">Crew Composition:</span>
                <span className="summary-value">{dispatch.workerSummary}</span>
              </div>

              {/* Individual Workers (Limited Info) */}
              <div className="workers-list">
                {dispatch.workers.map((worker, idx) => (
                  <div key={idx} className="worker-item">
                    <span className="worker-name">{worker.displayName}</span>
                    <span className="worker-role">{worker.role}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Required Certifications Card */}
        <section className="requirements-card">
          <h2 className="card-title">
            <span className="card-icon">📜</span>
            Required Certifications
          </h2>
          <p className="card-description">
            All workers assigned to this order hold the following certifications.
          </p>
          <ul className="requirements-list">
            {dispatch.requiredCertifications.map((cert, idx) => (
              <li key={idx} className="requirement-item">
                <span className="item-icon cert-icon">✓</span>
                <span className="item-text">{cert}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Required PPE Card */}
        <section className="requirements-card">
          <h2 className="card-title">
            <span className="card-icon">🦺</span>
            PPE Requirements
          </h2>
          <p className="card-description">
            Personal protective equipment required for site access.
          </p>
          <ul className="requirements-list">
            {dispatch.requiredPPE.map((item, idx) => (
              <li key={idx} className="requirement-item">
                <span className="item-icon ppe-icon">🛡️</span>
                <span className="item-text">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Required Tools Card */}
        {dispatch.requiredTools.length > 0 && (
          <section className="requirements-card">
            <h2 className="card-title">
              <span className="card-icon">🔧</span>
              Tools
            </h2>
            <p className="card-description">
              Tools required for this order.
            </p>
            <ul className="requirements-list">
              {dispatch.requiredTools.map((tool, idx) => (
                <li key={idx} className="requirement-item">
                  <span className="item-icon tool-icon">🔧</span>
                  <span className="item-text">{tool}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Special Instructions Card */}
        {dispatch.specialInstructions && (
          <section className="instructions-card">
            <h2 className="card-title">
              <span className="card-icon">📢</span>
              Site Instructions
            </h2>
            <div className="instructions-content">
              {dispatch.specialInstructions}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="dispatch-footer">
          <button className="back-link" onClick={() => router.push('/customer/orders')}>
            ← Back to Your Orders
          </button>
        </footer>
      </div>

      <style jsx>{`
        .customer-dispatch-page {
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
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
          border: 1px solid rgba(34, 197, 94, 0.25);
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
          color: #86efac;
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

        /* Dispatch Content */
        .dispatch-content {
          max-width: 900px;
          margin: 0 auto;
        }

        /* Header */
        .dispatch-header {
          margin-bottom: 28px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          box-shadow: 0 0 10px currentColor;
        }

        .status-text {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.7);
        }

        .order-title {
          margin: 0 0 8px 0;
          font-size: 34px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }

        .order-subtitle {
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

        .site-card {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(139, 92, 246, 0.06) 100%);
          border: 1px solid rgba(59, 130, 246, 0.15);
        }

        .workers-card {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(59, 130, 246, 0.06) 100%);
          border: 1px solid rgba(34, 197, 94, 0.15);
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

        .worker-count {
          margin-left: auto;
          padding: 3px 12px;
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
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

        /* Workers Section */
        .no-workers {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }

        .no-workers-icon {
          font-size: 20px;
        }

        .no-workers-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }

        .workers-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .summary-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: rgba(255, 255, 255, 0.5);
        }

        .summary-value {
          font-size: 14px;
          font-weight: 500;
          color: #4ade80;
        }

        .workers-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }

        .worker-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .worker-name {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }

        .worker-role {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          padding: 4px 10px;
          background: rgba(99, 102, 241, 0.12);
          border-radius: 4px;
        }

        /* Requirements Cards */
        .requirements-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
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

        .cert-icon {
          color: #4ade80;
        }

        .ppe-icon {
          color: #60a5fa;
        }

        .tool-icon {
          color: #a78bfa;
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
        .dispatch-footer {
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

        /* Responsive */
        @media (max-width: 768px) {
          .customer-dispatch-page {
            padding: 20px;
          }

          .info-row {
            flex-direction: column;
            gap: 6px;
            align-items: flex-start;
          }

          .info-value {
            text-align: left;
            max-width: 100%;
          }

          .requirements-list {
            grid-template-columns: 1fr;
          }

          .workers-list {
            grid-template-columns: 1fr;
          }
        }

        /* Print Styles */
        @media print {
          .customer-dispatch-page {
            background: #fff;
            color: #000;
            padding: 20px;
          }

          .demo-banner,
          .dispatch-footer {
            display: none;
          }

          .readonly-banner {
            background: #e8f5e9;
            border-color: #4caf50;
          }

          .readonly-title {
            color: #2e7d32;
          }

          .order-title {
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

