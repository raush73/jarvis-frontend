"use client";

import { useCallback } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import { useLoadIdentity } from "@/components/workforce/IdentityDraftContext";
import { WorkforceApiError } from "@/lib/workforce/workforceApi";

/**
 * Identity screen: legal name, date of birth, and SSN.
 *
 * The backend Identity stage saves atomically together with contact information, so
 * this screen holds its values and the Contact Information screen performs the single
 * save. Only presence is checked here so the worker is not sent forward with obvious
 * blanks; the backend remains the authority on format and validity.
 */
export default function IdentityPage() {
  const { draft, setField, serverView, loading, loadError } = useLoadIdentity();

  const validate = useCallback(async () => {
    const missing: string[] = [];
    if (!draft.firstName.trim()) missing.push("First name is required");
    if (!draft.lastName.trim()) missing.push("Last name is required");
    if (!draft.dateOfBirth.trim()) missing.push("Date of birth is required");
    if (!draft.ssn.trim() && !serverView?.ssnProvided) {
      missing.push("Social Security number is required");
    }
    if (missing.length > 0) {
      throw new WorkforceApiError(
        "Please complete the required fields.",
        400,
        missing,
      );
    }
  }, [draft, serverView]);

  return (
    <WorkforceWizardShell
      slug="identity"
      loading={loading}
      stageError={loadError}
      onSave={validate}
      continueLabel="Continue"
      intro="Enter your name exactly as it appears on your government-issued identification."
    >
      <div className="wf-grid">
        <label className="wf-field">
          <span className="wf-label">
            First name <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            value={draft.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
            autoComplete="given-name"
            maxLength={100}
          />
        </label>

        <label className="wf-field">
          <span className="wf-label">Middle name</span>
          <input
            className="wf-input"
            value={draft.middleName}
            onChange={(e) => setField("middleName", e.target.value)}
            autoComplete="additional-name"
            maxLength={100}
          />
        </label>

        <label className="wf-field">
          <span className="wf-label">
            Last name <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            value={draft.lastName}
            onChange={(e) => setField("lastName", e.target.value)}
            autoComplete="family-name"
            maxLength={100}
          />
        </label>

        <label className="wf-field">
          <span className="wf-label">Suffix</span>
          <input
            className="wf-input"
            value={draft.suffix}
            onChange={(e) => setField("suffix", e.target.value)}
            placeholder="Jr., Sr., III"
            maxLength={20}
          />
        </label>

        <label className="wf-field">
          <span className="wf-label">
            Date of birth <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            type="date"
            value={draft.dateOfBirth}
            onChange={(e) => setField("dateOfBirth", e.target.value)}
          />
        </label>

        <label className="wf-field">
          <span className="wf-label">
            Social Security number <span className="wf-req">*</span>
          </span>
          <input
            className="wf-input"
            value={draft.ssn}
            onChange={(e) => setField("ssn", e.target.value)}
            placeholder="000-00-0000"
            inputMode="numeric"
            autoComplete="off"
            maxLength={11}
          />
          <span className="wf-hint">
            {serverView?.ssnProvided
              ? `On file as ${serverView.ssnMasked}. For your security, re-enter it to save any change on the next screen.`
              : "Encrypted on submission and never displayed back to you in full."}
          </span>
        </label>
      </div>
    </WorkforceWizardShell>
  );
}
