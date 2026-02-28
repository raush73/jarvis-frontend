"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type UserRole = "Salesperson" | "Recruiter" | "Dispatcher" | "Accounting" | "Admin";
type UserStatus = "Active" | "Inactive";

type InternalUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: UserRole[];
  status: UserStatus;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
};

// Deterministic mock data
const MOCK_USERS: InternalUser[] = [
  {
    id: "USR-001",
    name: "Steve Mitchell",
    email: "steve.mitchell@mw4h.com",
    phone: "(555) 234-5678",
    roles: ["Salesperson", "Admin"],
    status: "Active",
    lastLogin: "2026-02-03 09:15 AM",
    createdAt: "2024-03-15",
    updatedAt: "2026-01-28",
    notes: "Senior sales lead. Override commission rate.",
  },
  {
    id: "USR-002",
    name: "Angela Torres",
    email: "angela.torres@mw4h.com",
    phone: "(555) 345-6789",
    roles: ["Recruiter"],
    status: "Active",
    lastLogin: "2026-02-03 08:42 AM",
    createdAt: "2024-06-01",
    updatedAt: "2026-02-01",
    notes: "",
  },
  {
    id: "USR-003",
    name: "Marcus Chen",
    email: "marcus.chen@mw4h.com",
    phone: "(555) 456-7890",
    roles: ["Dispatcher"],
    status: "Active",
    lastLogin: "2026-02-02 04:30 PM",
    createdAt: "2024-08-20",
    updatedAt: "2026-01-15",
    notes: "Night shift coordinator.",
  },
  {
    id: "USR-004",
    name: "Rachel Kim",
    email: "rachel.kim@mw4h.com",
    phone: "(555) 567-8901",
    roles: ["Accounting"],
    status: "Active",
    lastLogin: "2026-02-03 07:55 AM",
    createdAt: "2024-04-10",
    updatedAt: "2026-02-02",
    notes: "Handles invoicing and payroll.",
  },
  {
    id: "USR-005",
    name: "David Park",
    email: "david.park@mw4h.com",
    phone: "(555) 678-9012",
    roles: ["Salesperson"],
    status: "Active",
    lastLogin: "2026-02-01 11:20 AM",
    createdAt: "2025-01-05",
    updatedAt: "2026-01-20",
    notes: "",
  },
  {
    id: "USR-006",
    name: "Jennifer Walsh",
    email: "jennifer.walsh@mw4h.com",
    phone: "(555) 789-0123",
    roles: ["Recruiter", "Dispatcher"],
    status: "Active",
    lastLogin: "2026-02-03 10:05 AM",
    createdAt: "2024-09-12",
    updatedAt: "2026-01-30",
    notes: "Cross-trained for dispatch backup.",
  },
  {
    id: "USR-007",
    name: "Brian Foster",
    email: "brian.foster@mw4h.com",
    phone: "(555) 890-1234",
    roles: ["Admin"],
    status: "Active",
    lastLogin: "2026-02-03 09:00 AM",
    createdAt: "2024-01-01",
    updatedAt: "2026-02-03",
    notes: "System administrator.",
  },
  {
    id: "USR-008",
    name: "Lisa Hernandez",
    email: "lisa.hernandez@mw4h.com",
    phone: "(555) 901-2345",
    roles: ["Salesperson"],
    status: "Inactive",
    lastLogin: "2025-11-15 03:45 PM",
    createdAt: "2024-05-22",
    updatedAt: "2025-12-01",
    notes: "On leave.",
  },
  {
    id: "USR-009",
    name: "Kevin Nguyen",
    email: "kevin.nguyen@mw4h.com",
    phone: "(555) 012-3456",
    roles: ["Accounting", "Admin"],
    status: "Active",
    lastLogin: "2026-02-02 02:10 PM",
    createdAt: "2024-07-08",
    updatedAt: "2026-01-25",
    notes: "Finance lead with admin access.",
  },
  {
    id: "USR-010",
    name: "Michelle Adams",
    email: "michelle.adams@mw4h.com",
    phone: "(555) 123-4567",
    roles: ["Dispatcher"],
    status: "Inactive",
    lastLogin: "2025-10-20 09:30 AM",
    createdAt: "2024-02-14",
    updatedAt: "2025-11-01",
    notes: "Former employee.",
  },
];

const ROLE_OPTIONS: UserRole[] = ["Salesperson", "Recruiter", "Dispatcher", "Accounting", "Admin"];

export default function AdminUsersPage() {
  // Filter state
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail drawer state
  const [selectedUser, setSelectedUser] = useState<InternalUser | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Add user modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter logic
  const filteredUsers = MOCK_USERS.filter((user) => {
    // Role filter
    if (roleFilter !== "All" && !user.roles.includes(roleFilter as UserRole)) {
      return false;
    }
    // Status filter
    if (statusFilter !== "All" && user.status !== statusFilter) {
      return false;
    }
    // Search filter (name or email)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !user.name.toLowerCase().includes(query) &&
        !user.email.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  // Role badge color
  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case "Admin":
        return { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.25)" };
      case "Salesperson":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "Recruiter":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" };
      case "Dispatcher":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "Accounting":
        return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  // Status badge style
  const getStatusStyle = (status: UserStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  // Open detail drawer
  const handleViewUser = (user: InternalUser) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
  };

  // Close drawer
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedUser(null), 200);
  };

  return (
    <div className="users-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Users</h1>
          <p className="subtitle">
            Manage internal staff users and role assignments
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={() => setIsAddModalOpen(true)}>
            + Add User
          </button>
        </div>
      </div>

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
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
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
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Users Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role(s)</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="cell-name">{user.name}</td>
                  <td className="cell-email">{user.email}</td>
                  <td className="cell-roles">
                    <div className="roles-wrap">
                      {user.roles.map((role) => {
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
                            {role}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(user.status).bg,
                        color: getStatusStyle(user.status).color,
                        borderColor: getStatusStyle(user.status).border,
                      }}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="cell-login">{user.lastLogin}</td>
                  <td className="cell-actions">
                    <button
                      className="action-btn"
                      onClick={() => handleViewUser(user)}
                    >
                      View
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleViewUser(user)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No users match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail/Edit Drawer */}
      {isDrawerOpen && selectedUser && (
        <div className="drawer-overlay" onClick={handleCloseDrawer}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>User Profile</h2>
              <button className="drawer-close" onClick={handleCloseDrawer}>
                ×
              </button>
            </div>

            <div className="drawer-body">
              <div className="profile-section">
                <div className="profile-field">
                  <label>Name</label>
                  <div className="field-value">{selectedUser.name}</div>
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  <div className="field-value">{selectedUser.email}</div>
                </div>

                <div className="profile-field">
                  <label>Phone</label>
                  <div className="field-value">{selectedUser.phone}</div>
                </div>

                <div className="profile-field">
                  <label>Roles</label>
                  <div className="field-value roles-value">
                    {selectedUser.roles.map((role) => {
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
                          {role}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="profile-field">
                  <label>Status</label>
                  <div className="field-value">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(selectedUser.status).bg,
                        color: getStatusStyle(selectedUser.status).color,
                        borderColor: getStatusStyle(selectedUser.status).border,
                      }}
                    >
                      {selectedUser.status}
                    </span>
                  </div>
                </div>

                <div className="profile-field">
                  <label>Notes</label>
                  <div className="field-value notes-value">
                    {selectedUser.notes || "—"}
                  </div>
                </div>
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">{selectedUser.createdAt}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Last Login</span>
                    <span className="audit-value">{selectedUser.lastLogin}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Updated</span>
                    <span className="audit-value">{selectedUser.updatedAt}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn-edit" onClick={() => {}}>
                Edit User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal (UI shell only) */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add User</h2>
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
                  {ROLE_OPTIONS.map((role) => (
                    <label key={role} className="checkbox-label">
                      <input type="checkbox" />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-field">
                <label>Status</label>
                <select defaultValue="Active">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
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
                Save User
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
          grid-template-columns: repeat(3, 1fr);
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

