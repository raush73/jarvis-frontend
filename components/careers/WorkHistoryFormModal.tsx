"use client";

import { useEffect, useState } from "react";
import {
  COMPENSATION_TYPES,
  COMPENSATION_TYPE_LABELS,
  CONTACT_CONSENTS,
  CONTACT_CONSENT_LABELS,
  CompensationType,
  WORK_HISTORY_EMPLOYMENT_TYPES,
  WORK_HISTORY_EMPLOYMENT_TYPE_LABELS,
  WorkHistoryContactConsent,
  WorkHistoryEmploymentType,
  WorkHistoryEntry,
  WorkHistoryInput,
  createWorkHistory,
  updateWorkHistory,
} from "@/lib/careers/workHistoryApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { useDialogA11y } from "./useDialogA11y";

/** Convert an ISO datetime to the YYYY-MM-DD value a date input expects. */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.length >= 10 ? iso.slice(0, 10) : "";
}

function parseMoney(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Jarvis Careers - Create / Edit Work History dialog (Industrial Light V1,
 * V2.1.5B). Owned by an InternalApplicant. Compensation fields are shown only
 * when the admin config enables compensation history (showCompensation).
 */
export function WorkHistoryFormModal({
  open,
  mode,
  applicantId,
  entry,
  showCompensation,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  applicantId: string;
  entry?: WorkHistoryEntry | null;
  showCompensation: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employerName, setEmployerName] = useState("");
  const [employerCity, setEmployerCity] = useState("");
  const [employerState, setEmployerState] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentType, setEmploymentType] = useState<
    WorkHistoryEmploymentType | ""
  >("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [startingCompensation, setStartingCompensation] = useState("");
  const [endingCompensation, setEndingCompensation] = useState("");
  const [compensationType, setCompensationType] = useState<
    CompensationType | ""
  >("");
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorTitle, setSupervisorTitle] = useState("");
  const [supervisorPhone, setSupervisorPhone] = useState("");
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [contactConsent, setContactConsent] =
    useState<WorkHistoryContactConsent>("NOT_AUTHORIZED");
  const [reasonForLeaving, setReasonForLeaving] = useState("");
  const [skillsUsed, setSkillsUsed] = useState("");
  const [accomplishments, setAccomplishments] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && entry) {
      setEmployerName(entry.employerName ?? "");
      setEmployerCity(entry.employerCity ?? "");
      setEmployerState(entry.employerState ?? "");
      setJobTitle(entry.jobTitle ?? "");
      setEmploymentType(entry.employmentType ?? "");
      setStartDate(toDateInput(entry.startDate));
      setEndDate(toDateInput(entry.endDate));
      setIsCurrent(entry.isCurrent);
      setStartingCompensation(entry.startingCompensation ?? "");
      setEndingCompensation(entry.endingCompensation ?? "");
      setCompensationType(entry.compensationType ?? "");
      setSupervisorName(entry.supervisorName ?? "");
      setSupervisorTitle(entry.supervisorTitle ?? "");
      setSupervisorPhone(entry.supervisorPhone ?? "");
      setSupervisorEmail(entry.supervisorEmail ?? "");
      setContactConsent(entry.contactConsent ?? "NOT_AUTHORIZED");
      setReasonForLeaving(entry.reasonForLeaving ?? "");
      setSkillsUsed(entry.skillsUsed ?? "");
      setAccomplishments(entry.accomplishments ?? "");
    } else {
      setEmployerName("");
      setEmployerCity("");
      setEmployerState("");
      setJobTitle("");
      setEmploymentType("");
      setStartDate("");
      setEndDate("");
      setIsCurrent(false);
      setStartingCompensation("");
      setEndingCompensation("");
      setCompensationType("");
      setSupervisorName("");
      setSupervisorTitle("");
      setSupervisorPhone("");
      setSupervisorEmail("");
      setContactConsent("NOT_AUTHORIZED");
      setReasonForLeaving("");
      setSkillsUsed("");
      setAccomplishments("");
    }
    setError(null);
  }, [open, mode, entry]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const canSave =
    employerName.trim().length > 0 &&
    jobTitle.trim().length > 0 &&
    startDate.length > 0 &&
    !saving;

  async function handleSubmit() {
    if (!employerName.trim() || !jobTitle.trim() || !startDate) {
      setError("Employer, job title, and start date are required.");
      return;
    }
    if (!isCurrent && endDate && endDate < startDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: WorkHistoryInput = {
      employerName: employerName.trim(),
      employerCity: employerCity.trim() || null,
      employerState: employerState.trim() || null,
      jobTitle: jobTitle.trim(),
      employmentType: employmentType || null,
      startDate,
      endDate: isCurrent ? null : endDate || null,
      isCurrent,
      supervisorName: supervisorName.trim() || null,
      supervisorTitle: supervisorTitle.trim() || null,
      supervisorPhone: supervisorPhone.trim() || null,
      supervisorEmail: supervisorEmail.trim() || null,
      contactConsent,
      reasonForLeaving: reasonForLeaving.trim() || null,
      skillsUsed: skillsUsed.trim() || null,
      accomplishments: accomplishments.trim() || null,
    };
    if (showCompensation) {
      input.startingCompensation = parseMoney(startingCompensation);
      input.endingCompensation = parseMoney(endingCompensation);
      input.compensationType = compensationType || null;
    }
    try {
      if (mode === "create") {
        await createWorkHistory(applicantId, input);
      } else {
        await updateWorkHistory(entry!.id, input);
      }
      onSaved();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save work history."));
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
        aria-label={mode === "create" ? "Add Work History" : "Edit Work History"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>{mode === "create" ? "Add Work History" : "Edit Work History"}</h3>
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
              Employer Name <span className="pf-req">*</span>
            </span>
            <input
              className="pf-input"
              value={employerName}
              onChange={(e) => setEmployerName(e.target.value)}
              maxLength={200}
              placeholder="e.g. Acme Corp"
              data-autofocus
            />
          </label>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Employer City</span>
              <input
                className="pf-input"
                value={employerCity}
                onChange={(e) => setEmployerCity(e.target.value)}
                maxLength={120}
                placeholder="Houston"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Employer State</span>
              <input
                className="pf-input"
                value={employerState}
                onChange={(e) => setEmployerState(e.target.value)}
                maxLength={120}
                placeholder="TX"
              />
            </label>
          </div>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">
                Job Title <span className="pf-req">*</span>
              </span>
              <input
                className="pf-input"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Staff Accountant"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Employment Type</span>
              <select
                className="pf-input"
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(
                    e.target.value as WorkHistoryEmploymentType | "",
                  )
                }
              >
                <option value="">Not specified</option>
                {WORK_HISTORY_EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {WORK_HISTORY_EMPLOYMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">
                Start Date <span className="pf-req">*</span>
              </span>
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
            <span>Currently Employed</span>
          </label>

          {showCompensation ? (
            <>
              <div className="pf-section">
                <span className="pf-section-title">Compensation</span>
              </div>
              <div className="pf-grid">
                <label className="pf-field">
                  <span className="pf-label">Starting Compensation</span>
                  <input
                    className="pf-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={startingCompensation}
                    onChange={(e) => setStartingCompensation(e.target.value)}
                    placeholder="e.g. 45000"
                  />
                </label>
                <label className="pf-field">
                  <span className="pf-label">Ending Compensation</span>
                  <input
                    className="pf-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={endingCompensation}
                    onChange={(e) => setEndingCompensation(e.target.value)}
                    placeholder="e.g. 52000"
                  />
                </label>
              </div>
              <label className="pf-field">
                <span className="pf-label">Compensation Type</span>
                <select
                  className="pf-input"
                  value={compensationType}
                  onChange={(e) =>
                    setCompensationType(e.target.value as CompensationType | "")
                  }
                >
                  <option value="">Not specified</option>
                  {COMPENSATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {COMPENSATION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <div className="pf-section">
            <span className="pf-section-title">Supervisor & Reference</span>
          </div>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Supervisor Name</span>
              <input
                className="pf-input"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Supervisor Title</span>
              <input
                className="pf-input"
                value={supervisorTitle}
                onChange={(e) => setSupervisorTitle(e.target.value)}
                maxLength={200}
              />
            </label>
          </div>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Supervisor Phone</span>
              <input
                className="pf-input"
                value={supervisorPhone}
                onChange={(e) => setSupervisorPhone(e.target.value)}
                maxLength={50}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Supervisor Email</span>
              <input
                className="pf-input"
                type="email"
                value={supervisorEmail}
                onChange={(e) => setSupervisorEmail(e.target.value)}
                maxLength={255}
              />
            </label>
          </div>

          <label className="pf-field">
            <span className="pf-label">May Contact Employer</span>
            <select
              className="pf-input"
              value={contactConsent}
              onChange={(e) =>
                setContactConsent(e.target.value as WorkHistoryContactConsent)
              }
            >
              {CONTACT_CONSENTS.map((c) => (
                <option key={c} value={c}>
                  {CONTACT_CONSENT_LABELS[c]}
                </option>
              ))}
            </select>
            <span className="pf-hint">
              Stored per entry. No employer is ever contacted by the system in
              this version.
            </span>
          </label>

          <div className="pf-section">
            <span className="pf-section-title">Details</span>
          </div>

          <label className="pf-field">
            <span className="pf-label">Reason For Leaving</span>
            <textarea
              className="pf-textarea"
              value={reasonForLeaving}
              onChange={(e) => setReasonForLeaving(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </label>

          <label className="pf-field">
            <span className="pf-label">Skills Used</span>
            <textarea
              className="pf-textarea"
              value={skillsUsed}
              onChange={(e) => setSkillsUsed(e.target.value)}
              maxLength={5000}
              rows={3}
            />
          </label>

          <label className="pf-field">
            <span className="pf-label">Accomplishments</span>
            <textarea
              className="pf-textarea"
              value={accomplishments}
              onChange={(e) => setAccomplishments(e.target.value)}
              maxLength={5000}
              rows={3}
            />
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
                ? "Add Work History"
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
            max-width: 620px;
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
          .pf-section {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding-top: 6px;
            margin-top: 2px;
            border-top: 1px solid #f1f5f9;
          }
          .pf-section-title {
            font-size: 12px;
            font-weight: 700;
            color: #111827;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }
          .pf-input,
          .pf-textarea {
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
          .pf-textarea {
            resize: vertical;
          }
          .pf-input:focus,
          .pf-textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
          .pf-input:disabled {
            background: #f3f4f6;
            color: #9ca3af;
          }
          .pf-input::placeholder,
          .pf-textarea::placeholder {
            color: #9ca3af;
          }
          .pf-check {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #374151;
          }
          .pf-check input {
            accent-color: #2563eb;
            width: 15px;
            height: 15px;
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
