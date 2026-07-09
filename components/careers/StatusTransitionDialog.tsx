"use client";

import { useState } from "react";
import {
  APPLICATION_STATUS_LABELS,
  InternalApplicationStatus,
  TRANSITION_ACTION_LABELS,
  isDestructiveTransition,
} from "@/lib/careers/applicationsApi";

/**
 * Jarvis Careers - Application status-transition dialog.
 *
 * A new component (not ConfirmDialog) because a review note must be captured
 * inline: the backend only persists `reviewNote` via the status-transition
 * endpoint, so the note field lives with the transition action.
 */
export function StatusTransitionDialog({
  open,
  fromStatus,
  toStatus,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  fromStatus: InternalApplicationStatus;
  toStatus: InternalApplicationStatus | null;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reviewNote: string) => void;
  onCancel: () => void;
}) {
  // Note state resets per open because the parent remounts this dialog with a
  // `key` tied to the target status (avoids a reset-in-effect anti-pattern).
  const [reviewNote, setReviewNote] = useState("");

  if (!open || !toStatus) return null;

  const danger = isDestructiveTransition(toStatus);

  return (
    <div className="st-overlay" onClick={busy ? undefined : onCancel}>
      <div
        className="st-modal"
        role="dialog"
        aria-modal="true"
        aria-label={TRANSITION_ACTION_LABELS[toStatus]}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="st-title">{TRANSITION_ACTION_LABELS[toStatus]}</h3>
        <p className="st-body">
          Change status from{" "}
          <strong>{APPLICATION_STATUS_LABELS[fromStatus]}</strong> to{" "}
          <strong>{APPLICATION_STATUS_LABELS[toStatus]}</strong>.
        </p>

        <label className="st-field">
          <span className="st-label">Review note (optional)</span>
          <textarea
            className="st-textarea"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="Add context for this decision (visible to hiring staff)…"
          />
        </label>

        {error ? <div className="st-error">{error}</div> : null}

        <div className="st-footer">
          <button
            type="button"
            className="st-btn st-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`st-btn ${danger ? "st-danger" : "st-primary"}`}
            onClick={() => onConfirm(reviewNote.trim())}
            disabled={busy}
          >
            {busy ? "Working\u2026" : TRANSITION_ACTION_LABELS[toStatus]}
          </button>
        </div>

        <style jsx>{`
          .st-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 1000;
          }
          .st-modal {
            width: 100%;
            max-width: 480px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 22px 24px;
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
          }
          .st-title {
            font-size: 17px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 10px;
          }
          .st-body {
            font-size: 13px;
            color: #4b5563;
            line-height: 1.6;
            margin: 0 0 14px;
          }
          .st-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .st-label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
          }
          .st-textarea {
            font-size: 13px;
            color: #111827;
            background: #ffffff;
            border: 1px solid #d1d5db;
            border-radius: 7px;
            padding: 9px 11px;
            width: 100%;
            box-sizing: border-box;
            font-family: inherit;
            resize: vertical;
          }
          .st-textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
          .st-textarea::placeholder {
            color: #9ca3af;
          }
          .st-error {
            margin-top: 12px;
            background: #fff1f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            font-size: 12.5px;
            border-radius: 6px;
            padding: 8px 10px;
          }
          .st-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
          }
          .st-btn {
            font-size: 13px;
            font-weight: 700;
            border-radius: 7px;
            padding: 9px 16px;
            cursor: pointer;
            border: 1px solid transparent;
          }
          .st-btn:disabled {
            cursor: not-allowed;
            opacity: 0.6;
          }
          .st-cancel {
            background: #ffffff;
            color: #374151;
            border-color: #e5e7eb;
            font-weight: 600;
          }
          .st-cancel:hover:not(:disabled) {
            background: #f1f5f9;
            border-color: #d1d5db;
          }
          .st-primary {
            background: #2563eb;
            color: #ffffff;
          }
          .st-primary:hover:not(:disabled) {
            background: #1d4ed8;
          }
          .st-danger {
            background: #dc2626;
            color: #ffffff;
          }
          .st-danger:hover:not(:disabled) {
            background: #b91c1c;
          }
        `}</style>
      </div>
    </div>
  );
}
