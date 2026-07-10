"use client";

import { useEffect, useState } from "react";
import {
  MembershipEntry,
  MembershipInput,
  createMembership,
  updateMembership,
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
 * Jarvis Careers - Create / Edit Professional Membership dialog (Industrial
 * Light V1, V2.1.5C). Owned directly by an InternalApplicant. "Currently Active"
 * hides and clears the end date.
 */
export function MembershipFormModal({
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
  entry?: MembershipEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [organization, setOrganization] = useState("");
  const [membershipType, setMembershipType] = useState("");
  const [membershipNumber, setMembershipNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && entry) {
      setOrganization(entry.organization ?? "");
      setMembershipType(entry.membershipType ?? "");
      setMembershipNumber(entry.membershipNumber ?? "");
      setStartDate(toDateInput(entry.startDate));
      setEndDate(toDateInput(entry.endDate));
      setIsCurrent(entry.isCurrent);
    } else {
      setOrganization("");
      setMembershipType("");
      setMembershipNumber("");
      setStartDate("");
      setEndDate("");
      setIsCurrent(false);
    }
    setError(null);
  }, [open, mode, entry]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const canSave = organization.trim().length > 0 && !saving;

  async function handleSubmit() {
    if (!organization.trim()) {
      setError("Organization is required.");
      return;
    }
    if (!isCurrent && startDate && endDate && endDate < startDate) {
      setError("End date cannot be earlier than the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: MembershipInput = {
      organization: organization.trim(),
      membershipType: membershipType.trim() || null,
      membershipNumber: membershipNumber.trim() || null,
      startDate: startDate || null,
      endDate: isCurrent ? null : endDate || null,
      isCurrent,
    };
    try {
      if (mode === "create") {
        await createMembership(applicantId, input);
      } else {
        await updateMembership(entry!.id, input);
      }
      onSaved();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save membership."));
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
        aria-label={mode === "create" ? "Add Membership" : "Edit Membership"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>{mode === "create" ? "Add Membership" : "Edit Membership"}</h3>
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
              Organization <span className="pf-req">*</span>
            </span>
            <input
              className="pf-input"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              maxLength={200}
              placeholder="e.g. Project Management Institute"
              data-autofocus
            />
          </label>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Membership Type</span>
              <input
                className="pf-input"
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value)}
                maxLength={200}
                placeholder="e.g. Professional Member"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Membership Number</span>
              <input
                className="pf-input"
                value={membershipNumber}
                onChange={(e) => setMembershipNumber(e.target.value)}
                maxLength={120}
              />
            </label>
          </div>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Start Date</span>
              <input
                className="pf-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">End Date</span>
              <input
                className="pf-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isCurrent}
              />
            </label>
          </div>

          <label className="pf-check">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
            <span>Currently Active</span>
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
                ? "Add Membership"
                : "Save Changes"}
          </button>
        </div>

        <style jsx>{CREDENTIAL_MODAL_CSS}</style>
      </div>
    </div>
  );
}
