"use client";

import { useState } from "react";
import Link from "next/link";

type ToolStatus = "Active" | "Inactive";
type CategoryStatus = "Active" | "Inactive";

type Tool = {
  id: string;
  name: string;
  status: ToolStatus;
};

type ToolCategory = {
  id: string;
  name: string;
  status: CategoryStatus;
  tools: Tool[];
};

const MOCK_CATEGORIES: ToolCategory[] = [
  {
    id: "CAT-001",
    name: "Electrical & Diagnostic",
    status: "Active",
    tools: [
      { id: "TOOL-002", name: "Digital Multimeter", status: "Active" },
      { id: "TOOL-008", name: "Oscilloscope", status: "Inactive" },
    ],
  },
  {
    id: "CAT-002",
    name: "Hand Tools",
    status: "Active",
    tools: [
      { id: "TOOL-005", name: "Hammer Drill", status: "Inactive" },
      { id: "TOOL-001", name: "Pipe Wrench 24\"", status: "Active" },
    ],
  },
  {
    id: "CAT-003",
    name: "Heavy Equipment",
    status: "Active",
    tools: [
      { id: "TOOL-007", name: "Forklift", status: "Active" },
      { id: "TOOL-003", name: "Hydraulic Press", status: "Active" },
    ],
  },
  {
    id: "CAT-004",
    name: "Measurement & Precision",
    status: "Active",
    tools: [
      { id: "TOOL-006", name: "Laser Level", status: "Active" },
      { id: "TOOL-004", name: "Torque Wrench", status: "Active" },
    ],
  },
  {
    id: "CAT-005",
    name: "Retired Inventory",
    status: "Inactive",
    tools: [
      { id: "TOOL-009", name: "Analog Caliper", status: "Inactive" },
      { id: "TOOL-010", name: "Manual Winch", status: "Inactive" },
    ],
  },
];

export default function ToolCatalogPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => {
      const initial = new Set<string>();
      MOCK_CATEGORIES.forEach((cat) => {
        if (cat.status === "Active") initial.add(cat.id);
      });
      return initial;
    }
  );

  const toggleCategory = (categoryId: string, categoryStatus: CategoryStatus) => {
    if (categoryStatus === "Inactive") return;
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const filteredCategories = MOCK_CATEGORIES
    .filter((cat) => {
      if (statusFilter === "Active Only" && cat.status !== "Active") return false;
      if (statusFilter === "Inactive Only" && cat.status !== "Inactive") return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const getFilteredTools = (tools: Tool[]) => {
    return tools
      .filter((tool) => {
        if (!searchQuery) return true;
        return tool.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const totalTools = filteredCategories.reduce(
    (sum, cat) => sum + getFilteredTools(cat.tools).length,
    0
  );

  const getStatusStyle = (status: ToolStatus | CategoryStatus) => {
    if (status === "Active") {
      return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
    }
    return { bg: "rgba(107, 114, 128, 0.12)", color: "#6b7280", border: "rgba(107, 114, 128, 0.25)" };
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
            + Add Category
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
            <option value="All">All</option>
            <option value="Active Only">Active Only</option>
            <option value="Inactive Only">Inactive Only</option>
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
          {filteredCategories.length} categor{filteredCategories.length !== 1 ? "ies" : "y"},{" "}
          {totalTools} tool{totalTools !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Category Accordions */}
      <div className="categories-section">
        {filteredCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.id);
          const isInactive = category.status === "Inactive";
          const tools = getFilteredTools(category.tools);

          return (
            <div key={category.id} className="category-accordion">
              <div className={`category-header-row ${isInactive ? "category-header-row--inactive" : ""}`}>
                <button
                  type="button"
                  className="category-toggle"
                  onClick={() => toggleCategory(category.id, category.status)}
                  disabled={isInactive}
                >
                  <span className={`chevron ${isExpanded && !isInactive ? "chevron--open" : ""}`}>
                    ▶
                  </span>
                  <span className="category-name">{category.name}</span>
                  
                  <span className="tool-count">
                    {tools.length} tool{tools.length !== 1 ? "s" : ""}
                  </span>
                </button>
                {!isInactive && (
                  <Link
                    href={`/admin/tools/new?categoryId=${category.id}`}
                    className="btn-add-tool"
                  >
                    + Add Tool
                  </Link>
                )}
              </div>

              {isExpanded && !isInactive && (
                <div className="category-body">
                  {tools.length > 0 ? (
                    <div className="tools-grid">
                      {tools.map((tool) => (
                        <Link
                          key={tool.id}
                          href={`/admin/tools/${tool.id}`}
                          className="tool-cell"
                        >
                          <span className="tool-cell-name">{tool.name}</span>
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
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-category">
                      No tools match your search in this category
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="empty-state">No categories match your filters</div>
        )}
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

        /* Categories */
        .categories-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .category-accordion {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .category-header-row {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          transition: background 0.15s ease;
        }

        .category-header-row:hover:not(.category-header-row--inactive) {
          background: rgba(255, 255, 255, 0.05);
        }

        .category-header-row--inactive {
          opacity: 0.6;
        }

        .category-toggle {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
        }

        .category-header-row--inactive .category-toggle {
          cursor: not-allowed;
        }

        .chevron {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          transition: transform 0.2s ease;
          display: inline-block;
          flex-shrink: 0;
        }

        .chevron--open {
          transform: rotate(90deg);
        }

        .category-name {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
        }

        .tool-count {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          margin-left: auto;
        }

        .btn-add-tool {
          flex-shrink: 0;
          padding: 6px 14px;
          margin-right: 16px;
          font-size: 12px;
          font-weight: 600;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .btn-add-tool:hover {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(59, 130, 246, 0.4);
        }

        .status-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          flex-shrink: 0;
        }

        .category-body {
          padding: 16px 20px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .tools-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        @media (max-width: 1024px) {
          .tools-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .tools-grid {
            grid-template-columns: 1fr;
          }
        }

        .tool-cell {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.15s ease;
          cursor: pointer;
        }

        .tool-cell:hover {
          border-color: rgba(59, 130, 246, 0.3);
          background: rgba(59, 130, 246, 0.04);
        }

        .tool-cell-name {
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .empty-category {
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          padding: 24px 16px;
          font-size: 13px;
        }

        .empty-state {
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          padding: 40px 16px;
          font-size: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }
      `}</style>
    </div>
  );
}



