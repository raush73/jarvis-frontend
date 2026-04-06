"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type BackendUser = {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: string;
  roles: { userId: string; roleId: string; assignedAt: string; role: { id: string; name: string } }[];
};

type BackendRole = {
  id: string;
  name: string;
  description?: string | null;
};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
};

const NON_STAFF_ROLES = ["customer", "worker"];

function mapBackendUser(u: BackendUser): StaffMember {
  const roleNames = (u.roles ?? []).map((r) => r.role?.name ?? "unknown");
  return {
    id: u.id,
    name: u.fullName || u.email,
    email: u.email,
    isActive: u.isActive ?? true,
    roles: roleNames,
    createdAt: u.createdAt,
  };
}

function getToken(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem("jp_accessToken")
    : null;
}

function formatRoleName(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/users", { headers, cache: "no-store" }),
        fetch("/api/roles", { headers, cache: "no-store" }),
      ]);

      if (!usersRes.ok) {
        throw new Error(`Failed to load staff (${usersRes.status})`);
      }

      const usersData: BackendUser[] = await usersRes.json();
      setStaff(usersData.map(mapBackendUser));

      if (rolesRes.ok) {
        const rolesData: BackendRole[] = await rolesRes.json();
        setRoles(rolesData);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load staff data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const roleOptions = (
    roles.length > 0
      ? roles.map((r) => r.name)
      : [...new Set(staff.flatMap((s) => s.roles))]
  ).filter((r) => !NON_STAFF_ROLES.includes(r.toLowerCase()));

  const filteredStaff = staff.filter((member) => {
    if (roleFilter !== "All" && !member.roles.includes(roleFilter)) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !member.name.toLowerCase().includes(query) &&
        !member.email.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  const getRoleBadgeStyle = (role: string) => {
    const normalized = role.toLowerCase();
    switch (normalized) {
      case "admin":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.25)" };
      case "sales":
      case "salesperson":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "recruiter":
      case "recruiting":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" };
      case "dispatcher":
      case "dispatch":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "accounting":
        return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  const handleViewStaff = (member: StaffMember) => {
    setSelectedStaff(member);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedStaff(null), 200);
  };

  return (
    <div className="users-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Staff</h1>
          <p className="subtitle">
            Manage internal staff and role assignments
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={() => setIsAddModalOpen(true)}>
            + Add Staff
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          {error}
          <button className="retry-btn" onClick={fetchData}>Retry</button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="roleFilter">Role</label>
          <select
            id="roleFilter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {formatRoleName(role)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group search-group">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            placeholder="Name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-results">
          {loading ? "Loading..." : `${filteredStaff.length} staff member${filteredStaff.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Staff Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role(s)</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    Loading staff...
                  </td>
                </tr>
              )}
              {!loading && filteredStaff.map((member) => (
                <tr key={member.id}>
                  <td className="cell-name">{member.name}</td>
                  <td className="cell-email">{member.email}</td>
                  <td className="cell-roles">
                    <div className="roles-wrap">
                      {member.roles.map((role) => {
                        const style = getRoleBadgeStyle(role);
                        return (
                          <span
                            key={role}
                            className="role-badge"
                            style={{
                              backgroundColor: style.bg,
                              color: style.color,
                              borderColor: style.border,
                            }}
                          >
                            {formatRoleName(role)}
                          </span>
                        );
                      })}
                      {member.roles.length === 0 && (
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No roles</span>
                      )}
                    </div>
                  </td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={member.isActive
                        ? { backgroundColor: "rgba(34, 197, 94, 0.12)", color: "#22c55e", borderColor: "rgba(34, 197, 94, 0.25)" }
                        : { backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.25)" }
                      }
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="cell-login">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  <td className="cell-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleViewStaff(member)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No staff members match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Profile Drawer */}
      {isDrawerOpen && selectedStaff && (
        <div className="drawer-overlay" onClick={handleCloseDrawer}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>Staff Profile</h2>
              <button className="drawer-close" onClick={handleCloseDrawer}>
                ×
              </button>
            </div>

            <div className="drawer-body">
              <div className="profile-section">
                <div className="profile-field">
                  <label>Name</label>
                  <div className="field-value">{selectedStaff.name}</div>
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  <div className="field-value">{selectedStaff.email}</div>
                </div>

                <div className="profile-field">
                  <label>Status</label>
                  <div className="field-value">
                    <span
                      className="status-badge"
                      style={selectedStaff.isActive
                        ? { backgroundColor: "rgba(34, 197, 94, 0.12)", color: "#22c55e", borderColor: "rgba(34, 197, 94, 0.25)" }
                        : { backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.25)" }
                      }
                    >
                      {selectedStaff.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="profile-field">
                  <label>Roles</label>
                  <div className="field-value roles-value">
                    {selectedStaff.roles.map((role) => {
                      const style = getRoleBadgeStyle(role);
                      return (
                        <span
                          key={role}
                          className="role-badge"
                          style={{
                            backgroundColor: style.bg,
                            color: style.color,
                            borderColor: style.border,
                          }}
                        >
                          {formatRoleName(role)}
                        </span>
                      );
                    })}
                    {selectedStaff.roles.length === 0 && (
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No roles assigned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">
                      {new Date(selectedStaff.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Staff ID</span>
                    <span className="audit-value" style={{ fontSize: 10, wordBreak: "break-all" }}>
                      {selectedStaff.id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn-edit" onClick={() => {}}>
                Edit Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal (UI shell) */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Staff</h2>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-field">
                <label>Name</label>
                <input type="text" placeholder="Full name" />
              </div>

              <div className="form-field">
                <label>Email</label>
                <input type="email" placeholder="email@mw4h.com" />
              </div>

              <div className="form-field">
                <label>Phone</label>
                <input type="text" placeholder="(555) 123-4567" />
              </div>

              <div className="form-field">
                <label>Roles</label>
                <div className="checkbox-group">
                  {(roles.length > 0
                    ? roles.map((r) => r.name).filter((r) => !NON_STAFF_ROLES.includes(r.toLowerCase()))
                    : roleOptions
                  ).map((role) => (
                    <label key={role} className="checkbox-label">
                      <input type="checkbox" />
                      <span>{formatRoleName(role)}</span>
                    </label>
                  ))}
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
                Save Staff
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .users-container {
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

        /* Error */
        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin-bottom: 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
        }

        .retry-btn {
          margin-left: auto;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 500;
          color: #fff;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
          cursor: pointer;
        }

        .retry-btn:hover {
          background: rgba(239, 68, 68, 0.3);
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
          color: rgba(255, 255, 255, 0.3);
        }

        .search-group input {
          min-width: 200px;
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

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .users-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .users-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .users-table tr:last-child td {
          border-bottom: none;
        }

        .users-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .cell-name {
          font-weight: 500;
          color: #fff !important;
        }

        .cell-email {
          color: rgba(255, 255, 255, 0.6) !important;
          font-size: 12px !important;
        }

        .cell-login {
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.5) !important;
          white-space: nowrap;
        }

        .roles-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .role-badge {
          display: inline-block;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          white-space: nowrap;
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

        /* Drawer */
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
        }

        .drawer {
          width: 420px;
          max-width: 100%;
          height: 100%;
          background: #12151b;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.2s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .drawer-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .drawer-close {
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

        .drawer-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .profile-section {
          margin-bottom: 28px;
        }

        .profile-field {
          margin-bottom: 20px;
        }

        .profile-field label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }

        .field-value {
          font-size: 14px;
          color: #fff;
        }

        .roles-value {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .notes-value {
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.5;
        }

        .audit-section {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
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

        .drawer-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .btn-edit {
          width: 100%;
          padding: 12px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-edit:hover {
          background: #2563eb;
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
          width: 480px;
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

        .checkbox-group {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
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
