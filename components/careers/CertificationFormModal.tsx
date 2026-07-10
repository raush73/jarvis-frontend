"use client";

import { useEffect, useState } from "react";
import {
  CertificationEntry,
  CertificationInput,
  createCertification,
  updateCertification,
} from "@/lib/careers/credentialsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { useDialogA11y } from "./useDialogA11y";
import { CREDENTIAL_MODAL_CSS } from "./credentialModalStyles";

/** Convert an ISO datetime to the YYYY-MM-DD value a date input expects. */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.length >= 10 ? iso.slice(0, 10) : "";
}

/**
 * Jarvis Careers - Create / Edit Certification dialog (Industrial Light V1,
 * V2.1.5C). Owned directly by an InternalApplicant. "Does Not Expire" hides and
 * clears the expiration date.
 */
export function CertificationFormModal({
  open,
  mode,
  applicantId,
  entry,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  applicantId: string;
  entry?: CertificationEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [issuingOrganization, setIssuingOrganization] = useState("");
  const [certificationNumber, setCertificationNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [doesNotExpire, setDoesNotExpire] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && entry) {
      setName(entry.name ?? "");
      setIssuingOrganization(entry.issuingOrganization ?? "");
      setCertificationNumber(entry.certificationNumber ?? "");
      setIssueDate(toDateInput(entry.issueDate));
      setExpirationDate(toDateInput(entry.expirationDate));
      setDoesNotExpire(entry.doesNotExpire);
    } else {
      setName("");
      setIssuingOrganization("");
      setCertificationNumber("");
      setIssueDate("");
      setExpirationDate("");
      setDoesNotExpire(false);
    }
    setError(null);
  }, [open, mode, entry]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const canSave = name.trim().length > 0 && !saving;

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Certification name is required.");
      return;
    }
    if (!doesNotExpire && issueDate && expirationDate && expirationDate < issueDate) {
      setError("Expiration date cannot be earlier than the issue date.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: CertificationInput = {
      name: name.trim(),
      issuingOrganization: issuingOrganization.trim() || null,
      certificationNumber: certificationNumber.trim() || null,
      issueDate: issueDate || null,
      expirationDate: doesNotExpire ? null : expirationDate || null,
      doesNotExpire,
    };
    try {
      if (mode === "create") {
        await createCertification(applicantId, input);
      } else {
        await updateCertification(entry!.id, input);
      }
      onSaved();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save certification."));
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
        aria-label={
          mode === "create" ? "Add Certification" : "Edit Certification"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>
            {mode === "create" ? "Add Certification" : "Edit Certification"}
          </h3>
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
              Certification Name <span className="pf-req">*</span>
            </span>
            <input
              className="pf-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Certified Public Accountant"
              data-autofocus
            />
          </label>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Issuing Organization</span>
              <input
                className="pf-input"
                value={issuingOrganization}
                onChange={(e) => setIssuingOrganization(e.target.value)}
                maxLength={200}
                placeholder="e.g. AICPA"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Certification Number</span>
              <input
                className="pf-input"
                value={certificationNumber}
                onChange={(e) => setCertificationNumber(e.target.value)}
                maxLength={120}
              />
            </label>
          </div>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Issue Date</span>
              <input
                className="pf-input"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Expiration Date</span>
              <input
                className="pf-input"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                disabled={doesNotExpire}
              />
            </label>
          </div>

          <label className="pf-check">
            <input
              type="checkbox"
              checked={doesNotExpire}
              onChange={(e) => setDoesNotExpire(e.target.checked)}
            />
            <span>Does Not Expire</span>
          </label>
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
                ? "Add Certification"
                : "Save Changes"}
          </button>
        </div>

        <style jsx>{CREDENTIAL_MODAL_CSS}</style>
      </div>
    </div>
  );
}
