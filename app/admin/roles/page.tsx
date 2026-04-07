"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type BackendRole = {
  id: string;
  name: string;
  description?: string | null;
  scope: "STAFF" | "CUSTOMER" | "WORKER" | "SYSTEM";
  isActive: boolean;
};

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

const SCOPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  STAFF:    { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", border: "rgba(59,130,246,0.2)" },
  SYSTEM:   { bg: "rgba(239,68,68,0.12)", color: "#ef4444", border: "rgba(239,68,68,0.2)" },
  CUSTOMER: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
  WORKER:   { bg: "rgba(34,197,94,0.12)", color: "#22c55e", border: "rgba(34,197,94,0.2)" },
};

export default function RolesListPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<BackendRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/roles?includeInactive=true", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load roles (${res.status})`);
      const data: BackendRole[] = await res.json();
      setRoles(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const staffRoles = roles.filter((r) => r.scope === "STAFF" || r.scope === "SYSTEM");
  const otherRoles = roles.filter((r) => r.scope !== "STAFF" && r.scope !== "SYSTEM");

  return (
    <div className="roles-container">
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">&larr; Back to Admin</Link>
          <h1>Roles &amp; Permissions</h1>
          <p className="subtitle">Configure role permissions and data access scopes</p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button className="retry-btn" onClick={() => { setError(null); fetchRoles(); }}>Retry</button>
        </div>
      )}

      {/* Staff & System Roles */}
      <div className="section">
        <div className="section-header">
          <h2>Staff &amp; System Roles</h2>
        </div>
        <div className="table-wrap">
          <table className="roles-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="empty-row">Loading roles...</td></tr>
              )}
              {!loading && staffRoles.map((role) => {
                const sc = SCOPE_COLORS[role.scope] ?? SCOPE_COLORS.STAFF;
                return (
                  <tr key={role.id}>
                    <td className="cell-name">{formatRoleName(role.name)}</td>
                    <td className="cell-desc">{role.description || "—"}</td>
                    <td>
                      <span className="scope-tag" style={{ backgroundColor: sc.bg, color: sc.color, borderColor: sc.border }}>
                        {role.scope}
                      </span>
                    </td>
                    <td>
                      <span className={`status-dot ${role.isActive ? "active" : "inactive"}`}>
                        {role.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => router.push(`/admin/roles/${role.id}`)}
                      >
                        Edit Permissions &amp; Scopes
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && staffRoles.length === 0 && (
                <tr><td colSpan={5} className="empty-row">No staff roles found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Other Roles (Customer / Worker) */}
      {!loading && otherRoles.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h2>Other Roles</h2>
          </div>
          <div className="table-wrap">
            <table className="roles-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Description</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {otherRoles.map((role) => {
                  const sc = SCOPE_COLORS[role.scope] ?? SCOPE_COLORS.STAFF;
                  return (
                    <tr key={role.id}>
                      <td className="cell-name">{formatRoleName(role.name)}</td>
                      <td className="cell-desc">{role.description || "—"}</td>
                      <td>
                        <span className="scope-tag" style={{ backgroundColor: sc.bg, color: sc.color, borderColor: sc.border }}>
                          {role.scope}
                        </span>
                      </td>
                      <td>
                        <span className={`status-dot ${role.isActive ? "active" : "inactive"}`}>
                          {role.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="action-btn"
                          onClick={() => router.push(`/admin/roles/${role.id}`)}
                        >
                          Edit Permissions &amp; Scopes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .roles-container { padding: 24px 40px 60px; max-width: 1000px; margin: 0 auto; }
        .page-header { margin-bottom: 24px; }
        .back-link { font-size: 13px; color: rgba(255,255,255,0.5); text-decoration: none; display: inline-block; margin-bottom: 12px; transition: color 0.15s ease; }
        .back-link:hover { color: #3b82f6; }
        h1 { font-size: 28px; font-weight: 600; color: #fff; margin: 0 0 8px; letter-spacing: -0.5px; }
        .subtitle { font-size: 14px; color: rgba(255,255,255,0.55); margin: 0; }
        .error-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; margin-bottom: 16px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; color: #ef4444; font-size: 13px; }
        .retry-btn { margin-left: auto; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #fff; background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.3); border-radius: 4px; cursor: pointer; }
        .section { margin-bottom: 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; }
        .section-header { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .section-header h2 { font-size: 15px; font-weight: 600; color: #fff; margin: 0; }
        .table-wrap { overflow-x: auto; }
        .roles-table { width: 100%; border-collapse: collapse; }
        .roles-table th { padding: 12px 16px; text-align: left; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
        .roles-table td { padding: 14px 16px; font-size: 13px; color: rgba(255,255,255,0.85); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .roles-table tr:last-child td { border-bottom: none; }
        .roles-table tbody tr:hover { background: rgba(59,130,246,0.04); }
        .cell-name { font-weight: 600; color: #fff !important; }
        .cell-desc { color: rgba(255,255,255,0.5) !important; font-size: 12px !important; max-width: 260px; }
        .scope-tag { display: inline-block; padding: 3px 8px; font-size: 10px; font-weight: 600; border-radius: 4px; border: 1px solid; }
        .status-dot { font-size: 12px; font-weight: 500; }
        .status-dot.active { color: #22c55e; }
        .status-dot.inactive { color: #ef4444; }
        .action-btn { padding: 6px 14px; font-size: 12px; font-weight: 500; color: #3b82f6; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 5px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
        .action-btn:hover { color: #fff; background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.35); }
        .empty-row { text-align: center; color: rgba(255,255,255,0.4) !important; padding: 32px 16px !important; }
      `}</style>
    </div>
  );
}
