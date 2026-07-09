"use client";

import { useEffect, useState } from "react";
import {
  Position,
  PositionInput,
  createPosition,
  updatePosition,
} from "@/lib/careers/positionsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { useDialogA11y } from "./useDialogA11y";

/**
 * Jarvis Careers - Create / Edit Position dialog (Industrial Light V1).
 * Reuses the standard Jarvis centered-modal form pattern.
 */
export function PositionFormModal({
  open,
  mode,
  position,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  position?: Position | null;
  onClose: () => void;
  onSaved: (saved: Position) => void;
}) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && position) {
      setTitle(position.title ?? "");
      setDepartment(position.department ?? "");
      setDescription(position.description ?? "");
      setIsActive(position.isActive);
    } else {
      setTitle("");
      setDepartment("");
      setDescription("");
      setIsActive(true);
    }
    setError(null);
  }, [open, mode, position]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const canSave = title.trim().length > 0 && !saving;

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: PositionInput = {
      title: title.trim(),
      department: department.trim() || undefined,
      description: description.trim() || undefined,
      isActive,
    };
    try {
      const saved =
        mode === "create"
          ? await createPosition(input)
          : await updatePosition(position!.id, input);
      onSaved(saved);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save position."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pf-overlay" onClick={saving ? undefined : onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="pf-modal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "New Position" : "Edit Position"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>{mode === "create" ? "New Position" : "Edit Position"}</h3>
          <button
            type="button"
            className="pf-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="pf-body">
          {error ? <div className="pf-error">{error}</div> : null}

          <label className="pf-field">
            <span className="pf-label">
              Title <span className="pf-req">*</span>
            </span>
            <input
              className="pf-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Staff Accountant"
              data-autofocus
            />
          </label>

          <label className="pf-field">
            <span className="pf-label">Department</span>
            <input
              className="pf-input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              maxLength={200}
              placeholder="e.g. Finance"
            />
          </label>

          <label className="pf-field">
            <span className="pf-label">Description</span>
            <textarea
              className="pf-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder={"Role summary, responsibilities, requirements\u2026"}
            />
          </label>

          <label className="pf-check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Active</span>
          </label>
        </div>

        <div className="pf-footer">
          <button
            type="button"
            className="pf-btn pf-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pf-btn pf-save"
            onClick={handleSubmit}
            disabled={!canSave}
          >
            {saving
              ? "Saving\u2026"
              : mode === "create"
                ? "Create Position"
                : "Save Changes"}
          </button>
        </div>

        <style jsx>{`
          .pf-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 1000;
          }
          .pf-modal {
            width: 100%;
            max-width: 520px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
            max-height: 90vh;
            display: flex;
            flex-direction: column;
          }
          .pf-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 22px;
            border-bottom: 1px solid #f1f5f9;
          }
          .pf-header h3 {
            font-size: 17px;
            font-weight: 700;
            color: #111827;
            margin: 0;
          }
          .pf-close {
            background: transparent;
            border: none;
            font-size: 22px;
            line-height: 1;
            color: #6b7280;
            cursor: pointer;
            padding: 0 4px;
          }
          .pf-close:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }
          .pf-body {
            padding: 18px 22px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .pf-error {
            background: #fff1f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            font-size: 12.5px;
            border-radius: 6px;
            padding: 8px 10px;
          }
          .pf-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .pf-label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
          }
          .pf-req {
            color: #dc2626;
          }
          .pf-input,
          .pf-textarea {
            font-size: 13px;
            color: #111827;
            background: #ffffff;
            border: 1px solid #d1d5db;
            border-radius: 7px;
            padding: 9px 11px;
            width: 100%;
            box-sizing: border-box;
            font-family: inherit;
          }
          .pf-textarea {
            resize: vertical;
          }
          .pf-input:focus,
          .pf-textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
          .pf-input::placeholder,
          .pf-textarea::placeholder {
            color: #9ca3af;
          }
          .pf-check {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #374151;
          }
          .pf-check input {
            accent-color: #2563eb;
            width: 15px;
            height: 15px;
          }
          .pf-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 16px 22px;
            border-top: 1px solid #f1f5f9;
          }
          .pf-btn {
            font-size: 13px;
            font-weight: 700;
            border-radius: 7px;
            padding: 9px 16px;
            cursor: pointer;
            border: 1px solid transparent;
          }
          .pf-btn:disabled {
            cursor: not-allowed;
          }
          .pf-cancel {
            background: #ffffff;
            color: #374151;
            border-color: #e5e7eb;
            font-weight: 600;
          }
          .pf-cancel:hover:not(:disabled) {
            background: #f1f5f9;
            border-color: #d1d5db;
          }
          .pf-save {
            background: #2563eb;
            color: #ffffff;
          }
          .pf-save:hover:not(:disabled) {
            background: #1d4ed8;
          }
          .pf-save:disabled {
            background: #93c5fd;
          }
        `}</style>
      </div>
    </div>
  );
}
