'use client';

import { useRouter } from 'next/navigation';

/**
 * Employee Assignments List — UI Shell / Demo Only
 * 
 * Displays a READ-ONLY view of the employee's current and past assignments.
 * This is a MOCK/DEMO page with no backend integration.
 * 
 * Route: /my/orders
 */

// Mock assignment data (inline, no external fetching)
const MOCK_ASSIGNMENTS = [
  {
    id: 'assign_001',
    orderId: 'ord_001',
    jobName: 'Refinery Turnaround Q1',
    site: 'Marathon Petroleum — Galveston Bay, TX',
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    status: 'current' as const,
  },
  {
    id: 'assign_002',
    orderId: 'ord_002',
    jobName: 'Power Plant Maintenance',
    site: 'NRG Energy — Houston, TX',
    startDate: '2026-03-05',
    endDate: '2026-03-20',
    status: 'current' as const,
  },
  {
    id: 'assign_003',
    orderId: 'ord_003',
    jobName: 'Chemical Plant Expansion',
    site: 'BASF Corporation — Freeport, TX',
    startDate: '2025-11-10',
    endDate: '2025-12-15',
    status: 'completed' as const,
  },
  {
    id: 'assign_004',
    orderId: 'ord_004',
    jobName: 'Offshore Platform Retrofit',
    site: 'Chevron — Gulf of Mexico',
    startDate: '2025-09-01',
    endDate: '2025-10-30',
    status: 'completed' as const,
  },
  {
    id: 'assign_005',
    orderId: 'ord_005',
    jobName: 'LNG Terminal Commissioning',
    site: 'Cheniere Energy — Sabine Pass, LA',
    startDate: '2025-06-15',
    endDate: '2025-08-20',
    status: 'completed' as const,
  },
];

type Assignment = typeof MOCK_ASSIGNMENTS[0];

function formatDate(dateStr: string): string {
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

function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} — ${formatDate(end)}`;
}

function StatusBadge({ status }: { status: 'current' | 'completed' }) {
  const isCurrent = status === 'current';
  return (
    <span className={`status-badge ${isCurrent ? 'status-current' : 'status-completed'}`}>
      <span className="status-dot" />
      {isCurrent ? 'Current' : 'Completed'}

      <style jsx>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .status-current {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .status-completed {
          background: rgba(148, 163, 184, 0.1);
          color: rgba(255, 255, 255, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-current .status-dot {
          background: #4ade80;
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
        }

        .status-completed .status-dot {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </span>
  );
}

function AssignmentCard({ assignment, onClick }: { assignment: Assignment; onClick: () => void }) {
  const isCurrent = assignment.status === 'current';

  return (
    <div 
      className={`assignment-card ${isCurrent ? 'card-current' : 'card-completed'}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="card-main">
        <div className="card-header">
          <h3 className="job-name">{assignment.jobName}</h3>
          <StatusBadge status={assignment.status} />
        </div>
        
        <div className="card-details">
          <div className="detail-row">
            <span className="detail-icon">📍</span>
            <span className="detail-value">{assignment.site}</span>
          </div>
          <div className="detail-row">
            <span className="detail-icon">📅</span>
            <span className="detail-value">{formatDateRange(assignment.startDate, assignment.endDate)}</span>
          </div>
        </div>
      </div>

      <div className="card-action">
        <span className="view-dispatch">View Dispatch Packet</span>
        <span className="arrow">→</span>
      </div>

      <style jsx>{`
        .assignment-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .card-current {
          border-left: 3px solid #22c55e;
        }

        .card-completed {
          border-left: 3px solid rgba(255, 255, 255, 0.15);
        }

        .assignment-card:hover {
          background: rgba(59, 130, 246, 0.06);
          border-color: rgba(59, 130, 246, 0.2);
          transform: translateX(4px);
        }

        .assignment-card:focus-visible {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }

        .card-main {
          flex: 1;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .job-name {
          margin: 0;
          font-size: 17px;
          font-weight: 600;
          color: #fff;
          letter-spacing: -0.2px;
        }

        .card-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .detail-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .detail-icon {
          font-size: 14px;
          opacity: 0.8;
        }

        .detail-value {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .card-action {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .assignment-card:hover .card-action {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(59, 130, 246, 0.35);
        }

        .view-dispatch {
          font-size: 13px;
          font-weight: 500;
          color: #60a5fa;
        }

        .arrow {
          font-size: 14px;
          color: #60a5fa;
          transition: transform 0.2s ease;
        }

        .assignment-card:hover .arrow {
          transform: translateX(3px);
        }
      `}</style>
    </div>
  );
}

export default function MyOrdersPage() {
  const router = useRouter();

  const currentAssignments = MOCK_ASSIGNMENTS.filter(a => a.status === 'current');
  const pastAssignments = MOCK_ASSIGNMENTS.filter(a => a.status === 'completed');

  const handleViewDispatch = (assignmentId: string) => {
    router.push(`/my/orders/${assignmentId}/dispatch`);
  };

  return (
    <div className="my-orders-page">
      {/* Demo Banner */}
      <div className="demo-banner">
        <span className="demo-icon">⚠️</span>
        <span className="demo-text">UI Shell / Mock Data / Demo Only</span>
      </div>

      {/* Page Header */}
      <header className="page-header">
        <div className="header-icon">📋</div>
        <div className="header-content">
          <h1 className="page-title">My Assignments</h1>
          <p className="page-subtitle">View your current and past job assignments</p>
        </div>
      </header>

      {/* Current Assignments Section */}
      <section className="assignments-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">🟢</span>
            Current Assignments
          </h2>
          <span className="section-count">{currentAssignments.length}</span>
        </div>

        {currentAssignments.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p>No current assignments</p>
          </div>
        ) : (
          <div className="assignments-list">
            {currentAssignments.map(assignment => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onClick={() => handleViewDispatch(assignment.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Past Assignments Section */}
      <section className="assignments-section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="section-icon">📁</span>
            Past Assignments
          </h2>
          <span className="section-count">{pastAssignments.length}</span>
        </div>

        {pastAssignments.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p>No past assignments</p>
          </div>
        ) : (
          <div className="assignments-list">
            {pastAssignments.map(assignment => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                onClick={() => handleViewDispatch(assignment.id)}
              />
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .my-orders-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          padding: 24px 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Demo Banner */
        .demo-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 20px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 8px;
          margin-bottom: 32px;
        }

        .demo-icon {
          font-size: 16px;
        }

        .demo-text {
          font-size: 13px;
          font-weight: 600;
          color: #fbbf24;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Page Header */
        .page-header {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 40px;
        }

        .header-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
        }

        .header-content {
          flex: 1;
        }

        .page-title {
          margin: 0 0 6px 0;
          font-size: 32px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }

        .page-subtitle {
          margin: 0;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.55);
        }

        /* Sections */
        .assignments-section {
          margin-bottom: 40px;
          max-width: 900px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .section-icon {
          font-size: 16px;
        }

        .section-count {
          margin-left: auto;
          padding: 4px 12px;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          color: #60a5fa;
        }

        .assignments-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Empty State */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          text-align: center;
        }

        .empty-icon {
          font-size: 36px;
          margin-bottom: 12px;
          opacity: 0.5;
        }

        .empty-state p {
          margin: 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}

