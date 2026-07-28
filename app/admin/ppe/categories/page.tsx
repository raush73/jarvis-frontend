"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type PpeCategory = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  itemCount: number;
};

type ModalMode = "create" | "edit";

/**
 * C4E: PPE category administration.
 *
 * Deliberately scoped to PPE alone. Categories are never shared across catalogs (Amendment 3), so
 * this screen offers no path to Tool, Certification, or Capability categories - a single category
 * screen parameterized by catalog is exactly the shortcut that erodes separate ownership.
 */
export default function PpeCategoriesPage() {
  const [categories, setCategories] = useState<PpeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editing, setEditing] = useState<PpeCategory | null>(null);
  const [formName, setFormName] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await apiFetch<PpeCategory[]>("/ppe-categories?withCounts=true");
      setCategories(data);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load PPE categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setModalMode("create");
    setEditing(null);
    setFormName("");
    setFormSortOrder(String(categories.length + 1));
    setFormIsActive(true);
    setModalError(null);
    setModalOpen(true);
  };

  const openEdit = (category: PpeCategory) => {
    setModalMode("edit");
    setEditing(category);
    setFormName(category.name);
    setFormSortOrder(String(category.sortOrder));
    setFormIsActive(category.isActive);
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setTimeout(() => {
      setEditing(null);
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
        await apiFetch("/ppe-categories", {
          method: "POST",
          body: JSON.stringify({ name: trimmed, sortOrder: parsedOrder }),
        });
      } else if (editing) {
        await apiFetch(`/ppe-categories/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmed,
            isActive: formIsActive,
            sortOrder: parsedOrder,
          }),
        });
      }

      closeModal();
      await loadCategories();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Moves a category one position and renumbers the whole sequence, so the curated order stays
   * contiguous instead of drifting into ties that fall back to name order.
   */
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;

    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    const payload = reordered.map((category, position) => ({
      id: category.id,
      sortOrder: position + 1,
    }));

    setCategories(reordered.map((category, position) => ({ ...category, sortOrder: position + 1 })));

    try {
      await apiFetch("/ppe-categories/order", {
        method: "PUT",
        body: JSON.stringify({ categories: payload }),
      });
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to save the new order");
    } finally {
      await loadCategories();
    }
  };

  return (
    <div className="cat-container">
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin/ppe" className="back-link">
            ← Back to PPE Catalog
          </Link>
          <h1>PPE Categories</h1>
          <p className="subtitle">
            Classify PPE by what it protects against. Categories are business-standard and global —
            never trade-specific.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={openCreate}>
            + Create Category
          </button>
        </div>
      </div>

      {fetchError && <div className="fetch-error">{fetchError}</div>}

      <div className="table-section">
        <table className="cat-table">
          <thead>
            <tr>
              <th className="col-order">Order</th>
              <th>Name</th>
              <th className="col-items">Items</th>
              <th className="col-status">Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  Loading…
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">
                  No PPE categories yet.
                </td>
              </tr>
            ) : (
              categories.map((category, index) => (
                <tr key={category.id}>
                  <td className="cell-order">
                    <div className="order-controls">
                      <button
                        type="button"
                        className="order-btn"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${category.name} up`}
                      >
                        ↑
                      </button>
                      <span className="order-value">{category.sortOrder}</span>
                      <button
                        type="button"
                        className="order-btn"
                        onClick={() => move(index, 1)}
                        disabled={index === categories.length - 1}
                        aria-label={`Move ${category.name} down`}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="cell-name">{category.name}</td>
                  <td className="cell-items">{category.itemCount}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: category.isActive
                          ? "rgba(34, 197, 94, 0.12)"
                          : "rgba(107, 114, 128, 0.12)",
                        color: category.isActive ? "#22c55e" : "#6b7280",
                        borderColor: category.isActive
                          ? "rgba(34, 197, 94, 0.25)"
                          : "rgba(107, 114, 128, 0.25)",
                      }}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button className="action-btn" onClick={() => openEdit(category)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === "create" ? "Create PPE Category" : "Edit PPE Category"}</h2>
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
                  placeholder="e.g., Head Protection"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                />
                <p className="field-hint">
                  Name the protective function, not the trade. &ldquo;Head Protection&rdquo;, never
                  &ldquo;Millwright PPE&rdquo;.
                </p>
              </div>

              <div className="form-field">
                <label>Display Order</label>
                <input
                  type="number"
                  min={0}
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(e.target.value)}
                />
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
                  {!formIsActive && editing && editing.itemCount > 0 && (
                    <p className="field-warning">
                      {editing.itemCount} item{editing.itemCount !== 1 ? "s" : ""} will stay active
                      and move to Uncategorized for display. Deactivating a category never
                      deactivates its equipment.
                    </p>
                  )}
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
        .cat-container {
          padding: 24px 40px 60px;
          max-width: 1000px;
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
          max-width: 560px;
          line-height: 1.5;
        }

        .header-actions {
          padding-top: 28px;
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
          white-space: nowrap;
        }

        .btn-add:hover {
          background: #2563eb;
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

        .table-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .cat-table {
          width: 100%;
          border-collapse: collapse;
        }

        .cat-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .cat-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .cat-table td {
          padding: 12px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .cat-table tr:last-child td {
          border-bottom: none;
        }

        .cat-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .col-order {
          width: 120px;
        }

        .col-items,
        .col-status,
        .col-actions {
          width: 100px;
        }

        .order-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .order-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .order-btn:hover:not(:disabled) {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .order-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .order-value {
          min-width: 18px;
          text-align: center;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
        }

        .cell-name {
          font-weight: 500;
          color: #fff !important;
        }

        .cell-items {
          color: rgba(255, 255, 255, 0.5) !important;
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

        .empty-row {
          text-align: center;
          color: rgba(255, 255, 255, 0.4) !important;
          padding: 32px 16px !important;
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

        .form-field input {
          width: 100%;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          color: #fff;
        }

        .form-field input:focus {
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

        .field-warning {
          margin: 10px 0 0;
          padding: 10px 12px;
          font-size: 12px;
          line-height: 1.5;
          color: #eab308;
          background: rgba(234, 179, 8, 0.08);
          border: 1px solid rgba(234, 179, 8, 0.25);
          border-radius: 6px;
        }

        .toggle-group {
          display: flex;
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
