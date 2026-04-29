"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function NoteCreateForm({
  customerId,
  onCreated,
  onCancel,
}: {
  customerId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = noteText.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch("/activity/notes", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          noteText: noteText.trim(),
        }),
      });
      onCreated();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="note-create-form">
      <div className="form-field">
        <label htmlFor="note-text">
          Note <span className="required">*</span>
        </label>
        <textarea
          id="note-text"
          placeholder="Add an operational note for this account…"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={4}
          maxLength={5000}
          autoFocus
        />
        <span className="char-hint">
          {noteText.length > 0 ? `${noteText.length} / 5,000` : ""}
        </span>
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
          {saving ? "Saving…" : "Save Note"}
        </button>
      </div>

      <style jsx>{`
        .note-create-form {
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
        .form-field textarea:focus {
          outline: none;
          border-color: #7b1fa2;
          box-shadow: 0 0 0 2px rgba(123, 31, 162, 0.12);
        }
        .char-hint {
          font-size: 11px;
          color: #adb5bd;
          text-align: right;
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
          background: #7b1fa2;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-submit:hover:not(:disabled) {
          background: #6a1b9a;
        }
        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
