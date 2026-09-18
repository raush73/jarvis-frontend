/**
 * TE-S2B6 Save Draft reopen / hydration.
 *
 * Turns the authoritative detail response back into the Working Timesheet screen's own state
 * shapes. This is the exact inverse of `buildDraftPayload`, which is what makes
 * save -> reopen -> save a provable round trip.
 *
 * THREE RULES GOVERN THIS FILE:
 *
 *   1. NOTHING IS FABRICATED. A weekly total never becomes seven daily cells, and daily cells
 *      never become a weekly total. Each granularity hydrates only from its own source facts.
 *
 *   2. BOTH GRANULARITIES ARE RESTORED AT ONCE. `JobRow` already carries `dailyHours` and
 *      `weeklyTotalHours` side by side, so hydrating both preserves saved history for the
 *      inactive mode. Switching the selector after reopen then reveals genuinely saved values
 *      rather than derived ones, and no extra state machinery is needed.
 *
 *   3. OPERATOR INPUT COMES FROM OPERATOR INPUT. Manual DT comes from the DT designations, SD
 *      state from eligibility and day selections, OT allocation from the job-row input. None of
 *      it is reverse-engineered out of the calculated REG/OT/DT/SD classification lines, which
 *      are outputs. GOLD recomputes the classifications from the restored source facts.
 */

import type { BuilderItem, BuilderJobRow } from "./buildDraftPayload";
import type { WorkingTimesheetDetail } from "./workingTimesheetApi";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_IN_WEEK = 7;

export interface HydratedEmployee {
  id: string;
  name: string;
  trade: string;
  jobRows: BuilderJobRow[];
  billableItems: BuilderItem[];
  nonBillableItems: BuilderItem[];
}

export interface HydratedWorksheet {
  entryMode: "daily" | "weekly";
  employees: HydratedEmployee[];
  workerSdEnabled: Record<string, boolean>;
  rowSdFlags: Record<string, Record<string, boolean[]>>;
}

/** Persisted item taxonomy back to the label the approved dropdowns display. */
const ITEM_LABEL_BY_TYPE: Record<string, string> = {
  BONUS: "Bonus",
  HAZARD: "Hazard",
  MOBILIZATION: "Mobilization",
  DEMOBILIZATION: "Demobilization",
  REIMBURSEMENT: "Reimbursement",
  PER_DIEM: "Per Diem",
  OTHER: "Other",
};

/** Monday-first day index for a crew-week date, or -1 when it falls outside the week. */
export function dayIndexForWorkDate(weekStart: string, workDate: string): number {
  const start = new Date(`${weekStart}T00:00:00.000Z`).getTime();
  const day = new Date(`${workDate}T00:00:00.000Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(day)) return -1;
  const index = Math.round((day - start) / MS_PER_DAY);
  return index >= 0 && index < DAYS_IN_WEEK ? index : -1;
}

/** Deterministic job-row id. Transient ids are never persisted, so they are re-derived. */
export function jobRowId(candidateId: string, index: number): string {
  return `${candidateId}-job${index + 1}`;
}

function emptyWeek(): number[] {
  return [0, 0, 0, 0, 0, 0, 0];
}

/**
 * Restore one worker's job rows.
 *
 * Row count comes from the persisted rows; a worker with no persisted rows keeps the single
 * default row the screen has always shown, so an untouched worker still renders blank.
 */
function hydrateJobRows(
  detail: WorkingTimesheetDetail,
  candidateId: string,
  persistedRows: NonNullable<WorkingTimesheetDetail["workers"][number]["draftState"]>["jobRows"],
  legacyWeeklyTotal: number,
  legacyPerDiemDays: number,
): BuilderJobRow[] {
  if (persistedRows.length === 0) {
    // No per-row facts. Fall back to the TE-S2A summary shape so legacy drafts still reopen.
    return [
      {
        id: jobRowId(candidateId, 0),
        jobId: detail.orderId,
        dailyHours: emptyWeek(),
        perDiemDays: legacyPerDiemDays,
        weeklyTotalHours: legacyWeeklyTotal,
        weeklyOtAllocation: 0,
        dailyDtHours: emptyWeek(),
        weeklyDtHours: 0,
      },
    ];
  }

  return persistedRows.map((row, index) => {
    const dailyHours = emptyWeek();
    for (const cell of row.dailyHours) {
      const dayIdx = dayIndexForWorkDate(detail.weekStart, cell.workDate);
      if (dayIdx >= 0) dailyHours[dayIdx] = cell.quantity;
    }

    const dailyDtHours = emptyWeek();
    for (const cell of row.dailyDt) {
      const dayIdx = dayIndexForWorkDate(detail.weekStart, cell.workDate);
      if (dayIdx >= 0) dailyDtHours[dayIdx] = cell.quantity;
    }

    return {
      id: jobRowId(candidateId, index),
      // The saved job reference wins. When a row's facts never recorded one, the worksheet's
      // own Order is used, because it is the only job this Order-scoped sheet can offer - no
      // other job is invented.
      jobId: row.projectRef ?? detail.orderId,
      dailyHours,
      perDiemDays: row.perDiemDays ?? 0,
      weeklyTotalHours: row.weeklyHours ?? 0,
      weeklyOtAllocation: row.weeklyOtAllocation ?? 0,
      dailyDtHours,
      weeklyDtHours: row.weeklyDt ?? 0,
    };
  });
}

function hydrateItems(
  items: NonNullable<WorkingTimesheetDetail["workers"][number]["draftState"]>["items"],
  candidateId: string,
  billability: "BILLABLE" | "NON_BILLABLE",
): BuilderItem[] {
  const prefix = billability === "BILLABLE" ? "billable" : "nonbillable";
  return items
    .filter((item) => item.billability === billability)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, i) => ({
      id: `${candidateId}-${prefix}-${item.sortOrder}-${i}`,
      type: ITEM_LABEL_BY_TYPE[item.itemType] ?? "Other",
      note: item.note ?? "",
      value: item.value,
    }));
}

/**
 * Hydrate the whole worksheet.
 *
 * The roster still comes from the response's worker list, which is Assignment-derived, so a
 * roster worker with no persisted draft remains present and blank. A worker whose saved state
 * was ambiguous arrives with `draftState` null and is likewise left blank rather than guessed.
 */
export function hydrateDraftState(detail: WorkingTimesheetDetail): HydratedWorksheet {
  const workerSdEnabled: Record<string, boolean> = {};
  const rowSdFlags: Record<string, Record<string, boolean[]>> = {};

  const employees: HydratedEmployee[] = detail.workers.map((worker) => {
    const state = worker.draftState;

    // Legacy fallbacks, preserving the TE-S2A behaviour for drafts saved before TE-S2B5.
    const legacyWeeklyTotal = worker.draft?.totalHours ?? 0;
    const legacyPerDiemDays = (worker.draft?.lines ?? [])
      .filter((line) => line.earningCode === "PD" && line.unit === "DAYS")
      .reduce((sum, line) => sum + line.quantity, 0);

    const jobRows = hydrateJobRows(
      detail,
      worker.candidateId,
      state?.jobRows ?? [],
      legacyWeeklyTotal,
      // A per-row PD value supersedes the summed legacy fallback.
      (state?.jobRows ?? []).length > 0 ? 0 : legacyPerDiemDays,
    );

    if (state?.sdEligible) workerSdEnabled[worker.candidateId] = true;

    // SD day selections restore against the SAME synthesized row ids the page will use.
    const flagsForWorker: Record<string, boolean[]> = {};
    (state?.jobRows ?? []).forEach((row, index) => {
      if (row.sdDates.length === 0) return;
      const flags = [false, false, false, false, false, false, false];
      for (const iso of row.sdDates) {
        const dayIdx = dayIndexForWorkDate(detail.weekStart, iso);
        if (dayIdx >= 0) flags[dayIdx] = true;
      }
      flagsForWorker[jobRowId(worker.candidateId, index)] = flags;
    });
    if (Object.keys(flagsForWorker).length > 0) {
      rowSdFlags[worker.candidateId] = flagsForWorker;
    }

    return {
      id: worker.candidateId,
      name: worker.workerName,
      trade: worker.trade ?? "",
      jobRows,
      billableItems: hydrateItems(state?.items ?? [], worker.candidateId, "BILLABLE"),
      nonBillableItems: hydrateItems(state?.items ?? [], worker.candidateId, "NON_BILLABLE"),
    };
  });

  return {
    // A never-saved worksheet keeps the screen's existing default rather than an invented mode.
    entryMode: detail.entryMode === "WEEKLY" ? "weekly" : "daily",
    employees,
    workerSdEnabled,
    rowSdFlags,
  };
}
