"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type BackendRole = {
  id: string;
  name: string;
  description?: string | null;
  scope: "STAFF" | "CUSTOMER" | "WORKER" | "SYSTEM";
  isActive: boolean;
};

type BackendUser = {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  createdAt: string;
  roles: {
    userId: string;
    roleId: string;
    assignedAt: string;
    role: { id: string; name: string };
  }[];
};

type StaffMember = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleIds: string[];
  roleNames: string[];
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem("jp_accessToken")
    : null;
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function formatRoleName(raw: string): string {
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function mapBackendUser(u: BackendUser): StaffMember {
  const seen = new Set<string>();
  const dedupedRoleIds: string[] = [];
  const dedupedRoleNames: string[] = [];
  for (const r of u.roles ?? []) {
    const name = r.role?.name;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    dedupedRoleIds.push(r.role.id);
    dedupedRoleNames.push(name);
  }
  return {
    id: u.id,
    name: u.fullName || u.email,
    email: u.email,
    isActive: u.isActive ?? true,
    roleIds: dedupedRoleIds,
    roleNames: dedupedRoleNames,
    createdAt: u.createdAt,
  };
}

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  admin:      { bg: "rgba(239, 68, 68, 0.12)", color: "#ef4444", border: "rgba(239, 68, 68, 0.25)" },
  sales:      { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" },
  salesperson:{ bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" },
  recruiter:  { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" },
  recruiting: { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" },
  dispatcher: { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" },
  dispatch:   { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" },
  accounting: { bg: "rgba(34, 197, 94, 0.12)",  color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" },
};
const DEFAULT_ROLE_COLOR = { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };

function getRoleBadgeStyle(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? DEFAULT_ROLE_COLOR;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminStaffPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [allRoles, setAllRoles] = useState<BackendRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Staff drawer
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingRoles, setEditingRoles] = useState(false);
  const [pendingRoleIds, setPendingRoleIds] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // Add Staff modal
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [addFullName, setAddFullName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Role management modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<"create" | "edit">("create");
  const [roleModalTarget, setRoleModalTarget] = useState<BackendRole | null>(null);
  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormDesc, setRoleFormDesc] = useState("");
  const [roleFormScope, setRoleFormScope] = useState<BackendRole["scope"]>("STAFF");
  const [roleFormActive, setRoleFormActive] = useState(true);
  const [roleModalSaving, setRoleModalSaving] = useState(false);
  const [roleModalError, setRoleModalError] = useState<string | null>(null);

  // Manage Roles panel visibility
  const [showRolesPanel, setShowRolesPanel] = useState(false);

  /* ---------- Derived role lists ---------- */

  const staffRoles = allRoles.filter(
    (r) => r.scope === "STAFF" || r.scope === "SYSTEM"
  );

  // For role assignment: STAFF roles are the normal assignable set.
  // SYSTEM roles (Admin) shown separately with label so they're unambiguous.
  const assignableStaffRoles = allRoles.filter(
    (r) => r.scope === "STAFF" && r.isActive
  );
  const assignableSystemRoles = allRoles.filter(
    (r) => r.scope === "SYSTEM" && r.isActive
  );

  // Deduplicated filter dropdown: use unique role names from STAFF + SYSTEM scopes
  const filterRoleOptions = staffRoles.filter((r) => r.isActive);
  const deduplicatedFilterOptions: BackendRole[] = [];
  const seenFilterNames = new Set<string>();
  for (const r of filterRoleOptions) {
    const key = r.name.toLowerCase();
    if (seenFilterNames.has(key)) continue;
    seenFilterNames.add(key);
    deduplicatedFilterOptions.push(r);
  }

  /* ---------- Data fetching ---------- */

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/users", { headers: authHeaders(), cache: "no-store" }),
        fetch("/api/roles?includeInactive=true", {
          headers: authHeaders(),
          cache: "no-store",
        }),
      ]);
      if (!usersRes.ok) throw new Error(`Failed to load staff (${usersRes.status})`);
      const usersData: BackendUser[] = await usersRes.json();
      setStaff(usersData.map(mapBackendUser));
      if (rolesRes.ok) {
        const rolesData: BackendRole[] = await rolesRes.json();
        setAllRoles(rolesData);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load staff data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredStaff = staff.filter((m) => {
    if (roleFilter !== "All" && !m.roleNames.includes(roleFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  /* ---------- Drawer helpers ---------- */

  const openDrawer = (member: StaffMember) => {
    setSelectedStaff(member);
    setEditingRoles(false);
    setPendingRoleIds(member.roleIds);
    setIsDrawerOpen(true);
  };
  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingRoles(false);
    setTimeout(() => setSelectedStaff(null), 200);
  };

  const startEditRoles = () => {
    if (!selectedStaff) return;
    setPendingRoleIds([...selectedStaff.roleIds]);
    setEditingRoles(true);
  };

  const togglePendingRole = (roleId: string) => {
    setPendingRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const saveRoleAssignments = async () => {
    if (!selectedStaff) return;
    setSavingRoles(true);
    const currentIds = new Set(selectedStaff.roleIds);
    const targetIds = new Set(pendingRoleIds);

    const toAdd = pendingRoleIds.filter((id) => !currentIds.has(id));
    const toRemove = selectedStaff.roleIds.filter((id) => !targetIds.has(id));

    try {
      for (const roleId of toAdd) {
        await fetch(`/api/users/${selectedStaff.id}/roles/${roleId}`, {
          method: "POST",
          headers: authHeaders(),
        });
      }
      for (const roleId of toRemove) {
        await fetch(`/api/users/${selectedStaff.id}/roles/${roleId}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
      }
      await fetchData();
      setEditingRoles(false);
    } catch {
      setError("Failed to update role assignments");
    } finally {
      setSavingRoles(false);
    }
  };

  /* ---------- Add Staff ---------- */

  const openAddStaff = () => {
    setAddFullName("");
    setAddEmail("");
    setAddPassword("");
    setAddError(null);
    setAddStaffOpen(true);
  };

  const saveNewStaff = async () => {
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          email: addEmail.trim().toLowerCase(),
          password: addPassword,
          fullName: addFullName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Failed to create staff (${res.status})`);
      }
      setAddStaffOpen(false);
      await fetchData();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to create staff");
    } finally {
      setAddSaving(false);
    }
  };

  const canSaveNewStaff =
    addEmail.trim().length > 0 &&
    addPassword.length >= 8;

  /* ---------- Role CRUD modal ---------- */

  const openCreateRole = () => {
    setRoleModalMode("create");
    setRoleModalTarget(null);
    setRoleFormName("");
    setRoleFormDesc("");
    setRoleFormScope("STAFF");
    setRoleFormActive(true);
    setRoleModalError(null);
    setRoleModalOpen(true);
  };

  const openEditRole = (role: BackendRole) => {
    setRoleModalMode("edit");
    setRoleModalTarget(role);
    setRoleFormName(role.name);
    setRoleFormDesc(role.description ?? "");
    setRoleFormScope(role.scope);
    setRoleFormActive(role.isActive);
    setRoleModalError(null);
    setRoleModalOpen(true);
  };

  const saveRole = async () => {
    setRoleModalSaving(true);
    setRoleModalError(null);
    try {
      if (roleModalMode === "create") {
        const res = await fetch("/api/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            name: roleFormName.trim(),
            description: roleFormDesc.trim() || undefined,
            scope: roleFormScope,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Failed (${res.status})`);
        }
      } else if (roleModalTarget) {
        const res = await fetch(`/api/roles/${roleModalTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            name: roleFormName.trim(),
            description: roleFormDesc.trim() || undefined,
            isActive: roleFormActive,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || `Failed (${res.status})`);
        }
      }
      setRoleModalOpen(false);
      await fetchData();
    } catch (err: unknown) {
      setRoleModalError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setRoleModalSaving(false);
    }
  };

  /* ---------- Refresh selected staff after fetchData ---------- */
  useEffect(() => {
    if (selectedStaff) {
      const refreshed = staff.find((s) => s.id === selectedStaff.id);
      if (refreshed) {
        setSelectedStaff(refreshed);
        if (!editingRoles) setPendingRoleIds(refreshed.roleIds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  /* ---------- Render ---------- */

  return (
    <div className="users-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">&larr; Back to Admin</Link>
          <h1>Staff Management</h1>
          <p className="subtitle">Manage internal staff accounts and role assignments</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setShowRolesPanel(!showRolesPanel)}>
            {showRolesPanel ? "Hide Roles" : "Manage Roles"}
          </button>
          <button className="btn-primary" onClick={openAddStaff}>
            + Add Staff
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button className="retry-btn" onClick={() => { setError(null); fetchData(); }}>Retry</button>
        </div>
      )}

      {/* ---------- Roles Management Panel ---------- */}
      {showRolesPanel && (
        <div className="roles-panel">
          <div className="roles-panel-header">
            <h3>Staff &amp; System Roles</h3>
            <button className="btn-add-sm" onClick={openCreateRole}>+ New Role</button>
          </div>
          <table className="roles-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffRoles.map((role) => (
                <tr key={role.id}>
                  <td style={{ fontWeight: 500, color: "#fff" }}>{formatRoleName(role.name)}</td>
                  <td><span className={`scope-tag scope-${role.scope.toLowerCase()}`}>{role.scope}</span></td>
                  <td>
                    <span className={`status-dot ${role.isActive ? "active" : "inactive"}`}>
                      {role.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="action-btn-sm" onClick={() => openEditRole(role)}>Edit</button>
                    <button className="action-btn-sm" onClick={() => router.push(`/admin/roles/${role.id}`)} style={{ color: "#3b82f6" }}>Permissions</button>
                  </td>
                </tr>
              ))}
              {staffRoles.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: 20 }}>No staff roles found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Staff Filters ---------- */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="roleFilter">Staff Role</label>
          <select id="roleFilter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="All">All Roles</option>
            {deduplicatedFilterOptions.map((role) => (
              <option key={role.id} value={role.name}>{formatRoleName(role.name)}</option>
            ))}
          </select>
        </div>
        <div className="filter-group search-group">
          <label htmlFor="search">Search</label>
          <input id="search" type="text" placeholder="Name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="filter-results">
          {loading ? "Loading..." : `${filteredStaff.length} staff member${filteredStaff.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* ---------- Staff Table ---------- */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Staff Role(s)</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="empty-row">Loading staff...</td></tr>
              )}
              {!loading && filteredStaff.map((member) => (
                <tr key={member.id}>
                  <td className="cell-name">{member.name}</td>
                  <td className="cell-email">{member.email}</td>
                  <td className="cell-roles">
                    <div className="roles-wrap">
                      {member.roleNames.map((role) => {
                        const style = getRoleBadgeStyle(role);
                        return (
                          <span key={role} className="role-badge" style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}>
                            {formatRoleName(role)}
                          </span>
                        );
                      })}
                      {member.roleNames.length === 0 && (
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No roles</span>
                      )}
                    </div>
                  </td>
                  <td className="cell-status">
                    <span className="status-badge" style={member.isActive
                      ? { backgroundColor: "rgba(34, 197, 94, 0.12)", color: "#22c55e", borderColor: "rgba(34, 197, 94, 0.25)" }
                      : { backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.25)" }
                    }>
                      {member.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="cell-login">{new Date(member.createdAt).toLocaleDateString()}</td>
                  <td className="cell-actions">
                    <button className="action-btn" onClick={() => openDrawer(member)}>Manage</button>
                  </td>
                </tr>
              ))}
              {!loading && filteredStaff.length === 0 && (
                <tr><td colSpan={6} className="empty-row">No staff members match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Staff Manage Drawer ---------- */}
      {isDrawerOpen && selectedStaff && (
        <div className="drawer-overlay" onClick={closeDrawer}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>Manage Staff</h2>
              <button className="drawer-close" onClick={closeDrawer}>&times;</button>
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
                    <span className="status-badge" style={selectedStaff.isActive
                      ? { backgroundColor: "rgba(34, 197, 94, 0.12)", color: "#22c55e", borderColor: "rgba(34, 197, 94, 0.25)" }
                      : { backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.25)" }
                    }>{selectedStaff.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>

                {/* Role assignment section */}
                <div className="profile-field">
                  <label>Staff Roles</label>
                  {!editingRoles ? (
                    <div className="field-value roles-value">
                      {selectedStaff.roleNames.map((role) => {
                        const style = getRoleBadgeStyle(role);
                        return (
                          <span key={role} className="role-badge" style={{ backgroundColor: style.bg, color: style.color, borderColor: style.border }}>
                            {formatRoleName(role)}
                          </span>
                        );
                      })}
                      {selectedStaff.roleNames.length === 0 && (
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No roles assigned</span>
                      )}
                      <button className="btn-edit-roles" onClick={startEditRoles}>Edit Roles</button>
                    </div>
                  ) : (
                    <div className="role-edit-section">
                      {assignableStaffRoles.length > 0 && (
                        <div className="role-group">
                          <div className="role-group-label">Staff Roles</div>
                          <div className="checkbox-group">
                            {assignableStaffRoles.map((role) => (
                              <label key={role.id} className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={pendingRoleIds.includes(role.id)}
                                  onChange={() => togglePendingRole(role.id)}
                                />
                                <span>{formatRoleName(role.name)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {assignableSystemRoles.length > 0 && (
                        <div className="role-group">
                          <div className="role-group-label">System Roles</div>
                          <div className="checkbox-group">
                            {assignableSystemRoles.map((role) => (
                              <label key={role.id} className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={pendingRoleIds.includes(role.id)}
                                  onChange={() => togglePendingRole(role.id)}
                                />
                                <span>{formatRoleName(role.name)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="role-edit-actions">
                        <button className="btn-cancel-sm" onClick={() => setEditingRoles(false)} disabled={savingRoles}>Cancel</button>
                        <button className="btn-save-sm" onClick={saveRoleAssignments} disabled={savingRoles}>
                          {savingRoles ? "Saving..." : "Save Roles"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="audit-section">
                <div className="audit-title">Audit Information</div>
                <div className="audit-grid">
                  <div className="audit-item">
                    <span className="audit-label">Created</span>
                    <span className="audit-value">{new Date(selectedStaff.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="audit-item">
                    <span className="audit-label">Staff ID</span>
                    <span className="audit-value" style={{ fontSize: 10, wordBreak: "break-all" }}>{selectedStaff.id}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Add Staff Modal ---------- */}
      {addStaffOpen && (
        <div className="modal-overlay" onClick={() => setAddStaffOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Staff Member</h2>
              <button className="modal-close" onClick={() => setAddStaffOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {addError && (
                <div className="modal-error">{addError}</div>
              )}
              <div className="form-field">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Smith"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label>Email <span className="required-star">*</span></label>
                <input
                  type="email"
                  placeholder="e.g. jane@mw4h.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Password <span className="required-star">*</span></label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                />
                {addPassword.length > 0 && addPassword.length < 8 && (
                  <div className="field-hint" style={{ color: "#ef4444" }}>Password must be at least 8 characters</div>
                )}
              </div>
              <div className="field-hint" style={{ marginTop: -8, marginBottom: 12 }}>
                After creating the account, use Manage to assign staff roles.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setAddStaffOpen(false)}>Cancel</button>
              <button
                className="btn-save"
                onClick={saveNewStaff}
                disabled={addSaving || !canSaveNewStaff}
              >
                {addSaving ? "Creating..." : "Create Staff Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Role Create / Edit Modal ---------- */}
      {roleModalOpen && (
        <div className="modal-overlay" onClick={() => setRoleModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{roleModalMode === "create" ? "Create Staff Role" : "Edit Role"}</h2>
              <button className="modal-close" onClick={() => setRoleModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {roleModalError && (
                <div className="modal-error">{roleModalError}</div>
              )}
              <div className="form-field">
                <label>Role Name</label>
                <input
                  type="text"
                  placeholder="e.g. Safety Manager"
                  value={roleFormName}
                  onChange={(e) => setRoleFormName(e.target.value)}
                  disabled={roleModalMode === "edit" && roleModalTarget?.scope === "SYSTEM"}
                />
                {roleModalMode === "edit" && roleModalTarget?.scope === "SYSTEM" && (
                  <div className="field-hint">System roles cannot be renamed</div>
                )}
              </div>
              <div className="form-field">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="Optional description"
                  value={roleFormDesc}
                  onChange={(e) => setRoleFormDesc(e.target.value)}
                />
              </div>
              {roleModalMode === "create" && (
                <div className="form-field">
                  <label>Scope</label>
                  <select value={roleFormScope} onChange={(e) => setRoleFormScope(e.target.value as BackendRole["scope"])}>
                    <option value="STAFF">Staff</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="WORKER">Worker</option>
                    <option value="SYSTEM">System</option>
                  </select>
                </div>
              )}
              {roleModalMode === "edit" && (
                <div className="form-field">
                  <label>Scope</label>
                  <div className="field-value"><span className={`scope-tag scope-${roleModalTarget?.scope?.toLowerCase()}`}>{roleModalTarget?.scope}</span></div>
                  <div className="field-hint">Scope cannot be changed after creation</div>
                </div>
              )}
              {roleModalMode === "edit" && (
                <div className="form-field">
                  <label>Active</label>
                  <div className="toggle-row">
                    <button
                      className={`toggle-btn ${roleFormActive ? "on" : "off"}`}
                      onClick={() => setRoleFormActive(!roleFormActive)}
                      disabled={roleModalTarget?.scope === "SYSTEM"}
                    >
                      {roleFormActive ? "Active" : "Inactive"}
                    </button>
                    {roleModalTarget?.scope === "SYSTEM" && (
                      <span className="field-hint" style={{ marginLeft: 8 }}>System roles cannot be deactivated</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setRoleModalOpen(false)}>Cancel</button>
              <button
                className="btn-save"
                onClick={saveRole}
                disabled={roleModalSaving || !roleFormName.trim()}
              >
                {roleModalSaving ? "Saving..." : roleModalMode === "create" ? "Create Role" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .users-container { padding: 24px 40px 60px; max-width: 1200px; margin: 0 auto; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .back-link { font-size: 13px; color: rgba(255,255,255,0.5); text-decoration: none; transition: color 0.15s ease; display: inline-block; margin-bottom: 12px; }
        .back-link:hover { color: #3b82f6; }
        h1 { font-size: 28px; font-weight: 600; color: #fff; margin: 0 0 8px; letter-spacing: -0.5px; }
        .subtitle { font-size: 14px; color: rgba(255,255,255,0.55); margin: 0; }
        .header-actions { padding-top: 28px; display: flex; gap: 10px; }
        .btn-primary { padding: 10px 20px; font-size: 14px; font-weight: 600; color: #fff; background: #3b82f6; border: none; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary { padding: 10px 20px; font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; cursor: pointer; transition: all 0.15s ease; }
        .btn-secondary:hover { color: #fff; background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
        .error-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; margin-bottom: 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; color: #ef4444; font-size: 13px; }
        .retry-btn { margin-left: auto; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #fff; background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.3); border-radius: 4px; cursor: pointer; }
        .retry-btn:hover { background: rgba(239,68,68,0.3); }

        /* Roles Management Panel */
        .roles-panel { margin-bottom: 20px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
        .roles-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .roles-panel-header h3 { font-size: 15px; font-weight: 600; color: #fff; margin: 0; }
        .btn-add-sm { padding: 6px 14px; font-size: 12px; font-weight: 600; color: #fff; background: #3b82f6; border: none; border-radius: 6px; cursor: pointer; transition: background 0.15s ease; }
        .btn-add-sm:hover { background: #2563eb; }
        .roles-table { width: 100%; border-collapse: collapse; }
        .roles-table th { padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .roles-table td { padding: 8px 12px; font-size: 13px; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .scope-tag { display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 600; border-radius: 4px; border: 1px solid; }
        .scope-tag.scope-staff { background: rgba(59,130,246,0.12); color: #60a5fa; border-color: rgba(59,130,246,0.2); }
        .scope-tag.scope-system { background: rgba(239,68,68,0.12); color: #ef4444; border-color: rgba(239,68,68,0.2); }
        .scope-tag.scope-customer { background: rgba(245,158,11,0.12); color: #f59e0b; border-color: rgba(245,158,11,0.2); }
        .scope-tag.scope-worker { background: rgba(34,197,94,0.12); color: #22c55e; border-color: rgba(34,197,94,0.2); }
        .status-dot { font-size: 12px; font-weight: 500; }
        .status-dot.active { color: #22c55e; }
        .status-dot.inactive { color: #ef4444; }
        .action-btn-sm { padding: 4px 10px; font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; cursor: pointer; transition: all 0.15s ease; }
        .action-btn-sm:hover { color: #fff; background: rgba(255,255,255,0.08); }

        /* Filters */
        .filters-section { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 20px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
        .filter-group { display: flex; flex-direction: column; gap: 6px; }
        .filter-group label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.4px; }
        .filter-group select, .filter-group input { padding: 8px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 13px; color: #fff; min-width: 140px; }
        .filter-group select:focus, .filter-group input:focus { outline: none; border-color: #3b82f6; }
        .filter-group select option { background: #1a1d24; color: #fff; }
        .filter-group input::placeholder { color: rgba(255,255,255,0.3); }
        .search-group input { min-width: 200px; }
        .filter-results { margin-left: auto; font-size: 13px; color: rgba(255,255,255,0.5); padding-bottom: 8px; }

        /* Table */
        .table-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; }
        .table-wrap { overflow-x: auto; }
        .users-table { width: 100%; border-collapse: collapse; }
        .users-table thead { background: rgba(255,255,255,0.03); }
        .users-table th { padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .users-table td { padding: 14px 16px; font-size: 13px; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .users-table tr:last-child td { border-bottom: none; }
        .users-table tbody tr:hover { background: rgba(59,130,246,0.04); }
        .cell-name { font-weight: 500; color: #fff !important; }
        .cell-email { color: rgba(255,255,255,0.6) !important; font-size: 12px !important; }
        .cell-login { font-size: 12px !important; color: rgba(255,255,255,0.5) !important; white-space: nowrap; }
        .roles-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
        .role-badge { display: inline-block; padding: 3px 8px; font-size: 10px; font-weight: 600; border-radius: 4px; border: 1px solid; white-space: nowrap; }
        .status-badge { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 4px; border: 1px solid; }
        .cell-actions { white-space: nowrap; }
        .action-btn { padding: 6px 14px; font-size: 12px; font-weight: 500; color: #3b82f6; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 5px; cursor: pointer; transition: all 0.15s ease; }
        .action-btn:hover { color: #fff; background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.35); }
        .empty-row { text-align: center; color: rgba(255,255,255,0.4) !important; padding: 32px 16px !important; }

        /* Drawer */
        .drawer-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; justify-content: flex-end; }
        .drawer { width: 440px; max-width: 100%; height: 100%; background: #12151b; border-left: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; animation: slideIn 0.2s ease; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .drawer-header h2 { font-size: 18px; font-weight: 600; color: #fff; margin: 0; }
        .drawer-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: rgba(255,255,255,0.5); background: transparent; border: none; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
        .drawer-close:hover { color: #fff; background: rgba(255,255,255,0.08); }
        .drawer-body { flex: 1; overflow-y: auto; padding: 24px; }
        .profile-section { margin-bottom: 28px; }
        .profile-field { margin-bottom: 20px; }
        .profile-field label { display: block; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
        .field-value { font-size: 14px; color: #fff; }
        .roles-value { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .btn-edit-roles { padding: 3px 10px; font-size: 11px; font-weight: 500; color: #3b82f6; background: transparent; border: 1px solid rgba(59,130,246,0.3); border-radius: 4px; cursor: pointer; margin-left: 4px; transition: all 0.15s ease; }
        .btn-edit-roles:hover { background: rgba(59,130,246,0.1); }
        .role-edit-section { display: flex; flex-direction: column; gap: 14px; }
        .role-group { display: flex; flex-direction: column; gap: 8px; }
        .role-group-label { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.5px; }
        .checkbox-group { display: flex; flex-wrap: wrap; gap: 10px; }
        .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.8); cursor: pointer; }
        .checkbox-label input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
        .role-edit-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 4px; }
        .btn-cancel-sm { padding: 6px 14px; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; }
        .btn-save-sm { padding: 6px 14px; font-size: 12px; font-weight: 600; color: #fff; background: #3b82f6; border: none; border-radius: 6px; cursor: pointer; }
        .btn-save-sm:disabled { opacity: 0.5; cursor: not-allowed; }
        .audit-section { padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; }
        .audit-title { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 14px; }
        .audit-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .audit-item { display: flex; flex-direction: column; gap: 4px; }
        .audit-label { font-size: 10px; color: rgba(255,255,255,0.4); }
        .audit-value { font-size: 12px; color: rgba(255,255,255,0.8); }

        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .modal { width: 480px; max-width: 90%; max-height: 90vh; background: #12151b; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; display: flex; flex-direction: column; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .modal-header h2 { font-size: 18px; font-weight: 600; color: #fff; margin: 0; }
        .modal-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: rgba(255,255,255,0.5); background: transparent; border: none; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
        .modal-close:hover { color: #fff; background: rgba(255,255,255,0.08); }
        .modal-body { flex: 1; overflow-y: auto; padding: 24px; }
        .modal-error { padding: 10px 14px; margin-bottom: 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; color: #ef4444; font-size: 13px; }
        .form-field { margin-bottom: 20px; }
        .form-field label { display: block; font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.7); margin-bottom: 8px; }
        .required-star { color: #ef4444; }
        .form-field input, .form-field select, .form-field textarea { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 14px; color: #fff; }
        .form-field input:focus, .form-field select:focus, .form-field textarea:focus { outline: none; border-color: #3b82f6; }
        .form-field input::placeholder, .form-field textarea::placeholder { color: rgba(255,255,255,0.3); }
        .form-field select option { background: #1a1d24; color: #fff; }
        .form-field input:disabled { opacity: 0.5; cursor: not-allowed; }
        .field-hint { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .toggle-row { display: flex; align-items: center; }
        .toggle-btn { padding: 6px 16px; font-size: 13px; font-weight: 600; border: 1px solid; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
        .toggle-btn.on { color: #22c55e; background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.25); }
        .toggle-btn.off { color: #ef4444; background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.25); }
        .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.08); }
        .btn-cancel { padding: 10px 20px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer; transition: all 0.15s ease; }
        .btn-cancel:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .btn-save { padding: 10px 20px; font-size: 14px; font-weight: 600; color: #fff; background: #3b82f6; border: none; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; }
        .btn-save:hover { background: #2563eb; }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
