"use client";

import { useEffect, useState } from "react";
import {
  MILITARY_SERVICE_TYPES,
  MILITARY_SERVICE_TYPE_LABELS,
  MilitaryServiceEntry,
  MilitaryServiceInput,
  MilitaryServiceType,
  createMilitaryService,
  updateMilitaryService,
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
 * Jarvis Careers - Create / Edit Military Service dialog (Industrial Light V1,
 * V2.1.5C). Owned directly by an InternalApplicant and always optional.
 * "Veteran" is captured independently of the current service component so it can
 * support future veteran hiring initiatives, reporting, and recruiter filtering.
 */
export function MilitaryServiceFormModal({
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
  entry?: MilitaryServiceEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isVeteran, setIsVeteran] = useState(false);
  const [serviceType, setServiceType] = useState<MilitaryServiceType | "">("");
  const [branch, setBranch] = useState("");
  const [rank, setRank] = useState("");
  const [occupationalSpecialty, setOccupationalSpecialty] = useState("");
  const [serviceStartDate, setServiceStartDate] = useState("");
  const [serviceEndDate, setServiceEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && entry) {
      setIsVeteran(entry.isVeteran);
      setServiceType(entry.serviceType ?? "");
      setBranch(entry.branch ?? "");
      setRank(entry.rank ?? "");
      setOccupationalSpecialty(entry.occupationalSpecialty ?? "");
      setServiceStartDate(toDateInput(entry.serviceStartDate));
      setServiceEndDate(toDateInput(entry.serviceEndDate));
      setIsCurrent(entry.isCurrent);
    } else {
      setIsVeteran(false);
      setServiceType("");
      setBranch("");
      setRank("");
      setOccupationalSpecialty("");
      setServiceStartDate("");
      setServiceEndDate("");
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

  const canSave = !saving;

  async function handleSubmit() {
    if (
      !isCurrent &&
      serviceStartDate &&
      serviceEndDate &&
      serviceEndDate < serviceStartDate
    ) {
      setError("Service end date cannot be earlier than the start date.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: MilitaryServiceInput = {
      isVeteran,
      serviceType: serviceType || null,
      branch: branch.trim() || null,
      rank: rank.trim() || null,
      occupationalSpecialty: occupationalSpecialty.trim() || null,
      serviceStartDate: serviceStartDate || null,
      serviceEndDate: isCurrent ? null : serviceEndDate || null,
      isCurrent,
    };
    try {
      if (mode === "create") {
        await createMilitaryService(applicantId, input);
      } else {
        await updateMilitaryService(entry!.id, input);
      }
      onSaved();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save military service."));
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
          mode === "create" ? "Add Military Service" : "Edit Military Service"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>
            {mode === "create"
              ? "Add Military Service"
              : "Edit Military Service"}
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

          <label className="pf-check">
            <input
              type="checkbox"
              checked={isVeteran}
              onChange={(e) => setIsVeteran(e.target.checked)}
              data-autofocus
            />
            <span>Veteran</span>
          </label>

          <label className="pf-field">
            <span className="pf-label">Service Component</span>
            <select
              className="pf-input"
              value={serviceType}
              onChange={(e) =>
                setServiceType(e.target.value as MilitaryServiceType | "")
              }
            >
              <option value="">Not specified</option>
              {MILITARY_SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MILITARY_SERVICE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <span className="pf-hint">
              Active Duty, National Guard, or Reserve.
            </span>
          </label>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Branch</span>
              <input
                className="pf-input"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                maxLength={120}
                placeholder="e.g. Army"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Rank</span>
              <input
                className="pf-input"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                maxLength={120}
                placeholder="e.g. Sergeant"
              />
            </label>
          </div>

          <label className="pf-field">
            <span className="pf-label">Occupational Specialty</span>
            <input
              className="pf-input"
              value={occupationalSpecialty}
              onChange={(e) => setOccupationalSpecialty(e.target.value)}
              maxLength={200}
              placeholder="e.g. 25B - Information Technology Specialist"
            />
          </label>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Service Start Date</span>
              <input
                className="pf-input"
                type="date"
                value={serviceStartDate}
                onChange={(e) => setServiceStartDate(e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Service End Date</span>
              <input
                className="pf-input"
                type="date"
                value={serviceEndDate}
                onChange={(e) => setServiceEndDate(e.target.value)}
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
            <span>Currently Serving</span>
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
                ? "Add Military Service"
                : "Save Changes"}
          </button>
        </div>

        <style jsx>{CREDENTIAL_MODAL_CSS}</style>
      </div>
    </div>
  );
}
