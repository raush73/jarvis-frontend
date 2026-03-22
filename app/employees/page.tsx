"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type EmployeeRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  primaryTrade: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function EmployeesPage() {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE_SEEKING" | "NOT_ACTIVE">("all");

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("search", debouncedSearch);

        const data = await apiFetch<EmployeeRow[]>(
          `/employees${params.toString() ? `?${params}` : ""}`
        );
        if (!alive) return;
        setEmployees(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load employees.");
        setEmployees([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [debouncedSearch]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return employees;
    return employees.filter((e) => e.status === statusFilter);
  }, [employees, statusFilter]);

  return (
    <div className="employees-container">
      <div className="employees-header">
        <div className="header-left">
          <h1>Employees</h1>
          <span className="employee-count">
            {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="header-actions">
          <Link href="/candidates" className="btn-add">
            + Add Employee
          </Link>
        </div>
      </div>

      <div className="controls-row">
        <input
          type="text"
          placeholder="Search by name, email, phone, or ID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="control-search"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="control-select"
        >
          <option value="all">All Statuses</option>
          <option value="ACTIVE_SEEKING">Active / Seeking</option>
          <option value="NOT_ACTIVE">Not Active</option>
        </select>
      </div>

      {error && <div className="state-error">{error}</div>}

      {loading ? (
        <div className="state-loading">Loading employees...</div>
      ) : filtered.length === 0 ? (
        <div className="employees-table-wrap">
          <div className="state-empty">No employees found.</div>
        </div>
      ) : (
        <div className="employees-table-wrap">
          <table className="employees-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Primary Trade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => {
                const displayName = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || null;
                return (
                  <tr
                    key={emp.id}
                    onClick={() => router.push(`/employees/${emp.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div className="cell-primary">
                        {displayName || "\u2014"}
                      </div>
                    </td>
                    <td>{emp.email || "\u2014"}</td>
                    <td className="cell-mono">{emp.phone || "\u2014"}</td>
                    <td>{emp.primaryTrade || "\u2014"}</td>
                    <td>
                      <span
                        className={`status-badge ${emp.status === "ACTIVE_SEEKING" ? "status-active" : "status-inactive"}`}
                      >
                        {emp.status === "ACTIVE_SEEKING" ? "Active" : "Not Active"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .employees-container {
          padding: 32px 40px 60px;
          max-width: 1400px;
          margin: 0 auto;
          background: #f8fafc;
          min-height: 100vh;
        }

        .employees-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          align-items: baseline;
          gap: 14px;
        }

        .header-left h1 {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          letter-spacing: -0.3px;
        }

        .employee-count {
          font-size: 14px;
          color: #6b7280;
        }

        .header-actions {
          display: flex;
          align-items: center;
        }

        .btn-add {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 9px 18px;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          background: #2563eb;
          border: none;
          border-radius: 7px;
          cursor: pointer;
          transition: background 0.12s ease;
          text-decoration: none;
        }

        .btn-add:hover {
          background: #1d4ed8;
        }

        .controls-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          margin-bottom: 14px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          flex-wrap: wrap;
        }

        .control-search {
          flex: 1;
          min-width: 180px;
          padding: 9px 12px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          outline: none;
          transition: border-color 0.12s ease;
        }

        .control-search::placeholder {
          color: #9ca3af;
        }

        .control-search:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }

        .control-select {
          padding: 9px 12px;
          font-size: 13px;
          color: #111827;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          cursor: pointer;
          outline: none;
          transition: border-color 0.12s ease;
        }

        .control-select:focus {
          border-color: #2563eb;
        }

        .employees-table-wrap {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .employees-table {
          width: 100%;
          border-collapse: collapse;
        }

        .employees-table thead {
          background: #f1f5f9;
        }

        .employees-table th {
          padding: 11px 20px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #d1d5db;
          white-space: nowrap;
        }

        .employees-table td {
          padding: 14px 20px;
          font-size: 13px;
          color: #111827;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .employees-table tr:last-child td {
          border-bottom: none;
        }

        .employees-table tbody tr:hover td {
          background: #f9fafb;
        }

        .cell-primary {
          font-size: 13px;
          font-weight: 600;
          color: #2563eb;
        }

        .cell-mono {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: #6b7280;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .status-active {
          background: rgba(34, 197, 94, 0.08);
          color: #16a34a;
          border-color: rgba(34, 197, 94, 0.25);
        }

        .status-inactive {
          background: rgba(107, 114, 128, 0.08);
          color: #6b7280;
          border-color: rgba(107, 114, 128, 0.25);
        }

        .state-loading,
        .state-empty {
          padding: 32px 20px;
          text-align: center;
          font-size: 14px;
          color: #6b7280;
        }

        .state-error {
          padding: 14px 18px;
          margin-bottom: 16px;
          border-radius: 8px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
