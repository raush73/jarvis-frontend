"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface ApiCapability {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  categories: { id: string; name: string; isActive: boolean }[];
}

interface ApiCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface CapabilityRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  categoryIds: string[];
}

interface CategoryGroup {
  id: string;
  name: string;
  isActive: boolean;
  capabilities: CapabilityRow[];
}

interface CatModalState {
  open: boolean;
  mode: "create" | "edit";
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
}

interface CapModalState {
  open: boolean;
  mode: "create" | "edit";
  id?: string;
  name: string;
  description: string;
  isActive: boolean;
  categoryIds: string[];
}

const EMPTY_CAT_MODAL: CatModalState = { open: false, mode: "create", name: "", description: "", isActive: true };
const EMPTY_CAP_MODAL: CapModalState = { open: false, mode: "create", name: "", description: "", isActive: true, categoryIds: [] };
const UNCATEGORIZED_ID = "__uncategorized__";

function buildGroups(categories: ApiCategory[], capabilities: ApiCapability[]): CategoryGroup[] {
  const byId = new Map<string, CategoryGroup>();
  for (const cat of categories) {
    byId.set(cat.id, { id: cat.id, name: cat.name, isActive: cat.isActive, capabilities: [] });
  }

  const uncategorized: CapabilityRow[] = [];

  for (const cap of capabilities) {
    const row: CapabilityRow = {
      id: cap.id,
      name: cap.name,
      description: cap.description,
      isActive: cap.isActive,
      categoryIds: (cap.categories ?? []).map((c) => c.id),
    };
    if (!cap.categories || cap.categories.length === 0) {
      uncategorized.push(row);
      continue;
    }
    for (const cat of cap.categories) {
      if (!byId.has(cat.id)) {
        byId.set(cat.id, { id: cat.id, name: cat.name, isActive: cat.isActive, capabilities: [] });
      }
      byId.get(cat.id)!.capabilities.push(row);
    }
  }

  const sorted = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (uncategorized.length > 0) {
    sorted.push({
      id: UNCATEGORIZED_ID,
      name: "Uncategorized",
      isActive: true,
      capabilities: uncategorized.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }
  return sorted;
}

function statusStyle(isActive: boolean) {
  return isActive
    ? { bg: "rgba(34,197,94,0.12)", color: "#22c55e", border: "rgba(34,197,94,0.25)" }
    : { bg: "rgba(107,114,128,0.12)", color: "#6b7280", border: "rgba(107,114,128,0.25)" };
}

export default function CapabilitiesPage() {
  const [capabilities, setCapabilities] = useState<ApiCapability[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [catModal, setCatModal] = useState<CatModalState>(EMPTY_CAT_MODAL);
  const [catSaving, setCatSaving] = useState(false);
  const [catSaveError, setCatSaveError] = useState("");

  const [capModal, setCapModal] = useState<CapModalState>(EMPTY_CAP_MODAL);
  const [capSaving, setCapSaving] = useState(false);
  const [capSaveError, setCapSaveError] = useState("");

  const loadData = useCallback(async (preserveExpanded = false) => {
    setLoading(true);
    setError(null);
    try {
      const [caps, cats] = await Promise.all([
        apiFetch<ApiCapability[]>("/capabilities?include=categories"),
        apiFetch<ApiCategory[]>("/capability-categories?activeOnly=false"),
      ]);
      const capsArr = Array.isArray(caps) ? caps : [];
      const catsArr = Array.isArray(cats) ? cats : [];
      setCapabilities(capsArr);
      setCategories(catsArr);
      if (!preserveExpanded) {
        const groups = buildGroups(catsArr, capsArr);
        setExpanded(new Set(groups.map((g) => g.id)));
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load capabilities.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadData(false);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [loadData]);

  const groups = useMemo(() => buildGroups(categories, capabilities), [categories, capabilities]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.map((group) => ({
      ...group,
      capabilities: group.capabilities.filter((cap) => {
        if (statusFilter === "active" && !cap.isActive) return false;
        if (statusFilter === "inactive" && cap.isActive) return false;
        if (q && !cap.name.toLowerCase().includes(q) && !(cap.description ?? "").toLowerCase().includes(q)) return false;
        return true;
      }),
    }));
  }, [groups, statusFilter, search]);

  const totalFiltered = filteredGroups.reduce((s, g) => s + g.capabilities.length, 0);
  const categoriesWithItems = filteredGroups.filter((g) => g.capabilities.length > 0).length;

  const toggleCategory = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Category modal handlers ──
  const openCatCreate = () => {
    setCatSaveError("");
    setCatModal({ open: true, mode: "create", name: "", description: "", isActive: true });
  };
  const openCatEdit = (cat: ApiCategory) => {
    setCatSaveError("");
    setCatModal({ open: true, mode: "edit", id: cat.id, name: cat.name, description: cat.description ?? "", isActive: cat.isActive });
  };
  const closeCatModal = () => setCatModal(EMPTY_CAT_MODAL);
  const handleCatSave = async () => {
    if (!catModal.name.trim()) return;
    setCatSaving(true);
    setCatSaveError("");
    try {
      if (catModal.mode === "create") {
        await apiFetch("/capability-categories", {
          method: "POST",
          body: JSON.stringify({ name: catModal.name.trim(), description: catModal.description.trim() || null }),
        });
      } else {
        await apiFetch(`/capability-categories/${catModal.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: catModal.name.trim(), description: catModal.description.trim() || null, isActive: catModal.isActive }),
        });
      }
      closeCatModal();
      await loadData(true);
    } catch (e: any) {
      setCatSaveError(e?.message ?? "Failed to save category.");
    } finally {
      setCatSaving(false);
    }
  };

  // ── Capability modal handlers ──
  const openCapCreate = () => {
    setCapSaveError("");
    setCapModal({ open: true, mode: "create", name: "", description: "", isActive: true, categoryIds: [] });
  };
  const openCapEdit = (cap: CapabilityRow) => {
    setCapSaveError("");
    setCapModal({ open: true, mode: "edit", id: cap.id, name: cap.name, description: cap.description ?? "", isActive: cap.isActive, categoryIds: [...cap.categoryIds] });
  };
  const closeCapModal = () => setCapModal(EMPTY_CAP_MODAL);
  const toggleCapCategory = (catId: string) => {
    setCapModal((m) => {
      const next = m.categoryIds.includes(catId)
        ? m.categoryIds.filter((id) => id !== catId)
        : [...m.categoryIds, catId];
      return { ...m, categoryIds: next };
    });
  };

  const handleCapSave = async () => {
    if (!capModal.name.trim()) return;
    setCapSaving(true);
    setCapSaveError("");
    try {
      let capId = capModal.id;
      if (capModal.mode === "create") {
        const created = await apiFetch<{ id: string }>("/capabilities", {
          method: "POST",
          body: JSON.stringify({ name: capModal.name.trim(), description: capModal.description.trim() || null }),
        });
        capId = created.id;
      } else {
        await apiFetch(`/capabilities/${capId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: capModal.name.trim(), description: capModal.description.trim() || null, isActive: capModal.isActive }),
        });
      }
      await apiFetch(`/capabilities/${capId}/categories`, {
        method: "PUT",
        body: JSON.stringify({ categoryIds: capModal.categoryIds }),
      });
      closeCapModal();
      await loadData(true);
    } catch (e: any) {
      setCapSaveError(e?.message ?? "Failed to save capability.");
    } finally {
      setCapSaving(false);
    }
  };

  // ── Find full ApiCategory by id (for Edit Category from accordion) ──
  const findCategory = (id: string): ApiCategory | undefined => categories.find((c) => c.id === id);

  return (
    <div className="capabilities-container">
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">← Back to Admin</Link>
          <h1>Capabilities</h1>
          <p className="subtitle">Global dictionary of workforce capabilities organized by category.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-add-secondary" onClick={openCatCreate}>+ Add Category</button>
          <button type="button" className="btn-add-primary" onClick={openCapCreate}>+ Add Capability</button>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="filter-group search-group">
          <label>Search</label>
          <input type="text" placeholder="Search capabilities…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-results">
          {!loading && !error && (
            <>{categoriesWithItems} categor{categoriesWithItems !== 1 ? "ies" : "y"}, {totalFiltered} capabilit{totalFiltered !== 1 ? "ies" : "y"}</>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading capabilities…</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : (
        <div className="categories-section">
          {filteredGroups.map((group) => {
            const isExpanded = expanded.has(group.id);
            const isUncategorized = group.id === UNCATEGORIZED_ID;
            const apiCat = findCategory(group.id);
            return (
              <div key={group.id} className={`category-accordion${isUncategorized ? " uncategorized" : ""}`}>
                <div className="category-header-row">
                  <button type="button" className="category-toggle" onClick={() => toggleCategory(group.id)}>
                    <span className={`chevron ${isExpanded ? "chevron--open" : ""}`}>▶</span>
                    <span className="category-name">{group.name}</span>
                    {!isUncategorized && !group.isActive && (
                      <span className="cat-inactive-badge">Inactive</span>
                    )}
                    <span className="type-count">{group.capabilities.length} capabilit{group.capabilities.length !== 1 ? "ies" : "y"}</span>
                  </button>
                  {!isUncategorized && apiCat && (
                    <button type="button" className="btn-edit-category" onClick={() => openCatEdit(apiCat)}>Edit Category</button>
                  )}
                </div>

                {isExpanded && (
                  <div className="category-body">
                    {group.capabilities.length > 0 ? (
                      <div className="items-list">
                        {group.capabilities.map((cap) => {
                          const st = statusStyle(cap.isActive);
                          return (
                            <div key={cap.id} className="item-row">
                              <button type="button" className="item-link-btn" onClick={() => openCapEdit(cap)}>
                                <div className="item-left">
                                  <span className="item-name">{cap.name}</span>
                                  {cap.description && <span className="item-desc">{cap.description}</span>}
                                </div>
                              </button>
                              <span className="status-badge" style={{ backgroundColor: st.bg, color: st.color, borderColor: st.border }}>
                                {cap.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty-category">No capabilities in this category</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filteredGroups.every((g) => g.capabilities.length === 0) && (
            <div className="loading-state">
              {capabilities.length === 0
                ? "No capabilities defined yet. Click \"+ Add Capability\" to create one."
                : "No capabilities match the current filters."}
            </div>
          )}
        </div>
      )}

      {/* ── Category Create / Edit Modal ── */}
      {catModal.open && (
        <div className="modal-overlay" onClick={closeCatModal}>
          <div className="modal modal--small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{catModal.mode === "create" ? "Add Category" : "Edit Category"}</h2>
              <button className="modal-close" onClick={closeCatModal}>&times;</button>
            </div>
            <div className="modal-body">
              {catSaveError && <div className="form-error">{catSaveError}</div>}
              <div className="form-field">
                <label>Name <span className="required">*</span></label>
                <input type="text" value={catModal.name} onChange={(e) => setCatModal((m) => ({ ...m, name: e.target.value }))} placeholder="Category name" disabled={catSaving} />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea value={catModal.description} onChange={(e) => setCatModal((m) => ({ ...m, description: e.target.value }))} placeholder="Optional description" rows={3} disabled={catSaving} />
              </div>
              {catModal.mode === "edit" && (
                <div className="form-field">
                  <label>Active</label>
                  <div className="toggle-group">
                    <button type="button" className={`toggle-btn${catModal.isActive ? " active" : ""}`} onClick={() => setCatModal((m) => ({ ...m, isActive: true }))} disabled={catSaving}>Active</button>
                    <button type="button" className={`toggle-btn${!catModal.isActive ? " active" : ""}`} onClick={() => setCatModal((m) => ({ ...m, isActive: false }))} disabled={catSaving}>Inactive</button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={closeCatModal} disabled={catSaving}>Cancel</button>
              <button type="button" className="btn-save" onClick={handleCatSave} disabled={!catModal.name.trim() || catSaving}>
                {catSaving ? "Saving\u2026" : catModal.mode === "create" ? "Create Category" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Capability Create / Edit Modal ── */}
      {capModal.open && (
        <div className="modal-overlay" onClick={closeCapModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{capModal.mode === "create" ? "Add Capability" : "Edit Capability"}</h2>
              <button className="modal-close" onClick={closeCapModal}>&times;</button>
            </div>
            <div className="modal-body">
              {capSaveError && <div className="form-error">{capSaveError}</div>}
              <div className="form-field">
                <label>Name <span className="required">*</span></label>
                <input type="text" value={capModal.name} onChange={(e) => setCapModal((m) => ({ ...m, name: e.target.value }))} placeholder="Capability name" disabled={capSaving} />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea value={capModal.description} onChange={(e) => setCapModal((m) => ({ ...m, description: e.target.value }))} placeholder="Optional description" rows={3} disabled={capSaving} />
              </div>
              {capModal.mode === "edit" && (
                <div className="form-field">
                  <label>Active</label>
                  <div className="toggle-group">
                    <button type="button" className={`toggle-btn${capModal.isActive ? " active" : ""}`} onClick={() => setCapModal((m) => ({ ...m, isActive: true }))} disabled={capSaving}>Active</button>
                    <button type="button" className={`toggle-btn${!capModal.isActive ? " active" : ""}`} onClick={() => setCapModal((m) => ({ ...m, isActive: false }))} disabled={capSaving}>Inactive</button>
                  </div>
                </div>
              )}
              <div className="form-field">
                <label>Categories</label>
                <div className="cat-checklist">
                  {categories.length === 0 && <div className="cat-empty">No categories defined yet.</div>}
                  {categories.map((cat) => (
                    <label key={cat.id} className="cat-check-row">
                      <input
                        type="checkbox"
                        checked={capModal.categoryIds.includes(cat.id)}
                        onChange={() => toggleCapCategory(cat.id)}
                        disabled={capSaving}
                      />
                      <span className="cat-check-name">{cat.name}</span>
                      {!cat.isActive && <span className="cat-check-inactive">Inactive</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={closeCapModal} disabled={capSaving}>Cancel</button>
              <button type="button" className="btn-save" onClick={handleCapSave} disabled={!capModal.name.trim() || capSaving}>
                {capSaving ? "Saving\u2026" : capModal.mode === "create" ? "Create Capability" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .capabilities-container {
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
        .back-link:hover { color: #3b82f6; }
        h1 { font-size: 28px; font-weight: 600; color: #fff; margin: 0 0 8px; letter-spacing: -0.5px; }
        .subtitle { font-size: 14px; color: rgba(255, 255, 255, 0.55); margin: 0; max-width: 620px; line-height: 1.5; }

        .header-actions { padding-top: 28px; display: flex; gap: 10px; }
        .btn-add-primary {
          padding: 10px 20px; font-size: 14px; font-weight: 600; color: #fff;
          background: #3b82f6; border: none; border-radius: 8px; cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-add-primary:hover { background: #2563eb; }
        .btn-add-secondary {
          padding: 10px 20px; font-size: 14px; font-weight: 600;
          color: rgba(255, 255, 255, 0.85); background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 8px; cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-add-secondary:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.25); }

        .filters-section {
          display: flex; align-items: flex-end; gap: 16px; margin-bottom: 20px; padding: 20px;
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px;
        }
        .filter-group { display: flex; flex-direction: column; gap: 6px; }
        .filter-group label {
          font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase; letter-spacing: 0.4px;
        }
        .filter-group select, .filter-group input {
          padding: 8px 12px; background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; font-size: 13px; color: #fff; min-width: 140px;
        }
        .filter-group select:focus, .filter-group input:focus { outline: none; border-color: #3b82f6; }
        .filter-group select option { background: #1a1d24; color: #fff; }
        .filter-group input::placeholder { color: rgba(255, 255, 255, 0.35); }
        .search-group input { min-width: 240px; }
        .filter-results { margin-left: auto; font-size: 13px; color: rgba(255, 255, 255, 0.5); padding-bottom: 8px; }

        .loading-state, .error-state {
          text-align: center; padding: 32px 16px; border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06); background: rgba(255, 255, 255, 0.02); font-size: 14px;
        }
        .loading-state { color: rgba(255, 255, 255, 0.65); }
        .error-state { color: #fca5a5; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); }

        .categories-section { display: flex; flex-direction: column; gap: 8px; }
        .category-accordion {
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px; overflow: hidden;
        }
        .category-accordion.uncategorized { border-color: rgba(234, 179, 8, 0.2); }
        .category-header-row { display: flex; align-items: center; background: rgba(255, 255, 255, 0.03); }
        .uncategorized .category-header-row { background: rgba(234, 179, 8, 0.04); }
        .category-toggle {
          flex: 1; display: flex; align-items: center; gap: 12px; padding: 16px 20px;
          background: none; border: none; cursor: pointer; text-align: left;
        }
        .chevron {
          font-size: 10px; color: rgba(255, 255, 255, 0.4); transition: transform 0.2s ease;
          display: inline-block; flex-shrink: 0;
        }
        .chevron--open { transform: rotate(90deg); }
        .category-name { font-size: 15px; font-weight: 600; color: #fff; }
        .uncategorized .category-name { color: #eab308; }
        .cat-inactive-badge {
          font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
          background: rgba(107, 114, 128, 0.12); color: #6b7280;
          border: 1px solid rgba(107, 114, 128, 0.25);
        }
        .type-count { font-size: 12px; color: rgba(255, 255, 255, 0.4); margin-left: auto; }
        .btn-edit-category {
          flex-shrink: 0; padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px;
          cursor: pointer; color: rgba(255, 255, 255, 0.85); background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14); margin-right: 16px; transition: all 0.15s ease;
        }
        .btn-edit-category:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.25); }
        .category-body { padding: 16px 20px 20px; border-top: 1px solid rgba(255, 255, 255, 0.06); }
        .items-list { display: flex; flex-direction: column; }
        .item-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 12px; background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .item-row:last-child { border-bottom: none; }
        .item-link-btn {
          flex: 1; min-width: 0; border: none; background: transparent; padding: 0; margin: 0;
          cursor: pointer; text-align: left;
        }
        .item-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .item-name {
          font-size: 13px; font-weight: 500; color: #fff;
          text-decoration: underline; text-decoration-color: rgba(255, 255, 255, 0.25);
          text-underline-offset: 3px;
        }
        .item-desc {
          font-size: 12px; color: rgba(255, 255, 255, 0.45); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; max-width: 600px;
        }
        .status-badge {
          display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600;
          border-radius: 4px; border: 1px solid; flex-shrink: 0;
        }
        .empty-category { text-align: center; color: rgba(255, 255, 255, 0.4); padding: 24px 16px; font-size: 13px; }

        /* ── Modals ── */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 1000;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .modal {
          width: 580px; max-width: 100%; max-height: 90vh; background: #12151b;
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px;
          display: flex; flex-direction: column; animation: fadeIn 0.2s ease;
        }
        .modal--small { width: 480px; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .modal-header h2 { font-size: 18px; font-weight: 600; color: #fff; margin: 0; }
        .modal-close {
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          font-size: 24px; color: rgba(255, 255, 255, 0.5); background: transparent;
          border: none; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;
        }
        .modal-close:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
        .modal-body { flex: 1; overflow-y: auto; padding: 24px; }
        .form-field { margin-bottom: 20px; }
        .form-field label { display: block; font-size: 12px; font-weight: 500; color: rgba(255, 255, 255, 0.7); margin-bottom: 8px; }
        .required { color: #ef4444; }
        .form-field input, .form-field textarea {
          width: 100%; padding: 10px 12px; background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; font-size: 14px; color: #fff;
        }
        .form-field input:focus, .form-field textarea:focus { outline: none; border-color: #3b82f6; }
        .form-field input::placeholder, .form-field textarea::placeholder { color: rgba(255, 255, 255, 0.3); }
        .form-field textarea { resize: vertical; min-height: 60px; }
        .form-field input:disabled, .form-field textarea:disabled { opacity: 0.6; }
        .form-error {
          padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.28);
          background: rgba(239, 68, 68, 0.09); color: #fecaca; font-size: 12px; margin-bottom: 16px;
        }
        .toggle-group {
          display: flex; gap: 0; background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; overflow: hidden;
        }
        .toggle-btn {
          flex: 1; padding: 10px 16px; font-size: 13px; font-weight: 500;
          color: rgba(255, 255, 255, 0.5); background: transparent;
          border: none; cursor: pointer; transition: all 0.15s ease;
        }
        .toggle-btn:first-child { border-right: 1px solid rgba(255, 255, 255, 0.1); }
        .toggle-btn:hover { color: rgba(255, 255, 255, 0.8); }
        .toggle-btn.active { color: #fff; background: rgba(34, 197, 94, 0.15); }
        .toggle-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .cat-checklist {
          max-height: 200px; overflow-y: auto; padding: 8px 0;
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
        }
        .cat-empty { padding: 12px 16px; font-size: 13px; color: rgba(255, 255, 255, 0.4); font-style: italic; }
        .cat-check-row {
          display: flex; align-items: center; gap: 10px; padding: 6px 14px;
          font-size: 13px; color: rgba(255, 255, 255, 0.85); cursor: pointer;
          transition: background 0.1s ease;
        }
        .cat-check-row:hover { background: rgba(255, 255, 255, 0.04); }
        .cat-check-row input[type="checkbox"] { accent-color: #3b82f6; cursor: pointer; }
        .cat-check-name { flex: 1; }
        .cat-check-inactive {
          font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 3px;
          background: rgba(107, 114, 128, 0.12); color: #6b7280;
          border: 1px solid rgba(107, 114, 128, 0.25);
        }

        .modal-footer {
          display: flex; justify-content: flex-end; gap: 12px;
          padding: 16px 24px; border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .btn-cancel {
          padding: 10px 20px; font-size: 14px; font-weight: 500;
          color: rgba(255, 255, 255, 0.7); background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;
          cursor: pointer; transition: all 0.15s ease;
        }
        .btn-cancel:hover { color: #fff; background: rgba(255, 255, 255, 0.1); }
        .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-save {
          padding: 10px 20px; font-size: 14px; font-weight: 600; color: #fff;
          background: #3b82f6; border: none; border-radius: 8px; cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-save:hover:not(:disabled) { background: #2563eb; }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
