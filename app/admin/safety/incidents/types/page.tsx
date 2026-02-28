"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type SeverityLevel = "Low" | "Medium" | "High" | "Fatal";
type IncidentTypeStatus = "Active" | "Inactive";

type IncidentType = {
  id: string;
  name: string;
  description: string;
  severity: SeverityLevel;
  recordable: boolean;
  oshaReportable: boolean;
  status: IncidentTypeStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

// Deterministic mock data — MW4H-relevant incident types
const SEVERITIES: SeverityLevel[] = ["Low", "Medium", "High", "Fatal"];

const MOCK_INCIDENT_TYPES: IncidentType[] = [
  {
    id: "IT-001",
    name: "Injury",
    description: "Physical harm or bodily injury to a worker requiring medical attention beyond first aid.",
    severity: "High",
    recordable: true,
    oshaReportable: true,
    status: "Active",
    notes: "Includes lacerations, fractures, burns, and other injuries requiring treatment.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-002",
    name: "Near Miss",
    description: "An unplanned event that did not result in injury but had the potential to do so.",
    severity: "Low",
    recordable: false,
    oshaReportable: false,
    status: "Active",
    notes: "Critical for proactive safety tracking. Encourages reporting culture.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-003",
    name: "Property Damage",
    description: "Damage to equipment, tools, vehicles, or structures without personal injury.",
    severity: "Medium",
    recordable: false,
    oshaReportable: false,
    status: "Active",
    notes: "Includes vehicle incidents, tool damage, and structural impacts.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-004",
    name: "Equipment Failure",
    description: "Malfunction or breakdown of equipment that creates a safety hazard.",
    severity: "Medium",
    recordable: false,
    oshaReportable: false,
    status: "Active",
    notes: "Includes crane failures, scaffold collapses, and PPE defects.",
    createdAt: "2025-08-15",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-005",
    name: "Environmental",
    description: "Release of hazardous materials or environmental contamination events.",
    severity: "High",
    recordable: true,
    oshaReportable: true,
    status: "Active",
    notes: "Includes spills, releases, and exposure events. May trigger EPA reporting.",
    createdAt: "2025-08-15",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-006",
    name: "Fatality",
    description: "A work-related death of an employee or contractor.",
    severity: "Fatal",
    recordable: true,
    oshaReportable: true,
    status: "Active",
    notes: "OSHA requires notification within 8 hours. Triggers full investigation.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-007",
    name: "First Aid Only",
    description: "Minor injury requiring only basic first aid treatment on-site.",
    severity: "Low",
    recordable: false,
    oshaReportable: false,
    status: "Active",
    notes: "Includes minor cuts, scrapes, and bruises treatable with basic supplies.",
    createdAt: "2025-10-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-008",
    name: "Restricted Duty",
    description: "Injury resulting in work restrictions but not complete absence.",
    severity: "Medium",
    recordable: true,
    oshaReportable: false,
    status: "Active",
    notes: "Employee remains at work but with modified duties or limitations.",
    createdAt: "2025-10-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-009",
    name: "Lost Time Injury",
    description: "Injury causing employee to miss scheduled work beyond the day of injury.",
    severity: "High",
    recordable: true,
    oshaReportable: true,
    status: "Active",
    notes: "Key metric for safety performance. Tracked for TRIR calculations.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "IT-010",
    name: "Vehicle Incident",
    description: "Any incident involving company or personal vehicles used for work.",
    severity: "Medium",
    recordable: false,
    oshaReportable: false,
    status: "Inactive",
    notes: "Legacy type. Now tracked under Property Damage or Injury as appropriate.",
    createdAt: "2025-06-01",
    updatedAt: "2026-01-10",
  },
];

export default function IncidentTypesPage() {
  // Filter state
  const [severityFilter, setSeverityFilter] = useState<string>("All");
  const [recordableFilter, setRecordableFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Modal state
  const [selectedType, setSelectedType] = useState<IncidentType | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter logic
  const filteredTypes = MOCK_INCIDENT_TYPES.filter((type) => {
    if (severityFilter !== "All" && type.severity !== severityFilter) return false;
    if (recordableFilter !== "All") {
      const isRecordable = recordableFilter === "Yes";
      if (type.recordable !== isRecordable) return false;
    }
    if (statusFilter !== "All" && type.status !== statusFilter) return false;
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
  const getStatusStyle = (status: IncidentTypeStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  // Open view/edit modal
  const handleViewType = (type: IncidentType) => {
    setSelectedType(type);
    setIsViewModalOpen(true);
  };

  // Close view modal
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setTimeout(() => setSelectedType(null), 200);
  };

  return (
    <div className="types-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Incident Types</h1>
          <p className="subtitle">
            Define the categories of safety incidents used across Jarvis Prime for reporting and compliance.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={() => setIsAddModalOpen(true)}>
            + Add Incident Type
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
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
          <label htmlFor="recordableFilter">Recordable?</label>
          <select
            id="recordableFilter"
            value={recordableFilter}
            onChange={(e) => setRecordableFilter(e.target.value)}
          >
            <option value="All">All</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
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
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="filter-results">
          {filteredTypes.length} incident type{filteredTypes.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Incident Types Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="types-table">
            <thead>
              <tr>
                <th>Incident Type Name</th>
                <th>Severity Level</th>
                <th>Recordable?</th>
                <th>OSHA Reportable?</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map((type) => (
                <tr key={type.id}>
                  <td className="cell-name">
                    <span className="type-name">{type.name}</span>
                  </td>
                  <td className="cell-severity">
                    <span
                      className="severity-badge"
                      style={{
                        backgroundColor: getSeverityStyle(type.severity).bg,
                        color: getSeverityStyle(type.severity).color,
                        borderColor: getSeverityStyle(type.severity).border,
                      }}
                    >
                      {type.severity}
                    </span>
                  </td>
                  <td className="cell-recordable">
                    {type.recordable ? (
                      <span className="yes-text">Yes</span>
                    ) : (
                      <span className="no-text">No</span>
                    )}
                  </td>
                  <td className="cell-osha">
                    {type.oshaReportable ? (
                      <span className="yes-text">Yes</span>
                    ) : (
                      <span className="no-text">No</span>
                    )}
                  </td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(type.status).bg,
                        color: getStatusStyle(type.status).color,
                        borderColor: getStatusStyle(type.status).border,
                      }}
                    >
                      {type.status}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleViewType(type)}
                    >
                      View
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleViewType(type)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredTypes.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No incident types match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View/Edit Modal */}
      {isViewModalOpen && selectedType && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Incident Type Details</h2>
              <button className="modal-close" onClick={handleCloseViewModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label>Incident Type Name</label>
                <input type="text" defaultValue={selectedType.name} />
              </div>

              <div className="form-field">
                <label>Description</label>
                <textarea
                  rows={3}
                  defaultValue={selectedType.description}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Severity Level</label>
                  <select defaultValue={selectedType.severity}>
                    {SEVERITIES.map((sev) => (
                      <option key={sev} value={sev}>
                        {sev}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Status</label>
                  <div className="toggle-group">
                    <button
                      className={`toggle-btn ${selectedType.status === "Active" ? "active" : ""}`}
                      type="button"
                    >
                      Active
                    </button>
                    <button
                      className={`toggle-btn ${selectedType.status === "Inactive" ? "active" : ""}`}
                      type="button"
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Recordable?</label>
                  <div className="toggle-group">
                    <button
                      className={`toggle-btn ${selectedType.recordable ? "active" : ""}`}
                      type="button"
                    >
                      Yes
                    </button>
                    <button
                      className={`toggle-btn ${!selectedType.recordable ? "active" : ""}`}
                      type="button"
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label>OSHA Reportable?</label>
                  <div className="toggle-group">
                    <button
                      className={`toggle-btn ${selectedType.oshaReportable ? "active" : ""}`}
                      type="button"
                    >
                      Yes
                    </button>
                    <button
                      className={`toggle-btn ${!selectedType.oshaReportable ? "active" : ""}`}
                      type="button"
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-field">
                <label>Notes (optional)</label>
                <textarea
                  placeholder="Optional notes..."
                  rows={2}
                  defaultValue={selectedType.notes}
                />
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">{selectedType.createdAt}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Updated</span>
                    <span className="audit-value">{selectedType.updatedAt}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCloseViewModal}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleCloseViewModal}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Incident Type Modal (UI shell only) */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Incident Type</h2>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label>Incident Type Name</label>
                <input type="text" placeholder="e.g., Slip and Fall" />
              </div>

              <div className="form-field">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe this incident type..."
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Severity Level</label>
                  <select defaultValue="">
                    <option value="" disabled>
                      Select Severity
                    </option>
                    {SEVERITIES.map((sev) => (
                      <option key={sev} value={sev}>
                        {sev}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Status</label>
                  <div className="toggle-group">
                    <button className="toggle-btn active" type="button">
                      Active
                    </button>
                    <button className="toggle-btn" type="button">
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Recordable?</label>
                  <div className="toggle-group">
                    <button className="toggle-btn" type="button">
                      Yes
                    </button>
                    <button className="toggle-btn active" type="button">
                      No
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label>OSHA Reportable?</label>
                  <div className="toggle-group">
                    <button className="toggle-btn" type="button">
                      Yes
                    </button>
                    <button className="toggle-btn active" type="button">
                      No
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-field">
                <label>Notes (optional)</label>
                <textarea placeholder="Optional notes..." rows={2} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={() => setIsAddModalOpen(false)}>
                Add Incident Type
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .types-container {
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

        .header-actions {
          padding-top: 28px;
        }

        .btn-add {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-add:hover {
          background: #2563eb;
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

        .types-table {
          width: 100%;
          border-collapse: collapse;
        }

        .types-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .types-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .types-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .types-table tr:last-child td {
          border-bottom: none;
        }

        .types-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .cell-name {
          min-width: 160px;
        }

        .type-name {
          font-weight: 500;
          color: #fff;
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

        .yes-text {
          color: #22c55e;
          font-weight: 500;
        }

        .no-text {
          color: rgba(255, 255, 255, 0.5);
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
          margin-right: 8px;
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

        .action-btn:last-child {
          margin-right: 0;
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

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-field {
          margin-bottom: 20px;
        }

        .form-field label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          color: #fff;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-field input::placeholder,
        .form-field textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-field select option {
          background: #1a1d24;
          color: #fff;
        }

        .form-field textarea {
          resize: vertical;
          min-height: 60px;
        }

        .toggle-group {
          display: flex;
          gap: 0;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          overflow: hidden;
        }

        .toggle-btn {
          flex: 1;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toggle-btn:first-child {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-btn:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .toggle-btn.active {
          color: #fff;
          background: rgba(34, 197, 94, 0.15);
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

        .btn-cancel {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-cancel:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .btn-save {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-save:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
}

