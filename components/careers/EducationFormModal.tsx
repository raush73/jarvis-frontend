"use client";

import { useEffect, useState } from "react";
import {
  EducationEntry,
  EducationInput,
  createEducation,
  updateEducation,
} from "@/lib/careers/credentialsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { useDialogA11y } from "./useDialogA11y";
import { CREDENTIAL_MODAL_CSS } from "./credentialModalStyles";

/** Convert an ISO datetime to the YYYY-MM-DD value a date input expects. */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.length >= 10 ? iso.slice(0, 10) : "";
}

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Jarvis Careers - Create / Edit Education dialog (Industrial Light V1,
 * V2.1.5C). Owned directly by an InternalApplicant.
 */
export function EducationFormModal({
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
  entry?: EducationEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [schoolName, setSchoolName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [degree, setDegree] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [gpa, setGpa] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && entry) {
      setSchoolName(entry.schoolName ?? "");
      setCity(entry.city ?? "");
      setState(entry.state ?? "");
      setDegree(entry.degree ?? "");
      setFieldOfStudy(entry.fieldOfStudy ?? "");
      setGraduationDate(toDateInput(entry.graduationDate));
      setIsCurrent(entry.isCurrent);
      setGpa(entry.gpa ?? "");
    } else {
      setSchoolName("");
      setCity("");
      setState("");
      setDegree("");
      setFieldOfStudy("");
      setGraduationDate("");
      setIsCurrent(false);
      setGpa("");
    }
    setError(null);
  }, [open, mode, entry]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const canSave = schoolName.trim().length > 0 && !saving;

  async function handleSubmit() {
    if (!schoolName.trim()) {
      setError("School name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: EducationInput = {
      schoolName: schoolName.trim(),
      city: city.trim() || null,
      state: state.trim() || null,
      degree: degree.trim() || null,
      fieldOfStudy: fieldOfStudy.trim() || null,
      graduationDate: graduationDate || null,
      isCurrent,
      gpa: parseNumber(gpa),
    };
    try {
      if (mode === "create") {
        await createEducation(applicantId, input);
      } else {
        await updateEducation(entry!.id, input);
      }
      onSaved();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save education."));
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
        aria-label={mode === "create" ? "Add Education" : "Edit Education"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>{mode === "create" ? "Add Education" : "Edit Education"}</h3>
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
              School Name <span className="pf-req">*</span>
            </span>
            <input
              className="pf-input"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              maxLength={200}
              placeholder="e.g. University of Houston"
              data-autofocus
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

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Degree</span>
              <input
                className="pf-input"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                maxLength={200}
                placeholder="e.g. Bachelor of Science"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Field of Study</span>
              <input
                className="pf-input"
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                maxLength={200}
                placeholder="e.g. Accounting"
              />
            </label>
          </div>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Graduation Date</span>
              <input
                className="pf-input"
                type="date"
                value={graduationDate}
                onChange={(e) => setGraduationDate(e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">GPA</span>
              <input
                className="pf-input"
                type="number"
                min={0}
                max={99.99}
                step="0.01"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="e.g. 3.80"
              />
            </label>
          </div>

          <label className="pf-check">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
            <span>Currently Attending</span>
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
                ? "Add Education"
                : "Save Changes"}
          </button>
        </div>

        <style jsx>{CREDENTIAL_MODAL_CSS}</style>
      </div>
    </div>
  );
}
