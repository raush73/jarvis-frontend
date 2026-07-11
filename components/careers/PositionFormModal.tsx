"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FLSA_CLASSIFICATIONS,
  FLSA_CLASSIFICATION_LABELS,
  FlsaClassification,
  LUNCH_DURATIONS,
  PAY_TYPES,
  PAY_TYPE_LABELS,
  PayType,
  Position,
  PositionInput,
  TRAVEL_REQUIREMENTS,
  TRAVEL_REQUIREMENT_LABELS,
  TravelRequirement,
  WORK_LOCATIONS,
  WORK_LOCATION_LABELS,
  WorkLocation,
  createPosition,
  listPositions,
  updatePosition,
} from "@/lib/careers/positionsApi";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
} from "@/lib/careers/jobPostingsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { useDialogA11y } from "./useDialogA11y";

type ReportsToOption = { id: string; title: string; isActive: boolean };

/**
 * Jarvis Careers V2.1.6A - Create / Edit Position Profile dialog.
 *
 * Implements the LOCKED Position Profile governance sections: Position
 * Information, Employment Defaults, Standard Schedule, Reporting Structure,
 * Position Defaults, Hiring Requirements, Physical Requirements, Certifications.
 * Job Posting inheritance is unchanged (deferred to V2.1.6B).
 */
export function PositionFormModal({
  open,
  mode,
  position,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  position?: Position | null;
  onClose: () => void;
  onSaved: (saved: Position) => void;
}) {
  // Position Information
  const [positionCode, setPositionCode] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Employment Defaults
  const [defaultEmploymentType, setDefaultEmploymentType] = useState<
    EmploymentType | ""
  >("");
  const [payType, setPayType] = useState<PayType | "">("");
  const [flsaClassification, setFlsaClassification] = useState<
    FlsaClassification | ""
  >("");
  const [workLocation, setWorkLocation] = useState<WorkLocation | "">("");
  const [travelRequirement, setTravelRequirement] = useState<
    TravelRequirement | ""
  >("");
  // Standard Schedule
  const [standardWorkDays, setStandardWorkDays] = useState("");
  const [standardStartTime, setStandardStartTime] = useState("");
  const [standardEndTime, setStandardEndTime] = useState("");
  const [standardLunchMinutes, setStandardLunchMinutes] = useState("");
  const [standardHoursPerWeek, setStandardHoursPerWeek] = useState("");
  // Reporting Structure
  const [reportsToIds, setReportsToIds] = useState<string[]>([]);
  const [reportsToOptions, setReportsToOptions] = useState<ReportsToOption[]>(
    [],
  );
  const [reportsToSearch, setReportsToSearch] = useState("");
  // Position Defaults
  const [standardResponsibilities, setStandardResponsibilities] = useState("");
  const [standardQualifications, setStandardQualifications] = useState("");
  // Hiring Requirements
  const [drugScreenRequired, setDrugScreenRequired] = useState(false);
  const [backgroundCheckRequired, setBackgroundCheckRequired] = useState(false);
  const [driversLicenseRequired, setDriversLicenseRequired] = useState(false);
  const [motorVehicleRecordRequired, setMotorVehicleRecordRequired] =
    useState(false);
  // Physical Requirements
  const [liftRequirements, setLiftRequirements] = useState(false);
  const [climbingRequirements, setClimbingRequirements] = useState(false);
  const [outdoorWork, setOutdoorWork] = useState(false);
  const [overnightTravel, setOvernightTravel] = useState(false);
  const [additionalPhysicalRequirements, setAdditionalPhysicalRequirements] =
    useState("");
  // Certifications
  const [certifications, setCertifications] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && position) {
      setPositionCode(position.positionCode ?? "");
      setTitle(position.title ?? "");
      setDepartment(position.department ?? "");
      setDescription(position.description ?? "");
      setIsActive(position.isActive);
      setDefaultEmploymentType(position.defaultEmploymentType ?? "");
      setPayType(position.payType ?? "");
      setFlsaClassification(position.flsaClassification ?? "");
      setWorkLocation(position.workLocation ?? "");
      setTravelRequirement(position.travelRequirement ?? "");
      setStandardWorkDays(position.standardWorkDays ?? "");
      setStandardStartTime(position.standardStartTime ?? "");
      setStandardEndTime(position.standardEndTime ?? "");
      setStandardLunchMinutes(
        position.standardLunchMinutes != null
          ? String(position.standardLunchMinutes)
          : "",
      );
      setStandardHoursPerWeek(
        position.standardHoursPerWeek != null
          ? String(position.standardHoursPerWeek)
          : "",
      );
      setReportsToIds(position.reportsTo.map((r) => r.reportsToPositionId));
      setStandardResponsibilities(position.standardResponsibilities ?? "");
      setStandardQualifications(position.standardQualifications ?? "");
      setDrugScreenRequired(position.drugScreenRequired);
      setBackgroundCheckRequired(position.backgroundCheckRequired);
      setDriversLicenseRequired(position.driversLicenseRequired);
      setMotorVehicleRecordRequired(position.motorVehicleRecordRequired);
      setLiftRequirements(position.liftRequirements);
      setClimbingRequirements(position.climbingRequirements);
      setOutdoorWork(position.outdoorWork);
      setOvernightTravel(position.overnightTravel);
      setAdditionalPhysicalRequirements(
        position.additionalPhysicalRequirements ?? "",
      );
      setCertifications(position.certifications.map((c) => c.name));
    } else {
      setPositionCode("");
      setTitle("");
      setDepartment("");
      setDescription("");
      setIsActive(true);
      setDefaultEmploymentType("");
      setPayType("");
      setFlsaClassification("");
      setWorkLocation("");
      setTravelRequirement("");
      setStandardWorkDays("");
      setStandardStartTime("");
      setStandardEndTime("");
      setStandardLunchMinutes("");
      setStandardHoursPerWeek("");
      setReportsToIds([]);
      setStandardResponsibilities("");
      setStandardQualifications("");
      setDrugScreenRequired(false);
      setBackgroundCheckRequired(false);
      setDriversLicenseRequired(false);
      setMotorVehicleRecordRequired(false);
      setLiftRequirements(false);
      setClimbingRequirements(false);
      setOutdoorWork(false);
      setOvernightTravel(false);
      setAdditionalPhysicalRequirements("");
      setCertifications([]);
    }
    setReportsToSearch("");
    setError(null);
  }, [open, mode, position]);

  // Load the Position picker options for Reporting Structure (exclude self).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listPositions({ limit: 200 });
        if (cancelled) return;
        setReportsToOptions(
          res.items
            .filter((p) => p.id !== position?.id)
            .map((p) => ({ id: p.id, title: p.title, isActive: p.isActive })),
        );
      } catch {
        if (!cancelled) setReportsToOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, position?.id]);

  const dialogRef = useDialogA11y<HTMLDivElement>({
    open,
    onClose,
    busy: saving,
  });

  const filteredReportsTo = useMemo(() => {
    const q = reportsToSearch.trim().toLowerCase();
    const list = q
      ? reportsToOptions.filter((o) => o.title.toLowerCase().includes(q))
      : reportsToOptions;
    // Selected first, then by title.
    return [...list].sort((a, b) => {
      const aSel = reportsToIds.includes(a.id) ? 0 : 1;
      const bSel = reportsToIds.includes(b.id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.title.localeCompare(b.title);
    });
  }, [reportsToOptions, reportsToSearch, reportsToIds]);

  if (!open) return null;

  const canSave = title.trim().length > 0 && !saving;

  const toggleReportsTo = (id: string) => {
    setReportsToIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    let hoursValue: number | null = null;
    if (standardHoursPerWeek.trim()) {
      const n = Number(standardHoursPerWeek);
      if (Number.isNaN(n) || n < 0 || n > 168) {
        setError("Hours Per Week must be a number between 0 and 168.");
        return;
      }
      hoursValue = n;
    }

    setSaving(true);
    setError(null);
    const input: PositionInput = {
      positionCode: positionCode.trim() || null,
      title: title.trim(),
      department: department.trim() || null,
      description: description.trim() || null,
      isActive,
      defaultEmploymentType: defaultEmploymentType || null,
      payType: payType || null,
      flsaClassification: flsaClassification || null,
      workLocation: workLocation || null,
      travelRequirement: travelRequirement || null,
      standardWorkDays: standardWorkDays.trim() || null,
      standardStartTime: standardStartTime || null,
      standardEndTime: standardEndTime || null,
      standardLunchMinutes: standardLunchMinutes
        ? Number(standardLunchMinutes)
        : null,
      standardHoursPerWeek: hoursValue,
      reportsToPositionIds: reportsToIds,
      // Position Defaults support explicit clearing (emptied field -> null).
      standardResponsibilities: standardResponsibilities.trim() || null,
      standardQualifications: standardQualifications.trim() || null,
      drugScreenRequired,
      backgroundCheckRequired,
      driversLicenseRequired,
      motorVehicleRecordRequired,
      liftRequirements,
      climbingRequirements,
      outdoorWork,
      overnightTravel,
      additionalPhysicalRequirements:
        additionalPhysicalRequirements.trim() || null,
      certifications: certifications
        .map((c) => c.trim())
        .filter((c) => c.length > 0),
    };
    try {
      const saved =
        mode === "create"
          ? await createPosition(input)
          : await updatePosition(position!.id, input);
      onSaved(saved);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to save position."));
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
        aria-label={mode === "create" ? "New Position" : "Edit Position"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>{mode === "create" ? "New Position" : "Edit Position"}</h3>
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

          {/* Position Information */}
          <SectionTitle>Position Information</SectionTitle>
          <div className="pf-grid2">
            <label className="pf-field">
              <span className="pf-label">Position Code</span>
              <input
                className="pf-input"
                value={positionCode}
                onChange={(e) => setPositionCode(e.target.value)}
                maxLength={50}
                placeholder="e.g. ACCT-AR"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Department</span>
              <input
                className="pf-input"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                maxLength={200}
                placeholder="e.g. Finance"
              />
            </label>
          </div>

          <label className="pf-field">
            <span className="pf-label">
              Position Title <span className="pf-req">*</span>
            </span>
            <input
              className="pf-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Accounts Receivable Clerk"
              data-autofocus
            />
          </label>

          <label className="pf-field">
            <span className="pf-label">Description</span>
            <textarea
              className="pf-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder={"Permanent description of this role\u2026"}
            />
          </label>

          <label className="pf-check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span>Active</span>
          </label>

          {/* Employment Defaults */}
          <SectionTitle>Employment Defaults</SectionTitle>
          <div className="pf-grid2">
            <label className="pf-field">
              <span className="pf-label">Employment Type</span>
              <select
                className="pf-input"
                value={defaultEmploymentType}
                onChange={(e) =>
                  setDefaultEmploymentType(
                    e.target.value as EmploymentType | "",
                  )
                }
              >
                <option value="">No default</option>
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
                value={payType}
                onChange={(e) => setPayType(e.target.value as PayType | "")}
              >
                <option value="">No default</option>
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
                value={flsaClassification}
                onChange={(e) =>
                  setFlsaClassification(
                    e.target.value as FlsaClassification | "",
                  )
                }
              >
                <option value="">No default</option>
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
                value={workLocation}
                onChange={(e) =>
                  setWorkLocation(e.target.value as WorkLocation | "")
                }
              >
                <option value="">No default</option>
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
                value={travelRequirement}
                onChange={(e) =>
                  setTravelRequirement(e.target.value as TravelRequirement | "")
                }
              >
                <option value="">No default</option>
                {TRAVEL_REQUIREMENTS.map((t) => (
                  <option key={t} value={t}>
                    {TRAVEL_REQUIREMENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Standard Schedule */}
          <SectionTitle>Standard Schedule</SectionTitle>
          <label className="pf-field">
            <span className="pf-label">Work Days</span>
            <input
              className="pf-input"
              value={standardWorkDays}
              onChange={(e) => setStandardWorkDays(e.target.value)}
              maxLength={200}
              placeholder="e.g. Monday-Friday"
            />
          </label>
          <div className="pf-grid2">
            <label className="pf-field">
              <span className="pf-label">Start Time</span>
              <input
                type="time"
                className="pf-input"
                value={standardStartTime}
                onChange={(e) => setStandardStartTime(e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">End Time</span>
              <input
                type="time"
                className="pf-input"
                value={standardEndTime}
                onChange={(e) => setStandardEndTime(e.target.value)}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Lunch Duration</span>
              <select
                className="pf-input"
                value={standardLunchMinutes}
                onChange={(e) => setStandardLunchMinutes(e.target.value)}
              >
                <option value="">No default</option>
                {LUNCH_DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="pf-field">
              <span className="pf-label">Hours Per Week</span>
              <input
                type="number"
                className="pf-input"
                value={standardHoursPerWeek}
                onChange={(e) => setStandardHoursPerWeek(e.target.value)}
                min={0}
                max={168}
                step={0.5}
                placeholder="e.g. 40"
              />
            </label>
          </div>

          {/* Reporting Structure */}
          <SectionTitle>Reporting Structure</SectionTitle>
          <div className="pf-field">
            <span className="pf-label">Reports To</span>
            <span className="pf-hint">
              Select one or more positions this role reports to.
            </span>
            <input
              className="pf-input"
              value={reportsToSearch}
              onChange={(e) => setReportsToSearch(e.target.value)}
              placeholder="Search positions\u2026"
            />
            <div className="pf-picker">
              {filteredReportsTo.length === 0 ? (
                <div className="pf-picker-empty">No positions available.</div>
              ) : (
                filteredReportsTo.map((o) => (
                  <label key={o.id} className="pf-picker-row">
                    <input
                      type="checkbox"
                      checked={reportsToIds.includes(o.id)}
                      onChange={() => toggleReportsTo(o.id)}
                    />
                    <span>
                      {o.title}
                      {!o.isActive ? (
                        <span className="pf-inactive"> (inactive)</span>
                      ) : null}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Position Defaults */}
          <SectionTitle>Position Defaults</SectionTitle>
          <label className="pf-field">
            <span className="pf-label">Responsibilities</span>
            <textarea
              className="pf-textarea"
              value={standardResponsibilities}
              onChange={(e) => setStandardResponsibilities(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder={"Typical responsibilities for this role\u2026"}
            />
          </label>
          <label className="pf-field">
            <span className="pf-label">Qualifications</span>
            <textarea
              className="pf-textarea"
              value={standardQualifications}
              onChange={(e) => setStandardQualifications(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder={"Typical qualifications / requirements\u2026"}
            />
          </label>

          {/* Hiring Requirements */}
          <SectionTitle>Hiring Requirements</SectionTitle>
          <div className="pf-check-grid">
            <CheckRow
              label="Drug Screen"
              checked={drugScreenRequired}
              onChange={setDrugScreenRequired}
            />
            <CheckRow
              label="Background Check"
              checked={backgroundCheckRequired}
              onChange={setBackgroundCheckRequired}
            />
            <CheckRow
              label="Driver's License"
              checked={driversLicenseRequired}
              onChange={setDriversLicenseRequired}
            />
            <CheckRow
              label="Motor Vehicle Record"
              checked={motorVehicleRecordRequired}
              onChange={setMotorVehicleRecordRequired}
            />
          </div>

          {/* Physical Requirements */}
          <SectionTitle>Physical Requirements</SectionTitle>
          <div className="pf-check-grid">
            <CheckRow
              label="Lift Requirements"
              checked={liftRequirements}
              onChange={setLiftRequirements}
            />
            <CheckRow
              label="Climbing Requirements"
              checked={climbingRequirements}
              onChange={setClimbingRequirements}
            />
            <CheckRow
              label="Outdoor Work"
              checked={outdoorWork}
              onChange={setOutdoorWork}
            />
            <CheckRow
              label="Overnight Travel"
              checked={overnightTravel}
              onChange={setOvernightTravel}
            />
          </div>
          <label className="pf-field">
            <span className="pf-label">Additional Physical Requirements</span>
            <textarea
              className="pf-textarea"
              value={additionalPhysicalRequirements}
              onChange={(e) =>
                setAdditionalPhysicalRequirements(e.target.value)
              }
              maxLength={5000}
              rows={3}
              placeholder={"Any additional physical requirements\u2026"}
            />
          </label>

          {/* Certifications */}
          <SectionTitle>Certifications</SectionTitle>
          <div className="pf-field">
            <span className="pf-label">Position Certifications</span>
            <span className="pf-hint">
              Optional. Add one or more; leave empty for none.
            </span>
            {certifications.map((cert, idx) => (
              <div key={idx} className="pf-repeat-row">
                <input
                  className="pf-input"
                  value={cert}
                  onChange={(e) =>
                    setCertifications((prev) =>
                      prev.map((c, i) => (i === idx ? e.target.value : c)),
                    )
                  }
                  maxLength={200}
                  placeholder="e.g. CPA"
                />
                <button
                  type="button"
                  className="pf-remove"
                  onClick={() =>
                    setCertifications((prev) =>
                      prev.filter((_, i) => i !== idx),
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
              onClick={() => setCertifications((prev) => [...prev, ""])}
            >
              + Add Certification
            </button>
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
                ? "Create Position"
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
          .pf-check-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .pf-picker {
            border: 1px solid #e5e7eb;
            border-radius: 7px;
            max-height: 170px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }
          .pf-picker-row {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 10px;
            font-size: 13px;
            color: #374151;
            border-bottom: 1px solid #f8fafc;
          }
          .pf-picker-row input {
            accent-color: #2563eb;
            width: 15px;
            height: 15px;
          }
          .pf-inactive {
            color: #9ca3af;
            font-style: italic;
          }
          .pf-picker-empty {
            padding: 12px;
            font-size: 12.5px;
            color: #9ca3af;
            text-align: center;
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
