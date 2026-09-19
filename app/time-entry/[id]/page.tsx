"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  createCustomerJob,
  describeCustomerJobCreateError,
  fetchCustomerJobs,
  fetchCustomerReviewState,
  fetchWorkingTimesheetDetail,
  finalApproveWorkingTimesheet,
  initialApproveWorkingTimesheet,
  markWorkingTimesheetReadyForApprovals,
  saveWorkingTimesheetDraft,
  type CustomerJob,
  type CustomerReviewState,
  type FinalApprovalExceptionKind,
  type WorkingTimesheetDetail,
  type WorkingTimesheetReadiness,
} from "@/lib/timeEntry/workingTimesheetApi";
import {
  describeReadinessBlockers,
  describeReadinessState,
} from "@/lib/timeEntry/readinessReasons";
import { buildDraftPayload } from "@/lib/timeEntry/buildDraftPayload";
import { hydrateDraftState } from "@/lib/timeEntry/hydrateDraftState";

// =============================================================================
// SHIFT DIFFERENTIAL GATE — AUTHORITATIVE, SERVER-DERIVED, PER DATE
//
// TE-SD-2A replaced a hard-coded `JOB_HAS_SHIFT_DIFF = true` demo constant with
// `detail.sdEligibilityByDate`, which the backend derives from the Job Order's SD agreement.
// The answer is per crew-week DATE, not per sheet, so that a future governed effective-dated
// SD change needs no change here.
//
// This is a display gate only. The Save Draft writer enforces the same rule independently,
// because a UI can be bypassed and persisted SD must never lack an economic basis.
// =============================================================================

/** Is Shift Differential available on this crew-week day index (0 = Monday)? */
function isSdEligibleOnDayIndex(
  sdEligibilityByDate: Record<string, boolean>,
  weekStart: string,
  dayIdx: number,
): boolean {
  if (!weekStart) return false;
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayIdx);
  return sdEligibilityByDate[date.toISOString().slice(0, 10)] === true;
}

type JobOption = { id: string; name: string };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type EntryMode = "daily" | "weekly";

export interface JobRow {
  /**
   * TRANSIENT RENDER IDENTITY ONLY. React key and SD-flag map key. Never persisted, and never
   * Customer Job identity.
   */
  id: string;
  /**
   * The parent Job Order reference this row inherits. It is the PROJECT, not the Customer Job,
   * and it is what `projectRef` persists.
   */
  jobId: string;
  /**
   * TE-S2B8 the selected durable Customer Job, or null when none is selected.
   *
   * This is the row's BUSINESS identity: it is created once through the Order-owned API, shared
   * across workers, and reused in later weeks. It is deliberately separate from `id` (transient),
   * from the row's ordinal position (worksheet grain) and from `jobId` (the parent Order).
   *
   * Optional for the same reason `dailyDtHours` is: any state built without a Customer Job - a
   * historical draft, or an existing test fixture - behaves exactly as it did before this field
   * existed. Absent and null both mean "no Customer Job recorded".
   */
  customerJobId?: string | null;
  dailyHours: number[]; // Mon-Sun raw hours
  perDiemDays: number;
  weeklyTotalHours: number;
  weeklyOtAllocation: number;
  // Manually designated Double Time, carved from hours the allocator classifies as OT.
  // Optional so that any state built without DT behaves exactly as it did before DT existed.
  dailyDtHours?: number[]; // Mon-Sun designated DT, daily mode
  weeklyDtHours?: number; // designated DT for this row, weekly totals mode
}

// =============================================================================
// MANUAL DT DESIGNATION — VALIDATION (not part of the GOLD allocator)
// =============================================================================
// MW4H designates DT manually. It is never derived, and it is only ever carved out of
// hours the existing allocator has already classified as OT, so REG can never shrink and
// worked hours can never grow.
const DT_INCREMENT = 0.25;
const DT_EPSILON = 1e-9;

/** Worked-hour precision: DT must be a non-negative multiple of a quarter hour. */
function isDtQuantityWellFormed(value: number): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (value < 0) return false;
  const steps = value / DT_INCREMENT;
  return Math.abs(steps - Math.round(steps)) < DT_EPSILON;
}

/**
 * Resolve a designated DT quantity against the OT actually available at the same truthful
 * grain (one Daily JobRow/day cell, or one Weekly JobRow).
 *
 * An invalid designation is REJECTED, never clamped: it contributes no DT and is reported,
 * so the operator sees an error instead of a silently altered number.
 */
function carveDesignatedDt(
  requested: number,
  availableOt: number,
): { dt: number; invalid: boolean } {
  if (!requested) return { dt: 0, invalid: false };
  if (!isDtQuantityWellFormed(requested)) return { dt: 0, invalid: true };
  if (requested > availableOt + DT_EPSILON) return { dt: 0, invalid: true };
  return { dt: requested, invalid: false };
}

interface NonHourItem {
  id: string;
  type: string;
  note: string;
  value: number;
}

interface EmployeeData {
  id: string;
  name: string;
  trade: string;
  jobRows: JobRow[];
  billableItems: NonHourItem[];
  nonBillableItems: NonHourItem[];
}

// Compute weekly mode totals for an employee
// Returns per-row breakdown, employee totals, and mismatch info
export function computeWeeklyTotals(jobRows: JobRow[]): {
  totalHours: number;
  reg: number;
  ot: number;
  dt: number;
  jobBreakdown: { jobId: string; reg: number; ot: number; dt: number; total: number }[];
  allocatedOt: number;
  otEditable: boolean;
  mismatch: boolean;
  dtInvalid: boolean;
} {
  const totalHours = jobRows.reduce((sum, row) => sum + row.weeklyTotalHours, 0);
  const regComputed = Math.min(totalHours, 40);
  const otComputed = Math.max(totalHours - 40, 0);
  // Manual DT is carved from each row's OT below, after the existing allocation decides
  // which row owns that OT. Zero designations leave every figure exactly as before.
  let dt = 0;
  let dtInvalid = false;

  const hasMultipleRows = jobRows.length >= 2;
  const hasOtHours = totalHours > 40;
  const otEditable = hasMultipleRows && hasOtHours;

  const jobBreakdown: { jobId: string; reg: number; ot: number; dt: number; total: number }[] = [];
  let allocatedOt = 0;

  if (otEditable) {
    // OT is user-editable: use weeklyOtAllocation
    jobRows.forEach((row) => {
      const otAlloc = Math.max(0, Math.min(row.weeklyOtAllocation, row.weeklyTotalHours));
      const regRow = Math.max(row.weeklyTotalHours - otAlloc, 0);
      // DT may only consume OT allocated to THIS row, so it can never borrow from another.
      const carve = carveDesignatedDt(row.weeklyDtHours ?? 0, otAlloc);
      if (carve.invalid) dtInvalid = true;
      dt += carve.dt;
      jobBreakdown.push({
        jobId: row.id,
        reg: regRow,
        ot: otAlloc - carve.dt,
        dt: carve.dt,
        total: row.weeklyTotalHours,
      });
      // Unchanged: allocatedOt remains the operator's OT allocation, so mismatch keeps its
      // existing meaning and is not affected by a DT carve-out.
      allocatedOt += otAlloc;
    });
  } else {
    // OT is NOT editable: compute deterministically (top row to bottom row)
    let runningTotal = 0;
    jobRows.forEach((row) => {
      const hours = row.weeklyTotalHours;
      const hoursBeforeThisRow = runningTotal;
      const hoursAfterThisRow = runningTotal + hours;

      let regRow = 0;
      let otRow = 0;

      if (hoursBeforeThisRow >= 40) {
        // All OT
        otRow = hours;
      } else if (hoursAfterThisRow <= 40) {
        // All REG
        regRow = hours;
      } else {
        // Split: some REG, some OT
        regRow = 40 - hoursBeforeThisRow;
        otRow = hours - regRow;
      }

      // DT may only consume the OT this row was deterministically given.
      const carve = carveDesignatedDt(row.weeklyDtHours ?? 0, otRow);
      if (carve.invalid) dtInvalid = true;
      dt += carve.dt;

      jobBreakdown.push({
        jobId: row.id,
        reg: regRow,
        ot: otRow - carve.dt,
        dt: carve.dt,
        total: hours,
      });

      runningTotal = hoursAfterThisRow;
      allocatedOt += otRow;
    });
  }

  const mismatch = otEditable && allocatedOt !== otComputed;

  return {
    totalHours,
    reg: regComputed,
    ot: otComputed - dt,
    dt,
    jobBreakdown,
    allocatedOt,
    otEditable,
    mismatch,
    dtInvalid,
  };
}

// =============================================================================
// GOLD ALLOCATOR — DO NOT MODIFY
// =============================================================================
// Compute derived REG/OT/DT for an employee across all job rows
// Chronological allocation: Mon→Sun, within day: top row to bottom row
// First 40 hours = REG, remaining = OT, DT = 0 for now
export function computeEmployeeTotals(jobRows: JobRow[]): {
  totalHours: number;
  reg: number;
  ot: number;
  dt: number;
  jobBreakdown: { jobId: string; reg: number; ot: number; dt: number; total: number }[];
  dtInvalid: boolean;
} {
  let runningTotal = 0;
  const jobBreakdown: { jobId: string; reg: number; ot: number; dt: number; total: number }[] = [];
  let dt = 0;
  let dtInvalid = false;

  // Initialize breakdown for each job row
  jobRows.forEach((row) => {
    jobBreakdown.push({ jobId: row.id, reg: 0, ot: 0, dt: 0, total: 0 });
  });

  // Iterate chronologically: Mon→Sun, within day: row order
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    for (let rowIdx = 0; rowIdx < jobRows.length; rowIdx++) {
      const hours = jobRows[rowIdx].dailyHours[dayIdx] || 0;
      if (hours <= 0) continue;

      const breakdown = jobBreakdown[rowIdx];
      breakdown.total += hours;

      // Allocate hours: first 40 total = REG, rest = OT
      const hoursBeforeThisCell = runningTotal;
      const hoursAfterThisCell = runningTotal + hours;

      // The cell's REG/OT split is decided FIRST, exactly as before, and is never revisited.
      let cellReg = 0;
      let cellOt = 0;

      if (hoursBeforeThisCell >= 40) {
        // All OT
        cellOt = hours;
      } else if (hoursAfterThisCell <= 40) {
        // All REG
        cellReg = hours;
      } else {
        // Split: some REG, some OT
        const regPortion = 40 - hoursBeforeThisCell;
        const otPortion = hours - regPortion;
        cellReg = regPortion;
        cellOt = otPortion;
      }

      // Manual DT is then carved out of THIS cell's OT only. REG is untouched, the worked
      // cell is untouched, and DT cannot migrate to another row or another day.
      const carve = carveDesignatedDt(jobRows[rowIdx].dailyDtHours?.[dayIdx] ?? 0, cellOt);
      if (carve.invalid) dtInvalid = true;
      dt += carve.dt;

      breakdown.reg += cellReg;
      breakdown.ot += cellOt - carve.dt;
      breakdown.dt += carve.dt;

      runningTotal = hoursAfterThisCell;
    }
  }

  const totalHours = runningTotal;
  const reg = Math.min(totalHours, 40);
  const ot = Math.max(totalHours - 40, 0);

  return { totalHours, reg, ot: ot - dt, dt, jobBreakdown, dtInvalid };
}

// =============================================================================
// CELL BREAKDOWN HELPER — DAILY MODE ONLY (PARALLEL BREAKDOWN, NO GOLD MUTATION)
// =============================================================================
// Returns per-cell REG/OT/DT breakdown for SD overlay consumption.
// Uses SAME allocation logic as computeEmployeeTotals: Mon→Sun, row order, first 40 REG.
// This is a READ-ONLY parallel breakdown — does NOT affect GOLD totals.
export function computeAllocatorCellBreakdownDaily(jobRows: JobRow[]): {
  cell: { reg: number; ot: number; dt: number }[][];
} {
  const cell: { reg: number; ot: number; dt: number }[][] = [];

  // Initialize 2D array: cell[rowIdx][dayIdx]
  for (let rowIdx = 0; rowIdx < jobRows.length; rowIdx++) {
    cell[rowIdx] = [];
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      cell[rowIdx][dayIdx] = { reg: 0, ot: 0, dt: 0 };
    }
  }

  let runningTotal = 0;

  // Iterate chronologically: Mon→Sun, within day: row order (SAME as computeEmployeeTotals)
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    for (let rowIdx = 0; rowIdx < jobRows.length; rowIdx++) {
      const hours = jobRows[rowIdx].dailyHours[dayIdx] || 0;
      if (hours <= 0) continue;

      const hoursBeforeThisCell = runningTotal;
      const hoursAfterThisCell = runningTotal + hours;

      if (hoursBeforeThisCell >= 40) {
        // All OT
        cell[rowIdx][dayIdx].ot = hours;
      } else if (hoursAfterThisCell <= 40) {
        // All REG
        cell[rowIdx][dayIdx].reg = hours;
      } else {
        // Split: some REG, some OT
        const regPortion = 40 - hoursBeforeThisCell;
        const otPortion = hours - regPortion;
        cell[rowIdx][dayIdx].reg = regPortion;
        cell[rowIdx][dayIdx].ot = otPortion;
      }

      // Carve manual DT out of this cell's OT. Because the SD overlay already reads
      // cellData.dt, an SD-selected cell now yields DT_SD for the carved portion and OT_SD
      // for what remains, with no change to the SD functions themselves.
      const carve = carveDesignatedDt(
        jobRows[rowIdx].dailyDtHours?.[dayIdx] ?? 0,
        cell[rowIdx][dayIdx].ot,
      );
      cell[rowIdx][dayIdx].ot -= carve.dt;
      cell[rowIdx][dayIdx].dt = carve.dt;

      runningTotal = hoursAfterThisCell;
    }
  }

  return { cell };
}

// =============================================================================
// SD OVERLAY HELPER — DAILY MODE ONLY (HOURS ONLY, NO RATES)
// =============================================================================
// Computes SD hour buckets by reading the per-cell breakdown.
// rowSdFlagsForEmployee: { [rowId]: boolean[7] } — SD intent flags per row/day
export function computeShiftDiffOverlayDaily({
  jobRows,
  cellBreakdown,
  rowSdFlagsForEmployee,
}: {
  jobRows: JobRow[];
  cellBreakdown: { reg: number; ot: number; dt: number }[][];
  rowSdFlagsForEmployee: Record<string, boolean[]>;
}): { regSdHours: number; otSdHours: number; dtSdHours: number } {
  let regSdHours = 0;
  let otSdHours = 0;
  let dtSdHours = 0;

  // Iterate Mon→Sun, row order (SAME order as cell breakdown)
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    for (let rowIdx = 0; rowIdx < jobRows.length; rowIdx++) {
      const row = jobRows[rowIdx];
      const sdFlags = rowSdFlagsForEmployee[row.id] || [false, false, false, false, false, false, false];
      const isSdOn = sdFlags[dayIdx];

      if (isSdOn) {
        const cellData = cellBreakdown[rowIdx]?.[dayIdx];
        if (cellData) {
          regSdHours += cellData.reg;
          otSdHours += cellData.ot;
          dtSdHours += cellData.dt;
        }
      }
    }
  }

  return { regSdHours, otSdHours, dtSdHours };
}

// =============================================================================
// PER-ROW SD TOTALS HELPER — DAILY MODE ONLY
// =============================================================================
// Computes SD hour buckets for a SINGLE row (scoped by rowIdx).
// Uses the same cellBreakdown but only sums for the specific row.
export function computeRowShiftDiffTotals({
  rowIdx,
  cellBreakdown,
  sdFlags,
}: {
  rowIdx: number;
  cellBreakdown: { reg: number; ot: number; dt: number }[][];
  sdFlags: boolean[];
}): { regSd: number; otSd: number; dtSd: number } {
  let regSd = 0;
  let otSd = 0;
  let dtSd = 0;

  // Iterate Mon→Sun for this specific row only
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const isSdOn = sdFlags[dayIdx];
    if (isSdOn) {
      const cellData = cellBreakdown[rowIdx]?.[dayIdx];
      if (cellData) {
        regSd += cellData.reg;
        otSd += cellData.ot;
        dtSd += cellData.dt;
      }
    }
  }

  return { regSd, otSd, dtSd };
}

// =============================================================================
// HYDRATION — map the Working Timesheet read response onto the existing state shapes
// =============================================================================
// Delegated to lib/timeEntry/hydrateDraftState, which is the exact inverse of the Save Draft
// payload builder. Only persisted facts are restored: a weekly total never becomes seven daily
// cells, daily cells never become a weekly total, and operator inputs come from their own
// persisted structures rather than from the calculated classification lines.
//
// Both granularities are restored together, because JobRow already carries dailyHours and
// weeklyTotalHours side by side. That is what lets the selector reveal genuinely saved values
// for the inactive mode after a reopen.
function toEmployees(detail: WorkingTimesheetDetail): EmployeeData[] {
  return hydrateDraftState(detail).employees;
}

export default function TimeEntryPage() {
  const params = useParams();
  const workingTimesheetId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);

  // Working Timesheet context (Job Site / Customer / Week Ending / status)
  const [context, setContext] = useState({
    jobSite: "",
    customer: "",
    weekEnding: "",
    status: "Working",
  });

  // Job/order options for the per-row job selector
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);

  // TE-S2B8 the parent Job Order. Customer Jobs are Order-owned, so every Customer Job list and
  // create call is scoped to this id, which is also what a new job row inherits as its project.
  const [orderId, setOrderId] = useState("");

  /**
   * TE-S2B8 the selectable Customer Jobs for this Job Order.
   *
   * Loaded from the durable Order-owned list, NOT derived from this week's rows - which is what
   * makes a Customer Job typed this week available next week for the same Order. Archived jobs
   * referenced by a saved row are merged in on hydration so their rows still display correctly,
   * without becoming normal new choices.
   */
  const [customerJobs, setCustomerJobs] = useState<CustomerJob[]>([]);

  // Inline "+ Add New Job", tracked per row so only the intended row opens an input, and so the
  // created job is selected for that row.
  const [addingJobFor, setAddingJobFor] = useState<{ employeeId: string; rowId: string } | null>(
    null,
  );
  const [newJobDescription, setNewJobDescription] = useState("");
  const [creatingJob, setCreatingJob] = useState(false);
  const [customerJobError, setCustomerJobError] = useState("");

  /**
   * TE-S3 the server's readiness verdict for this worksheet.
   *
   * Held as received and never recomputed here: the backend is authoritative about whether the sheet may
   * begin approvals, and a screen that decided for itself could disagree with the transition endpoint.
   */
  const [readiness, setReadiness] = useState<WorkingTimesheetReadiness | null>(null);
  const [markingReady, setMarkingReady] = useState(false);
  const [readyError, setReadyError] = useState("");
  const [readyMessage, setReadyMessage] = useState("");

  /**
   * TE-S5 / TE-S6 the approval lifecycle, as the server reports it.
   *
   * `locked` is the TE-S6 Final Approval lock, derived server-side from the immutable snapshot. Held
   * separately from `reviewState` because it governs the WHOLE page - editing, saving and every
   * approval control - and must survive even if the approval-state read is unavailable.
   */
  const [reviewState, setReviewState] = useState<CustomerReviewState | null>(null);
  const [locked, setLocked] = useState(false);
  /** Which approval is in flight, so the two buttons can never both be pressed. */
  const [approving, setApproving] = useState<"INITIAL" | "FINAL" | null>(null);
  const [approvalError, setApprovalError] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  /**
   * The governed exception the approver has deliberately opened, and the reason they typed.
   *
   * Null until they explicitly choose it. An override must be an act, not a default: a Final Approval
   * that proceeds over a customer's objection cannot happen because somebody clicked the ordinary
   * button without noticing.
   */
  const [overrideKind, setOverrideKind] = useState<FinalApprovalExceptionKind | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Crew-week Monday, used to turn day indexes into real work dates when saving. Held in
  // state rather than parsed out of the route so the server value stays authoritative.
  const [weekStart, setWeekStart] = useState("");
  /**
   * TE-SD-2A authoritative per-date SD eligibility from the server.
   *
   * Empty until the sheet loads, which correctly means "no SD anywhere" rather than defaulting to
   * available - the previous demo constant defaulted the other way.
   */
  const [sdEligibilityByDate, setSdEligibilityByDate] = useState<Record<string, boolean>>({});

  // Save Draft status, using this page's existing plain-text conventions.
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // Entry mode state
  const [entryMode, setEntryMode] = useState<EntryMode>("daily");

  // =============================================================================
  // SD STATE — Worker-level enable, Project-Row/Day toggles (INTENT ONLY)
  // =============================================================================
  // Worker-level SD enable: { [employeeId]: boolean }
  // This gates ALL SD UI for the employee (week-scoped enable)
  // Meaning: "This employee is eligible for shift differential THIS WEEK."
  // No SD eligibility is persisted yet, so this starts empty rather than carrying a
  // fabricated saved state. Toggling remains available exactly as before.
  const [workerSdEnabled, setWorkerSdEnabled] = useState<Record<string, boolean>>({});

  // Project-Row/Day SD flags: { [employeeId]: { [jobRowId]: boolean[7] } }
  // Each job row has its OWN SD-by-day state (SNAPSHOT-SAFE shape)
  // Records INTENT only — which PROJECT + DAY hours are marked as SD
  // Per-row/day SD intent is not persisted yet. getRowSdFlags() already falls back to
  // all-false, so this starts empty rather than carrying a fabricated saved state.
  const [rowSdFlags, setRowSdFlags] = useState<Record<string, Record<string, boolean[]>>>({});

  // Toggle worker-level SD (gates all SD UI for this employee)
  const toggleWorkerSd = (employeeId: string) => {
    setWorkerSdEnabled((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId],
    }));
  };

  // Toggle day-level SD for a specific job row
  const toggleRowDaySd = (employeeId: string, rowId: string, dayIdx: number) => {
    setRowSdFlags((prev) => {
      const empRows = prev[employeeId] || {};
      const current = empRows[rowId] || [false, false, false, false, false, false, false];
      const updated = [...current];
      updated[dayIdx] = !updated[dayIdx];
      return {
        ...prev,
        [employeeId]: {
          ...empRows,
          [rowId]: updated,
        },
      };
    });
  };

  // Initialize SD flags for a new job row
  const initRowSdFlags = (employeeId: string, rowId: string) => {
    setRowSdFlags((prev) => {
      const empRows = prev[employeeId] || {};
      if (empRows[rowId]) return prev; // Already exists
      return {
        ...prev,
        [employeeId]: {
          ...empRows,
          [rowId]: [false, false, false, false, false, false, false],
        },
      };
    });
  };

  // Helper: Get SD flags for a row (with fallback)
  /**
   * TE-SD-2A does the Job Order grant Shift Differential on ANY day of this crew week?
   *
   * Gates the worker-level toggle and the breakdown panel. It is deliberately NOT sufficient for a
   * day checkmark - individual days consult `isSdEligibleOnDayIndex`, so a week that acquires SD
   * partway through cannot have SD recorded on its earlier days.
   */
  const sdConfiguredThisWeek = Object.values(sdEligibilityByDate).some((eligible) => eligible);

  const getRowSdFlags = (employeeId: string, rowId: string): boolean[] => {
    return rowSdFlags[employeeId]?.[rowId] || [false, false, false, false, false, false, false];
  };

  // Dispatched roster for this Order + crew-week, left-joined with any saved draft.
  const [employees, setEmployees] = useState<EmployeeData[]>([]);

  // Load the Working Timesheet. Read-only: this never writes Time Entry.
  const loadWorkingTimesheet = useCallback(async () => {
    if (!workingTimesheetId) return;

    setLoading(true);
    setLoadError("");
    try {
      const detail = await fetchWorkingTimesheetDetail(workingTimesheetId);
      setContext({
        jobSite: detail.jobSite,
        customer: detail.customerName,
        weekEnding: detail.weekEnding,
        status: detail.status,
      });
      setWeekStart(detail.weekStart);
      setSdEligibilityByDate(detail.sdEligibilityByDate ?? {});
      setOrderId(detail.orderId);
      setReadiness(detail.readiness);
      // TE-S6 the Final Approval lock, derived server-side from the immutable snapshot.
      setLocked(detail.finalApproval?.locked === true);
      setJobOptions([{ id: detail.orderId, name: detail.orderRef }]);

      // TE-S5 / TE-S6 the approval state. A failure here must not block the timesheet from loading, so
      // it degrades to "no approval controls" rather than throwing the whole page away - which is also
      // the safe direction, since the absent state offers nothing rather than offering too much.
      try {
        setReviewState(await fetchCustomerReviewState(workingTimesheetId));
      } catch {
        setReviewState(null);
      }

      // Restore the whole persisted worksheet: mode, both source granularities, operator
      // inputs, SD state and items. Nothing is fabricated for what was never saved.
      const hydrated = hydrateDraftState(detail);
      setEntryMode(hydrated.entryMode);
      setEmployees(hydrated.employees);
      setWorkerSdEnabled(hydrated.workerSdEnabled);
      setRowSdFlags(hydrated.rowSdFlags);

      // TE-S2B8 Customer Job options: the durable ACTIVE list for this Order, plus any job a
      // saved row references. The second part is what keeps an ARCHIVED saved job displayable -
      // a select whose value has no option would otherwise appear to have changed the operator's
      // selection. A list failure must not block the timesheet, so it degrades to the referenced
      // jobs only rather than throwing the whole load away.
      let active: CustomerJob[] = [];
      try {
        active = (await fetchCustomerJobs(detail.orderId)) ?? [];
      } catch {
        active = [];
      }
      const merged = new Map<string, CustomerJob>();
      for (const job of active) merged.set(job.id, job);
      for (const job of hydrated.referencedCustomerJobs) {
        if (!merged.has(job.id)) merged.set(job.id, job);
      }
      setCustomerJobs(Array.from(merged.values()));
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load working timesheet.");
    } finally {
      setLoading(false);
    }
  }, [workingTimesheetId]);

  useEffect(() => {
    void loadWorkingTimesheet();
  }, [loadWorkingTimesheet]);

  // Add a new job row for an employee
  const addJobRow = (employeeId: string) => {
    const newRowId = `${employeeId}-job${Date.now()}`;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: [
            ...emp.jobRows,
            {
              id: newRowId,
              // TE-S2B8: `jobId: "job2"` is retired. It was a hardcoded placeholder that named
              // nothing - not a project, not a Customer Job, not a persisted identity - and it
              // made every added row claim the same fictional job. A new row inherits the
              // worksheet's real parent Order as its project, and carries NO Customer Job until
              // the operator selects or creates one.
              jobId: orderId,
              customerJobId: null,
              dailyHours: [0, 0, 0, 0, 0, 0, 0],
              perDiemDays: 0,
              weeklyTotalHours: 0,
              weeklyOtAllocation: 0,
              dailyDtHours: [0, 0, 0, 0, 0, 0, 0],
              weeklyDtHours: 0,
            },
          ],
        };
      })
    );
    // Initialize SD flags for the new row
    initRowSdFlags(employeeId, newRowId);
  };

  // Remove a job row for an employee
  const removeJobRow = (employeeId: string, rowId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        // Don't remove if it's the only row
        if (emp.jobRows.length <= 1) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.filter((r) => r.id !== rowId),
        };
      })
    );
  };

  // Update job selection for a row
  const updateJobSelection = (employeeId: string, rowId: string, jobId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, jobId } : r
          ),
        };
      })
    );
  };

  /** The sentinel value of the "+ Add New Job" option. Never a Customer Job id. */
  const ADD_NEW_CUSTOMER_JOB = "__add_new_customer_job__";

  /**
   * TE-S2B8 select a durable Customer Job for one row, or open the inline create.
   *
   * Only the ID is stored. The description is never copied onto the row, so a later correction to
   * the Customer Job shows through everywhere instead of leaving stale text behind.
   */
  const updateCustomerJobSelection = (
    employeeId: string,
    rowId: string,
    value: string,
  ) => {
    setCustomerJobError("");

    if (value === ADD_NEW_CUSTOMER_JOB) {
      setAddingJobFor({ employeeId, rowId });
      setNewJobDescription("");
      return;
    }

    setAddingJobFor(null);
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            // Empty string is the "no Customer Job" choice and stores null, not "".
            r.id === rowId ? { ...r, customerJobId: value === "" ? null : value } : r,
          ),
        };
      }),
    );
  };

  /**
   * TE-S2B8 create a Customer Job inline and select it for the row that asked for it.
   *
   * ENTER ONCE, SELECT MANY. Creation goes through the authoritative Order-owned API, so the
   * durable id comes back from the server rather than being invented here. Adding it to
   * `customerJobs` is what makes it immediately available to every other worker on this sheet -
   * and, because the list is Order-owned, to later weeks for the same Job Order.
   *
   * A duplicate is NOT silently turned into a second identity: the backend's conflict is surfaced
   * as a recoverable message telling the operator to pick the existing job.
   */
  const handleCreateCustomerJob = async () => {
    if (!addingJobFor || !orderId) return;

    const description = newJobDescription.trim();
    if (!description) {
      setCustomerJobError("Enter a Customer Job description.");
      return;
    }

    setCreatingJob(true);
    setCustomerJobError("");
    try {
      const created = await createCustomerJob(orderId, description);

      setCustomerJobs((prev) =>
        prev.some((j) => j.id === created.id) ? prev : [...prev, created],
      );

      const { employeeId, rowId } = addingJobFor;
      setEmployees((prev) =>
        prev.map((emp) => {
          if (emp.id !== employeeId) return emp;
          return {
            ...emp,
            jobRows: emp.jobRows.map((r) =>
              r.id === rowId ? { ...r, customerJobId: created.id } : r,
            ),
          };
        }),
      );

      setAddingJobFor(null);
      setNewJobDescription("");
    } catch (e: any) {
      // The inline input stays open with the typed text intact, so the operator can correct it.
      setCustomerJobError(describeCustomerJobCreateError(e));
    } finally {
      setCreatingJob(false);
    }
  };

  const cancelCreateCustomerJob = () => {
    setAddingJobFor(null);
    setNewJobDescription("");
    setCustomerJobError("");
  };

  /** Active jobs, plus any job currently selected somewhere, so archived selections still show. */
  const selectableCustomerJobs = (
    selectedId: string | null | undefined,
  ): CustomerJob[] =>
    customerJobs
      .filter((job) => job.isActive || job.id === selectedId)
      .slice()
      .sort((a, b) => a.description.localeCompare(b.description));

  // Update daily hours for a job row
  const updateDailyHours = (
    employeeId: string,
    rowId: string,
    dayIdx: number,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) => {
            if (r.id !== rowId) return r;
            const newDailyHours = [...r.dailyHours];
            newDailyHours[dayIdx] = numValue;
            return { ...r, dailyHours: newDailyHours };
          }),
        };
      })
    );
  };

  // Update per diem days for a job row
  const updatePerDiemDays = (
    employeeId: string,
    rowId: string,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, perDiemDays: numValue } : r
          ),
        };
      })
    );
  };

  // Update weekly total hours for a job row
  const updateWeeklyTotalHours = (
    employeeId: string,
    rowId: string,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, weeklyTotalHours: numValue } : r
          ),
        };
      })
    );
  };

  // Update weekly OT allocation for a job row
  const updateWeeklyOtAllocation = (
    employeeId: string,
    rowId: string,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, weeklyOtAllocation: numValue } : r
          ),
        };
      })
    );
  };

  // Update manually designated DT for a job row on one day (Daily mode).
  // The worked-hour cell is never touched: this only classifies part of what was worked.
  const updateDailyDtHours = (
    employeeId: string,
    rowId: string,
    dayIdx: number,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) => {
            if (r.id !== rowId) return r;
            const next = [...(r.dailyDtHours ?? [0, 0, 0, 0, 0, 0, 0])];
            next[dayIdx] = numValue;
            return { ...r, dailyDtHours: next };
          }),
        };
      })
    );
  };

  // Update manually designated DT for a job row (Weekly Totals mode).
  const updateWeeklyDtHours = (
    employeeId: string,
    rowId: string,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, weeklyDtHours: numValue } : r
          ),
        };
      })
    );
  };

  /**
   * Save Draft.
   *
   * The GOLD engines are READ here and nothing more: their output is collected as the governed
   * classification the backend persists. No calculation is duplicated, and no source fact is
   * invented - the payload builder sends only the granularity the current mode actually holds.
   */
  const handleSaveDraft = async () => {
    if (!workingTimesheetId || saving) return;

    // TE-S2B9 THE WEEKLY OT ALLOCATION SAVE GATE.
    //
    // Jarvis computes HOW MUCH overtime a Weekly worker earned; the OPERATOR decides WHICH JobRow -
    // and therefore which Customer Job - owns it, from the customer's own reporting or direction.
    // Jarvis must never distribute, proportion or infer that ownership. The consequence is that
    // until every computed OT hour has been allocated, there is no truthful answer to "which
    // Customer Job is this overtime billable to", so the draft must not be persisted at all.
    //
    // Enforced HERE, at the action boundary, and not only by disabling the button: a disabled
    // control is a UX affordance, whereas this function is the only path to the API.
    //
    // The mismatch truth is READ from the approved engine, never recomputed. `mismatch` is already
    // exactly the Owner's rule - multiple JobRows, computed OT present, and allocated OT not equal
    // to it - so reusing it means there is no second overtime comparison in the system and no new
    // floating-point behaviour beside the existing quarter-hour architecture.
    if (entryMode === "weekly") {
      const unallocated = employees.filter(
        (employee) => computeWeeklyTotals(employee.jobRows).mismatch,
      );
      if (unallocated.length > 0) {
        const names = unallocated.map((employee) => employee.name).join(", ");
        // The operator's unsaved inputs are left exactly as they are so the allocation can be
        // corrected in place.
        setSaveMessage("");
        setSaveError(
          `Allocated OT does not equal calculated OT for ${names}. Allocate all overtime across the job rows before saving.`,
        );
        return;
      }
    }

    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const totalsByEmployeeId: Record<
        string,
        {
          totalHours: number;
          reg: number;
          ot: number;
          dt: number;
          jobBreakdown: { reg: number; ot: number; dt: number }[];
        }
      > = {};
      const sdOverlayByEmployeeId: Record<
        string,
        { regSdHours: number; otSdHours: number; dtSdHours: number }
      > = {};

      for (const employee of employees) {
        const totals =
          entryMode === "daily"
            ? computeEmployeeTotals(employee.jobRows)
            : computeWeeklyTotals(employee.jobRows);
        totalsByEmployeeId[employee.id] = {
          totalHours: totals.totalHours,
          reg: totals.reg,
          ot: totals.ot,
          dt: totals.dt,
          // TE-S2B9: the approved engine's per-JobRow REG/OT/DT, carried through instead of being
          // discarded here. This assignment is where billable hours previously lost the JobRow - and
          // therefore the Customer Job - they belonged to.
          //
          // Mapped by POSITION, which is the durable worksheet grain: entry i belongs to
          // jobRows[i], which is jobRowIndex i. `jobId` is deliberately not read - it holds the
          // transient React row id and is never persisted identity.
          jobBreakdown: totals.jobBreakdown.map((row) => ({
            reg: row.reg,
            ot: row.ot,
            dt: row.dt,
          })),
        };

        // SD classification is only truthful when the worker is actually SD-enabled, and SD
        // itself is Daily-only.
        const sdEnabled = sdConfiguredThisWeek && (workerSdEnabled[employee.id] ?? false);
        if (entryMode === "daily" && sdEnabled) {
          const cellBreakdown = computeAllocatorCellBreakdownDaily(employee.jobRows);
          sdOverlayByEmployeeId[employee.id] = computeShiftDiffOverlayDaily({
            jobRows: employee.jobRows,
            cellBreakdown: cellBreakdown.cell,
            rowSdFlagsForEmployee: rowSdFlags[employee.id] ?? {},
          });
        }
      }

      const payload = buildDraftPayload({
        entryMode,
        employees,
        weekStart,
        workerSdEnabled,
        rowSdFlags,
        totalsByEmployeeId,
        sdOverlayByEmployeeId,
      });

      const result = await saveWorkingTimesheetDraft(workingTimesheetId, payload);
      setSaveMessage(`Draft saved — ${result.savedCandidateIds.length} worker(s).`);
    } catch (e: any) {
      // A failed request must never read as success.
      setSaveError(e?.message ?? "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * TE-S3 mark this worksheet READY FOR APPROVALS.
   *
   * The server recomputes readiness and refuses unless its own verdict is READY, so this records an
   * operator's assertion rather than making a claim the client can force. On success the refreshed
   * verdict and status come back from the server, so the screen shows what actually happened rather
   * than assuming the write succeeded as requested.
   */
  const handleMarkReadyForApprovals = async () => {
    if (!workingTimesheetId || markingReady) return;

    setMarkingReady(true);
    setReadyError("");
    setReadyMessage("");
    try {
      const result = await markWorkingTimesheetReadyForApprovals(workingTimesheetId);
      setReadiness(result.readiness);
      setContext((prev) => ({ ...prev, status: result.status }));
      setReadyMessage(
        result.status === "Ready for Approvals"
          ? "Marked Ready for Approvals."
          : "Saved, but this working timesheet is no longer ready. Review the outstanding items.",
      );
    } catch (e: any) {
      setReadyError(e?.message ?? "Could not mark this working timesheet ready.");
    } finally {
      setMarkingReady(false);
    }
  };

  /**
   * TE-S5 MW4H INITIAL APPROVAL: freeze what the customer will be shown.
   *
   * DELIBERATELY A SEPARATE ACTION FROM FINAL APPROVAL. This one is reversible in practice - editing the
   * sheet afterwards simply supersedes the frozen version - and it locks nothing.
   */
  const handleInitialApprove = async () => {
    if (!workingTimesheetId || approving) return;

    setApproving("INITIAL");
    setApprovalError("");
    setApprovalMessage("");
    try {
      const result = await initialApproveWorkingTimesheet(workingTimesheetId);
      setApprovalMessage(
        result.created
          ? `MW4H Initial Approval recorded. Customer review version ${result.sequence} frozen with ${result.lineCount} line(s).`
          : `This working timesheet was already initially approved as version ${result.sequence}. Nothing changed.`,
      );
      await refreshApprovalState();
    } catch (e: any) {
      setApprovalError(e?.message ?? "Could not record MW4H Initial Approval.");
    } finally {
      setApproving(null);
    }
  };

  /**
   * TE-S6 MW4H FINAL APPROVAL: create the immutable snapshot and close this crew week.
   *
   * IRREVERSIBLE, SO IT IS CONFIRMED. After this the source is locked and a correction requires an
   * Adjustment Timesheet, which is worth saying out loud before the request is sent.
   *
   * THE SERVER REMAINS THE GATE. This sends the command and, when one applies, the governed exception
   * and its reason. It asserts nothing about readiness, the review requirement or the customer's
   * decisions, and a refusal is shown as the server worded it.
   */
  const handleFinalApprove = async (
    exception?: { kind: FinalApprovalExceptionKind; reason: string },
  ) => {
    if (!workingTimesheetId || approving) return;

    setApproving("FINAL");
    setApprovalError("");
    setApprovalMessage("");
    try {
      const result = await finalApproveWorkingTimesheet(workingTimesheetId, exception);
      setApprovalMessage(
        result.exceptionUsed
          ? `MW4H Final Approval recorded through a governed ${
              result.exceptionUsed === "NO_RESPONSE"
                ? "no-response"
                : "dispute override"
            } exception. ${result.workerCount} worker(s) frozen. This timesheet is now locked.`
          : `MW4H Final Approval recorded. ${result.workerCount} worker(s) frozen. This timesheet is now locked.`,
      );
      setOverrideReason("");
      setOverrideKind(null);
      await refreshApprovalState();
    } catch (e: any) {
      setApprovalError(e?.message ?? "Could not record MW4H Final Approval.");
    } finally {
      setApproving(null);
    }
  };

  /**
   * Re-read the server's approval facts, and the worksheet itself.
   *
   * Both are re-read rather than patched from the response, because the lock changes what the whole page
   * may do - and inferring that locally is exactly how a screen ends up disagreeing with the server.
   */
  const refreshApprovalState = async () => {
    if (!workingTimesheetId) return;
    try {
      const [review, detail] = await Promise.all([
        fetchCustomerReviewState(workingTimesheetId),
        fetchWorkingTimesheetDetail(workingTimesheetId),
      ]);
      setReviewState(review);
      setReadiness(detail.readiness);
      setLocked(detail.finalApproval?.locked === true);
      setContext((prev) => ({ ...prev, status: detail.status }));
    } catch {
      // A failed refresh must not silently unlock the page, so nothing is changed here. The next load,
      // or the server's own refusal, still carries the truth.
    }
  };

  /**
   * TE-S6 which governed exception, if any, does the current evidence actually call for?
   *
   * ADVISORY ONLY, AND IT MIRRORS THE SERVER'S ORDERING: a dispute outranks silence, because proceeding
   * over an objection is a different act from proceeding without an answer. The server independently
   * decides the same thing and rejects a mismatch, so the worst this can do is offer the wrong control.
   */
  const requiredException: FinalApprovalExceptionKind | null = (() => {
    if (!reviewState?.requirement.required) return null;
    const current = reviewState.current;
    if (!current || current.lineCount === 0) return null;
    if (current.disputed > 0) return "DISPUTE_OVERRIDE";
    if (current.unanswered > 0) return "NO_RESPONSE";
    return null;
  })();

  /**
   * May a Final Approval control be OFFERED at all?
   *
   * Requires the server to have said the sheet is ready, that a valid Initial Approval still describes
   * current content, and that the week is not already locked. And when the only route forward is the
   * no-response exception, the deadline must actually have passed - the page never offers a path the
   * server would certainly refuse.
   */
  const finalApprovalOffered =
    !locked &&
    readiness?.state === "READY" &&
    reviewState?.finalApproval.initialApprovalValid === true &&
    (requiredException !== "NO_RESPONSE" || reviewState?.finalApproval.respondByElapsed === true);

  /** The blocking reasons, named by the shared describer so no wording is invented per screen. */
  const readinessBlockers = readiness
    ? describeReadinessBlockers(readiness, (candidateId) =>
        employees.find((e) => e.id === candidateId)?.name ?? candidateId,
      )
    : [];

  /**
   * TE-S2B9 true while any Weekly worker still has unallocated computed OT.
   *
   * ONE derived truth, read from the approved engine's own `mismatch` flag, so the amber warning,
   * the disabled Save Draft button and the guard inside `handleSaveDraft` can never disagree about
   * whether the sheet is saveable.
   */
  const weeklyOtAllocationBlocked =
    entryMode === "weekly" &&
    employees.some((employee) => computeWeeklyTotals(employee.jobRows).mismatch);

  // Get job name by id
  const getJobName = (jobId: string): string => {
    const job = jobOptions.find((j) => j.id === jobId);
    return job ? job.name : "Unknown Job";
  };

  // Billable item type options
  const BILLABLE_ITEM_TYPES = ["Bonus", "Hazard", "Mobilization", "Demobilization", "Reimbursement", "Other"];
  // Non-billable item type options
  const NON_BILLABLE_ITEM_TYPES = ["Per Diem", "Bonus", "Hazard", "Reimbursement", "Other"];

  // Add a billable item for an employee
  const addBillableItem = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        const newItemId = `${emp.id}-billable-${Date.now()}`;
        return {
          ...emp,
          billableItems: [
            ...emp.billableItems,
            { id: newItemId, type: "Bonus", note: "", value: 0 },
          ],
        };
      })
    );
  };

  // Add a non-billable item for an employee
  const addNonBillableItem = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        const newItemId = `${emp.id}-nonbillable-${Date.now()}`;
        return {
          ...emp,
          nonBillableItems: [
            ...emp.nonBillableItems,
            { id: newItemId, type: "Per Diem", note: "", value: 0 },
          ],
        };
      })
    );
  };

  // Remove a billable item
  const removeBillableItem = (employeeId: string, itemId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          billableItems: emp.billableItems.filter((item) => item.id !== itemId),
        };
      })
    );
  };

  // Remove a non-billable item
  const removeNonBillableItem = (employeeId: string, itemId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          nonBillableItems: emp.nonBillableItems.filter((item) => item.id !== itemId),
        };
      })
    );
  };

  // Update a billable item
  const updateBillableItem = (
    employeeId: string,
    itemId: string,
    patch: Partial<NonHourItem>
  ) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          billableItems: emp.billableItems.map((item) =>
            item.id === itemId ? { ...item, ...patch } : item
          ),
        };
      })
    );
  };

  // Update a non-billable item
  const updateNonBillableItem = (
    employeeId: string,
    itemId: string,
    patch: Partial<NonHourItem>
  ) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          nonBillableItems: emp.nonBillableItems.map((item) =>
            item.id === itemId ? { ...item, ...patch } : item
          ),
        };
      })
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header Card */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-center gap-6 mb-4">
          <div>
            <div className="text-xs text-slate-400 mb-1">Job Site</div>
            <div className="text-base font-medium text-slate-100">
              {context.jobSite}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Customer</div>
            <div className="text-base font-medium text-slate-100">
              {context.customer}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Week Ending</div>
            <div className="text-base font-medium text-slate-100">
              {context.weekEnding}
            </div>
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-700">
              {context.status}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Working sheet — snapshot generated after approval
        </p>

        {/* Entry Mode Toggle */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">Entry Mode:</span>
            <div className="flex items-center gap-1 bg-slate-800 rounded p-0.5">
              <button
                onClick={() => setEntryMode("daily")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  entryMode === "daily"
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setEntryMode("weekly")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  entryMode === "weekly"
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Weekly Totals
              </button>
            </div>
            {entryMode === "weekly" && (
              <span className="text-xs text-slate-500">
                Weekly Totals mode — OT editable only when 2+ jobs and &gt;40 hrs
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Employee Sections */}
      {loading && (
        <div className="text-sm text-slate-400 mb-6">Loading working timesheet...</div>
      )}
      {!loading && loadError && (
        <div className="text-sm text-red-400 mb-6">{loadError}</div>
      )}
      {!loading && !loadError && employees.length === 0 && (
        <div className="text-sm text-slate-400 mb-6">
          No dispatched workers for this crew-week.
        </div>
      )}
      {employees.map((employee) => {
        const dailyTotals = computeEmployeeTotals(employee.jobRows);
        const weeklyTotals = computeWeeklyTotals(employee.jobRows);
        const totals = entryMode === "daily" ? dailyTotals : weeklyTotals;
        const showMismatchWarning = entryMode === "weekly" && weeklyTotals.mismatch;

        // SD state for this worker (INTENT ONLY — no calculations)
        const isWorkerSdEnabled = sdConfiguredThisWeek && (workerSdEnabled[employee.id] ?? false);

        return (
          <div
            key={employee.id}
            className={`bg-slate-900 border rounded-lg mb-6 overflow-hidden ${
              showMismatchWarning ? "border-amber-600" : "border-slate-700"
            }`}
          >
            {/* Employee Header */}
            <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-100">
                    {employee.name}
                  </span>
                  <span className="text-sm text-slate-400">
                    {employee.trade}
                  </span>
                  {/* Worker-level SD Toggle — shown only when the Order grants SD on some day of
                      this crew week. Per-day availability is enforced separately below. */}
                  {sdConfiguredThisWeek && (
                    <button
                      onClick={() => toggleWorkerSd(employee.id)}
                      className={`ml-2 px-2 py-0.5 text-xs font-medium rounded border transition-colors ${
                        isWorkerSdEnabled
                          ? "bg-purple-900/50 text-purple-300 border-purple-600"
                          : "bg-slate-700 text-slate-400 border-slate-600 hover:text-slate-300"
                      }`}
                    >
                      Shift Diff {isWorkerSdEnabled ? "ON" : "OFF"}
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  Employee Weekly: REG {totals.reg} | OT {totals.ot} | DT {totals.dt} | Total {totals.totalHours}
                </div>
              </div>

              {/* OT Mismatch Warning */}
              {showMismatchWarning && (
                <div className="mt-2 px-2 py-1 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-400">
                  OT allocation mismatch — computed OT: {weeklyTotals.ot}, allocated OT: {weeklyTotals.allocatedOt}
                </div>
              )}

              {/* Invalid DT designation — rejected, never silently clamped */}
              {totals.dtInvalid && (
                <div className="mt-2 px-2 py-1 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-400">
                  Invalid DT designation — DT must be a quarter-hour amount no greater than the OT
                  available on that job row{entryMode === "daily" ? " and day" : ""}. It was not applied.
                </div>
              )}

              {/* ================================================================
                  SHIFT DIFFERENTIAL BREAKDOWN — VISUAL VERIFICATION LAYER
                  Read-only display of SD vs non-SD hour buckets.
                  Reflects existing data; does NOT compute or modify anything.
                  ================================================================ */}
              {sdConfiguredThisWeek && entryMode === "daily" && (() => {
                // Compute SD overlay for this employee (read-only, parallel to GOLD)
                const cellBreakdown = computeAllocatorCellBreakdownDaily(employee.jobRows);
                const rowSdFlagsForEmployee = rowSdFlags[employee.id] || {};
                const sdOverlay = computeShiftDiffOverlayDaily({
                  jobRows: employee.jobRows,
                  cellBreakdown: cellBreakdown.cell,
                  rowSdFlagsForEmployee,
                });

                // Derive non-SD hours (total minus SD)
                const regNonSd = totals.reg - sdOverlay.regSdHours;
                const otNonSd = totals.ot - sdOverlay.otSdHours;
                const dtNonSd = totals.dt - sdOverlay.dtSdHours;

                const hasSdHours = sdOverlay.regSdHours > 0 || sdOverlay.otSdHours > 0 || sdOverlay.dtSdHours > 0;

                return (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">
                        Shift Differential Breakdown
                      </span>
                      {isWorkerSdEnabled ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-600">
                          SD Applied
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600">
                          SD Not Enabled
                        </span>
                      )}
                    </div>

                    {isWorkerSdEnabled ? (
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        {/* REG Bucket */}
                        <div className="bg-slate-800/50 rounded px-3 py-2 border border-slate-700">
                          <div className="text-[10px] text-slate-400 mb-1 font-medium">REG Hours</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-slate-300">Non-SD:</span>
                              <span className="ml-1 font-medium text-slate-100">{regNonSd}</span>
                            </div>
                            <div>
                              <span className="text-purple-400">SD:</span>
                              <span className="ml-1 font-medium text-purple-300">{sdOverlay.regSdHours}</span>
                            </div>
                          </div>
                        </div>

                        {/* OT Bucket */}
                        <div className="bg-slate-800/50 rounded px-3 py-2 border border-slate-700">
                          <div className="text-[10px] text-slate-400 mb-1 font-medium">OT Hours</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-slate-300">Non-SD:</span>
                              <span className="ml-1 font-medium text-slate-100">{otNonSd}</span>
                            </div>
                            <div>
                              <span className="text-purple-400">SD:</span>
                              <span className="ml-1 font-medium text-purple-300">{sdOverlay.otSdHours}</span>
                            </div>
                          </div>
                        </div>

                        {/* DT Bucket */}
                        <div className="bg-slate-800/50 rounded px-3 py-2 border border-slate-700">
                          <div className="text-[10px] text-slate-400 mb-1 font-medium">DT Hours</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-slate-300">Non-SD:</span>
                              <span className="ml-1 font-medium text-slate-100">{dtNonSd}</span>
                            </div>
                            <div>
                              <span className="text-purple-400">SD:</span>
                              <span className="ml-1 font-medium text-purple-300">{sdOverlay.dtSdHours}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">
                        Enable Shift Diff for this worker to see SD vs non-SD breakdown.
                      </div>
                    )}

                    {/* Source attribution */}
                    {isWorkerSdEnabled && hasSdHours && (
                      <div className="mt-2 text-[9px] text-slate-500">
                        Derived from Job Order SD rules • Per-row/day SD flags shown below
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Job Order has NO Shift Differential — explicit indicator */}
              {!sdConfiguredThisWeek && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      Shift Differential
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">
                      Not Configured
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 italic">
                    This Job Order does not have Shift Differential configured.
                  </div>
                </div>
              )}
            </div>

            {/* Job Rows Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 border-b border-slate-700 min-w-[200px]">
                      Job/Order
                    </th>
                    {entryMode === "daily" ? (
                      <>
                        {DAYS.map((day) => (
                          <th
                            key={day}
                            className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-16"
                          >
                            <div>{day}</div>
                          </th>
                        ))}
                      </>
                    ) : (
                      <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-16">
                        Hours
                      </th>
                    )}
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      Total
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      REG
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      OT
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      DT
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      PD
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-10">
                      &nbsp;
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employee.jobRows.map((row, rowIdx) => {
                    const rowTotalDaily = row.dailyHours.reduce((s, h) => s + h, 0);
                    const breakdown = totals.jobBreakdown[rowIdx];
                    const isFirstRow = rowIdx === 0;
                    const rowSdFlagsArr = getRowSdFlags(employee.id, row.id);

                    return (
                      <React.Fragment key={row.id}>
                        {/* Main job row */}
                        <tr className="border-b border-slate-700/50">
                          {/*
                            TE-S2B8 the Job/Order cell, unchanged in position and still the only
                            job column. The parent Job Order stays visible on the worker's first
                            row as project context; the Customer Job selector sits underneath it,
                            because the Customer Job is an allocation UNDER that Order rather than
                            a competing project.
                          */}
                          <td className="px-4 py-2">
                            {isFirstRow && (
                              <div className="text-xs text-slate-400 mb-1">
                                {getJobName(row.jobId)}
                              </div>
                            )}
                            {addingJobFor?.employeeId === employee.id &&
                            addingJobFor?.rowId === row.id ? (
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={newJobDescription}
                                  onChange={(e) => setNewJobDescription(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void handleCreateCustomerJob();
                                    if (e.key === "Escape") cancelCreateCustomerJob();
                                  }}
                                  placeholder="Customer Job description"
                                  aria-label="New Customer Job description"
                                  className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={creatingJob}
                                    onClick={() => void handleCreateCustomerJob()}
                                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-white"
                                  >
                                    {creatingJob ? "Saving..." : "Save Job"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelCreateCustomerJob}
                                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                {customerJobError && (
                                  <div className="text-xs text-red-400">{customerJobError}</div>
                                )}
                              </div>
                            ) : (
                              <select
                                value={row.customerJobId ?? ""}
                                aria-label="Customer Job"
                                onChange={(e) =>
                                  updateCustomerJobSelection(employee.id, row.id, e.target.value)
                                }
                                className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                              >
                                <option value="">— Select Customer Job —</option>
                                {selectableCustomerJobs(row.customerJobId).map((job) => (
                                  <option key={job.id} value={job.id}>
                                    {job.isActive
                                      ? job.description
                                      : `${job.description} (inactive)`}
                                  </option>
                                ))}
                                <option value={ADD_NEW_CUSTOMER_JOB}>+ Add New Job</option>
                              </select>
                            )}
                          </td>
                          {entryMode === "daily" ? (
                            <>
                              {DAYS.map((day, dayIdx) => (
                                <td key={day} className="px-1 py-2 text-center">
                                  <input
                                    type="text"
                                    value={row.dailyHours[dayIdx] || ""}
                                    onChange={(e) =>
                                      updateDailyHours(employee.id, row.id, dayIdx, e.target.value)
                                    }
                                    className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                                  />
                                </td>
                              ))}
                            </>
                          ) : (
                            <td className="px-1 py-2 text-center">
                              <input
                                type="text"
                                value={row.weeklyTotalHours || ""}
                                onChange={(e) =>
                                  updateWeeklyTotalHours(employee.id, row.id, e.target.value)
                                }
                                className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                              />
                            </td>
                          )}
                          <td className="px-2 py-2 text-center text-sm font-medium text-slate-200">
                            {entryMode === "daily" ? rowTotalDaily : row.weeklyTotalHours}
                          </td>
                          <td className="px-2 py-2 text-center text-sm text-slate-400">
                            {breakdown?.reg || 0}
                          </td>
                          {/* OT column: editable input in weekly mode when otEditable, otherwise display-only */}
                          <td className="px-1 py-2 text-center">
                            {entryMode === "weekly" && weeklyTotals.otEditable ? (
                              <input
                                type="text"
                                value={row.weeklyOtAllocation || ""}
                                onChange={(e) =>
                                  updateWeeklyOtAllocation(employee.id, row.id, e.target.value)
                                }
                                className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                              />
                            ) : (
                              <span className="text-sm text-slate-400">
                                {breakdown?.ot || 0}
                              </span>
                            )}
                          </td>
                          {/* DT column: editable in Weekly Totals mode, otherwise the carved
                              result. Mirrors how the OT column already behaves. */}
                          <td className="px-1 py-2 text-center">
                            {entryMode === "weekly" ? (
                              <input
                                type="text"
                                value={row.weeklyDtHours || ""}
                                onChange={(e) =>
                                  updateWeeklyDtHours(employee.id, row.id, e.target.value)
                                }
                                className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                              />
                            ) : (
                              <span className="text-sm text-slate-400">
                                {breakdown?.dt || 0}
                              </span>
                            )}
                          </td>
                          <td className="px-1 py-2 text-center">
                            <input
                              type="text"
                              value={row.perDiemDays || ""}
                              onChange={(e) =>
                                updatePerDiemDays(employee.id, row.id, e.target.value)
                              }
                              className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            {!isFirstRow && (
                              <button
                                onClick={() => removeJobRow(employee.id, row.id)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Per-row manual DT designation — Daily mode only.
                            Grain is worker + JobRow + day, matching the cell the allocator
                            classifies. DT is carved from that cell's OT; worked hours above
                            are never altered. */}
                        {entryMode === "daily" && (
                          <tr className="bg-amber-900/10 border-b border-slate-700/30">
                            <td className="px-4 py-1 text-[10px] text-amber-400">
                              DT
                            </td>
                            {DAYS.map((day, dayIdx) => (
                              <td key={day} className="px-1 py-1 text-center">
                                <input
                                  type="text"
                                  value={row.dailyDtHours?.[dayIdx] || ""}
                                  onChange={(e) =>
                                    updateDailyDtHours(
                                      employee.id,
                                      row.id,
                                      dayIdx,
                                      e.target.value
                                    )
                                  }
                                  className="w-8 px-1 py-0.5 text-center text-[10px] bg-slate-800 border border-slate-600 rounded text-slate-200"
                                />
                              </td>
                            ))}
                            <td colSpan={6}>&nbsp;</td>
                          </tr>
                        )}

                        {/* Per-row SD toggles — only shown when worker SD is enabled (INTENT ONLY) */}
                        {isWorkerSdEnabled && entryMode === "daily" && (() => {
                          const cellBreakdown = computeAllocatorCellBreakdownDaily(employee.jobRows);
                          const rowSdTotals = computeRowShiftDiffTotals({
                            rowIdx,
                            cellBreakdown: cellBreakdown.cell,
                            sdFlags: rowSdFlagsArr,
                          });
                          const hasAnySd = rowSdTotals.regSd > 0 || rowSdTotals.otSd > 0 || rowSdTotals.dtSd > 0;
                          return (
                            <tr className="bg-purple-900/10 border-b border-slate-700/30">
                              <td className="px-4 py-1 text-[10px] text-purple-400">
                                SD
                              </td>
                              {DAYS.map((day, dayIdx) => {
                                // TE-SD-2A per-DAY availability. A day the Job Order does not cover
                                // cannot be selected, which is what makes a mid-Order SD start
                                // representable without a whole-week boolean.
                                const dayEligible = isSdEligibleOnDayIndex(
                                  sdEligibilityByDate,
                                  weekStart,
                                  dayIdx,
                                );
                                return (
                                  <td key={day} className="px-1 py-1 text-center">
                                    <button
                                      onClick={() => toggleRowDaySd(employee.id, row.id, dayIdx)}
                                      disabled={!dayEligible}
                                      title={
                                        dayEligible
                                          ? undefined
                                          : "Shift Differential is not available on this date for this Job Order"
                                      }
                                      className={`w-8 h-5 text-[10px] font-medium rounded transition-colors ${
                                        !dayEligible
                                          ? "bg-slate-800/40 text-slate-600 border border-slate-700 cursor-not-allowed"
                                          : rowSdFlagsArr[dayIdx]
                                            ? "bg-purple-700/70 text-purple-200 border border-purple-500"
                                            : "bg-slate-700/40 text-slate-500 border border-slate-600 hover:text-slate-400"
                                      }`}
                                    >
                                      {rowSdFlagsArr[dayIdx] ? "✓" : ""}
                                    </button>
                                  </td>
                                );
                              })}
                              {/* Per-row SD totals: REG_SD / OT_SD / DT_SD */}
                              <td className="px-2 py-1 text-center">
                                {/* Total column - empty for SD row */}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {hasAnySd && (
                                  <span className="text-[10px] font-medium text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">
                                    {rowSdTotals.regSd}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {hasAnySd && (
                                  <span className="text-[10px] font-medium text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">
                                    {rowSdTotals.otSd}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {hasAnySd && (
                                  <span className="text-[10px] font-medium text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">
                                    {rowSdTotals.dtSd}
                                  </span>
                                )}
                              </td>
                              <td colSpan={2}>&nbsp;</td>
                            </tr>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>


            {/* Add Job Control Row */}
            <div className="px-4 py-3 border-t border-slate-700/50 flex gap-2">
              <button
                onClick={() => addJobRow(employee.id)}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-3 py-1"
              >
                + Add Job
              </button>
              <button
                onClick={() => addBillableItem(employee.id)}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-3 py-1"
              >
                + Add Item
              </button>
              <button
                onClick={() => addNonBillableItem(employee.id)}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-3 py-1"
              >
                + Add Non-Billable Item
              </button>
            </div>

            {/* Non-Hour Items Section */}
            {(employee.billableItems.length > 0 || employee.nonBillableItems.length > 0) && (
              <div className="px-4 py-3 border-t border-slate-700/50">
                <div className="text-xs font-medium text-slate-300 mb-3">Non-Hour Items</div>

                {/* Billable Items */}
                <div className="mb-3">
                  <div className="text-xs text-slate-400 mb-2">Billable Items</div>
                  {employee.billableItems.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">None</div>
                  ) : (
                    <div className="space-y-2">
                      {employee.billableItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 border border-slate-700 rounded px-2 py-1"
                        >
                          <select
                            value={item.type}
                            onChange={(e) =>
                              updateBillableItem(employee.id, item.id, { type: e.target.value })
                            }
                            className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                          >
                            {BILLABLE_ITEM_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Note"
                            value={item.note}
                            onChange={(e) =>
                              updateBillableItem(employee.id, item.id, { note: e.target.value })
                            }
                            className="flex-1 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                          />
                          <input
                            type="text"
                            value={item.value || ""}
                            onChange={(e) =>
                              updateBillableItem(employee.id, item.id, {
                                value: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-20 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-right"
                          />
                          <span className="text-xs text-slate-500 w-8">$</span>
                          <button
                            onClick={() => removeBillableItem(employee.id, item.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Non-Billable Items */}
                <div>
                  <div className="text-xs text-slate-400 mb-2">Non-Billable Items (Payroll Only)</div>
                  {employee.nonBillableItems.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">None</div>
                  ) : (
                    <div className="space-y-2">
                      {employee.nonBillableItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 border border-slate-700 rounded px-2 py-1"
                        >
                          <select
                            value={item.type}
                            onChange={(e) =>
                              updateNonBillableItem(employee.id, item.id, { type: e.target.value })
                            }
                            className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                          >
                            {NON_BILLABLE_ITEM_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Note"
                            value={item.note}
                            onChange={(e) =>
                              updateNonBillableItem(employee.id, item.id, { note: e.target.value })
                            }
                            className="flex-1 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                          />
                          <input
                            type="text"
                            value={item.value || ""}
                            onChange={(e) =>
                              updateNonBillableItem(employee.id, item.id, {
                                value: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-20 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-right"
                          />
                          <span className="text-xs text-slate-500 w-8">
                            {item.type === "Per Diem" ? "Days" : "$"}
                          </span>
                          <button
                            onClick={() => removeNonBillableItem(employee.id, item.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom Actions (disabled UI shell) */}
      {/* OT mismatch blocking warning */}
      {weeklyOtAllocationBlocked && (
        <div className="mb-3 px-3 py-2 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-400">
          Fix OT allocation mismatch warnings before continuing.
        </div>
      )}
      <div className="flex gap-3 mb-6">
        {/*
          TE-S2B9: the button is also disabled while any Weekly worker's OT is unallocated, so the
          existing amber warning above now describes a real block rather than advice. This is the
          affordance only - `handleSaveDraft` enforces the same rule itself, because a disabled
          control is not authorization.
        */}
        {/*
          TE-S6: also disabled once the crew week is finally approved. The approved snapshot is the
          authoritative record from that point, so editing the source would make the two disagree. The
          writer refuses independently, because a disabled control is not authorization.
        */}
        <button
          onClick={() => void handleSaveDraft()}
          disabled={saving || weeklyOtAllocationBlocked || locked}
          title={
            locked
              ? "This working timesheet has received MW4H Final Approval and is locked. Corrections require an adjustment timesheet."
              : undefined
          }
          className={
            saving || weeklyOtAllocationBlocked || locked
              ? "px-5 py-2 text-sm font-medium bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
              : "px-5 py-2 text-sm font-medium bg-slate-800 text-slate-200 border border-slate-600 rounded hover:text-slate-100"
          }
        >
          Save Draft
        </button>
        {/*
          TE-S3 repurposes the existing "Mark Ready for Payroll" placeholder into the Owner-authoritative
          action, and leaves "Generate Snapshot" disabled because TE-S4 owns it. No new action was added
          and the approved shell was not redesigned.
        */}
        <button
          disabled
          className="px-5 py-2 text-sm font-medium bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
        >
          Generate Snapshot
        </button>
        <button
          onClick={() => void handleMarkReadyForApprovals()}
          disabled={markingReady || readiness?.state !== "READY" || locked}
          title={
            locked
              ? "This working timesheet has received MW4H Final Approval and is locked."
              : readiness?.state === "READY"
                ? undefined
                : "Resolve the outstanding items before marking this working timesheet ready."
          }
          className={
            markingReady || readiness?.state !== "READY" || locked
              ? "px-5 py-2 text-sm font-medium bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
              : "px-5 py-2 text-sm font-medium bg-slate-800 text-slate-200 border border-slate-600 rounded hover:text-slate-100"
          }
        >
          {markingReady ? "Marking..." : "Mark Ready for Approvals"}
        </button>
      </div>

      {/*
        =========================================================================================
        TE-S5 / TE-S6 THE MW4H APPROVAL LIFECYCLE
        =========================================================================================

        TWO DISTINCT APPROVALS, PRESENTED AS TWO DISTINCT ACTS. Initial Approval freezes what the
        customer will be shown and leaves the sheet editable. Final Approval creates the immutable
        snapshot and closes the week. They are never one control, because they are never one decision.

        THE SCREEN EXPLAINS; THE SERVER DECIDES. Every fact shown here was resolved server-side, and the
        Final Approval endpoint re-checks all of it. A stale page can at worst offer a button whose
        request is refused.

        NO REDESIGN. This reuses the page's existing plain-text and slate/amber conventions.
      */}
      <div className="mb-6">
        <div className="text-sm text-slate-300 mb-2">MW4H Approvals</div>

        {locked ? (
          /*
            THE FINALLY APPROVED, LOCKED STATE.
            It does not suggest the sheet can be reopened, because it cannot. The approved figures stay
            readable; only editing is gone.
          */
          <div className="px-3 py-2 bg-slate-800/60 border border-slate-600 rounded text-xs text-slate-300">
            <div className="text-emerald-400 font-medium mb-1">
              MW4H Final Approval complete — this working timesheet is locked.
            </div>
            <div>
              The approved snapshot is the permanent record for payroll and invoicing. This timesheet can
              no longer be edited, and a correction requires an adjustment timesheet.
            </div>
            {reviewState?.finalApproval.exception && (
              <div className="mt-1 text-amber-400">
                Final Approval proceeded through a governed MW4H exception:{" "}
                {reviewState.finalApproval.exception.note}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-3 items-center flex-wrap">
              <button
                onClick={() => void handleInitialApprove()}
                disabled={approving !== null || readiness?.state !== "READY"}
                title={
                  readiness?.state === "READY"
                    ? undefined
                    : "This working timesheet is not ready for approvals yet."
                }
                className={
                  approving !== null || readiness?.state !== "READY"
                    ? "px-5 py-2 text-sm font-medium bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
                    : "px-5 py-2 text-sm font-medium bg-slate-800 text-slate-200 border border-slate-600 rounded hover:text-slate-100"
                }
              >
                {approving === "INITIAL" ? "Approving..." : "MW4H Initial Approval"}
              </button>

              {/*
                THE ORDINARY FINAL APPROVAL, offered only when no governed exception is needed - that is,
                when review does not apply or the customer approved everything. When an exception IS
                needed this button is absent entirely, so it can never be the route by which a dispute
                or a silence gets waved through.
              */}
              {requiredException === null && (
                <button
                  onClick={() => void handleFinalApprove()}
                  disabled={approving !== null || !finalApprovalOffered}
                  title={
                    finalApprovalOffered
                      ? "Creates the immutable approved snapshot and locks this timesheet."
                      : "MW4H Initial Approval must be current before Final Approval."
                  }
                  className={
                    approving !== null || !finalApprovalOffered
                      ? "px-5 py-2 text-sm font-medium bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
                      : "px-5 py-2 text-sm font-medium bg-emerald-900/40 text-emerald-300 border border-emerald-700 rounded hover:text-emerald-200"
                  }
                >
                  {approving === "FINAL" ? "Approving..." : "MW4H Final Approval"}
                </button>
              )}
            </div>

            {/* The customer review situation, stated plainly and never flattered. */}
            {reviewState?.requirement.required && reviewState.current && (
              <div className="text-xs text-slate-400">
                Customer review version {reviewState.current.sequence}:{" "}
                {reviewState.current.approved + reviewState.current.carriedForward} approved,{" "}
                {reviewState.current.disputed} disputed, {reviewState.current.unanswered} awaiting a
                response, of {reviewState.current.lineCount} line(s).
              </div>
            )}

            {/*
              AN UNRESOLVED DISPUTE. Never described as a customer approval, because it is the opposite
              of one. The override is available, clearly labelled as MW4H's own act, and it demands a
              reason before it can be used.
            */}
            {requiredException === "DISPUTE_OVERRIDE" && (
              <div className="px-3 py-2 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-300">
                <div className="font-medium mb-1">
                  The customer disputed {reviewState?.current?.disputed} line(s). This is not a customer
                  approval and the dispute remains on record.
                </div>
                {overrideKind === "DISPUTE_OVERRIDE" ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <label className="text-amber-200" htmlFor="te-override-reason">
                      Why is MW4H proceeding over the customer&apos;s dispute? This is recorded
                      permanently against the approval.
                    </label>
                    <textarea
                      id="te-override-reason"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={2}
                      className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          void handleFinalApprove({
                            kind: "DISPUTE_OVERRIDE",
                            reason: overrideReason,
                          })
                        }
                        disabled={
                          approving !== null ||
                          !finalApprovalOffered ||
                          overrideReason.trim().length < 10
                        }
                        className={
                          approving !== null ||
                          !finalApprovalOffered ||
                          overrideReason.trim().length < 10
                            ? "px-4 py-1 bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
                            : "px-4 py-1 bg-amber-900/50 text-amber-200 border border-amber-600 rounded hover:text-amber-100"
                        }
                      >
                        {approving === "FINAL"
                          ? "Approving..."
                          : "MW4H Final Approval — override dispute"}
                      </button>
                      <button
                        onClick={() => {
                          setOverrideKind(null);
                          setOverrideReason("");
                        }}
                        className="px-4 py-1 bg-slate-800 text-slate-300 border border-slate-600 rounded hover:text-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setOverrideKind("DISPUTE_OVERRIDE")}
                    className="mt-1 px-4 py-1 bg-slate-800 text-amber-300 border border-amber-700 rounded hover:text-amber-200"
                  >
                    Use MW4H dispute override
                  </button>
                )}
              </div>
            )}

            {/*
              NO CUSTOMER RESPONSE. Before the deadline there is deliberately no completion path here at
              all - only a statement of when it passes. Afterwards the action says what it actually is:
              proceeding WITHOUT a customer response, not with their approval.
            */}
            {requiredException === "NO_RESPONSE" && (
              <div className="px-3 py-2 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-300">
                <div className="font-medium mb-1">
                  The customer has not responded to {reviewState?.current?.unanswered} line(s). This is
                  not a customer approval.
                </div>
                {reviewState?.finalApproval.respondByElapsed !== true ? (
                  <div>
                    {reviewState?.finalApproval.governingRespondBy
                      ? `The response deadline has not passed yet (${reviewState.finalApproval.governingRespondBy}). Final Approval cannot proceed without a customer response until then.`
                      : "No customer review request has been sent yet, so there is no response deadline."}
                  </div>
                ) : overrideKind === "NO_RESPONSE" ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <label className="text-amber-200" htmlFor="te-noresponse-reason">
                      Record why MW4H is proceeding without a customer response. This is kept permanently
                      against the approval.
                    </label>
                    <textarea
                      id="te-noresponse-reason"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={2}
                      className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-slate-200"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          void handleFinalApprove({
                            kind: "NO_RESPONSE",
                            reason: overrideReason,
                          })
                        }
                        disabled={
                          approving !== null ||
                          !finalApprovalOffered ||
                          overrideReason.trim().length < 10
                        }
                        className={
                          approving !== null ||
                          !finalApprovalOffered ||
                          overrideReason.trim().length < 10
                            ? "px-4 py-1 bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
                            : "px-4 py-1 bg-amber-900/50 text-amber-200 border border-amber-600 rounded hover:text-amber-100"
                        }
                      >
                        {approving === "FINAL"
                          ? "Approving..."
                          : "MW4H Final Approval — proceed without customer response"}
                      </button>
                      <button
                        onClick={() => {
                          setOverrideKind(null);
                          setOverrideReason("");
                        }}
                        className="px-4 py-1 bg-slate-800 text-slate-300 border border-slate-600 rounded hover:text-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setOverrideKind("NO_RESPONSE")}
                    className="mt-1 px-4 py-1 bg-slate-800 text-amber-300 border border-amber-700 rounded hover:text-amber-200"
                  >
                    Proceed without customer response
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {approvalError && <div className="text-sm text-red-400 mt-2">{approvalError}</div>}
        {approvalMessage && <div className="text-sm text-emerald-400 mt-2">{approvalMessage}</div>}
      </div>

      {/*
        TE-S3 the server's readiness verdict, and the blocking reasons it supplied.
        The screen explains the hold; it never decides it.
      */}
      {readiness && (
        <div className="mb-6">
          <div className="text-sm text-slate-300 mb-1">
            {status === "Ready for Approvals" ? "Ready for Approvals" : "Draft"}
            <span className="text-slate-500"> — {describeReadinessState(readiness)}</span>
          </div>
          {readinessBlockers.length > 0 && (
            <ul className="text-xs text-amber-400 list-disc pl-5">
              {readinessBlockers.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {readyError && <div className="text-sm text-red-400 mt-1">{readyError}</div>}
          {readyMessage && <div className="text-sm text-emerald-400 mt-1">{readyMessage}</div>}
        </div>
      )}

      {/* Save Draft status, using this page's existing plain-text conventions */}
      {saving && <div className="text-sm text-slate-400 mb-6">Saving draft…</div>}
      {!saving && saveError && <div className="text-sm text-red-400 mb-6">{saveError}</div>}
      {!saving && !saveError && saveMessage && (
        <div className="text-sm text-emerald-400 mb-6">{saveMessage}</div>
      )}
      <p className="text-xs text-slate-500 mb-6">UI shell</p>

      {/* Navigation */}
      <div className="flex gap-6 items-center">
        <Link
          href="/time-entry"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Time Entry
        </Link>
      </div>
    </div>
  );
}
