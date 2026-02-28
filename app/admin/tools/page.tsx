"use client";

import { useState } from "react";
import Link from "next/link";

// Types
type ToolStatus = "Active" | "Inactive";

type Tool = {
  id: string;
  name: string;
  flags: {
    calibrationRequired: boolean;
    heavyEquipment: boolean;
    precisionTool: boolean;
  };
  status: ToolStatus;
};

// Mock data
const MOCK_TOOLS: Tool[] = [
  {
    id: "TOOL-001",
    name: "Pipe Wrench 24\"",
    flags: { calibrationRequired: false, heavyEquipment: false, precisionTool: false },
    status: "Active",
  },
  {
    id: "TOOL-002",
    name: "Digital Multimeter",
    flags: { calibrationRequired: true, heavyEquipment: false, precisionTool: true },
    status: "Active",
  },
  {
    id: "TOOL-003",
    name: "Hydraulic Press",
    flags: { calibrationRequired: true, heavyEquipment: true, precisionTool: false },
    status: "Active",
  },
  {
    id: "TOOL-004",
    name: "Torque Wrench",
    flags: { calibrationRequired: true, heavyEquipment: false, precisionTool: true },
    status: "Active",
  },
  {
    id: "TOOL-005",
    name: "Hammer Drill",
    flags: { calibrationRequired: false, heavyEquipment: false, precisionTool: false },
    status: "Inactive",
  },
  {
    id: "TOOL-006",
    name: "Laser Level",
    flags: { calibrationRequired: true, heavyEquipment: false, precisionTool: true },
    status: "Active",
  },
  {
    id: "TOOL-007",
    name: "Forklift",
    flags: { calibrationRequired: false, heavyEquipment: true, precisionTool: false },
    status: "Active",
  },
  {
    id: "TOOL-008",
    name: "Oscilloscope",
    flags: { calibrationRequired: true, heavyEquipment: false, precisionTool: true },
    status: "Inactive",
  },
];

export default function ToolCatalogPage() {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter logic
  const filteredTools = MOCK_TOOLS.filter((tool) => {
    if (statusFilter !== "All" && tool.status !== statusFilter) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!tool.name.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  // Status badge style
  const getStatusStyle = (status: ToolStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
  };

  // Flag badge style
  const getFlagStyle = () => {
    return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
  };

  return (
    <div className="tools-container">
      {/* UI Shell Banner */}
      <div className="shell-banner">
        UI shell (mocked) — Internal management view — not visible to field roles.
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Tool Catalog</h1>
          <p className="subtitle">
            Single source of truth for all tools used across Jarvis Prime.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/admin/tools/new" className="btn-add">
            + Add Tool
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
            placeholder="Tool name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-results">
          {filteredTools.length} tool{filteredTools.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Tools Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="tools-table">
            <thead>
              <tr>
                <th>Tool Name</th>
                <th>Flags</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTools.map((tool) => (
                <tr key={tool.id}>
                  <td className="cell-name">{tool.name}</td>
                  <td className="cell-flags">
                    <div className="flags-wrap">
                      {tool.flags.calibrationRequired && (
                        <span
                          className="flag-badge"
                          style={{
                            backgroundColor: getFlagStyle().bg,
                            color: getFlagStyle().color,
                            borderColor: getFlagStyle().border,
                          }}
                          title="Calibration Required"
                        >
                          CAL
                        </span>
                      )}
                      {tool.flags.heavyEquipment && (
                        <span
                          className="flag-badge"
                          style={{
                            backgroundColor: "rgba(245, 158, 11, 0.12)",
                            color: "#f59e0b",
                            borderColor: "rgba(245, 158, 11, 0.25)",
                          }}
                          title="Heavy Equipment"
                        >
                          HEAVY
                        </span>
                      )}
                      {tool.flags.precisionTool && (
                        <span
                          className="flag-badge"
                          style={{
                            backgroundColor: "rgba(168, 85, 247, 0.12)",
                            color: "#a855f7",
                            borderColor: "rgba(168, 85, 247, 0.25)",
                          }}
                          title="Precision Tool"
                        >
                          PREC
                        </span>
                      )}
                      {!tool.flags.calibrationRequired && !tool.flags.heavyEquipment && !tool.flags.precisionTool && (
                        <span className="no-flags">—</span>
                      )}
                    </div>
                  </td>
                  <td className="cell-status">
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusStyle(tool.status).bg,
                        color: getStatusStyle(tool.status).color,
                        borderColor: getStatusStyle(tool.status).border,
                      }}
                    >
                      {tool.status}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <Link href={`/admin/tools/${tool.id}`} className="action-btn">
                      View
                    </Link>
                    <Link href={`/admin/tools/${tool.id}`} className="action-btn">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredTools.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No tools match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .tools-container {
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

        .tools-table {
          width: 100%;
          border-collapse: collapse;
        }

        .tools-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .tools-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .tools-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .tools-table tr:last-child td {
          border-bottom: none;
        }

        .tools-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .cell-name {
          font-weight: 500;
          color: #fff !important;
        }

        .cell-flags {
          min-width: 180px;
        }

        .flags-wrap {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .flag-badge {
          display: inline-block;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .no-flags {
          color: rgba(255, 255, 255, 0.3);
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
          margin-right: 8px;
        }

        .action-btn:last-child {
          margin-right: 0;
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
