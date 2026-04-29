"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function TaskEditForm({
  taskId,
  initialTitle,
  initialDescription,
  initialDueDate,
  onSaved,
  onCancel,
}: {
  taskId: string;
  initialTitle: string;
  initialDescription: string;
  initialDueDate: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = description.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/activity/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim() || undefined,
          description: description.trim(),
          dueDate: dueDate || null,
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="task-edit-form">
      <div className="form-field">
        <label htmlFor="edit-task-title">Title</label>
        <input
          id="edit-task-title"
          type="text"
          placeholder="Brief task title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoFocus
        />
      </div>

      <div className="form-field">
        <label htmlFor="edit-task-desc">
          Description <span className="required">*</span>
        </label>
        <textarea
          id="edit-task-desc"
          placeholder="What needs to be done?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="form-field">
        <label htmlFor="edit-task-due">Due Date</label>
        <input
          id="edit-task-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button
          className="btn-cancel"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="btn-submit"
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <style jsx>{`
        .task-edit-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .form-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .form-field label {
          font-size: 12px;
          font-weight: 600;
          color: #5a6872;
        }
        .required {
          color: #c0392b;
        }
        .form-field input,
        .form-field textarea {
          padding: 8px 10px;
          border: 1px solid #d0d7de;
          border-radius: 6px;
          font-size: 14px;
          color: #2c3e50;
          background: #fff;
          font-family: inherit;
          resize: vertical;
        }
        .form-field input:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: #1976d2;
          box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
        }
        .form-error {
          font-size: 13px;
          color: #c0392b;
          padding: 6px 10px;
          background: #fdecea;
          border-radius: 4px;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 4px;
        }
        .btn-cancel {
          padding: 7px 16px;
          border: 1px solid #d0d7de;
          border-radius: 6px;
          background: #fff;
          color: #5a6872;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-cancel:hover {
          background: #f0f3f6;
        }
        .btn-submit {
          padding: 7px 20px;
          border: none;
          border-radius: 6px;
          background: #1976d2;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-submit:hover:not(:disabled) {
          background: #1565c0;
        }
        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
