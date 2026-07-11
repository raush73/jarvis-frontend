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
  publicApplicationUrl,
  updateJobPosting,
} from "@/lib/careers/jobPostingsApi";
import {
  FLSA_CLASSIFICATIONS,
  FLSA_CLASSIFICATION_LABELS,
  FlsaClassification,
  LUNCH_DURATIONS,
  PAY_TYPES,
  PAY_TYPE_LABELS,
  PayType,
  Position,
  TRAVEL_REQUIREMENTS,
  TRAVEL_REQUIREMENT_LABELS,
  TravelRequirement,
  WORK_LOCATIONS,
  WORK_LOCATION_LABELS,
  WorkLocation,
  listPositions,
} from "@/lib/careers/positionsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { StaffSelect } from "./StaffSelect";
import { useDialogA11y } from "./useDialogA11y";

/**
 * Jarvis Careers V2.1.6B - Create / Edit Job Posting dialog (Industrial Light V1).
 *
 * Implements the LOCKED Job Posting Profile: Posting Information, the Inherited
 * Position Profile (Snapshot), Compensation, and Application Settings. Selecting
 * a Position (create) immediately populates the inherited snapshot fields; those
 * values are editable here WITHOUT ever modifying the source Position Profile.
 */

// Full editor form shape; all inputs are held as strings/booleans and marshalled
// to the API payload on submit.
type FormState = {
  postingCode: string;
  title: string;
  hiringManagerUserId: string;
  department: string;
  visibility: PostingVisibility;
  numberOfOpenings: string;
  postingDate: string;
  closingDate: string;
  expectedStartDate: string;
  // Inherited Position Profile snapshot (overridable)
  description: string;
  responsibilities: string;
  qualifications: string;
  location: string;
  employmentType: EmploymentType | "";
  payType: PayType | "";
  flsaClassification: FlsaClassification | "";
  workLocation: WorkLocation | "";
  travelRequirement: TravelRequirement | "";
  standardWorkDays: string;
  standardStartTime: string;
  standardEndTime: string;
  standardLunchMinutes: string;
  standardHoursPerWeek: string;
  drugScreenRequired: boolean;
  backgroundCheckRequired: boolean;
  driversLicenseRequired: boolean;
  motorVehicleRecordRequired: boolean;
  liftRequirements: boolean;
  climbingRequirements: boolean;
  outdoorWork: boolean;
  overnightTravel: boolean;
  additionalPhysicalRequirements: string;
  certifications: string[];
  // Compensation
  startingPay: string;
  maximumPay: string;
  signOnBonus: string;
  commissionPlan: string;
  benefitsSummaryOverride: string;
  // Application Settings
  resumeRequired: boolean;
  coverLetterRequired: boolean;
  internalApplicantsOnly: boolean;
  externalApplicantsAllowed: boolean;
  autoCloseWhenFilled: boolean;
};

function emptyForm(): FormState {
  return {
    postingCode: "",
    title: "",
    hiringManagerUserId: "",
    department: "",
    visibility: "INTERNAL",
    numberOfOpenings: "1",
    postingDate: "",
    closingDate: "",
    expectedStartDate: "",
    description: "",
    responsibilities: "",
    qualifications: "",
    location: "",
    employmentType: "",
    payType: "",
    flsaClassification: "",
    workLocation: "",
    travelRequirement: "",
    standardWorkDays: "",
    standardStartTime: "",
    standardEndTime: "",
    standardLunchMinutes: "",
    standardHoursPerWeek: "",
    drugScreenRequired: false,
    backgroundCheckRequired: false,
    driversLicenseRequired: false,
    motorVehicleRecordRequired: false,
    liftRequirements: false,
    climbingRequirements: false,
    outdoorWork: false,
    overnightTravel: false,
    additionalPhysicalRequirements: "",
    certifications: [],
    startingPay: "",
    maximumPay: "",
    signOnBonus: "",
    commissionPlan: "",
    benefitsSummaryOverride: "",
    resumeRequired: false,
    coverLetterRequired: false,
    internalApplicantsOnly: false,
    externalApplicantsAllowed: true,
    autoCloseWhenFilled: false,
  };
}

const dateInput = (iso: string | null): string => (iso ? iso.slice(0, 10) : "");
const numStr = (n: number | null): string => (n != null ? String(n) : "");

function formFromPosting(p: JobPosting): FormState {
  return {
    postingCode: p.postingCode ?? "",
    title: p.title ?? "",
    hiringManagerUserId: p.hiringManagerUserId ?? "",
    department: p.department ?? "",
    visibility: p.visibility,
    numberOfOpenings: String(p.numberOfOpenings ?? 1),
    postingDate: dateInput(p.postingDate),
    closingDate: dateInput(p.closingDate),
    expectedStartDate: dateInput(p.expectedStartDate),
    description: p.description ?? "",
    responsibilities: p.responsibilities ?? "",
    qualifications: p.qualifications ?? "",
    location: p.location ?? "",
    employmentType: p.employmentType ?? "",
    payType: p.payType ?? "",
    flsaClassification: p.flsaClassification ?? "",
    workLocation: p.workLocation ?? "",
    travelRequirement: p.travelRequirement ?? "",
    standardWorkDays: p.standardWorkDays ?? "",
    standardStartTime: p.standardStartTime ?? "",
    standardEndTime: p.standardEndTime ?? "",
    standardLunchMinutes: numStr(p.standardLunchMinutes),
    standardHoursPerWeek: numStr(p.standardHoursPerWeek),
    drugScreenRequired: p.drugScreenRequired,
    backgroundCheckRequired: p.backgroundCheckRequired,
    driversLicenseRequired: p.driversLicenseRequired,
    motorVehicleRecordRequired: p.motorVehicleRecordRequired,
    liftRequirements: p.liftRequirements,
    climbingRequirements: p.climbingRequirements,
    outdoorWork: p.outdoorWork,
    overnightTravel: p.overnightTravel,
    additionalPhysicalRequirements: p.additionalPhysicalRequirements ?? "",
    certifications: (p.certifications ?? []).map((c) => c.name),
    startingPay: numStr(p.startingPay),
    maximumPay: numStr(p.maximumPay),
    signOnBonus: numStr(p.signOnBonus),
    commissionPlan: p.commissionPlan ?? "",
    benefitsSummaryOverride: p.benefitsSummaryOverride ?? "",
    resumeRequired: p.resumeRequired,
    coverLetterRequired: p.coverLetterRequired,
    internalApplicantsOnly: p.internalApplicantsOnly,
    externalApplicantsAllowed: p.externalApplicantsAllowed,
    autoCloseWhenFilled: p.autoCloseWhenFilled,
  };
}

// The Inherited Position Profile snapshot copied when a Position is selected.
// (Location is posting-specific and is NOT part of the Position Profile.)
function snapshotFromPosition(pos: Position): Partial<FormState> {
  return {
    title: pos.title ?? "",
    department: pos.department ?? "",
    description: pos.description ?? "",
    responsibilities: pos.standardResponsibilities ?? "",
    qualifications: pos.standardQualifications ?? "",
    employmentType: pos.defaultEmploymentType ?? "",
    payType: pos.payType ?? "",
    flsaClassification: pos.flsaClassification ?? "",
    workLocation: pos.workLocation ?? "",
    travelRequirement: pos.travelRequirement ?? "",
    standardWorkDays: pos.standardWorkDays ?? "",
    standardStartTime: pos.standardStartTime ?? "",
    standardEndTime: pos.standardEndTime ?? "",
    standardLunchMinutes: numStr(pos.standardLunchMinutes),
    standardHoursPerWeek: numStr(pos.standardHoursPerWeek),
    drugScreenRequired: pos.drugScreenRequired,
    backgroundCheckRequired: pos.backgroundCheckRequired,
    driversLicenseRequired: pos.driversLicenseRequired,
    motorVehicleRecordRequired: pos.motorVehicleRecordRequired,
    liftRequirements: pos.liftRequirements,
    climbingRequirements: pos.climbingRequirements,
    outdoorWork: pos.outdoorWork,
    overnightTravel: pos.overnightTravel,
    additionalPhysicalRequirements: pos.additionalPhysicalRequirements ?? "",
    // Related collections may be absent on some payloads; never assume they
    // exist. Treat a missing certifications collection as empty.
    certifications: (pos.certifications ?? []).map((c) => c.name),
  };
}

export function JobPostingFormModal({
  open,
  mode,
  posting,
  fromPosition,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  posting?: JobPosting | null;
  // When a posting is created from a Position, the caller passes the source
  // Position so the form can seed the inherited snapshot. The authoritative
  // snapshot is still taken server-side at create.
  fromPosition?: Position | null;
  onClose: () => void;
  onSaved: (saved: JobPosting) => void;
}) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);

  const [positionId, setPositionId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // positionId can only be changed while a posting is in DRAFT (backend rule).
  const positionLocked =
    mode === "edit" && posting != null && posting.status !== "DRAFT";

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && posting) {
      setPositionId(posting.positionId);
      setForm(formFromPosting(posting));
    } else {
      setPositionId(fromPosition?.id ?? "");
      setForm({
        ...emptyForm(),
        ...(fromPosition ? snapshotFromPosition(fromPosition) : {}),
      });
    }
    setError(null);
  }, [open, mode, posting, fromPosition]);

  // Load active positions for the picker whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setPositionsLoading(true);
    listPositions({ isActive: true, limit: 200 })
      .then((res) => {
        if (!active) return;
        let items = res.items;
        // Keep the current (possibly inactive) position selectable in edit mode.
        if (
          posting?.position &&
          !items.some((p) => p.id === posting.position!.id)
        ) {
          items = [
            {
              id: posting.position.id,
              title: posting.position.title,
              department: posting.position.department,
            } as Position,
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
  const publicUrl = posting ? publicApplicationUrl(posting) : null;

  const onSelectPosition = (nextId: string) => {
    setPositionId(nextId);
    // Selecting a Position copies its Position Profile snapshot into the posting
    // (create mode). Editable afterward; the Position Profile is never modified.
    if (mode === "create") {
      const chosen = positions.find((p) => p.id === nextId);
      setForm((prev) => ({
        ...prev,
        ...(chosen ? snapshotFromPosition(chosen) : {}),
      }));
    }
  };

  async function handleSubmit() {
    if (!positionId.trim()) {
      setError("A position is required.");
      return;
    }

    const parseNum = (s: string): number | null => {
      const t = s.trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };

    const openings = parseInt(form.numberOfOpenings, 10);

    const input: JobPostingInput = {
      positionId,
      postingCode: form.postingCode.trim(),
      title: form.title.trim(),
      department: form.department.trim(),
      visibility: form.visibility,
      numberOfOpenings: Number.isFinite(openings) && openings > 0 ? openings : 1,
      postingDate: form.postingDate || null,
      closingDate: form.closingDate || null,
      expectedStartDate: form.expectedStartDate || null,
      // Inherited Position Profile snapshot (overrides)
      description: form.description.trim(),
      responsibilities: form.responsibilities.trim(),
      qualifications: form.qualifications.trim(),
      location: form.location.trim(),
      employmentType: form.employmentType || null,
      payType: form.payType || null,
      flsaClassification: form.flsaClassification || null,
      workLocation: form.workLocation || null,
      travelRequirement: form.travelRequirement || null,
      standardWorkDays: form.standardWorkDays.trim(),
      standardStartTime: form.standardStartTime || null,
      standardEndTime: form.standardEndTime || null,
      standardLunchMinutes: form.standardLunchMinutes
        ? Number(form.standardLunchMinutes)
        : null,
      standardHoursPerWeek: parseNum(form.standardHoursPerWeek),
      drugScreenRequired: form.drugScreenRequired,
      backgroundCheckRequired: form.backgroundCheckRequired,
      driversLicenseRequired: form.driversLicenseRequired,
      motorVehicleRecordRequired: form.motorVehicleRecordRequired,
      liftRequirements: form.liftRequirements,
      climbingRequirements: form.climbingRequirements,
      outdoorWork: form.outdoorWork,
      overnightTravel: form.overnightTravel,
      additionalPhysicalRequirements: form.additionalPhysicalRequirements.trim(),
      certifications: form.certifications
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
      // Compensation
      startingPay: parseNum(form.startingPay),
      maximumPay: parseNum(form.maximumPay),
      signOnBonus: parseNum(form.signOnBonus),
      commissionPlan: form.commissionPlan.trim(),
      benefitsSummaryOverride: form.benefitsSummaryOverride.trim(),
      // Application Settings
      resumeRequired: form.resumeRequired,
      coverLetterRequired: form.coverLetterRequired,
      internalApplicantsOnly: form.internalApplicantsOnly,
      externalApplicantsAllowed: form.externalApplicantsAllowed,
      autoCloseWhenFilled: form.autoCloseWhenFilled,
    };

    // Hiring manager: on create only send when chosen; on edit always send so an
    // empty value clears the assignment.
    const hm = form.hiringManagerUserId.trim();
    if (mode === "create") {
      if (hm) input.hiringManagerUserId = hm;
    } else {
      input.hiringManagerUserId = hm;
    }

    setSaving(true);
    setError(null);
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

          {/* Posting Information */}
          <SectionTitle>Posting Information</SectionTitle>
          <label className="pf-field">
            <span className="pf-label">
              Position <span className="pf-req">*</span>
            </span>
            <select
              className="pf-input"
              value={positionId}
              onChange={(e) => onSelectPosition(e.target.value)}
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
                  {p.isActive === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {positionLocked ? (
              <span className="pf-hint">
                Position can only be changed while the posting is a draft.
              </span>
            ) : (
              <span className="pf-hint">
                Selecting a Position copies its Position Profile into this Job
                Posting as a snapshot. Any inherited values may be edited without
                modifying the Position Profile.
              </span>
            )}
          </label>

          <div className="pf-grid2">
            <label className="pf-field">
              <span className="pf-label">Posting Code</span>
              <input
                className="pf-input"
                value={form.postingCode}
                onChange={(e) => set("postingCode", e.target.value)}
                maxLength={60}
                placeholder="Optional reference, e.g. REQ-1042"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Department</span>
              <input
                className="pf-input"
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                maxLength={200}
                placeholder="Inherited from the position"
              />
            </label>
          </div>

          <label className="pf-field">
            <span className="pf-label">Job Title</span>
            <input
              className="pf-input"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={200}
              placeholder="Defaults to the position title"
            />
          </label>

          <div className="pf-grid2">
            <div className="pf-field">
              <span className="pf-label">Hiring Manager</span>
              <StaffSelect
                value={form.hiringManagerUserId}
                onChange={(v) => set("hiringManagerUserId", v)}
                disabled={saving}
              />
            </div>
            <label className="pf-field">
              <span className="pf-label">Visibility</span>
              <select
                className="pf-input"
                value={form.visibility}
                onChange={(e) =>
                  set("visibility", e.target.value as PostingVisibility)
                }
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pf-grid2">
            <label className="pf-field">
              <span className="pf-label">Number of Openings</span>
              <input
                type="number"
                className="pf-input"
                value={form.numberOfOpenings}
                onChange={(e) => set("numberOfOpenings", e.target.value)}
                min={1}
                step={1}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Posting Date</span>
              <input
                type="date"
                className="pf-input"
                value={form.postingDate}
                onChange={(e) => set("postingDate", e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Closing Date</span>
              <input
                type="date"
                className="pf-input"
                value={form.closingDate}
                onChange={(e) => set("closingDate", e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Expected Start Date</span>
              <input
                type="date"
                className="pf-input"
                value={form.expectedStartDate}
                onChange={(e) => set("expectedStartDate", e.target.value)}
              />
            </label>
          </div>

          {/* Inherited Position Profile (Snapshot) */}
          <SectionTitle>Inherited Position Profile (Snapshot)</SectionTitle>
          <span className="pf-hint">
            Copied from the Position when it was selected. Editing here changes
            only this Job Posting.
          </span>
          <label className="pf-field">
            <span className="pf-label">Position Description</span>
            <textarea
              className="pf-textarea"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={20000}
              rows={4}
              placeholder={"Role summary\u2026"}
            />
          </label>
          <label className="pf-field">
            <span className="pf-label">Standard Responsibilities</span>
            <textarea
              className="pf-textarea"
              value={form.responsibilities}
              onChange={(e) => set("responsibilities", e.target.value)}
              maxLength={20000}
              rows={4}
            />
          </label>
          <label className="pf-field">
            <span className="pf-label">Standard Qualifications</span>
            <textarea
              className="pf-textarea"
              value={form.qualifications}
              onChange={(e) => set("qualifications", e.target.value)}
              maxLength={20000}
              rows={4}
            />
          </label>
          <div className="pf-grid2">
            <label className="pf-field">
              <span className="pf-label">Location</span>
              <input
                className="pf-input"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                maxLength={200}
                placeholder="e.g. Houston, TX or Remote"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Employment Type</span>
              <select
                className="pf-input"
                value={form.employmentType}
                onChange={(e) =>
                  set("employmentType", e.target.value as EmploymentType | "")
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
            <label className="pf-field">
              <span className="pf-label">Pay Type</span>
              <select
                className="pf-input"
                value={form.payType}
                onChange={(e) => set("payType", e.target.value as PayType | "")}
              >
                <option value="">Unspecified</option>
                {PAY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PAY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span className="pf-label">FLSA Classification</span>
              <select
                className="pf-input"
                value={form.flsaClassification}
                onChange={(e) =>
                  set(
                    "flsaClassification",
                    e.target.value as FlsaClassification | "",
                  )
                }
              >
                <option value="">Unspecified</option>
                {FLSA_CLASSIFICATIONS.map((t) => (
                  <option key={t} value={t}>
                    {FLSA_CLASSIFICATION_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span className="pf-label">Work Location</span>
              <select
                className="pf-input"
                value={form.workLocation}
                onChange={(e) =>
                  set("workLocation", e.target.value as WorkLocation | "")
                }
              >
                <option value="">Unspecified</option>
                {WORK_LOCATIONS.map((t) => (
                  <option key={t} value={t}>
                    {WORK_LOCATION_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span className="pf-label">Travel Requirement</span>
              <select
                className="pf-input"
                value={form.travelRequirement}
                onChange={(e) =>
                  set(
                    "travelRequirement",
                    e.target.value as TravelRequirement | "",
                  )
                }
              >
                <option value="">Unspecified</option>
                {TRAVEL_REQUIREMENTS.map((t) => (
                  <option key={t} value={t}>
                    {TRAVEL_REQUIREMENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="pf-field">
            <span className="pf-label">Standard Work Days</span>
            <input
              className="pf-input"
              value={form.standardWorkDays}
              onChange={(e) => set("standardWorkDays", e.target.value)}
              maxLength={200}
              placeholder="e.g. Monday–Friday"
            />
          </label>
          <div className="pf-grid2">
            <label className="pf-field">
              <span className="pf-label">Standard Start Time</span>
              <input
                type="time"
                className="pf-input"
                value={form.standardStartTime}
                onChange={(e) => set("standardStartTime", e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Standard End Time</span>
              <input
                type="time"
                className="pf-input"
                value={form.standardEndTime}
                onChange={(e) => set("standardEndTime", e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Standard Lunch Duration</span>
              <select
                className="pf-input"
                value={form.standardLunchMinutes}
                onChange={(e) => set("standardLunchMinutes", e.target.value)}
              >
                <option value="">Unspecified</option>
                {LUNCH_DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span className="pf-label">Standard Hours Per Week</span>
              <input
                type="number"
                className="pf-input"
                value={form.standardHoursPerWeek}
                onChange={(e) => set("standardHoursPerWeek", e.target.value)}
                min={0}
                max={168}
                step={0.5}
                placeholder="e.g. 40"
              />
            </label>
          </div>

          <span className="pf-sublabel">Hiring Requirements</span>
          <div className="pf-check-grid">
            <CheckRow
              label="Drug Screen"
              checked={form.drugScreenRequired}
              onChange={(v) => set("drugScreenRequired", v)}
            />
            <CheckRow
              label="Background Check"
              checked={form.backgroundCheckRequired}
              onChange={(v) => set("backgroundCheckRequired", v)}
            />
            <CheckRow
              label="Driver's License"
              checked={form.driversLicenseRequired}
              onChange={(v) => set("driversLicenseRequired", v)}
            />
            <CheckRow
              label="Motor Vehicle Record"
              checked={form.motorVehicleRecordRequired}
              onChange={(v) => set("motorVehicleRecordRequired", v)}
            />
          </div>

          <span className="pf-sublabel">Physical Requirements</span>
          <div className="pf-check-grid">
            <CheckRow
              label="Lift Requirements"
              checked={form.liftRequirements}
              onChange={(v) => set("liftRequirements", v)}
            />
            <CheckRow
              label="Climbing Requirements"
              checked={form.climbingRequirements}
              onChange={(v) => set("climbingRequirements", v)}
            />
            <CheckRow
              label="Outdoor Work"
              checked={form.outdoorWork}
              onChange={(v) => set("outdoorWork", v)}
            />
            <CheckRow
              label="Overnight Travel"
              checked={form.overnightTravel}
              onChange={(v) => set("overnightTravel", v)}
            />
          </div>
          <label className="pf-field">
            <span className="pf-label">Additional Physical Requirements</span>
            <textarea
              className="pf-textarea"
              value={form.additionalPhysicalRequirements}
              onChange={(e) =>
                set("additionalPhysicalRequirements", e.target.value)
              }
              maxLength={20000}
              rows={3}
            />
          </label>

          <div className="pf-field">
            <span className="pf-label">Default Certifications</span>
            <span className="pf-hint">
              Copied from the position; edit for this posting only.
            </span>
            {form.certifications.map((cert, idx) => (
              <div key={idx} className="pf-repeat-row">
                <input
                  className="pf-input"
                  value={cert}
                  onChange={(e) =>
                    set(
                      "certifications",
                      form.certifications.map((c, i) =>
                        i === idx ? e.target.value : c,
                      ),
                    )
                  }
                  maxLength={200}
                  placeholder="e.g. OSHA 30"
                />
                <button
                  type="button"
                  className="pf-remove"
                  onClick={() =>
                    set(
                      "certifications",
                      form.certifications.filter((_, i) => i !== idx),
                    )
                  }
                  aria-label="Remove certification"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              className="pf-add"
              onClick={() => set("certifications", [...form.certifications, ""])}
            >
              + Add Certification
            </button>
          </div>

          {/* Compensation */}
          <SectionTitle>Compensation</SectionTitle>
          <div className="pf-grid2">
            <label className="pf-field">
              <span className="pf-label">Starting Pay</span>
              <input
                type="number"
                className="pf-input"
                value={form.startingPay}
                onChange={(e) => set("startingPay", e.target.value)}
                min={0}
                step="any"
                placeholder="e.g. 55000"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Maximum Pay</span>
              <input
                type="number"
                className="pf-input"
                value={form.maximumPay}
                onChange={(e) => set("maximumPay", e.target.value)}
                min={0}
                step="any"
                placeholder="e.g. 72000"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Sign-on Bonus</span>
              <input
                type="number"
                className="pf-input"
                value={form.signOnBonus}
                onChange={(e) => set("signOnBonus", e.target.value)}
                min={0}
                step="any"
                placeholder="Optional"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Commission Plan</span>
              <input
                className="pf-input"
                value={form.commissionPlan}
                onChange={(e) => set("commissionPlan", e.target.value)}
                maxLength={2000}
                placeholder="Optional"
              />
            </label>
          </div>
          <label className="pf-field">
            <span className="pf-label">Benefits Summary Override</span>
            <textarea
              className="pf-textarea"
              value={form.benefitsSummaryOverride}
              onChange={(e) => set("benefitsSummaryOverride", e.target.value)}
              maxLength={20000}
              rows={3}
              placeholder="Optional — overrides the standard benefits summary"
            />
          </label>

          {/* Application Settings */}
          <SectionTitle>Application Settings</SectionTitle>
          <div className="pf-check-grid">
            <CheckRow
              label="Resume Required"
              checked={form.resumeRequired}
              onChange={(v) => set("resumeRequired", v)}
            />
            <CheckRow
              label="Cover Letter Required"
              checked={form.coverLetterRequired}
              onChange={(v) => set("coverLetterRequired", v)}
            />
            <CheckRow
              label="Internal Applicants Only"
              checked={form.internalApplicantsOnly}
              onChange={(v) => set("internalApplicantsOnly", v)}
            />
            <CheckRow
              label="External Applicants Allowed"
              checked={form.externalApplicantsAllowed}
              onChange={(v) => set("externalApplicantsAllowed", v)}
            />
            <CheckRow
              label="Auto-Close When Filled"
              checked={form.autoCloseWhenFilled}
              onChange={(v) => set("autoCloseWhenFilled", v)}
            />
          </div>
          {publicUrl ? (
            <label className="pf-field">
              <span className="pf-label">Public Application URL</span>
              <input
                className="pf-input"
                value={publicUrl}
                readOnly
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
          ) : null}
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
            max-width: 640px;
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
          .pf-grid2 {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
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
          .pf-sublabel {
            font-size: 12px;
            font-weight: 700;
            color: #4b5563;
          }
          .pf-hint {
            font-size: 11.5px;
            color: #9ca3af;
          }
          .pf-req {
            color: #dc2626;
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
          .pf-input[readonly] {
            background: #f8fafc;
            color: #6b7280;
          }
          .pf-input::placeholder,
          .pf-textarea::placeholder {
            color: #9ca3af;
          }
          .pf-check-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .pf-repeat-row {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          .pf-remove {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 7px;
            color: #991b1b;
            font-size: 18px;
            line-height: 1;
            width: 34px;
            height: 34px;
            cursor: pointer;
            flex-shrink: 0;
          }
          .pf-remove:hover {
            background: #fff1f2;
            border-color: #fecaca;
          }
          .pf-add {
            align-self: flex-start;
            background: #ffffff;
            border: 1px dashed #cbd5e1;
            border-radius: 7px;
            color: #2563eb;
            font-size: 12.5px;
            font-weight: 600;
            padding: 7px 12px;
            cursor: pointer;
          }
          .pf-add:hover {
            background: #f8fafc;
            border-color: #94a3b8;
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
            .pf-grid2,
            .pf-check-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pf-section">
      <span className="pf-section-title">{children}</span>
      <style jsx>{`
        .pf-section {
          padding-top: 8px;
          margin-top: 4px;
          border-top: 1px solid #f1f5f9;
        }
        .pf-section-title {
          font-size: 12px;
          font-weight: 700;
          color: #111827;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
      `}</style>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="cr">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
      <style jsx>{`
        .cr {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #374151;
        }
        .cr input {
          accent-color: #2563eb;
          width: 15px;
          height: 15px;
        }
      `}</style>
    </label>
  );
}
