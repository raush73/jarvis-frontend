"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type SalespersonStatus = "Active" | "Inactive";

export default function SalespeopleListPage() {
  const [salespeople, setSalespeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch("/salespeople");
        if (!alive) return;
        const raw = Array.isArray(data) ? data : [];
        const mapped = raw.map((r: any) => {
          const fullName = `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();
          const lastAct = r.lastActivityAt ?? r.updatedAt ?? null;
          return {
            id: r.id,
            name: fullName || "\u2014",
            email: r.email ?? "\u2014",
            phone: r.phone ?? "",
            status: r.isActive != null ? (r.isActive ? "Active" : "Inactive") : "Inactive",
            defaultCommissionPlan: r.defaultCommissionPlanName ?? "\u2014",
            customersOwned: r.customersOwned ?? 0,
            lastActivity: lastAct
              ? new Date(lastAct).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "\u2014",
          };
        });
        setSalespeople(mapped);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load salespeople.");
        setSalespeople([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filteredSalespeople = salespeople.filter((sp) => {
    if (statusFilter !== "All" && sp.status !== statusFilter) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !(sp.name ?? "").toLowerCase().includes(query) &&
        !(sp.email ?? "").toLowerCase().includes(query) &&
        !(sp.phone ?? "").toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  // Status badge style
  const getStatusStyle = (status: SalespersonStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  return (
    <div className="salespeople-container">
      {/* UI Shell Banner */}
      <div className="shell-banner">
        UI shell (mocked) — Internal management view — not visible to Sales roles.
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Salespeople</h1>
          <p className="subtitle">
            Commercial owners used for Customer defaults and commission attribution.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/admin/salespeople/new" className="btn-add">
            + Create Salesperson
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
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
            placeholder="Name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-results">
          {filteredSalespeople.length} salesperson{filteredSalespeople.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Salespeople Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="salespeople-table">
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Email</th>
                <th>Status</th>
                <th>Default Commission Plan</th>
                <th>Customers Owned</th>
                <th>Last Activity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSalespeople.map((sp) => (
                <tr key={sp.id}>
                  <td className="cell-name">{sp.name}</td>
                  <td className="cell-email">{sp.email}</td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(sp.status).bg,
                        color: getStatusStyle(sp.status).color,
                        borderColor: getStatusStyle(sp.status).border,
                      }}
                    >
                      {sp.status}
                    </span>
                  </td>
                  <td className="cell-plan">{sp.defaultCommissionPlan}</td>
                  <td className="cell-customers">{sp.customersOwned}</td>
                  <td className="cell-activity">{sp.lastActivity}</td>
                  <td className="cell-actions">
                    <Link href={`/admin/salespeople/${sp.id}`} className="action-btn">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredSalespeople.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">
                    No salespeople match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .salespeople-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Shell Banner */
        .shell-banner {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 500;
          color: #f59e0b;
          text-align: center;
          margin-bottom: 24px;
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
          display: inline-block;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
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

        .salespeople-table {
          width: 100%;
          border-collapse: collapse;
        }

        .salespeople-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .salespeople-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .salespeople-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .salespeople-table tr:last-child td {
          border-bottom: none;
        }

        .salespeople-table tbody tr:hover {
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

        .cell-plan {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .cell-customers {
          font-weight: 500;
          color: #3b82f6 !important;
        }

        .cell-activity {
          font-size: 12px !important;
          color: rgba(255, 255, 255, 0.5) !important;
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
          display: inline-block;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 5px;
          text-decoration: none;
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
      `}</style>
    </div>
  );
}
