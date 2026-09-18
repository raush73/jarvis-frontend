import { apiFetch } from "@/lib/api";
import type { SaveDraftPayload } from "@/lib/timeEntry/buildDraftPayload";

/**
 * TE-S1 Working Timesheet Hub contract.
 *
 * A Working Timesheet is ONE Job Order + ONE Monday->Sunday crew-week. Its `id` is the
 * deterministic backend identity (`${orderId}__${weekStart}`), so it is stable across
 * reads and safe to use as the Hub's navigation target.
 */

/**
 * The Working Timesheet lifecycle states the backend actually produces.
 *
 * TE-S1 produced only "Draft". TE-S3 adds "Ready for Approvals", the Owner-authoritative name for a
 * worksheet that has passed its entry checks and may begin the governed approval lifecycle.
 *
 * The Hub legend's other placeholders ("Submitted", "Needs Customer", "Ready to Snapshot") remain
 * display-only and are still NOT produced: MW4H Initial Approval, Customer Review, MW4H Final Approval
 * and the Immutable Approved Snapshot are later slices.
 */
export type WorkingTimesheetStatus = "Draft" | "Ready for Approvals";

/**
 * TE-S3 the server's readiness verdict for one Working Timesheet.
 *
 * `state` is the ONLY representation of the verdict; the three lists explain it and never compete with
 * it. The backend recomputes this on every read, so a screen must consume it rather than deciding
 * readiness for itself - and `markedReadyAt` is audit, never a reason to display readiness.
 */
export type WorkingTimesheetReadinessState = "NOT_STARTED" | "INCOMPLETE" | "READY";

export interface ReadinessUnaccountedWorker {
  candidateId: string;
  workerName: string;
}

export interface ReadinessDataConflict {
  kind: "AMBIGUOUS_DRAFT" | "ORPHANED_DRAFT";
  candidateId: string;
}

export interface ReadinessIncompleteEntry {
  kind: "WEEKLY_OT_NOT_FULLY_ALLOCATED" | "WORKED_ROW_MISSING_CUSTOMER_JOB";
  candidateId: string;
  jobRowIndex: number | null;
  detail: string | null;
}

export interface WorkingTimesheetReadiness {
  state: WorkingTimesheetReadinessState;
  rosterWorkerCount: number;
  accountedWorkerCount: number;
  /** Rostered workers nobody entered anything for and nobody reviewed. */
  unaccountedWorkers: ReadinessUnaccountedWorker[];
  dataConflicts: ReadinessDataConflict[];
  incompleteEntries: ReadinessIncompleteEntry[];
  /** True when the parent Job Order operates with subordinate Customer Jobs. */
  customerJobsApplicable: boolean;
  markedReadyAt: string | null;
  markedReadyByUserId: string | null;
  evaluatedAt: string;
}

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
  /**
   * TE-S2B8 the durable Customer Job recorded for this row, or null when none was.
   *
   * Null means only "not recorded". It is never the parent Order, and nothing is invented for a
   * historical row saved before Customer Jobs existed.
   */
  customerJobId: string | null;
  /**
   * The Customer Job's CURRENT description, resolved by the backend through the relation.
   *
   * Sent alongside the id for two reasons: descriptions are renameable while the id is durable,
   * and this is how a row referencing an ARCHIVED Customer Job can still display its real job
   * even though the archived job is absent from the selectable list.
   */
  customerJobDescription: string | null;
  /** False when the referenced Customer Job has been archived. Never a reason to clear the row. */
  customerJobIsActive: boolean | null;
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

/**
 * TE-SD-2A authoritative Shift Differential availability per crew-week date, keyed `YYYY-MM-DD`.
 *
 * Server-derived from the Job Order's SD agreement and the replacement for the former hard-coded
 * `JOB_HAS_SHIFT_DIFF` constant. Carries capability only - never an SD dollar amount.
 */
export type SdEligibilityByDate = Record<string, boolean>;

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
  /**
   * TE-S3 whether this worksheet may begin the approval lifecycle, recomputed server-side on every
   * read. `status` above is the display consequence; this is the reasoned verdict.
   */
  readiness: WorkingTimesheetReadiness;
  workers: WorkingTimesheetWorker[];
  draftConflictCandidateIds: string[];
  orphanedDraftCandidateIds: string[];
  /** TE-SD-2A per-date Shift Differential availability. Optional so older fixtures stay valid. */
  sdEligibilityByDate?: SdEligibilityByDate;
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

/**
 * TE-S2B8 one durable Customer Job under a Job Order.
 *
 * The customer's own paperwork names the work - "First Floor", "Paint Area",
 * "Customer Job #12345" - as ONE free-text description. `id` is the durable business identity
 * that Time Entry rows reference; `description` is display only and may be corrected later
 * without the id moving.
 */
export interface CustomerJob {
  id: string;
  orderId: string;
  description: string;
  isActive: boolean;
}

/**
 * List the Customer Jobs for one Job Order.
 *
 * ORDER-OWNED, NOT WEEK-OWNED, and that is the whole point: because the list belongs to the Job
 * Order rather than to a worksheet, a Customer Job typed once is offered to every worker on this
 * sheet and to every LATER WEEK for the same Order, with no retyping and no derivation from the
 * current week's rows.
 *
 * Returns ACTIVE jobs by default, which is the correct set of NEW choices. `includeInactive` uses
 * the backend's existing `activeOnly=false` support and is not part of normal selection.
 */
export async function fetchCustomerJobs(
  orderId: string,
  options: { includeInactive?: boolean } = {},
): Promise<CustomerJob[]> {
  const query = options.includeInactive ? "?activeOnly=false" : "";
  return apiFetch<CustomerJob[]>(
    `/orders/${encodeURIComponent(orderId)}/customer-jobs${query}`,
  );
}

/**
 * Create one Customer Job under a Job Order and return it, including its durable id.
 *
 * The returned id - never the typed text - is what a Time Entry row stores. Duplicate identity is
 * decided by the backend (case-insensitive, whitespace-normalized, per Order), so "first floor"
 * cannot become a second "First Floor" here.
 */
export async function createCustomerJob(
  orderId: string,
  description: string,
): Promise<CustomerJob> {
  return apiFetch<CustomerJob>(`/orders/${encodeURIComponent(orderId)}/customer-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
}

/**
 * Turn a Customer Job create failure into something an operator can act on.
 *
 * `apiFetch` throws one Error whose message embeds the HTTP status, so this reads that rather
 * than inventing a second error channel. The three cases worth distinguishing are the three an
 * operator can actually respond to: the job already exists, they lack the capability, or the
 * description was rejected.
 */
export function describeCustomerJobCreateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b409\b/.test(message)) {
    return "That Customer Job already exists for this Job Order. Select it from the list instead.";
  }
  if (/\b(401|403)\b/.test(message)) {
    return "You do not have permission to create a Customer Job for this Job Order.";
  }
  if (/\b400\b/.test(message)) {
    return "Enter a Customer Job description.";
  }
  return "Could not create the Customer Job. Please try again.";
}

export interface MarkReadyForApprovalsResult {
  workingTimesheetId: string;
  orderId: string;
  weekStart: string;
  status: WorkingTimesheetStatus;
  readiness: WorkingTimesheetReadiness;
}

/**
 * TE-S3 mark one Working Timesheet READY FOR APPROVALS.
 *
 * The server recomputes readiness and refuses unless its own verdict is READY, so this is a request to
 * record an operator's assertion rather than a claim the client can make stick. It records who and when,
 * creates no snapshot, performs no approval, and leaves the worksheet editable.
 */
export async function markWorkingTimesheetReadyForApprovals(
  id: string,
): Promise<MarkReadyForApprovalsResult> {
  return apiFetch<MarkReadyForApprovalsResult>(
    `/time-entry/working-timesheets/${encodeURIComponent(id)}/ready-for-approvals`,
    { method: "PUT", headers: { "Content-Type": "application/json" } },
  );
}

export interface AcknowledgeRosterWorkerResult {
  workingTimesheetId: string;
  candidateId: string;
  acknowledgedAt: string;
  acknowledgedByUserId: string;
  readiness: WorkingTimesheetReadiness;
}

/**
 * TE-S3 record that a rostered worker was reviewed and has no Time Entry facts to enter this week.
 *
 * This exists because "untouched" must never silently mean "reviewed and worked zero hours". It is a
 * TIME ENTRY acknowledgement only: it ends no Assignment, suspends nobody, removes nobody from
 * Dispatch, and creates no zero-hour entry.
 */
export async function acknowledgeRosterWorker(
  id: string,
  candidateId: string,
): Promise<AcknowledgeRosterWorkerResult> {
  return apiFetch<AcknowledgeRosterWorkerResult>(
    `/time-entry/working-timesheets/${encodeURIComponent(id)}/roster-acknowledgement`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId }),
    },
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
