"use client";

import { useEffect, useState } from "react";
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

export default function ToolCatalogPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<ToolCategory[]>([]);


  
  const [refreshKey, setRefreshKey] = useState(0);
useEffect(() => {
    async function load() {
      const token = window.localStorage.getItem("jp_accessToken");
      if (!token) return;

      const [catsRes, toolsRes] = await Promise.all([
        fetch("/api/tool-categories", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/tools", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const cats = await catsRes.json();
      const tools = await toolsRes.json();

      const catNameById: Record<string, string> = {};
      const catActiveById: Record<string, boolean> = {};

      (cats || []).forEach((c: any) => {
        catNameById[c.id] = c.name;
        catActiveById[c.id] = !!c.isActive;
      });

      const grouped: Record<string, ToolCategory> = {};

      (tools || []).forEach((t: any) => {
        const catId = t.categoryId;

        if (!grouped[catId]) {
          grouped[catId] = {
            id: catId,
            name: catNameById[catId] ?? "UNMAPPED CATEGORY",
            status: catActiveById[catId] ? "Active" : "Inactive",
            tools: [],
          };
        }

        grouped[catId].tools.push({
          id: t.id,
          name: t.name,
          status: t.isActive ? "Active" : "Inactive",
        });
      });

      const nextCats = Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
      setCategories(nextCats);

      const initial = new Set<string>();
      nextCats.forEach((cat) => {
        if (cat.status === "Active") initial.add(cat.id);
      });
      setExpandedCategories(initial);
    }

    load();
  }, [refreshKey]);

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

  
  async function toggleToolActive(toolId: string, nextIsActive: boolean) {
    const token = window.localStorage.getItem("jp_accessToken");
    if (!token) return;

    await fetch(`/api/tools/${toolId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: nextIsActive }),
      cache: "no-store",
    });

    setRefreshKey((k) => k + 1);
  }
const getFilteredTools = (tools: Tool[]) => {
    return tools
      .filter((tool) => {
        if (statusFilter === "Active Only" && tool.status !== "Active") return false;
        if (statusFilter === "Inactive Only" && tool.status !== "Inactive") return false;
        if (!searchQuery) return true;
        return tool.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      tools: getFilteredTools(cat.tools),
    }))
    .filter((cat) => cat.tools.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalTools = filteredCategories.reduce((sum, cat) => sum + cat.tools.length, 0);

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
                          <span className="status-badge" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleToolActive(tool.id, tool.status !== "Active"); }} style={{ cursor: "pointer",
                              backgroundColor: getStatusStyle(tool.status).bg,
                              color: getStatusStyle(tool.status).color,
                              borderColor: getStatusStyle(tool.status).border,
                            }}>{tool.status}</span>
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









