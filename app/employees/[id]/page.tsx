"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MOCK_EMPLOYEES, Employee } from "@/data/mockEmployeeData";
import { EventSpineTimelineSnapshot } from "@/components/EventSpineTimelineSnapshot";

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  // Find employee in mock data
  const employee: Employee | undefined = MOCK_EMPLOYEES.find(
    (emp) => emp.id === id
  );

  // Not found state
  if (!employee) {
    return (
      <div className="employee-detail-container">
        <div className="not-found-state">
          <div className="not-found-icon">?</div>
          <h2>Employee Not Found</h2>
          <p>No employee found with ID: {id}</p>
          <button
            className="btn-back"
            onClick={() => router.push("/employees")}
          >
            Back to Employees
          </button>
        </div>

        <style jsx>{`
          .employee-detail-container {
            padding: 32px 40px;
            max-width: 1200px;
            margin: 0 auto;
          }

          .not-found-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 80px 40px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 12px;
            text-align: center;
          }

          .not-found-icon {
            width: 64px;
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: 700;
            color: rgba(255, 255, 255, 0.3);
            background: rgba(255, 255, 255, 0.04);
            border-radius: 50%;
            margin-bottom: 20px;
          }

          .not-found-state h2 {
            font-size: 20px;
            font-weight: 600;
            color: #fff;
            margin: 0 0 8px;
          }

          .not-found-state p {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
            margin: 0 0 24px;
          }

          .btn-back {
            padding: 10px 24px;
            background: #3b82f6;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .btn-back:hover {
            background: #2563eb;
          }
        `}</style>
      </div>
    );
  }

  // Status badge color helper
  const getStatusColor = (status: Employee["status"]) => {
    switch (status) {
      case "Active":
        return "#22c55e";
      case "Inactive":
        return "#6b7280";
      case "Do Not Dispatch":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  // Availability badge color helper
  const getAvailabilityColor = (availability: Employee["availability"]) => {
    switch (availability) {
      case "Available":
        return "#22c55e";
      case "On Assignment":
        return "#3b82f6";
      case "Unavailable":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  return (
    <div className="employee-detail-container">
      {/* HEADER */}
      <div className="page-header">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link href="/employees" className="breadcrumb-link">
            Employees
          </Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">
            {employee.lastName}, {employee.firstName}
          </span>
        </nav>

        {/* Title Row */}
        <div className="header-title-row">
          <div className="header-title-content">
            <h1>
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="header-subtitle">Employee ID: {employee.id}</p>
          </div>
          <div className="header-actions">
            <button className="btn-action" disabled>
              Edit
            </button>
            <button className="btn-action" disabled>
              Message
            </button>
            <button
              className="btn-back-link"
              onClick={() => router.push("/employees")}
            >
              Back to Employees
            </button>
          </div>
        </div>

        {/* Mock Data Banner */}
        <div className="mock-banner">
          UI Shell (Mock Data) — No backend connected.
        </div>

        {/* Tab Navigation */}
        <div className="tab-nav">
          <button className="tab-item tab-active">Overview</button>
          <Link href="/my/timeline" className="tab-item">
            Timeline
          </Link>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Status</span>
          <span
            className="summary-value status-badge"
            style={{
              backgroundColor: `${getStatusColor(employee.status)}15`,
              color: getStatusColor(employee.status),
              borderColor: `${getStatusColor(employee.status)}40`,
            }}
          >
            {employee.status || "Unknown"}
          </span>
        </div>

        <div className="summary-card">
          <span className="summary-label">Trade</span>
          <span className="summary-value">{employee.trade || "—"}</span>
        </div>

        <div className="summary-card">
          <span className="summary-label">Availability</span>
          <span
            className="summary-value availability-text"
            style={{ color: getAvailabilityColor(employee.availability) }}
          >
            {employee.availability || "Unknown"}
          </span>
        </div>
      </div>

      {/* BODY - 2 Columns */}
      <div className="body-grid">
        {/* LEFT - Profile */}
        <div className="body-card">
          <h3 className="card-title">Profile</h3>
          <div className="profile-fields">
            <div className="profile-field">
              <span className="field-label">Phone</span>
              <span className="field-value">{employee.phone || "—"}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Email</span>
              <span className="field-value field-email">
                {employee.email || "—"}
              </span>
            </div>
            <div className="profile-field">
              <span className="field-label">Location</span>
              <span className="field-value">
                {employee.city && employee.state
                  ? `${employee.city}, ${employee.state}`
                  : "—"}
              </span>
            </div>
            <div className="profile-field">
              <span className="field-label">Hire Date</span>
              <span className="field-value">{employee.hireDate || "—"}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">Last Dispatch</span>
              <span className="field-value">
                {employee.lastDispatchDate || "—"}
              </span>
            </div>
            <div className="profile-field">
              <span className="field-label">Notes</span>
              <span className="field-value field-placeholder">—</span>
            </div>
          </div>
        </div>

        {/* RIGHT - Compliance */}
        <div className="body-card">
          <h3 className="card-title">Compliance</h3>
          <div className="compliance-sections">
            {/* Certifications */}
            <div className="compliance-section">
              <span className="compliance-label">Certifications</span>
              {employee.certifications && employee.certifications.length > 0 ? (
                <div className="tag-list">
                  {employee.certifications.map((cert, idx) => (
                    <span key={idx} className="tag">
                      {cert}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="empty-text">No certifications listed</span>
              )}
            </div>

            {/* Tools - NOT in mock data */}
            <div className="compliance-section">
              <span className="compliance-label">Tools</span>
              <span className="empty-text">No tools listed</span>
            </div>

            {/* PPE - NOT in mock data */}
            <div className="compliance-section">
              <span className="compliance-label">PPE</span>
              <span className="empty-text">No PPE listed</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM - Work History */}
      <div className="work-history-section">
        <h3 className="card-title">Work History</h3>
        <div className="work-history-empty">
          <span className="empty-icon">—</span>
          <span className="empty-text">No assignments yet</span>
        </div>
      </div>

      {/* EVENT SPINE TIMELINE (UI-Only) */}
      <div className="timeline-section">
        <EventSpineTimelineSnapshot
          mode="full"
          contextLabel="Timeline (Event Spine — UI Only)"
          workerName={`${employee.firstName} ${employee.lastName}`}
          orderRef="ORD-2026-0042"
        />
      </div>

      <style jsx>{`
        .employee-detail-container {
          padding: 32px 40px;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* HEADER */
        .page-header {
          margin-bottom: 28px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        .breadcrumb-link {
          color: #3b82f6;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .breadcrumb-link:hover {
          color: #60a5fa;
        }

        .breadcrumb-sep {
          color: rgba(255, 255, 255, 0.3);
        }

        .breadcrumb-current {
          color: rgba(255, 255, 255, 0.6);
        }

        .header-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 16px;
        }

        .header-title-content h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }

        .header-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
          font-family: var(--font-geist-mono), monospace;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .btn-action {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-back-link {
          padding: 8px 16px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-back-link:hover {
          background: #2563eb;
        }

        .mock-banner {
          padding: 10px 16px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #f59e0b;
          text-align: center;
        }

        /* TAB NAVIGATION */
        .tab-nav {
          display: flex;
          gap: 4px;
          margin-top: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 0;
        }

        .tab-item {
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
          margin-bottom: -1px;
        }

        .tab-item:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .tab-active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }

        /* SUMMARY CARDS */
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .summary-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .status-badge {
          display: inline-block;
          padding: 6px 12px;
          border: 1px solid;
          border-radius: 5px;
          font-size: 13px;
          width: fit-content;
        }

        .availability-text {
          font-weight: 600;
        }

        /* BODY GRID */
        .body-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        .body-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 24px;
        }

        .card-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        /* PROFILE FIELDS */
        .profile-fields {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .profile-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .field-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .field-value {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .field-email {
          color: #3b82f6;
        }

        .field-placeholder {
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
        }

        /* COMPLIANCE SECTIONS */
        .compliance-sections {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .compliance-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .compliance-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          padding: 5px 10px;
          background: rgba(59, 130, 246, 0.12);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #60a5fa;
        }

        .empty-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
        }

        /* WORK HISTORY */
        .work-history-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 24px;
        }

        .work-history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 10px;
        }

        .empty-icon {
          font-size: 24px;
          color: rgba(255, 255, 255, 0.2);
        }

        /* TIMELINE SECTION */
        .timeline-section {
          margin-top: 24px;
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .employee-detail-container {
            padding: 20px;
          }

          .header-title-row {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .summary-cards {
            grid-template-columns: 1fr;
          }

          .body-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
