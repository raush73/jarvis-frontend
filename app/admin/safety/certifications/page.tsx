"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type CertStatus = "Active" | "Inactive";
type CertCategory = "Safety" | "Trade" | "Site" | "Other";

type Certification = {
  id: string;
  name: string;
  shortCode: string;
  category: CertCategory;
  expires: boolean;
  validityPeriod: string;
  gracePeriodDays: number | null;
  requiresDocument: boolean;
  status: CertStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

// Deterministic mock data — MW4H-relevant certifications
const CATEGORIES: CertCategory[] = ["Safety", "Trade", "Site", "Other"];

const MOCK_CERTIFICATIONS: Certification[] = [
  {
    id: "CERT-001",
    name: "OSHA 10-Hour",
    shortCode: "OSHA10",
    category: "Safety",
    expires: false,
    validityPeriod: "Never",
    gracePeriodDays: null,
    requiresDocument: true,
    status: "Active",
    notes: "Basic OSHA safety certification required for most job sites.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-002",
    name: "OSHA 30-Hour",
    shortCode: "OSHA30",
    category: "Safety",
    expires: false,
    validityPeriod: "Never",
    gracePeriodDays: null,
    requiresDocument: true,
    status: "Active",
    notes: "Advanced OSHA certification. Required for supervisory roles on some sites.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-003",
    name: "MSHA Part 48B",
    shortCode: "MSHA48B",
    category: "Safety",
    expires: true,
    validityPeriod: "1 year",
    gracePeriodDays: 30,
    requiresDocument: true,
    status: "Active",
    notes: "Mine Safety and Health Administration certification. Annual refresher required.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-004",
    name: "Confined Space Entry",
    shortCode: "CSE",
    category: "Safety",
    expires: true,
    validityPeriod: "1 year",
    gracePeriodDays: 14,
    requiresDocument: true,
    status: "Active",
    notes: "Required for tank entry, vessel work, and confined space environments.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-005",
    name: "TWIC Card",
    shortCode: "TWIC",
    category: "Site",
    expires: true,
    validityPeriod: "5 years",
    gracePeriodDays: 60,
    requiresDocument: true,
    status: "Active",
    notes: "Transportation Worker Identification Credential. Required for port/maritime facilities.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-006",
    name: "NCCER Certified",
    shortCode: "NCCER",
    category: "Trade",
    expires: false,
    validityPeriod: "Never",
    gracePeriodDays: null,
    requiresDocument: true,
    status: "Active",
    notes: "National Center for Construction Education and Research certification.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-007",
    name: "Forklift Operator",
    shortCode: "FORKLIFT",
    category: "Trade",
    expires: true,
    validityPeriod: "3 years",
    gracePeriodDays: 30,
    requiresDocument: true,
    status: "Active",
    notes: "Powered industrial truck operator certification per OSHA 1910.178.",
    createdAt: "2025-06-01",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-008",
    name: "Rigging & Signaling",
    shortCode: "RIGSIG",
    category: "Trade",
    expires: true,
    validityPeriod: "5 years",
    gracePeriodDays: 30,
    requiresDocument: true,
    status: "Active",
    notes: "Crane rigging and signal person qualification.",
    createdAt: "2025-08-15",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-009",
    name: "Fall Protection",
    shortCode: "FALLPRO",
    category: "Safety",
    expires: true,
    validityPeriod: "1 year",
    gracePeriodDays: 14,
    requiresDocument: true,
    status: "Active",
    notes: "Fall protection and rescue training certification.",
    createdAt: "2025-08-15",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-010",
    name: "First Aid / CPR",
    shortCode: "FIRSTAID",
    category: "Safety",
    expires: true,
    validityPeriod: "2 years",
    gracePeriodDays: 30,
    requiresDocument: true,
    status: "Active",
    notes: "American Red Cross or equivalent first aid and CPR certification.",
    createdAt: "2025-08-15",
    updatedAt: "2025-12-15",
  },
  {
    id: "CERT-011",
    name: "Scaffold Builder",
    shortCode: "SCAFFOLD",
    category: "Trade",
    expires: true,
    validityPeriod: "3 years",
    gracePeriodDays: 30,
    requiresDocument: true,
    status: "Inactive",
    notes: "Legacy certification. Being phased out in favor of new scaffold competency program.",
    createdAt: "2025-06-01",
    updatedAt: "2026-01-10",
  },
  {
    id: "CERT-012",
    name: "Client Site Badge - Marathon",
    shortCode: "MARATHON",
    category: "Site",
    expires: true,
    validityPeriod: "1 year",
    gracePeriodDays: 7,
    requiresDocument: false,
    status: "Active",
    notes: "Site-specific badge for Marathon Petroleum facilities.",
    createdAt: "2025-10-01",
    updatedAt: "2025-12-15",
  },
];

export default function CertificationsPage() {
  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal state
  const [selectedCert, setSelectedCert] = useState<Certification | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter logic
  const filteredCerts = MOCK_CERTIFICATIONS.filter((cert) => {
    if (categoryFilter !== "All" && cert.category !== categoryFilter) return false;
    if (statusFilter !== "All" && cert.status !== statusFilter) return false;
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      if (
        !cert.name.toLowerCase().includes(query) &&
        !cert.shortCode.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  // Category badge style
  const getCategoryStyle = (category: CertCategory) => {
    switch (category) {
      case "Safety":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.25)" };
      case "Trade":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "Site":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "Other":
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  // Status badge style
  const getStatusStyle = (status: CertStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  // Open view/edit modal
  const handleViewCert = (cert: Certification) => {
    setSelectedCert(cert);
    setIsViewModalOpen(true);
  };

  // Close view modal
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setTimeout(() => setSelectedCert(null), 200);
  };

  return (
    <div className="cert-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Certifications</h1>
          <p className="subtitle">
            Define and manage the certifications used across Jarvis Prime for safety, trade, and site compliance.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={() => setIsAddModalOpen(true)}>
            + Add Certification
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="categoryFilter">Category</label>
          <select
            id="categoryFilter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
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
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="filter-group search-group">
          <label htmlFor="searchInput">Search</label>
          <input
            id="searchInput"
            type="text"
            placeholder="Search by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-results">
          {filteredCerts.length} certification{filteredCerts.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Certifications Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="certs-table">
            <thead>
              <tr>
                <th>Certification Name</th>
                <th>Category</th>
                <th>Expires?</th>
                <th>Validity Period</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCerts.map((cert) => (
                <tr key={cert.id}>
                  <td className="cell-name">
                    <div className="name-wrap">
                      <span className="cert-name">{cert.name}</span>
                      <span className="cert-code">{cert.shortCode}</span>
                    </div>
                  </td>
                  <td className="cell-category">
                    <span
                      className="category-badge"
                      style={{
                        backgroundColor: getCategoryStyle(cert.category).bg,
                        color: getCategoryStyle(cert.category).color,
                        borderColor: getCategoryStyle(cert.category).border,
                      }}
                    >
                      {cert.category}
                    </span>
                  </td>
                  <td className="cell-expires">
                    {cert.expires ? (
                      <span className="expires-yes">Yes</span>
                    ) : (
                      <span className="expires-no">No</span>
                    )}
                  </td>
                  <td className="cell-validity">{cert.validityPeriod}</td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(cert.status).bg,
                        color: getStatusStyle(cert.status).color,
                        borderColor: getStatusStyle(cert.status).border,
                      }}
                    >
                      {cert.status}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleViewCert(cert)}
                    >
                      View
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleViewCert(cert)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCerts.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No certifications match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View/Edit Modal */}
      {isViewModalOpen && selectedCert && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Certification Details</h2>
              <button className="modal-close" onClick={handleCloseViewModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Certification Name</label>
                  <input type="text" defaultValue={selectedCert.name} />
                </div>

                <div className="form-field">
                  <label>Short Code / Slug</label>
                  <input type="text" defaultValue={selectedCert.shortCode} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Category</label>
                  <select defaultValue={selectedCert.category}>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Status</label>
                  <div className="toggle-group">
                    <button
                      className={`toggle-btn ${selectedCert.status === "Active" ? "active" : ""}`}
                      type="button"
                    >
                      Active
                    </button>
                    <button
                      className={`toggle-btn ${selectedCert.status === "Inactive" ? "active" : ""}`}
                      type="button"
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-field">
                <label>Expires?</label>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${selectedCert.expires ? "active" : ""}`}
                    type="button"
                  >
                    Yes
                  </button>
                  <button
                    className={`toggle-btn ${!selectedCert.expires ? "active" : ""}`}
                    type="button"
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Validity Period</label>
                  <input
                    type="text"
                    defaultValue={selectedCert.validityPeriod}
                    placeholder="e.g., 1 year, 3 years, Never"
                  />
                </div>

                <div className="form-field">
                  <label>Grace Period (days)</label>
                  <input
                    type="number"
                    min="0"
                    defaultValue={selectedCert.gracePeriodDays ?? ""}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-field">
                <label>Requires Document Upload?</label>
                <div className="toggle-group">
                  <button
                    className={`toggle-btn ${selectedCert.requiresDocument ? "active" : ""}`}
                    type="button"
                  >
                    Yes
                  </button>
                  <button
                    className={`toggle-btn ${!selectedCert.requiresDocument ? "active" : ""}`}
                    type="button"
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Notes</label>
                <textarea
                  placeholder="Optional notes..."
                  rows={3}
                  defaultValue={selectedCert.notes}
                />
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">{selectedCert.createdAt}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Updated</span>
                    <span className="audit-value">{selectedCert.updatedAt}</span>
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

      {/* Add Certification Modal (UI shell only) */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Certification</h2>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-field">
                  <label>Certification Name</label>
                  <input type="text" placeholder="e.g., OSHA 10-Hour" />
                </div>

                <div className="form-field">
                  <label>Short Code / Slug</label>
                  <input type="text" placeholder="e.g., OSHA10" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Category</label>
                  <select defaultValue="">
                    <option value="" disabled>
                      Select Category
                    </option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
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

              <div className="form-field">
                <label>Expires?</label>
                <div className="toggle-group">
                  <button className="toggle-btn" type="button">
                    Yes
                  </button>
                  <button className="toggle-btn active" type="button">
                    No
                  </button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Validity Period</label>
                  <input type="text" placeholder="e.g., 1 year, 3 years, Never" />
                </div>

                <div className="form-field">
                  <label>Grace Period (days)</label>
                  <input type="number" min="0" placeholder="Optional" />
                </div>
              </div>

              <div className="form-field">
                <label>Requires Document Upload?</label>
                <div className="toggle-group">
                  <button className="toggle-btn active" type="button">
                    Yes
                  </button>
                  <button className="toggle-btn" type="button">
                    No
                  </button>
                </div>
              </div>

              <div className="form-field">
                <label>Notes</label>
                <textarea placeholder="Optional notes..." rows={3} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-save" onClick={() => setIsAddModalOpen(false)}>
                Add Certification
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .cert-container {
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

        .filter-group select,
        .filter-group input {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: #fff;
          min-width: 140px;
        }

        .filter-group select:focus,
        .filter-group input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .filter-group select option {
          background: #1a1d24;
          color: #fff;
        }

        .filter-group input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .search-group input {
          min-width: 220px;
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

        .certs-table {
          width: 100%;
          border-collapse: collapse;
        }

        .certs-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .certs-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .certs-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .certs-table tr:last-child td {
          border-bottom: none;
        }

        .certs-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .cell-name {
          min-width: 200px;
        }

        .name-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cert-name {
          font-weight: 500;
          color: #fff;
        }

        .cert-code {
          font-size: 11px;
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.45);
        }

        .category-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .expires-yes {
          color: #f59e0b;
        }

        .expires-no {
          color: rgba(255, 255, 255, 0.5);
        }

        .cell-validity {
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.7) !important;
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
          min-height: 80px;
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

