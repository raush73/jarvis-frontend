"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type SeverityLevel = "Low" | "Medium" | "High" | "Fatal";
type RecordStatus = "Open" | "Closed";

type IncidentRecord = {
  id: string;
  date: string;
  time: string;
  incidentType: string;
  severity: SeverityLevel;
  state: string;
  site: string;
  description: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
};

// Deterministic mock data — MW4H-relevant incident records
const INCIDENT_TYPES = ["Injury", "Near Miss", "Property Damage", "Equipment Failure", "Environmental", "First Aid Only", "Restricted Duty", "Lost Time Injury"] as const;
const SEVERITIES: SeverityLevel[] = ["Low", "Medium", "High", "Fatal"];
const STATES = ["KY", "TN", "IN", "OH"] as const;

const MOCK_INCIDENT_RECORDS: IncidentRecord[] = [
  {
    id: "INC-2026-001",
    date: "2026-01-28",
    time: "14:30",
    incidentType: "Near Miss",
    severity: "Low",
    state: "KY",
    site: "Marathon Louisville",
    description: "Unsecured load on forklift nearly struck worker. No contact made. Forklift operator retrained on load securing procedures.",
    status: "Closed",
    createdAt: "2026-01-28",
    updatedAt: "2026-01-30",
  },
  {
    id: "INC-2026-002",
    date: "2026-01-25",
    time: "08:15",
    incidentType: "First Aid Only",
    severity: "Low",
    state: "TN",
    site: "Valero Memphis",
    description: "Minor laceration to left hand from sheet metal edge. Cleaned and bandaged on-site. Employee returned to work immediately.",
    status: "Closed",
    createdAt: "2026-01-25",
    updatedAt: "2026-01-25",
  },
  {
    id: "INC-2026-003",
    date: "2026-01-22",
    time: "11:45",
    incidentType: "Property Damage",
    severity: "Medium",
    state: "IN",
    site: "BP Whiting",
    description: "Boom truck contacted overhead pipe rack during repositioning. Pipe rack sustained minor damage. No injuries. Spotter protocol reviewed.",
    status: "Closed",
    createdAt: "2026-01-22",
    updatedAt: "2026-01-24",
  },
  {
    id: "INC-2026-004",
    date: "2026-01-18",
    time: "16:00",
    incidentType: "Injury",
    severity: "High",
    state: "OH",
    site: "Marathon Canton",
    description: "Worker suffered ankle sprain after stepping in unmarked floor opening. Transported to local clinic. Lost time expected.",
    status: "Open",
    createdAt: "2026-01-18",
    updatedAt: "2026-02-01",
  },
  {
    id: "INC-2026-005",
    date: "2026-01-15",
    time: "09:30",
    incidentType: "Equipment Failure",
    severity: "Medium",
    state: "KY",
    site: "LG&E Mill Creek",
    description: "Scaffold plank cracked during use. Worker felt movement and evacuated safely. All planks on site inspected and replaced as needed.",
    status: "Closed",
    createdAt: "2026-01-15",
    updatedAt: "2026-01-17",
  },
  {
    id: "INC-2026-006",
    date: "2026-01-10",
    time: "13:20",
    incidentType: "Near Miss",
    severity: "Low",
    state: "TN",
    site: "TVA Kingston",
    description: "Dropped wrench from elevated platform. Area below was barricaded. No personnel in drop zone. Tool tethering policy reinforced.",
    status: "Closed",
    createdAt: "2026-01-10",
    updatedAt: "2026-01-11",
  },
  {
    id: "INC-2026-007",
    date: "2026-01-08",
    time: "07:45",
    incidentType: "Restricted Duty",
    severity: "Medium",
    state: "IN",
    site: "NIPSCO Michigan City",
    description: "Worker strained lower back while lifting pipe section. Placed on light duty for two weeks. Lift assist equipment ordered.",
    status: "Closed",
    createdAt: "2026-01-08",
    updatedAt: "2026-01-22",
  },
  {
    id: "INC-2026-008",
    date: "2026-01-05",
    time: "10:00",
    incidentType: "Environmental",
    severity: "High",
    state: "OH",
    site: "Marathon Catlettsburg",
    description: "Minor hydraulic fluid leak from crane detected. Contained with absorbent materials. Equipment removed from service for repair.",
    status: "Closed",
    createdAt: "2026-01-05",
    updatedAt: "2026-01-07",
  },
  {
    id: "INC-2026-009",
    date: "2025-12-28",
    time: "15:15",
    incidentType: "Lost Time Injury",
    severity: "High",
    state: "KY",
    site: "Marathon Louisville",
    description: "Welder sustained second-degree burn to forearm from hot slag. Treated at urgent care. Three days lost time. PPE inspection initiated.",
    status: "Closed",
    createdAt: "2025-12-28",
    updatedAt: "2026-01-03",
  },
  {
    id: "INC-2026-010",
    date: "2025-12-20",
    time: "11:00",
    incidentType: "Property Damage",
    severity: "Medium",
    state: "TN",
    site: "Valero Memphis",
    description: "Company truck mirror struck by passing vehicle in plant parking lot. Driver not at fault. Mirror replaced.",
    status: "Closed",
    createdAt: "2025-12-20",
    updatedAt: "2025-12-21",
  },
];

export default function IncidentRecordsPage() {
  // Filter state
  const [incidentTypeFilter, setIncidentTypeFilter] = useState<string>("All");
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Modal state (view only)
  const [selectedRecord, setSelectedRecord] = useState<IncidentRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Filter logic
  const filteredRecords = MOCK_INCIDENT_RECORDS.filter((record) => {
    if (incidentTypeFilter !== "All" && record.incidentType !== incidentTypeFilter) return false;
    if (severityFilter !== "All" && record.severity !== severityFilter) return false;
    if (statusFilter !== "All" && record.status !== statusFilter) return false;
    return true;
  });

  // Severity badge style
  const getSeverityStyle = (severity: SeverityLevel) => {
    switch (severity) {
      case "Low":
        return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
      case "Medium":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "High":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.25)" };
      case "Fatal":
        return { bg: "rgba(127, 29, 29, 0.25)", color: "#fca5a5", border: "rgba(239, 68, 68, 0.4)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  // Status badge style
  const getStatusStyle = (status: RecordStatus) => {
    if (status === "Open") {
      return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  // State badge style
  const getStateBadgeStyle = (state: string) => {
    switch (state) {
      case "KY":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "TN":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "IN":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" };
      case "OH":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  // Open view modal
  const handleViewRecord = (record: IncidentRecord) => {
    setSelectedRecord(record);
    setIsViewModalOpen(true);
  };

  // Close view modal
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setTimeout(() => setSelectedRecord(null), 200);
  };

  return (
    <div className="records-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Incident Records</h1>
          <p className="subtitle">
            View logged safety incidents across the system for audit and review purposes.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="dateRangeFilter">Date Range</label>
          <select id="dateRangeFilter" defaultValue="last30">
            <option value="last30">Last 30 Days</option>
            <option value="last90">Last 90 Days</option>
            <option value="thisYear">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="incidentTypeFilter">Incident Type</label>
          <select
            id="incidentTypeFilter"
            value={incidentTypeFilter}
            onChange={(e) => setIncidentTypeFilter(e.target.value)}
          >
            <option value="All">All Types</option>
            {INCIDENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="severityFilter">Severity</label>
          <select
            id="severityFilter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="All">All Severities</option>
            {SEVERITIES.map((sev) => (
              <option key={sev} value={sev}>
                {sev}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="statusFilter">Status</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <div className="filter-results">
          {filteredRecords.length} record{filteredRecords.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Incident Records Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="records-table">
            <thead>
              <tr>
                <th>Incident ID</th>
                <th>Date</th>
                <th>Incident Type</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td className="cell-id">
                    <span className="record-id">{record.id}</span>
                  </td>
                  <td className="cell-date">{record.date}</td>
                  <td className="cell-type">{record.incidentType}</td>
                  <td className="cell-severity">
                    <span
                      className="severity-badge"
                      style={{
                        backgroundColor: getSeverityStyle(record.severity).bg,
                        color: getSeverityStyle(record.severity).color,
                        borderColor: getSeverityStyle(record.severity).border,
                      }}
                    >
                      {record.severity}
                    </span>
                  </td>
                  <td className="cell-location">
                    <div className="location-wrap">
                      <span
                        className="state-badge"
                        style={{
                          backgroundColor: getStateBadgeStyle(record.state).bg,
                          color: getStateBadgeStyle(record.state).color,
                          borderColor: getStateBadgeStyle(record.state).border,
                        }}
                      >
                        {record.state}
                      </span>
                      <span className="site-name">{record.site}</span>
                    </div>
                  </td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(record.status).bg,
                        color: getStatusStyle(record.status).color,
                        borderColor: getStatusStyle(record.status).border,
                      }}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleViewRecord(record)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No incident records match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal (READ-ONLY) */}
      {isViewModalOpen && selectedRecord && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Incident Record</h2>
              <button className="modal-close" onClick={handleCloseViewModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="read-only-notice">
                This record is read-only for audit purposes.
              </div>

              <div className="detail-row">
                <div className="detail-field">
                  <label>Incident ID</label>
                  <div className="detail-value mono">{selectedRecord.id}</div>
                </div>
                <div className="detail-field">
                  <label>Status</label>
                  <div className="detail-value">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(selectedRecord.status).bg,
                        color: getStatusStyle(selectedRecord.status).color,
                        borderColor: getStatusStyle(selectedRecord.status).border,
                      }}
                    >
                      {selectedRecord.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-field">
                  <label>Date</label>
                  <div className="detail-value">{selectedRecord.date}</div>
                </div>
                <div className="detail-field">
                  <label>Time</label>
                  <div className="detail-value">{selectedRecord.time}</div>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-field">
                  <label>Incident Type</label>
                  <div className="detail-value">{selectedRecord.incidentType}</div>
                </div>
                <div className="detail-field">
                  <label>Severity</label>
                  <div className="detail-value">
                    <span
                      className="severity-badge"
                      style={{
                        backgroundColor: getSeverityStyle(selectedRecord.severity).bg,
                        color: getSeverityStyle(selectedRecord.severity).color,
                        borderColor: getSeverityStyle(selectedRecord.severity).border,
                      }}
                    >
                      {selectedRecord.severity}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-field full-width">
                <label>Location</label>
                <div className="detail-value">
                  <span
                    className="state-badge"
                    style={{
                      backgroundColor: getStateBadgeStyle(selectedRecord.state).bg,
                      color: getStateBadgeStyle(selectedRecord.state).color,
                      borderColor: getStateBadgeStyle(selectedRecord.state).border,
                    }}
                  >
                    {selectedRecord.state}
                  </span>
                  <span style={{ marginLeft: "8px" }}>{selectedRecord.site}</span>
                </div>
              </div>

              <div className="detail-field full-width">
                <label>Description</label>
                <div className="detail-value description-text">
                  {selectedRecord.description}
                </div>
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">{selectedRecord.createdAt}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Updated</span>
                    <span className="audit-value">{selectedRecord.updatedAt}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-close" onClick={handleCloseViewModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .records-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Header */
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
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
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.55);
          margin: 0;
          max-width: 520px;
          line-height: 1.5;
        }

        /* Filters */
        .filters-section {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 20px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-group label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .filter-group select {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: #fff;
          min-width: 140px;
        }

        .filter-group select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .filter-group select option {
          background: #1a1d24;
          color: #fff;
        }

        .filter-results {
          margin-left: auto;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          padding-bottom: 8px;
        }

        /* Table */
        .table-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .records-table {
          width: 100%;
          border-collapse: collapse;
        }

        .records-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .records-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .records-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .records-table tr:last-child td {
          border-bottom: none;
        }

        .records-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .cell-id {
          min-width: 120px;
        }

        .record-id {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 500;
          color: #fff;
          font-size: 12px;
        }

        .cell-date {
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .cell-type {
          font-weight: 500;
          color: #fff !important;
        }

        .severity-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .cell-location {
          min-width: 180px;
        }

        .location-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .state-badge {
          display: inline-block;
          padding: 4px 8px;
          font-size: 10px;
          font-weight: 700;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .site-name {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
        }

        .cell-actions {
          white-space: nowrap;
        }

        .action-btn {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .empty-row {
          text-align: center;
          color: rgba(255, 255, 255, 0.4) !important;
          padding: 32px 16px !important;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal {
          width: 560px;
          max-width: 90%;
          max-height: 90vh;
          background: #12151b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .modal-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .read-only-notice {
          padding: 10px 14px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          font-size: 12px;
          color: #60a5fa;
          margin-bottom: 20px;
        }

        .detail-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .detail-field {
          margin-bottom: 16px;
        }

        .detail-field.full-width {
          grid-column: 1 / -1;
        }

        .detail-field label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }

        .detail-value {
          font-size: 14px;
          color: #fff;
        }

        .detail-value.mono {
          font-family: var(--font-geist-mono), monospace;
        }

        .description-text {
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.85);
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        }

        .audit-section {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          margin-top: 8px;
        }

        .audit-title {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 14px;
        }

        .audit-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .audit-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .audit-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
        }

        .audit-value {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .btn-close {
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

