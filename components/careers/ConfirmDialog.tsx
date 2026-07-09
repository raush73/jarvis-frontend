"use client";

import { ReactNode } from "react";
import { useDialogA11y } from "./useDialogA11y";

/**
 * Jarvis Careers - reusable confirmation modal (Industrial Light V1).
 * Used for reversible/irreversible action confirmations (e.g. deactivate).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose: onCancel,
    busy,
  });

  if (!open) return null;

  return (
    <div className="cd-overlay" onClick={busy ? undefined : onCancel}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="cd-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="cd-title">{title}</h3>
        <div className="cd-body">{message}</div>
        {error ? <div className="cd-error">{error}</div> : null}
        <div className="cd-footer">
          <button
            type="button"
            className="cd-btn cd-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`cd-btn ${tone === "danger" ? "cd-danger" : "cd-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working\u2026" : confirmLabel}
          </button>
        </div>

        <style jsx>{`
          .cd-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 1000;
          }
          .cd-modal {
            width: 100%;
            max-width: 460px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 22px 24px;
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
          }
          .cd-title {
            font-size: 17px;
            font-weight: 700;
            color: #111827;
            margin: 0 0 10px;
          }
          .cd-body {
            font-size: 13px;
            color: #4b5563;
            line-height: 1.6;
          }
          .cd-error {
            margin-top: 12px;
            background: #fff1f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            font-size: 12.5px;
            border-radius: 6px;
            padding: 8px 10px;
          }
          .cd-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
          }
          .cd-btn {
            font-size: 13px;
            font-weight: 700;
            border-radius: 7px;
            padding: 9px 16px;
            cursor: pointer;
            border: 1px solid transparent;
          }
          .cd-btn:disabled {
            cursor: not-allowed;
            opacity: 0.6;
          }
          .cd-cancel {
            background: #ffffff;
            color: #374151;
            border-color: #e5e7eb;
            font-weight: 600;
          }
          .cd-cancel:hover:not(:disabled) {
            background: #f1f5f9;
            border-color: #d1d5db;
          }
          .cd-primary {
            background: #2563eb;
            color: #ffffff;
          }
          .cd-primary:hover:not(:disabled) {
            background: #1d4ed8;
          }
          .cd-danger {
            background: #dc2626;
            color: #ffffff;
          }
          .cd-danger:hover:not(:disabled) {
            background: #b91c1c;
          }
        `}</style>
      </div>
    </div>
  );
}
