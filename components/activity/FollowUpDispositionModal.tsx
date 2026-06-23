"use client";

import { useState } from "react";

export type FollowUpDisposition =
  | "CONNECTED"
  | "COMPLETED"
  | "LEFT_VOICEMAIL"
  | "NO_ANSWER"
  | "BAD_NUMBER"
  | "CONTACT_LEFT_COMPANY"
  | "WRONG_CONTACT"
  | "RESCHEDULED"
  | "CANCELLED";

export interface ReplacementContactInput {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
}

export interface DispositionConfirmPayload {
  disposition: FollowUpDisposition;
  completionNote?: string;
  createNext?: { dueAt: string; hasExplicitTime: boolean; context?: string };
  // Set for CONTACT_LEFT_COMPANY / WRONG_CONTACT when a replacement is provided.
  replacement?: {
    newContact: ReplacementContactInput;
    dueAt: string;
    hasExplicitTime: boolean;
    context?: string;
  };
}

// Terminal completion dispositions offered in the modal. RESCHEDULED and
// CANCELLED remain dedicated actions on the surfaces that embed this modal.
const DISPOSITION_OPTIONS: {
  value: FollowUpDisposition;
  label: string;
  hint?: string;
}[] = [
  { value: "CONNECTED", label: "Connected", hint: "Reached the contact" },
  { value: "COMPLETED", label: "Completed", hint: "Obligation satisfied" },
  { value: "LEFT_VOICEMAIL", label: "Left voicemail" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "BAD_NUMBER", label: "Bad number" },
  { value: "CONTACT_LEFT_COMPANY", label: "Contact left company" },
  { value: "WRONG_CONTACT", label: "Wrong contact" },
];

const NO_CONTACT_DISPOSITIONS = new Set<FollowUpDisposition>([
  "LEFT_VOICEMAIL",
  "NO_ANSWER",
]);

// Dispositions that offer a replacement-contact workflow.
const REPLACEMENT_DISPOSITIONS = new Set<FollowUpDisposition>([
  "CONTACT_LEFT_COMPANY",
  "WRONG_CONTACT",
]);

export default function FollowUpDispositionModal({
  title = "Complete Follow-Up",
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: {
  title?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (payload: DispositionConfirmPayload) => void;
  onClose: () => void;
}) {
  const [disposition, setDisposition] = useState<FollowUpDisposition | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [localError, setLocalError] = useState("");

  // Replacement-contact workflow state.
  // When the replacement is unknown, the form is skipped and the disposition is
  // submitted without a replacement payload — the backend then creates a
  // CONTACT_VERIFICATION follow-up to find the correct contact.
  const [replacementUnknown, setReplacementUnknown] = useState(false);
  const [rcFirstName, setRcFirstName] = useState("");
  const [rcLastName, setRcLastName] = useState("");
  const [rcJobTitle, setRcJobTitle] = useState("");
  const [rcEmail, setRcEmail] = useState("");
  const [rcPhone, setRcPhone] = useState("");
  const [rcDate, setRcDate] = useState("");
  const [rcTime, setRcTime] = useState("");
  const [rcContext, setRcContext] = useState("");

  const showCreateNext = disposition != null && NO_CONTACT_DISPOSITIONS.has(disposition);
  const showReplacement = disposition != null && REPLACEMENT_DISPOSITIONS.has(disposition);

  const handleConfirm = () => {
    setLocalError("");
    if (!disposition) {
      setLocalError("Select a disposition.");
      return;
    }

    let createNext: DispositionConfirmPayload["createNext"];
    if (showCreateNext && scheduleNext) {
      if (!nextDate) {
        setLocalError("Select a date for the next attempt.");
        return;
      }
      const dueAt = nextTime
        ? new Date(`${nextDate}T${nextTime}`).toISOString()
        : new Date(`${nextDate}T09:00:00`).toISOString();
      createNext = { dueAt, hasExplicitTime: !!nextTime };
    }

    let replacement: DispositionConfirmPayload["replacement"];
    if (showReplacement && !replacementUnknown) {
      if (!rcFirstName.trim() || !rcLastName.trim()) {
        setLocalError("Enter the replacement contact's first and last name.");
        return;
      }
      if (!rcDate) {
        setLocalError("Select a date for the replacement follow-up.");
        return;
      }
      const dueAt = rcTime
        ? new Date(`${rcDate}T${rcTime}`).toISOString()
        : new Date(`${rcDate}T09:00:00`).toISOString();
      replacement = {
        newContact: {
          firstName: rcFirstName.trim(),
          lastName: rcLastName.trim(),
          jobTitle: rcJobTitle.trim() || undefined,
          email: rcEmail.trim() || undefined,
          phone: rcPhone.trim() || undefined,
        },
        dueAt,
        hasExplicitTime: !!rcTime,
        context: rcContext.trim() || undefined,
      };
    }

    onConfirm({
      disposition,
      completionNote: completionNote.trim() || undefined,
      createNext,
      replacement,
    });
  };

  return (
    <div
      className="fud-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="fud-modal">
        <div className="fud-header">
          <h2>{title}</h2>
          <button
            className="fud-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="fud-body">
          {(error || localError) && (
            <div className="fud-error">{error || localError}</div>
          )}

          <label className="fud-label">Disposition *</label>
          <div className="fud-options">
            {DISPOSITION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`fud-option ${disposition === opt.value ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="disposition"
                  value={opt.value}
                  checked={disposition === opt.value}
                  onChange={() => setDisposition(opt.value)}
                  disabled={busy}
                />
                <span className="fud-option-label">{opt.label}</span>
                {opt.hint && <span className="fud-option-hint">{opt.hint}</span>}
              </label>
            ))}
          </div>

          <label className="fud-label">Completion note (optional)</label>
          <textarea
            className="fud-textarea"
            value={completionNote}
            onChange={(e) => setCompletionNote(e.target.value)}
            placeholder="What was the outcome of this follow-up?"
            rows={2}
            disabled={busy}
          />

          {showCreateNext && (
            <div className="fud-next">
              <label className="fud-check">
                <input
                  type="checkbox"
                  checked={scheduleNext}
                  onChange={(e) => setScheduleNext(e.target.checked)}
                  disabled={busy}
                />
                Schedule next attempt
              </label>
              {scheduleNext && (
                <div className="fud-next-row">
                  <div className="fud-next-field">
                    <label className="fud-label">Date *</label>
                    <input
                      type="date"
                      className="fud-input"
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="fud-next-field">
                    <label className="fud-label">Time (optional)</label>
                    <input
                      type="time"
                      className="fud-input"
                      value={nextTime}
                      onChange={(e) => setNextTime(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {showReplacement && (
            <div className="fud-next">
              <label className="fud-check" style={{ marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={replacementUnknown}
                  onChange={(e) => setReplacementUnknown(e.target.checked)}
                  disabled={busy}
                />
                Replacement contact unknown — create a verification task
              </label>

              {replacementUnknown ? (
                <p className="fud-replace-help">
                  No replacement contact will be entered. A contact-verification
                  follow-up is created automatically to find the correct contact.
                </p>
              ) : (
                <>
                  <div className="fud-replace-title">Replacement contact</div>
                  <p className="fud-replace-help">
                    Add the new point of contact and schedule a follow-up. The
                    original follow-up is closed and the new one is linked to it.
                  </p>
                  <div className="fud-next-row">
                    <div className="fud-next-field">
                      <label className="fud-label">First name *</label>
                      <input
                        type="text"
                        className="fud-input"
                        value={rcFirstName}
                        onChange={(e) => setRcFirstName(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="fud-next-field">
                      <label className="fud-label">Last name *</label>
                      <input
                        type="text"
                        className="fud-input"
                        value={rcLastName}
                        onChange={(e) => setRcLastName(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <div className="fud-next-row">
                    <div className="fud-next-field">
                      <label className="fud-label">Job title (optional)</label>
                      <input
                        type="text"
                        className="fud-input"
                        value={rcJobTitle}
                        onChange={(e) => setRcJobTitle(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="fud-next-field">
                      <label className="fud-label">Phone (optional)</label>
                      <input
                        type="text"
                        className="fud-input"
                        value={rcPhone}
                        onChange={(e) => setRcPhone(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <label className="fud-label">Email (optional)</label>
                  <input
                    type="email"
                    className="fud-input"
                    value={rcEmail}
                    onChange={(e) => setRcEmail(e.target.value)}
                    disabled={busy}
                  />
                  <div className="fud-next-row" style={{ marginTop: 10 }}>
                    <div className="fud-next-field">
                      <label className="fud-label">Follow-up date *</label>
                      <input
                        type="date"
                        className="fud-input"
                        value={rcDate}
                        onChange={(e) => setRcDate(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                    <div className="fud-next-field">
                      <label className="fud-label">Time (optional)</label>
                      <input
                        type="time"
                        className="fud-input"
                        value={rcTime}
                        onChange={(e) => setRcTime(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  </div>
                  <label className="fud-label" style={{ marginTop: 10 }}>
                    Follow-up context (optional)
                  </label>
                  <textarea
                    className="fud-textarea"
                    value={rcContext}
                    onChange={(e) => setRcContext(e.target.value)}
                    placeholder="Carry over or update the follow-up context"
                    rows={2}
                    disabled={busy}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="fud-footer">
          <button className="fud-confirm" onClick={handleConfirm} disabled={busy}>
            {busy ? "Saving…" : "Confirm"}
          </button>
          <button className="fud-cancel" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>

      <style jsx>{`
        .fud-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 24px;
        }
        .fud-modal {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-width: 460px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .fud-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 12px;
          border-bottom: 1px solid #e9ecef;
        }
        .fud-header h2 {
          margin: 0;
          font-size: 17px;
          font-weight: 600;
          color: #2c3e50;
        }
        .fud-close {
          background: none;
          border: none;
          font-size: 22px;
          color: #8e99a4;
          cursor: pointer;
          line-height: 1;
          padding: 0 4px;
        }
        .fud-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .fud-body {
          padding: 16px 20px;
        }
        .fud-error {
          margin-bottom: 10px;
          padding: 8px 10px;
          background: #fdecea;
          color: #c0392b;
          border-radius: 6px;
          font-size: 13px;
        }
        .fud-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #5a6872;
          margin-bottom: 6px;
        }
        .fud-options {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 14px;
        }
        .fud-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }
        .fud-option.selected {
          border-color: #1976d2;
          background: #e8f4fd;
        }
        .fud-option-label {
          font-weight: 500;
          color: #2c3e50;
        }
        .fud-option-hint {
          margin-left: auto;
          color: #8e99a4;
          font-size: 12px;
        }
        .fud-textarea,
        .fud-input {
          width: 100%;
          padding: 8px;
          border: 1px solid #d0d7de;
          border-radius: 6px;
          font-size: 13px;
          color: #2c3e50;
          box-sizing: border-box;
        }
        .fud-textarea {
          resize: vertical;
          font-family: inherit;
        }
        .fud-next {
          margin-top: 12px;
          padding: 10px 12px;
          background: #f8f9fa;
          border: 1px solid #e3e8ee;
          border-radius: 8px;
        }
        .fud-check {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #2c3e50;
          font-weight: 500;
          cursor: pointer;
        }
        .fud-replace-title {
          font-size: 13px;
          font-weight: 600;
          color: #2c3e50;
        }
        .fud-replace-help {
          margin: 4px 0 10px;
          font-size: 12px;
          color: #8e99a4;
          line-height: 1.4;
        }
        .fud-next-row {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        .fud-next-field {
          flex: 1;
        }
        .fud-footer {
          display: flex;
          gap: 10px;
          padding: 12px 20px 18px;
          border-top: 1px solid #e9ecef;
        }
        .fud-confirm {
          padding: 8px 18px;
          border: 1px solid #2e7d32;
          border-radius: 6px;
          background: #2e7d32;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .fud-confirm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .fud-cancel {
          padding: 8px 18px;
          border: 1px solid #d0d7de;
          border-radius: 6px;
          background: #fff;
          color: #5a6872;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .fud-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
