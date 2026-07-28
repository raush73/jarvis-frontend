"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type PpeType = {
  id: string;
  name: string;
  isActive: boolean;
  categoryId: string | null;
  sortOrder: number;
};

type PpeCategory = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  itemCount: number;
};

/**
 * A category and the items inside it. `category` is null for the uncategorized bucket, which is
 * supported for edge cases and future additions but is not meant to be the primary experience -
 * see Amendment 1.
 */
type PpeGroup = {
  category: PpeCategory | null;
  items: PpeType[];
};

type ModalMode = "create" | "edit";
type StatusFilter = "All" | "Active Only" | "Inactive Only";

const UNCATEGORIZED_KEY = "__uncategorized__";

export default function PpeCatalogPage() {
  const [ppeTypes, setPpeTypes] = useState<PpeType[]>([]);
  const [categories, setCategories] = useState<PpeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingItem, setEditingItem] = useState<PpeType | null>(null);

  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    try {
      setFetchError(null);
      // Both endpoints return curated order with name as the fallback. Nothing here re-sorts.
      const [categoryData, itemData] = await Promise.all([
        apiFetch<PpeCategory[]>("/ppe-categories?withCounts=true"),
        apiFetch<PpeType[]>("/ppe-types"),
      ]);
      setCategories(categoryData);
      setPpeTypes(itemData);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load the PPE catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  /**
   * Groups items into their category, walking categories in the order the server returned them.
   * The uncategorized bucket always trails. No sorting happens here - display order is
   * server-authoritative.
   */
  const groups = useMemo<PpeGroup[]>(() => {
    const query = searchQuery.trim().toLowerCase();

    const matches = (item: PpeType) => {
      if (statusFilter === "Active Only" && !item.isActive) return false;
      if (statusFilter === "Inactive Only" && item.isActive) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query);
    };

    const visible = ppeTypes.filter(matches);
    const byCategory = new Map<string, PpeType[]>();
    for (const item of visible) {
      const key = item.categoryId ?? UNCATEGORIZED_KEY;
      const bucket = byCategory.get(key);
      if (bucket) bucket.push(item);
      else byCategory.set(key, [item]);
    }

    const result: PpeGroup[] = categories.map((category) => ({
      category,
      items: byCategory.get(category.id) ?? [],
    }));

    const orphans = byCategory.get(UNCATEGORIZED_KEY) ?? [];
    if (orphans.length > 0) {
      result.push({ category: null, items: orphans });
    }

    return result;
  }, [categories, ppeTypes, searchQuery, statusFilter]);

  const unclassifiedCount = useMemo(
    () => ppeTypes.filter((item) => !item.categoryId).length,
    [ppeTypes],
  );

  const visibleCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openCreate = () => {
    setModalMode("create");
    setEditingItem(null);
    setFormName("");
    setFormCategoryId("");
    setFormSortOrder("");
    setFormIsActive(true);
    setModalError(null);
    setModalOpen(true);
  };

  const openEdit = (item: PpeType) => {
    setModalMode("edit");
    setEditingItem(item);
    setFormName(item.name);
    setFormCategoryId(item.categoryId ?? "");
    setFormSortOrder(item.sortOrder ? String(item.sortOrder) : "");
    setFormIsActive(item.isActive);
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTimeout(() => {
      setEditingItem(null);
      setModalError(null);
    }, 200);
  };

  const handleSubmit = async () => {
    const trimmed = formName.trim();
    if (!trimmed) {
      setModalError("Name is required.");
      return;
    }

    const parsedOrder = formSortOrder.trim() === "" ? undefined : Number(formSortOrder);
    if (parsedOrder !== undefined && (!Number.isInteger(parsedOrder) || parsedOrder < 0)) {
      setModalError("Display order must be a whole number of 0 or more.");
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      if (modalMode === "create") {
        await apiFetch("/ppe-types", {
          method: "POST",
          body: JSON.stringify({
            name: trimmed,
            categoryId: formCategoryId || undefined,
            sortOrder: parsedOrder,
          }),
        });
      } else if (editingItem) {
        await apiFetch(`/ppe-types/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmed,
            isActive: formIsActive,
            // Explicit null returns the item to the uncategorized bucket.
            categoryId: formCategoryId || null,
            sortOrder: parsedOrder,
          }),
        });
      }

      closeModal();
      await loadCatalog();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ppe-container">
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>PPE Catalog</h1>
          <p className="subtitle">
            Personal protective equipment used across Jarvis Prime, grouped by protective function.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/admin/ppe/categories" className="btn-secondary">
            Manage Categories
          </Link>
          <button className="btn-add" onClick={openCreate}>
            + Create PPE
          </button>
        </div>
      </div>

      {fetchError && <div className="fetch-error">{fetchError}</div>}

      {!loading && unclassifiedCount > 0 && (
        <div className="classification-notice">
          <strong>{unclassifiedCount}</strong> item{unclassifiedCount !== 1 ? "s" : ""} not yet
          assigned to a category. A fully classified catalog is a release requirement.
        </div>
      )}

      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="statusFilter">Status</label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
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
            placeholder="PPE name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-results">
          {visibleCount} item{visibleCount !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <div className="state-panel">Loading…</div>
      ) : groups.every((group) => group.items.length === 0) ? (
        <div className="state-panel">No PPE matches the current filters.</div>
      ) : (
        <div className="groups-section">
          {groups.map((group) => {
            const key = group.category?.id ?? UNCATEGORIZED_KEY;
            const isCollapsed = collapsed.has(key);
            const label = group.category?.name ?? "Uncategorized";
            const isInactiveCategory = group.category ? !group.category.isActive : false;

            // An empty category stays visible so an administrator can see where to classify.
            return (
              <div key={key} className="group-accordion">
                <button
                  type="button"
                  className="group-header"
                  onClick={() => toggleGroup(key)}
                >
                  <span className={`chevron ${isCollapsed ? "" : "chevron--open"}`}>▶</span>
                  <span className="group-name">{label}</span>
                  {isInactiveCategory && <span className="group-flag">Inactive category</span>}
                  {!group.category && group.items.length > 0 && (
                    <span className="group-flag group-flag--warn">Needs classification</span>
                  )}
                  <span className="group-count">
                    {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="group-body">
                    {group.items.length === 0 ? (
                      <div className="group-empty">No items in this category.</div>
                    ) : (
                      <table className="ppe-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Order</th>
                            <th>Active</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => (
                            <tr key={item.id}>
                              <td className="cell-name">{item.name}</td>
                              <td className="cell-order">{item.sortOrder || "—"}</td>
                              <td>
                                <span
                                  className="status-badge"
                                  style={{
                                    backgroundColor: item.isActive
                                      ? "rgba(34, 197, 94, 0.12)"
                                      : "rgba(107, 114, 128, 0.12)",
                                    color: item.isActive ? "#22c55e" : "#6b7280",
                                    borderColor: item.isActive
                                      ? "rgba(34, 197, 94, 0.25)"
                                      : "rgba(107, 114, 128, 0.25)",
                                  }}
                                >
                                  {item.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="cell-actions">
                                <button className="action-btn" onClick={() => openEdit(item)}>
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === "create" ? "Create PPE Type" : "Edit PPE Type"}</h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {modalError && <div className="modal-error">{modalError}</div>}

              <div className="form-field">
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Hard Hat"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-field">
                <label>Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                >
                  <option value="">Uncategorized</option>
                  {categories
                    .filter((category) => category.isActive || category.id === formCategoryId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {category.isActive ? "" : " (inactive)"}
                      </option>
                    ))}
                </select>
                <p className="field-hint">
                  Classify by what the equipment protects against. Where an item could fit two
                  categories, the hazard-specific one wins: welding gloves are Welding Protection,
                  not Hand Protection.
                </p>
              </div>

              <div className="form-field">
                <label>Display Order</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Leave blank for name order"
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(e.target.value)}
                />
                <p className="field-hint">Position within the category. Blank sorts by name.</p>
              </div>

              {modalMode === "edit" && (
                <div className="form-field">
                  <label>Status</label>
                  <div className="toggle-group">
                    <button
                      className={`toggle-btn ${formIsActive ? "active" : ""}`}
                      type="button"
                      onClick={() => setFormIsActive(true)}
                    >
                      Active
                    </button>
                    <button
                      className={`toggle-btn ${!formIsActive ? "active" : ""}`}
                      type="button"
                      onClick={() => setFormIsActive(false)}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : modalMode === "create" ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ppe-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }

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
          max-width: 520px;
          line-height: 1.5;
        }

        .header-actions {
          padding-top: 28px;
          display: flex;
          gap: 10px;
          align-items: center;
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

        .btn-secondary {
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .btn-secondary:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .fetch-error {
          padding: 12px 16px;
          margin-bottom: 20px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          font-size: 13px;
          color: #ef4444;
        }

        .classification-notice {
          padding: 12px 16px;
          margin-bottom: 20px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.25);
          border-radius: 8px;
          font-size: 13px;
          color: #eab308;
        }

        .filters-section {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 20px;
          padding: 16px;
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
          min-width: 160px;
        }

        .search-group {
          flex: 1;
        }

        .search-group input {
          width: 100%;
        }

        .filter-group select:focus,
        .filter-group input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .filter-results {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
          padding-bottom: 9px;
          white-space: nowrap;
        }

        .state-panel {
          padding: 40px;
          text-align: center;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .groups-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .group-accordion {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .group-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: none;
          cursor: pointer;
          text-align: left;
        }

        .group-header:hover {
          background: rgba(59, 130, 246, 0.06);
        }

        .chevron {
          font-size: 9px;
          color: rgba(255, 255, 255, 0.4);
          transition: transform 0.15s ease;
        }

        .chevron--open {
          transform: rotate(90deg);
        }

        .group-name {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .group-flag {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          color: #6b7280;
          background: rgba(107, 114, 128, 0.12);
          border: 1px solid rgba(107, 114, 128, 0.25);
        }

        .group-flag--warn {
          color: #eab308;
          background: rgba(234, 179, 8, 0.1);
          border-color: rgba(234, 179, 8, 0.28);
        }

        .group-count {
          margin-left: auto;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .group-body {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .group-empty {
          padding: 20px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.35);
        }

        .ppe-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ppe-table th {
          padding: 10px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ppe-table td {
          padding: 12px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .ppe-table tr:last-child td {
          border-bottom: none;
        }

        .ppe-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .cell-name {
          font-weight: 500;
          color: #fff !important;
        }

        .cell-order {
          color: rgba(255, 255, 255, 0.45) !important;
          width: 70px;
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
          width: 90px;
        }

        .action-btn {
          padding: 6px 12px;
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

        .modal-error {
          padding: 10px 14px;
          margin-bottom: 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          font-size: 13px;
          color: #ef4444;
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
        .form-field select {
          width: 100%;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          color: #fff;
        }

        .form-field input:focus,
        .form-field select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-field input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .field-hint {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.4);
        }

        .toggle-group {
          display: flex;
          gap: 0;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          overflow: hidden;
        }

        .toggle-btn {
          flex: 1;
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .toggle-btn:first-child {
          border-right: 1px solid rgba(255, 255, 255, 0.1);
        }

        .toggle-btn:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .toggle-btn.active {
          color: #fff;
          background: rgba(34, 197, 94, 0.15);
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

        .btn-save:disabled,
        .btn-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
