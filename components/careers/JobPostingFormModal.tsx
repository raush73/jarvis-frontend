"use client";

import { useEffect, useState } from "react";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
  JobPosting,
  JobPostingInput,
  PostingVisibility,
  VISIBILITIES,
  VISIBILITY_LABELS,
  createJobPosting,
  updateJobPosting,
} from "@/lib/careers/jobPostingsApi";
import { Position, listPositions } from "@/lib/careers/positionsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { StaffSelect } from "./StaffSelect";
import { useDialogA11y } from "./useDialogA11y";

/**
 * Jarvis Careers - Create / Edit Job Posting dialog (Industrial Light V1).
 * Reuses the standard Jarvis centered-modal form pattern (see
 * PositionFormModal) and the shared StaffSelect hiring-manager picker.
 */
export function JobPostingFormModal({
  open,
  mode,
  posting,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  posting?: JobPosting | null;
  onClose: () => void;
  onSaved: (saved: JobPosting) => void;
}) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);

  const [positionId, setPositionId] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("");
  const [visibility, setVisibility] = useState<PostingVisibility>("INTERNAL");
  const [hiringManagerUserId, setHiringManagerUserId] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // positionId can only be changed while a posting is in DRAFT (backend rule).
  const positionLocked = mode === "edit" && posting != null && posting.status !== "DRAFT";

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && posting) {
      setPositionId(posting.positionId);
      setTitle(posting.title ?? "");
      setLocation(posting.location ?? "");
      setEmploymentType(posting.employmentType ?? "");
      setVisibility(posting.visibility);
      setHiringManagerUserId(posting.hiringManagerUserId ?? "");
      setDescription(posting.description ?? "");
    } else {
      setPositionId("");
      setTitle("");
      setLocation("");
      setEmploymentType("");
      setVisibility("INTERNAL");
      setHiringManagerUserId("");
      setDescription("");
    }
    setError(null);
  }, [open, mode, posting]);

  // Load active positions for the picker whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPositionsLoading(true);
    listPositions({ isActive: true, limit: 200 })
      .then((res) => {
        if (!active) return;
        let items = res.items;
        // Ensure the current (possibly inactive) position stays selectable in edit mode.
        if (
          posting?.position &&
          !items.some((p) => p.id === posting.position!.id)
        ) {
          items = [
            {
              id: posting.position.id,
              title: posting.position.title,
              department: posting.position.department,
              description: null,
              standardResponsibilities: null,
              standardQualifications: null,
              defaultEmploymentType: null,
              isActive: false,
              createdByUserId: null,
              createdAt: posting.createdAt,
              updatedAt: posting.updatedAt,
            },
            ...items,
          ];
        }
        setPositions(items);
      })
      .catch(() => {
        if (active) setPositions([]);
      })
      .finally(() => {
        if (active) setPositionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, posting]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  if (!open) return null;

  const canSave = positionId.trim().length > 0 && !saving;

  async function handleSubmit() {
    if (!positionId.trim()) {
      setError("A position is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const input: JobPostingInput = {
      positionId,
      title: title.trim(),
      location: location.trim(),
      description: description.trim(),
      visibility,
    };
    if (employmentType) input.employmentType = employmentType;
    // On create, only send a hiring manager when one is chosen. On edit, always
    // send it so an empty value clears the assignment.
    const hm = hiringManagerUserId.trim();
    if (mode === "create") {
      if (hm) input.hiringManagerUserId = hm;
    } else {
      input.hiringManagerUserId = hm;
    }

    try {
      const saved =
        mode === "create"
          ? await createJobPosting(input)
          : await updateJobPosting(posting!.id, input);
      onSaved(saved);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save job posting."));
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
        aria-label={mode === "create" ? "New Job Posting" : "Edit Job Posting"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>{mode === "create" ? "New Job Posting" : "Edit Job Posting"}</h3>
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
              Position <span className="pf-req">*</span>
            </span>
            <select
              className="pf-input"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              disabled={positionLocked || positionsLoading}
              data-autofocus
            >
              <option value="">
                {positionsLoading ? "Loading positions…" : "Select a position…"}
              </option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.department ? ` — ${p.department}` : ""}
                  {p.isActive ? "" : " (inactive)"}
                </option>
              ))}
            </select>
            {positionLocked ? (
              <span className="pf-hint">
                Position can only be changed while the posting is a draft.
              </span>
            ) : null}
          </label>

          <label className="pf-field">
            <span className="pf-label">Title</span>
            <input
              className="pf-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Defaults to the position title"
            />
          </label>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Location</span>
              <input
                className="pf-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder="e.g. Houston, TX or Remote"
              />
            </label>

            <label className="pf-field">
              <span className="pf-label">Employment Type</span>
              <select
                className="pf-input"
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as EmploymentType | "")
                }
              >
                <option value="">Unspecified</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EMPLOYMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Visibility</span>
              <select
                className="pf-input"
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as PostingVisibility)
                }
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>

            <div className="pf-field">
              <span className="pf-label">Hiring Manager</span>
              <StaffSelect
                value={hiringManagerUserId}
                onChange={setHiringManagerUserId}
                disabled={saving}
              />
            </div>
          </div>

          <label className="pf-field">
            <span className="pf-label">Description</span>
            <textarea
              className="pf-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={20000}
              rows={6}
              placeholder={"Role summary, responsibilities, requirements\u2026"}
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
                ? "Create Posting"
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
            background: #f9fafb;
            color: #6b7280;
            cursor: not-allowed;
          }
          .pf-input::placeholder,
          .pf-textarea::placeholder {
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
