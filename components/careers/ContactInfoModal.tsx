"use client";

import { useEffect, useState } from "react";
import {
  Applicant,
  ApplicantInput,
  updateApplicant,
} from "@/lib/careers/applicantsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { US_STATES } from "@/lib/careers/usStates";
import { useDialogA11y } from "./useDialogA11y";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Jarvis Careers - Update Contact Information dialog (V2.1.6C).
 *
 * A submitted application is a historical record and remains read-only. The ONLY
 * applicant data recruiters may correct post-submission is contact information:
 * Phone, Email, Street Address, City, State, and ZIP Code. All other applicant
 * data (work history, education, credentials, resume, professional profile,
 * social profiles, application answers) is intentionally NOT editable here.
 */
export function ContactInfoModal({
  open,
  applicant,
  onClose,
  onSaved,
}: {
  open: boolean;
  applicant: Applicant | null;
  onClose: () => void;
  onSaved: (saved: Applicant) => void;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !applicant) return;
    setEmail(applicant.email ?? "");
    setPhone(applicant.phone ?? "");
    setAddressLine1(applicant.addressLine1 ?? "");
    setCity(applicant.city ?? "");
    setState(applicant.state ?? "");
    setPostalCode(applicant.postalCode ?? "");
    setError(null);
  }, [open, applicant]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const emailValid = EMAIL_RE.test(email.trim());
  const canSave = emailValid && !saving;

  async function handleSubmit() {
    if (!applicant) return;
    if (!emailValid) {
      setError("A valid email address is required.");
      return;
    }
    setSaving(true);
    setError(null);
    // Only contact fields are sent. Omitted profile/history fields are left
    // untouched by the backend (historical record preserved).
    const input: ApplicantInput = {
      email: email.trim(),
      phone: phone.trim(),
      addressLine1: addressLine1.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim(),
    };
    try {
      const saved = await updateApplicant(applicant.id, input);
      onSaved(saved);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to update contact information."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ci-overlay" onClick={saving ? undefined : onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="ci-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Update Contact Information"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ci-header">
          <h3>Update Contact Information</h3>
          <button
            type="button"
            className="ci-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="ci-body">
          {error ? <div className="ci-error">{error}</div> : null}
          <p className="ci-note">
            The submitted application is a permanent historical record. Only
            contact information can be updated here.
          </p>

          <label className="ci-field">
            <span className="ci-label">
              Email <span className="ci-req">*</span>
            </span>
            <input
              className="ci-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              data-autofocus
            />
          </label>

          <label className="ci-field">
            <span className="ci-label">Phone Number</span>
            <input
              className="ci-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
              placeholder="e.g. (555) 123-4567"
            />
          </label>

          <label className="ci-field">
            <span className="ci-label">Street Address</span>
            <input
              className="ci-input"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              maxLength={200}
              placeholder="e.g. 123 Main St"
            />
          </label>

          <div className="ci-grid">
            <label className="ci-field">
              <span className="ci-label">City</span>
              <input
                className="ci-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={120}
                placeholder="Houston"
              />
            </label>
            <label className="ci-field">
              <span className="ci-label">State</span>
              <select
                className="ci-input"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                <option value="">Select state…</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ci-field">
              <span className="ci-label">ZIP Code</span>
              <input
                className="ci-input"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                maxLength={20}
                placeholder="77002"
              />
            </label>
          </div>
        </div>

        <div className="ci-footer">
          <button
            type="button"
            className="ci-btn ci-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ci-btn ci-save"
            onClick={handleSubmit}
            disabled={!canSave}
          >
            {saving ? "Saving\u2026" : "Save Changes"}
          </button>
        </div>

        <style jsx>{`
          .ci-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 1000;
          }
          .ci-modal {
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
          .ci-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 22px;
            border-bottom: 1px solid #f1f5f9;
          }
          .ci-header h3 {
            font-size: 17px;
            font-weight: 700;
            color: #111827;
            margin: 0;
          }
          .ci-close {
            background: transparent;
            border: none;
            font-size: 22px;
            line-height: 1;
            color: #6b7280;
            cursor: pointer;
            padding: 0 4px;
          }
          .ci-close:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }
          .ci-body {
            padding: 18px 22px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .ci-note {
            font-size: 12px;
            color: #6b7280;
            margin: 0;
          }
          .ci-error {
            background: #fff1f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            font-size: 12.5px;
            border-radius: 6px;
            padding: 8px 10px;
          }
          .ci-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 14px;
          }
          .ci-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .ci-label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
          }
          .ci-req {
            color: #dc2626;
          }
          .ci-input {
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
          .ci-input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
          .ci-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 16px 22px;
            border-top: 1px solid #f1f5f9;
          }
          .ci-btn {
            font-size: 13px;
            font-weight: 700;
            border-radius: 7px;
            padding: 9px 16px;
            cursor: pointer;
            border: 1px solid transparent;
          }
          .ci-btn:disabled {
            cursor: not-allowed;
          }
          .ci-cancel {
            background: #ffffff;
            color: #374151;
            border-color: #e5e7eb;
            font-weight: 600;
          }
          .ci-cancel:hover:not(:disabled) {
            background: #f1f5f9;
            border-color: #d1d5db;
          }
          .ci-save {
            background: #2563eb;
            color: #ffffff;
          }
          .ci-save:hover:not(:disabled) {
            background: #1d4ed8;
          }
          .ci-save:disabled {
            background: #93c5fd;
          }
          @media (max-width: 560px) {
            .ci-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
