import { apiFetch } from "@/lib/api";

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

export interface WorkingTimesheetWorker {
  /** Stable worker/draft join identity. */
  candidateId: string;
  workerName: string;
  trade: string | null;
  /** Every overlapping Assignment for this worker, reference only. */
  assignmentIds: string[];
  /** Null when nothing was saved, or when the saved state was ambiguous. */
  draft: WorkingTimesheetWorkerDraft | null;
  /** True when more than one OPEN draft row exists, so no draft truth is guessed. */
  draftConflict: boolean;
}

export interface WorkingTimesheetDetail {
  id: string;
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
