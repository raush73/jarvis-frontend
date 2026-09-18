import { apiFetch } from "@/lib/api";
import type { SaveDraftPayload } from "@/lib/timeEntry/buildDraftPayload";

/**
 * TE-S1 Working Timesheet Hub contract.
 *
 * A Working Timesheet is ONE Job Order + ONE Monday->Sunday crew-week. Its `id` is the
 * deterministic backend identity (`${orderId}__${weekStart}`), so it is stable across
 * reads and safe to use as the Hub's navigation target.
 */

/** Only state produced by TE-S1. Later lifecycle states are owned by a later slice. */
export type WorkingTimesheetStatus = "Draft";

export interface WorkingTimesheetSummary {
  id: string;
  orderId: string;
  orderRef: string;
  customerId: string;
  customerName: string;
  /** Crew-week Monday, YYYY-MM-DD. */
  weekStart: string;
  /** Crew-week Sunday, YYYY-MM-DD. */
  weekEnding: string;
  workers: number;
  status: WorkingTimesheetStatus;
}

export interface WorkingTimesheetCustomerGroup {
  customerId: string;
  customerName: string;
  workingTimesheets: WorkingTimesheetSummary[];
}

export interface WorkingTimesheetHubResponse {
  weekStart: string;
  weekEnding: string;
  customerGroups: WorkingTimesheetCustomerGroup[];
}

/**
 * Fetch the Working Timesheets for a completed crew-week.
 *
 * `weekStart` must be a Monday (YYYY-MM-DD). When omitted the backend uses the most
 * recently completed crew-week, so the Hub is populated once a week has closed without
 * staff creating each Working Timesheet by hand.
 */
export async function fetchWorkingTimesheetHub(
  weekStart?: string,
): Promise<WorkingTimesheetHubResponse> {
  const query = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
  return apiFetch<WorkingTimesheetHubResponse>(`/time-entry/working-timesheets${query}`);
}

/**
 * One persisted draft line, exactly as stored. Time Entry does not own money, so no
 * rate or amount is exposed here.
 */
export interface WorkingTimesheetDraftLine {
  earningCode: string;
  unit: string;
  quantity: number;
  projectRef: string | null;
  tradeId: string | null;
}

/** Persisted OPEN draft for one worker in this crew-week. */
export interface WorkingTimesheetWorkerDraft {
  hoursEntryId: string;
  totalHours: number;
  lines: WorkingTimesheetDraftLine[];
}

/** TE-S2B6: the ONE saved operating mode of a Working Timesheet. */
export type WorkingTimesheetEntryMode = "DAILY" | "WEEKLY";

/** A quantity belonging to one actual date. `workDate` is YYYY-MM-DD. */
export interface WorkingTimesheetDatedQuantity {
  workDate: string;
  quantity: number;
}

/**
 * One persisted job row. Identity is `jobRowIndex` plus `projectRef`; transient UI row ids are
 * never persistence identity.
 *
 * Source facts (`dailyHours`, `weeklyHours`) are kept distinct from operator inputs
 * (`weeklyOtAllocation`, `dailyDt`, `weeklyDt`, `sdDates`) and from the billable Per Diem
 * quantity, so hydration never mistakes an output for an input.
 */
export interface WorkingTimesheetDraftJobRow {
  jobRowIndex: number;
  projectRef: string | null;
  dailyHours: WorkingTimesheetDatedQuantity[];
  weeklyHours: number | null;
  weeklyOtAllocation: number | null;
  dailyDt: WorkingTimesheetDatedQuantity[];
  weeklyDt: number | null;
  sdDates: string[];
  perDiemDays: number | null;
}

export interface WorkingTimesheetDraftItem {
  billability: "BILLABLE" | "NON_BILLABLE";
  itemType: string;
  unit: "DOLLARS" | "DAYS";
  value: number;
  note: string | null;
  sortOrder: number;
}

/** The full persisted draft for one worker, decomposed for reopen fidelity. */
export interface WorkingTimesheetWorkerDraftState {
  hoursEntryId: string;
  totalHours: number;
  /** Null means SD eligibility was never recorded, not that it is off. */
  sdEligible: boolean | null;
  jobRows: WorkingTimesheetDraftJobRow[];
  items: WorkingTimesheetDraftItem[];
  /** Persisted classification OUTPUT. Present for fidelity, never re-read as input. */
  classifications: WorkingTimesheetDraftLine[];
}

export interface WorkingTimesheetWorker {
  /** Stable worker/draft join identity. */
  candidateId: string;
  workerName: string;
  trade: string | null;
  /** Every overlapping Assignment for this worker, reference only. */
  assignmentIds: string[];
  /** Null when nothing was saved, or when the saved state was ambiguous. */
  draft: WorkingTimesheetWorkerDraft | null;
  /** TE-S2B6 full persisted draft. Null under the same conditions as `draft`. */
  draftState: WorkingTimesheetWorkerDraftState | null;
  /** True when more than one OPEN draft row exists, so no draft truth is guessed. */
  draftConflict: boolean;
}

export interface WorkingTimesheetDetail {
  id: string;
  /** Saved worksheet operating mode, or null when this worksheet was never saved. */
  entryMode: WorkingTimesheetEntryMode | null;
  orderId: string;
  weekStart: string;
  weekEnding: string;
  orderRef: string;
  jobSite: string;
  customerId: string;
  customerName: string;
  status: WorkingTimesheetStatus;
  workers: WorkingTimesheetWorker[];
  draftConflictCandidateIds: string[];
  orphanedDraftCandidateIds: string[];
}

/**
 * Fetch one primary Working Timesheet by its derived identity (`${orderId}__${weekStart}`).
 *
 * Returns the Order-scoped crew-week roster left-joined with any persisted OPEN draft.
 * Read-only: this call never creates, updates, or deletes Time Entry.
 */
export async function fetchWorkingTimesheetDetail(
  id: string,
): Promise<WorkingTimesheetDetail> {
  return apiFetch<WorkingTimesheetDetail>(
    `/time-entry/working-timesheets/${encodeURIComponent(id)}`,
  );
}

export interface SaveWorkingTimesheetDraftResult {
  workingTimesheetId: string;
  orderId: string;
  weekStart: string;
  entryMode: "DAILY" | "WEEKLY";
  /** Workers whose facts were persisted. Untouched roster workers are absent by design. */
  savedCandidateIds: string[];
  /** Submitted workers skipped because they carried no actual Time Entry fact. */
  skippedEmptyCandidateIds: string[];
}

/**
 * Save the Working Timesheet draft.
 *
 * PUT because the operation is a full, idempotent replacement of the submitted worker facts:
 * sending the same payload twice leaves exactly the same persisted state. Writes only mutable
 * OPEN draft state - it never approves, snapshots, or reaches payroll or invoicing.
 */
export async function saveWorkingTimesheetDraft(
  id: string,
  payload: SaveDraftPayload,
): Promise<SaveWorkingTimesheetDraftResult> {
  return apiFetch<SaveWorkingTimesheetDraftResult>(
    `/time-entry/working-timesheets/${encodeURIComponent(id)}/draft`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}
