"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Permission = { id: string; key: string; description?: string | null };
type RoleScope = { id: string; resource: string; scope: string };
type RoleDetail = {
  id: string;
  name: string;
  description?: string | null;
  scope: string;
  isActive: boolean;
  _count?: { permissions: number; users: number };
};

const SCOPE_RESOURCES = [
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
  { key: "employees", label: "Employees" },
  { key: "commissions", label: "Commissions" },
];

const ACCESS_SCOPE_OPTIONS = [
  { value: "NONE", label: "None" },
  { value: "OWN", label: "Own Only" },
  { value: "TEAM", label: "Team" },
  { value: "COMPANY", label: "All (Company)" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("jp_accessToken") : null;
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function groupPermissions(perms: Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {};
  for (const p of perms) {
    const parts = p.key.split(".");
    const domain = parts[0];
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(p);
  }
  return groups;
}

function formatDomain(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function RoleEditPage() {
  const params = useParams();
  const router = useRouter();
  const roleId = params.id as string;

  const [role, setRole] = useState<RoleDetail | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissionIds, setRolePermissionIds] = useState<Set<string>>(new Set());
  const [roleScopes, setRoleScopes] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* ---------- Fetch data ---------- */

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleRes, allPermsRes, rolePermsRes, scopesRes] = await Promise.all([
        fetch(`/api/roles/${roleId}`, { headers: authHeaders(), cache: "no-store" }),
        fetch("/api/roles/permissions", { headers: authHeaders(), cache: "no-store" }),
        fetch(`/api/roles/${roleId}/permissions`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`/api/roles/${roleId}/scopes`, { headers: authHeaders(), cache: "no-store" }),
      ]);

      if (!roleRes.ok) throw new Error("Failed to load role");

      const roleData: RoleDetail = await roleRes.json();
      setRole(roleData);

      if (allPermsRes.ok) {
        const perms: Permission[] = await allPermsRes.json();
        setAllPermissions(perms);
      }

      if (rolePermsRes.ok) {
        const rPerms: Permission[] = await rolePermsRes.json();
        setRolePermissionIds(new Set(rPerms.map((p) => p.id)));
      }

      if (scopesRes.ok) {
        const sList: RoleScope[] = await scopesRes.json();
        const map: Record<string, string> = {};
        for (const s of sList) map[s.resource] = s.scope;
        setRoleScopes(map);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ---------- Permission toggle ---------- */

  const togglePermission = (permId: string) => {
    setRolePermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
    setSuccess(null);
  };

  /* ---------- Scope change ---------- */

  const setScope = (resource: string, scope: string) => {
    setRoleScopes((prev) => ({ ...prev, [resource]: scope }));
    setSuccess(null);
  };

  /* ---------- Save ---------- */

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const [permRes, scopeRes] = await Promise.all([
        fetch(`/api/roles/${roleId}/permissions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ permissionIds: Array.from(rolePermissionIds) }),
        }),
        fetch(`/api/roles/${roleId}/scopes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            scopes: SCOPE_RESOURCES.map((r) => ({
              resource: r.key,
              scope: roleScopes[r.key] || "NONE",
            })),
          }),
        }),
      ]);

      if (!permRes.ok) throw new Error("Failed to save permissions");
      if (!scopeRes.ok) throw new Error("Failed to save scopes");

      setSuccess("Saved successfully. Changes take effect after user re-login.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Render ---------- */

  const grouped = groupPermissions(allPermissions);

  if (loading) {
    return (
      <div style={{ padding: "40px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
        Loading role configuration...
      </div>
    );
  }

  if (!role) {
    return (
      <div style={{ padding: "40px", color: "#ef4444", textAlign: "center" }}>
        Role not found.{" "}
        <Link href="/admin/roles" style={{ color: "#3b82f6" }}>Back to Roles &amp; Permissions</Link>
      </div>
    );
  }

  return (
    <div className="role-edit-container">
      <div className="page-header">
        <Link href="/admin/roles" className="back-link">&larr; Back to Roles &amp; Permissions</Link>
        <h1>Edit Role: {role.name}</h1>
        <p className="subtitle">
          {role.description || "No description"} &middot; Scope: {role.scope}
          {role._count ? ` · ${role._count.users} user(s)` : ""}
        </p>
      </div>

      {error && <div className="msg-banner error">{error}</div>}
      {success && <div className="msg-banner success">{success}</div>}

      {/* ---- Section 1: Permissions ---- */}
      <div className="section">
        <div className="section-header">
          <h2>Permissions</h2>
          <span className="count-badge">{rolePermissionIds.size} selected</span>
        </div>
        <p className="section-desc">Toggle which actions this role can perform.</p>

        <div className="perm-grid">
          {Object.entries(grouped).map(([domain, perms]) => (
            <div key={domain} className="perm-group">
              <div className="perm-group-title">{formatDomain(domain)}</div>
              {perms.map((p) => (
                <label key={p.id} className="perm-item">
                  <input
                    type="checkbox"
                    checked={rolePermissionIds.has(p.id)}
                    onChange={() => togglePermission(p.id)}
                  />
                  <span className="perm-key">{p.key}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---- Section 2: Data Scope (OBAC) ---- */}
      <div className="section">
        <div className="section-header">
          <h2>Data Scope</h2>
        </div>
        <p className="section-desc">
          Control which records users with this role can see. &quot;Own Only&quot; restricts to records the user owns. &quot;All&quot; shows everything.
        </p>

        <div className="scope-grid">
          {SCOPE_RESOURCES.map((r) => (
            <div key={r.key} className="scope-row">
              <div className="scope-label">{r.label}</div>
              <div className="scope-options">
                {ACCESS_SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`scope-btn ${(roleScopes[r.key] || "NONE") === opt.value ? "active" : ""}`}
                    onClick={() => setScope(r.key, opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Save bar ---- */}
      <div className="save-bar">
        <button className="btn-cancel" onClick={() => router.push("/admin/roles")}>Cancel</button>
        <button className="btn-save" onClick={saveAll} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <style jsx>{`
        .role-edit-container { padding: 24px 40px 80px; max-width: 960px; margin: 0 auto; }
        .page-header { margin-bottom: 24px; }
        .back-link { font-size: 13px; color: rgba(255,255,255,0.5); text-decoration: none; display: inline-block; margin-bottom: 12px; }
        .back-link:hover { color: #3b82f6; }
        h1 { font-size: 26px; font-weight: 600; color: #fff; margin: 0 0 6px; }
        .subtitle { font-size: 13px; color: rgba(255,255,255,0.45); margin: 0; }

        .msg-banner { padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; border: 1px solid; }
        .msg-banner.error { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.25); color: #ef4444; }
        .msg-banner.success { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.25); color: #22c55e; }

        .section { margin-bottom: 32px; padding: 24px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
        .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .section-header h2 { font-size: 18px; font-weight: 600; color: #fff; margin: 0; }
        .count-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; background: rgba(59,130,246,0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); }
        .section-desc { font-size: 13px; color: rgba(255,255,255,0.45); margin: 0 0 20px; }

        .perm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        .perm-group { display: flex; flex-direction: column; gap: 8px; }
        .perm-group-title { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.55); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; }
        .perm-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.8); cursor: pointer; padding: 3px 0; }
        .perm-item input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #3b82f6; }
        .perm-key { font-family: monospace; font-size: 12px; }

        .scope-grid { display: flex; flex-direction: column; gap: 14px; }
        .scope-row { display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; }
        .scope-label { width: 140px; font-size: 14px; font-weight: 600; color: #fff; }
        .scope-options { display: flex; gap: 6px; flex-wrap: wrap; }
        .scope-btn { padding: 6px 14px; font-size: 12px; font-weight: 500; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.6); }
        .scope-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); }
        .scope-btn.active { background: rgba(59,130,246,0.15); color: #60a5fa; border-color: rgba(59,130,246,0.4); font-weight: 600; }

        .save-bar { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 0; border-top: 1px solid rgba(255,255,255,0.06); position: sticky; bottom: 0; background: #0b0e13; }
        .btn-cancel { padding: 10px 20px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer; }
        .btn-cancel:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .btn-save { padding: 10px 24px; font-size: 14px; font-weight: 600; color: #fff; background: #3b82f6; border: none; border-radius: 8px; cursor: pointer; }
        .btn-save:hover { background: #2563eb; }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
