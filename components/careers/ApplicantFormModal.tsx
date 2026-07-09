"use client";

import { useEffect, useState } from "react";
import {
  Applicant,
  ApplicantInput,
  createApplicant,
  updateApplicant,
} from "@/lib/careers/applicantsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { useDialogA11y } from "./useDialogA11y";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Jarvis Careers - Create / Edit Applicant dialog (Industrial Light V1).
 * Reuses the standard Jarvis centered-modal form pattern (see
 * PositionFormModal / JobPostingFormModal).
 */
export function ApplicantFormModal({
  open,
  mode,
  applicant,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  applicant?: Applicant | null;
  onClose: () => void;
  onSaved: (saved: Applicant) => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && applicant) {
      setEmail(applicant.email ?? "");
      setFirstName(applicant.firstName ?? "");
      setLastName(applicant.lastName ?? "");
      setPhone(applicant.phone ?? "");
      setCity(applicant.city ?? "");
      setState(applicant.state ?? "");
    } else {
      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setCity("");
      setState("");
    }
    setError(null);
  }, [open, mode, applicant]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const emailValid = EMAIL_RE.test(email.trim());
  const canSave = emailValid && !saving;

  async function handleSubmit() {
    if (!emailValid) {
      setError("A valid email address is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: ApplicantInput = {
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      state: state.trim(),
    };
    try {
      const saved =
        mode === "create"
          ? await createApplicant(input)
          : await updateApplicant(applicant!.id, input);
      onSaved(saved);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save applicant."));
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
        aria-label={mode === "create" ? "New Applicant" : "Edit Applicant"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>{mode === "create" ? "New Applicant" : "Edit Applicant"}</h3>
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
              Email <span className="pf-req">*</span>
            </span>
            <input
              className="pf-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              placeholder="e.g. jane.doe@example.com"
              data-autofocus
            />
            <span className="pf-hint">
              Email uniquely identifies an applicant and is normalized to
              lowercase.
            </span>
          </label>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">First Name</span>
              <input
                className="pf-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={120}
                placeholder="Jane"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Last Name</span>
              <input
                className="pf-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={120}
                placeholder="Doe"
              />
            </label>
          </div>

          <label className="pf-field">
            <span className="pf-label">Phone</span>
            <input
              className="pf-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
              placeholder="e.g. (555) 123-4567"
            />
          </label>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">City</span>
              <input
                className="pf-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={120}
                placeholder="Houston"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">State</span>
              <input
                className="pf-input"
                value={state}
                onChange={(e) => setState(e.target.value)}
                maxLength={120}
                placeholder="TX"
              />
            </label>
          </div>
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
                ? "Create Applicant"
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
            max-width: 560px;
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
          .pf-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
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
          .pf-hint {
            font-size: 11.5px;
            color: #9ca3af;
          }
          .pf-input {
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
          .pf-input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
          .pf-input::placeholder {
            color: #9ca3af;
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
          @media (max-width: 560px) {
            .pf-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
