"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type PpeType = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ModalMode = "create" | "edit";

export default function PpeCatalogPage() {
  const [ppeTypes, setPpeTypes] = useState<PpeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingItem, setEditingItem] = useState<PpeType | null>(null);

  const [formName, setFormName] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchPpeTypes = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await apiFetch<PpeType[]>("/ppe-types");
      setPpeTypes(data);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : "Failed to load PPE types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPpeTypes();
  }, [fetchPpeTypes]);

  const openCreate = () => {
    setModalMode("create");
    setEditingItem(null);
    setFormName("");
    setFormIsActive(true);
    setModalError(null);
    setModalOpen(true);
  };

  const openEdit = (item: PpeType) => {
    setModalMode("edit");
    setEditingItem(item);
    setFormName(item.name);
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

    setSaving(true);
    setModalError(null);

    try {
      if (modalMode === "create") {
        await apiFetch("/ppe-types", {
          method: "POST",
          body: JSON.stringify({ name: trimmed }),
        });
      } else if (editingItem) {
        await apiFetch(`/ppe-types/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: trimmed, isActive: formIsActive }),
        });
      }

      closeModal();
      await fetchPpeTypes();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ppe-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>PPE Catalog</h1>
          <p className="subtitle">
            Manage personal protective equipment types used across Jarvis Prime.
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-add" onClick={openCreate}>
            + Create PPE
          </button>
        </div>
      </div>

      {/* Error */}
      {fetchError && (
        <div className="fetch-error">{fetchError}</div>
      )}

      {/* Table */}
      <div className="table-section">
        <div className="table-wrap">
          <table className="ppe-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="empty-row">Loading…</td>
                </tr>
              ) : ppeTypes.length === 0 && !fetchError ? (
                <tr>
                  <td colSpan={3} className="empty-row">No PPE types found</td>
                </tr>
              ) : (
                ppeTypes.map((item) => (
                  <tr key={item.id}>
                    <td className="cell-name">{item.name}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === "create" ? "Create PPE Type" : "Edit PPE Type"}</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <div className="modal-body">
              {modalError && (
                <div className="modal-error">{modalError}</div>
              )}

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
                {saving
                  ? "Saving…"
                  : modalMode === "create"
                    ? "Create"
                    : "Save Changes"}
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

        .fetch-error {
          padding: 12px 16px;
          margin-bottom: 20px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          font-size: 13px;
          color: #ef4444;
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

        .ppe-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ppe-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .ppe-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ppe-table td {
          padding: 14px 16px;
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
