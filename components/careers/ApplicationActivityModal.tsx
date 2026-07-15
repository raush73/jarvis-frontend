"use client";

import { useEffect, useState } from "react";
import {
  APPLICATION_ACTIVITY_TYPES,
  APPLICATION_ACTIVITY_TYPE_LABELS,
  ApplicationActivity,
  ApplicationActivityType,
  addApplicationActivity,
} from "@/lib/careers/applicationsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { useDialogA11y } from "./useDialogA11y";

/**
 * Jarvis Careers V2.1.7 - Add Activity dialog.
 *
 * Logs a manual activity (call, email, meeting, internal note, ...) onto the
 * permanent Application Activity log. The performing user is taken from the
 * authenticated session server-side (never selected here). Status Change is not
 * offered - those activities are generated automatically by the system.
 *
 * The activity log is an append-only audit trail: there is no edit/delete, so
 * this dialog only ever creates new entries.
 */
function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function ApplicationActivityModal({
  open,
  applicationId,
  onClose,
  onSaved,
}: {
  open: boolean;
  applicationId: string;
  onClose: () => void;
  onSaved: (items: ApplicationActivity[]) => void;
}) {
  const [activityType, setActivityType] =
    useState<ApplicationActivityType>("PHONE_CALL");
  const [occurredAt, setOccurredAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActivityType("PHONE_CALL");
    setOccurredAt(nowLocalInput());
    setNote("");
    setError(null);
  }, [open]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const canSave = !saving && !!occurredAt;

  async function handleSubmit() {
    if (!occurredAt) {
      setError("A date and time is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await addApplicationActivity(applicationId, {
        activityType,
        occurredAt: fromLocalInput(occurredAt) ?? new Date().toISOString(),
        note: note.trim() || undefined,
      });
      onSaved(res.items);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to add activity."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="aa-overlay" onClick={saving ? undefined : onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="aa-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add Activity"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aa-header">
          <h3>Add Activity</h3>
          <button
            type="button"
            className="aa-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="aa-body">
          {error ? <div className="aa-error">{error}</div> : null}
          <p className="aa-note">
            Activities are a permanent audit trail. They cannot be edited or
            deleted after they are added.
          </p>

          <label className="aa-field">
            <span className="aa-label">Activity Type</span>
            <select
              className="aa-input"
              value={activityType}
              onChange={(e) =>
                setActivityType(e.target.value as ApplicationActivityType)
              }
              data-autofocus
            >
              {APPLICATION_ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {APPLICATION_ACTIVITY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="aa-field">
            <span className="aa-label">Date &amp; Time</span>
            <input
              className="aa-input"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </label>

          <div className="aa-field">
            <span className="aa-label">Performed By</span>
            <p className="aa-static">
              Recorded automatically as the signed-in user.
            </p>
          </div>

          <label className="aa-field">
            <span className="aa-label">Notes</span>
            <textarea
              className="aa-input aa-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={10000}
              rows={5}
              placeholder="What happened? (details of the call, email, meeting, etc.)"
            />
          </label>
        </div>

        <div className="aa-footer">
          <button
            type="button"
            className="aa-btn aa-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="aa-btn aa-save"
            onClick={handleSubmit}
            disabled={!canSave}
          >
            {saving ? "Saving\u2026" : "Add Activity"}
          </button>
        </div>

        <style jsx>{`
          .aa-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 1000;
          }
          .aa-modal {
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
          .aa-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 22px;
            border-bottom: 1px solid #f1f5f9;
          }
          .aa-header h3 {
            font-size: 17px;
            font-weight: 700;
            color: #111827;
            margin: 0;
          }
          .aa-close {
            background: transparent;
            border: none;
            font-size: 22px;
            line-height: 1;
            color: #6b7280;
            cursor: pointer;
            padding: 0 4px;
          }
          .aa-close:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }
          .aa-body {
            padding: 18px 22px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .aa-note {
            font-size: 12px;
            color: #6b7280;
            margin: 0;
          }
          .aa-error {
            background: #fff1f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            font-size: 12.5px;
            border-radius: 6px;
            padding: 8px 10px;
          }
          .aa-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .aa-label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
          }
          .aa-static {
            font-size: 12.5px;
            color: #6b7280;
            margin: 0;
          }
          .aa-input {
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
          .aa-textarea {
            resize: vertical;
          }
          .aa-input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
          .aa-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 16px 22px;
            border-top: 1px solid #f1f5f9;
          }
          .aa-btn {
            font-size: 13px;
            font-weight: 700;
            border-radius: 7px;
            padding: 9px 16px;
            cursor: pointer;
            border: 1px solid transparent;
          }
          .aa-btn:disabled {
            cursor: not-allowed;
          }
          .aa-cancel {
            background: #ffffff;
            color: #374151;
            border-color: #e5e7eb;
            font-weight: 600;
          }
          .aa-cancel:hover:not(:disabled) {
            background: #f1f5f9;
            border-color: #d1d5db;
          }
          .aa-save {
            background: #2563eb;
            color: #ffffff;
          }
          .aa-save:hover:not(:disabled) {
            background: #1d4ed8;
          }
          .aa-save:disabled {
            background: #93c5fd;
          }
        `}</style>
      </div>
    </div>
  );
}
