"use client";

import { useState } from "react";
import { fridayFetch } from "../friday/fridayFetch";
import { FOLLOWUP_TYPE_OPTIONS, type FollowUpType } from "./types";

const INTENT_OPTIONS: { value: string; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "CALLBACK", label: "Callback" },
  { value: "QUOTE_FOLLOWUP", label: "Quote Follow-Up" },
  { value: "MSA_FOLLOWUP", label: "MSA Follow-Up" },
  { value: "CHECK_IN", label: "Check-In" },
  { value: "DECISION_PENDING", label: "Decision Pending" },
  { value: "INFORMATION_SENT", label: "Information Sent" },
];

export default function FollowUpCreateForm({
  customerId,
  onCreated,
  onCancel,
}: {
  customerId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [intentType, setIntentType] = useState("GENERAL");
  const [followUpType, setFollowUpType] = useState<FollowUpType>("TASK");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    dueDate.trim().length > 0 && context.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");

    const hasExplicitTime = dueTime.trim().length > 0;
    // Date-only follow-ups anchor at local noon to avoid timezone day-shift.
    const localIso = hasExplicitTime
      ? new Date(`${dueDate}T${dueTime}`).toISOString()
      : new Date(`${dueDate}T12:00:00`).toISOString();

    const res = await fridayFetch("/friday/follow-ups", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        intentType,
        followUpType,
        dueAt: localIso,
        hasExplicitTime,
        context: context.trim(),
      }),
    });

    if (res.ok) {
      onCreated();
    } else if (res.status === 409) {
      setError(
        "An open follow-up with this intent already exists for this account. Choose a different intent type or resolve the existing follow-up.",
      );
    } else {
      setError(res.error || "Failed to create follow-up.");
    }
    setSaving(false);
  };

  return (
    <div className="followup-create-form">
      <div className="form-row">
        <div className="form-field">
          <label htmlFor="fu-type">
            Type <span className="required">*</span>
          </label>
          <select
            id="fu-type"
            value={followUpType}
            onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}
          >
            {FOLLOWUP_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="fu-intent">
            Intent <span className="required">*</span>
          </label>
          <select
            id="fu-intent"
            value={intentType}
            onChange={(e) => setIntentType(e.target.value)}
          >
            {INTENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="fu-date">
            Due Date <span className="required">*</span>
          </label>
          <input
            id="fu-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="fu-time">Time (optional)</label>
          <input
            id="fu-time"
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="fu-context">
          Context <span className="required">*</span>
        </label>
        <textarea
          id="fu-context"
          placeholder="Why is this follow-up needed?"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={3}
          maxLength={2000}
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
          {saving ? "Creating…" : "Create Follow-Up"}
        </button>
      </div>

      <style jsx>{`
        .followup-create-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .form-row {
          display: flex;
          gap: 12px;
        }
        .form-row .form-field {
          flex: 1;
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
        .form-field select,
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
        .form-field select:focus,
        .form-field textarea:focus {
          outline: none;
          border-color: #e67e22;
          box-shadow: 0 0 0 2px rgba(230, 126, 34, 0.15);
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
          background: #e67e22;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-submit:hover:not(:disabled) {
          background: #d35400;
        }
        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
