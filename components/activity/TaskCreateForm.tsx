"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function TaskCreateForm({
  customerId,
  onCreated,
  onCancel,
}: {
  customerId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = description.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch("/activity/tasks", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          title: title.trim() || undefined,
          description: description.trim(),
          dueDate: dueDate || undefined,
        }),
      });
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="task-create-form">
      <div className="form-field">
        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          type="text"
          placeholder="Brief task title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          autoFocus
        />
      </div>

      <div className="form-field">
        <label htmlFor="task-desc">
          Description <span className="required">*</span>
        </label>
        <textarea
          id="task-desc"
          placeholder="What needs to be done?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>

      <div className="form-field">
        <label htmlFor="task-due">Due Date</label>
        <input
          id="task-due"
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
          {saving ? "Creating…" : "Create Task"}
        </button>
      </div>

      <style jsx>{`
        .task-create-form {
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
          background: #2e7d32;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-submit:hover:not(:disabled) {
          background: #1b5e20;
        }
        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
