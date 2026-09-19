/**
 * TE-S6 the MW4H Final Approval experience.
 *
 * WHAT THESE PROVE. Initial Approval and Final Approval are two visibly different acts. Final Approval
 * is only offered when the server's own facts say it might succeed. Once the week is finally approved
 * the screen says so and the editing controls are gone.
 *
 * WHAT THEY FENCE. A dispute is never dressed up as a customer approval. A silence is never dressed up
 * as one either, and before the deadline there is no completion path at all. An override cannot be
 * reached by clicking the ordinary button, and it cannot be used without a reason. And the request
 * carries only the command: no readiness, no review-required flag, no customer decision.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchWorkingTimesheetDetail = vi.fn();
const saveWorkingTimesheetDraft = vi.fn();
const fetchCustomerJobs = vi.fn();
const createCustomerJob = vi.fn();
const markWorkingTimesheetReadyForApprovals = vi.fn();
const fetchCustomerReviewState = vi.fn();
const initialApproveWorkingTimesheet = vi.fn();
const finalApproveWorkingTimesheet = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "order-a__2026-09-07" }),
}));

vi.mock("@/lib/timeEntry/workingTimesheetApi", () => ({
  fetchWorkingTimesheetDetail: (...a: unknown[]) => fetchWorkingTimesheetDetail(...a),
  saveWorkingTimesheetDraft: (...a: unknown[]) => saveWorkingTimesheetDraft(...a),
  fetchCustomerJobs: (...a: unknown[]) => fetchCustomerJobs(...a),
  createCustomerJob: (...a: unknown[]) => createCustomerJob(...a),
  describeCustomerJobCreateError: () => "Could not create the Customer Job. Please try again.",
  markWorkingTimesheetReadyForApprovals: (...a: unknown[]) =>
    markWorkingTimesheetReadyForApprovals(...a),
  fetchCustomerReviewState: (...a: unknown[]) => fetchCustomerReviewState(...a),
  initialApproveWorkingTimesheet: (...a: unknown[]) => initialApproveWorkingTimesheet(...a),
  finalApproveWorkingTimesheet: (...a: unknown[]) => finalApproveWorkingTimesheet(...a),
}));

import WorkingTimesheetPage from "./page";

const ORDER_A = "order-a";
const WEEK_START = "2026-09-07";
const MON = "2026-09-07";
const SHEET_ID = `${ORDER_A}__${WEEK_START}`;

const HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const HOUR_AHEAD = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const REASON = "Escalated to the site superintendent and confirmed against the signed daily log.";

function detail(overrides: Record<string, any> = {}) {
  return {
    id: SHEET_ID,
    entryMode: "DAILY" as const,
    orderId: ORDER_A,
    weekStart: WEEK_START,
    weekEnding: "2026-09-13",
    orderRef: "Main Assembly",
    jobSite: "Plant A",
    customerId: "cust-1",
    customerName: "5D Mining & Construction",
    status: "Ready for Approvals" as const,
    readiness: {
      state: "READY",
      rosterWorkerCount: 1,
      accountedWorkerCount: 1,
      unaccountedWorkers: [],
      dataConflicts: [],
      incompleteEntries: [],
      customerJobsApplicable: false,
      markedReadyAt: "2026-09-18T12:00:00.000Z",
      markedReadyByUserId: "user-ready",
      evaluatedAt: "2026-09-18T12:00:00.000Z",
    },
    workers: [
      {
        candidateId: "cand-1",
        workerName: "John Martinez",
        trade: "Millwright",
        assignmentIds: ["a1"],
        draft: null,
        draftState: {
          hoursEntryId: "h1",
          totalHours: 8,
          sdEligible: null,
          jobRows: [
            {
              jobRowIndex: 0,
              projectRef: ORDER_A,
              dailyHours: [{ workDate: MON, quantity: 8 }],
              weeklyHours: null,
              weeklyOtAllocation: null,
              dailyDt: [],
              weeklyDt: null,
              sdDates: [],
              perDiemDays: null,
              customerJobId: null,
              customerJobDescription: null,
              customerJobIsActive: null,
            },
          ],
          items: [],
          classifications: [],
        },
        draftConflict: false,
      },
    ],
    draftConflictCandidateIds: [],
    orphanedDraftCandidateIds: [],
    sdEligibilityByDate: {},
    // TE-S6 not finally approved, so the sheet is still open.
    finalApproval: {
      locked: false,
      snapshotId: null,
      approvedAt: null,
      approvedByUserId: null,
    },
    ...overrides,
  };
}

/** A version summary with the given decision tally. */
function version(counts: Partial<Record<"approved" | "disputed" | "carriedForward" | "unanswered", number>>) {
  const approved = counts.approved ?? 0;
  const disputed = counts.disputed ?? 0;
  const carriedForward = counts.carriedForward ?? 0;
  const unanswered = counts.unanswered ?? 0;
  return {
    versionId: "ver-a",
    sequence: 1,
    contentHash: "hash-a",
    supersededAt: null,
    lineCount: approved + disputed + carriedForward + unanswered,
    approved,
    disputed,
    carriedForward,
    unanswered,
  };
}

function reviewState(overrides: Record<string, any> = {}) {
  return {
    requirement: { orderId: ORDER_A, customerId: "cust-1", required: false, source: "CUSTOMER_DEFAULT" },
    finalApproval: {
      locked: false,
      snapshotId: null,
      approvedAt: null,
      approvedByUserId: null,
      initialApprovalValid: true,
      governingRespondBy: null,
      respondByElapsed: null,
      exception: null,
    },
    current: version({ approved: 3 }),
    removedSincePriorVersion: [],
    versions: [],
    ...overrides,
  };
}

async function renderSheet() {
  render(<WorkingTimesheetPage />);
  await waitFor(() => expect(fetchWorkingTimesheetDetail).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());
}

const initialButton = () => screen.queryByRole("button", { name: /MW4H Initial Approval/i });
const finalButton = () =>
  screen.queryByRole("button", { name: /^MW4H Final Approval$/i }) ??
  screen.queryByRole("button", { name: /^Approving\.\.\.$/i });
const saveButton = () => screen.getByRole("button", { name: /Save Draft/i });

/**
 * Is this control disabled?
 *
 * Read from the attribute, matching the convention the existing Time Entry tests already use. No
 * jest-dom matchers are installed here, and TE-S6 introduces no new testing dependency.
 */
const isDisabled = (el: Element | null) => Boolean(el?.hasAttribute("disabled"));

beforeEach(() => {
  vi.clearAllMocks();
  fetchWorkingTimesheetDetail.mockResolvedValue(detail());
  fetchCustomerReviewState.mockResolvedValue(reviewState());
  fetchCustomerJobs.mockResolvedValue([]);
  initialApproveWorkingTimesheet.mockResolvedValue({
    created: true,
    versionId: "ver-a",
    sequence: 1,
    contentHash: "hash-a",
    lineCount: 4,
    carriedForwardCount: 0,
    supersededVersionId: null,
  });
  finalApproveWorkingTimesheet.mockResolvedValue({
    snapshotId: "snap-1",
    orderId: ORDER_A,
    weekStart: WEEK_START,
    weekEnd: "2026-09-13",
    workerCount: 1,
    customerReviewRequired: false,
    reviewVersionId: "ver-a",
    reviewVersionSequence: 1,
    exceptionUsed: null,
  });
});

afterEach(() => cleanup());

// ===========================================================================================
// THE TWO APPROVALS ARE DISTINCT
// ===========================================================================================

describe("TE-S6 keeps Initial Approval and Final Approval separate", () => {
  it("offers both, labelled distinctly", async () => {
    await renderSheet();
    expect(initialButton()).toBeTruthy();
    expect(finalButton()).toBeTruthy();
    expect(initialButton()).not.toBe(finalButton());
  });

  it("sends each to its OWN endpoint", async () => {
    await renderSheet();

    fireEvent.click(initialButton()!);
    await waitFor(() => expect(initialApproveWorkingTimesheet).toHaveBeenCalledWith(SHEET_ID));
    expect(finalApproveWorkingTimesheet).not.toHaveBeenCalled();

    fireEvent.click(finalButton()!);
    await waitFor(() => expect(finalApproveWorkingTimesheet).toHaveBeenCalled());
  });

  it("says Initial Approval froze a review version rather than locking anything", async () => {
    await renderSheet();
    fireEvent.click(initialButton()!);
    await waitFor(() => expect(screen.getByText(/Initial Approval recorded/i)).toBeTruthy());
    expect(screen.queryByText(/locked/i)).toBeNull();
  });
});

// ===========================================================================================
// FINAL APPROVAL IS OFFERED ONLY WHEN IT MIGHT SUCCEED
// ===========================================================================================

describe("TE-S6 offers Final Approval only in an appropriate state", () => {
  it("withholds it when the sheet is not READY", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({
        status: "Draft",
        readiness: { ...detail().readiness, state: "INCOMPLETE" },
      }),
    );
    await renderSheet();
    expect(isDisabled(finalButton())).toBe(true);
  });

  it("withholds it when no valid Initial Approval exists", async () => {
    fetchCustomerReviewState.mockResolvedValue(
      reviewState({
        finalApproval: { ...reviewState().finalApproval, initialApprovalValid: false },
      }),
    );
    await renderSheet();
    expect(isDisabled(finalButton())).toBe(true);
  });

  it("withholds it when the source changed since Initial Approval", async () => {
    // The server reports the fingerprint no longer matches, which is the same fact as above from the
    // screen's point of view: the frozen version no longer describes this sheet.
    fetchCustomerReviewState.mockResolvedValue(
      reviewState({
        finalApproval: { ...reviewState().finalApproval, initialApprovalValid: false },
      }),
    );
    await renderSheet();
    expect(isDisabled(finalButton())).toBe(true);
    expect(finalButton()!.getAttribute("title")).toMatch(/Initial Approval must be current/i);
  });

  it("offers it when review is not required and Initial Approval is current", async () => {
    await renderSheet();
    expect(isDisabled(finalButton())).toBe(false);
  });

  it("offers it when review IS required and the customer approved everything", async () => {
    fetchCustomerReviewState.mockResolvedValue(
      reviewState({
        requirement: { ...reviewState().requirement, required: true },
        current: version({ approved: 3, carriedForward: 1 }),
      }),
    );
    await renderSheet();
    expect(isDisabled(finalButton())).toBe(false);
    expect(screen.getByText(/4 approved, 0 disputed, 0 awaiting a response/i)).toBeTruthy();
  });
});

// ===========================================================================================
// A DISPUTE IS NEVER SHOWN AS AN APPROVAL
// ===========================================================================================

describe("TE-S6 tells the truth about a customer dispute", () => {
  const disputed = () =>
    reviewState({
      requirement: { ...reviewState().requirement, required: true },
      current: version({ approved: 2, disputed: 1 }),
    });

  beforeEach(() => {
    fetchCustomerReviewState.mockResolvedValue(disputed());
  });

  it("does not describe it as Customer Approved", async () => {
    await renderSheet();
    expect(screen.getByText(/disputed 1 line\(s\)/i)).toBeTruthy();
    expect(screen.getByText(/not a customer approval/i)).toBeTruthy();
    expect(screen.queryByText(/Customer Approved/i)).toBeNull();
  });

  it("removes the ordinary Final Approval button entirely", async () => {
    // The ordinary path must not be the route by which a dispute gets waved through.
    await renderSheet();
    expect(finalButton()).toBeNull();
  });

  it("requires an explicit override interaction before any approval control appears", async () => {
    await renderSheet();
    expect(screen.queryByRole("button", { name: /override dispute/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Use MW4H dispute override/i }));
    expect(screen.getByRole("button", { name: /override dispute/i })).toBeTruthy();
  });

  it("labels the override as MW4H's own act", async () => {
    await renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Use MW4H dispute override/i }));
    expect(
      screen.getByRole("button", { name: /MW4H Final Approval — override dispute/i }),
    ).toBeTruthy();
    expect(screen.getByText(/dispute remains on record/i)).toBeTruthy();
  });

  it("refuses to submit without a reason", async () => {
    await renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Use MW4H dispute override/i }));

    const submit = screen.getByRole("button", { name: /override dispute/i });
    expect(isDisabled(submit)).toBe(true);

    fireEvent.change(screen.getByLabelText(/Why is MW4H proceeding/i), {
      target: { value: "no" },
    });
    expect(isDisabled(screen.getByRole("button", { name: /override dispute/i }))).toBe(true);

    fireEvent.change(screen.getByLabelText(/Why is MW4H proceeding/i), {
      target: { value: REASON },
    });
    expect(isDisabled(screen.getByRole("button", { name: /override dispute/i }))).toBe(false);
  });

  it("sends DISPUTE_OVERRIDE with the typed reason and nothing else", async () => {
    await renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Use MW4H dispute override/i }));
    fireEvent.change(screen.getByLabelText(/Why is MW4H proceeding/i), {
      target: { value: REASON },
    });
    fireEvent.click(screen.getByRole("button", { name: /override dispute/i }));

    await waitFor(() =>
      expect(finalApproveWorkingTimesheet).toHaveBeenCalledWith(SHEET_ID, {
        kind: "DISPUTE_OVERRIDE",
        reason: REASON,
      }),
    );
  });
});

// ===========================================================================================
// NO CUSTOMER RESPONSE
// ===========================================================================================

describe("TE-S6 tells the truth about a customer who never answered", () => {
  const silent = (respondBy: string, elapsed: boolean | null) =>
    reviewState({
      requirement: { ...reviewState().requirement, required: true },
      current: version({ approved: 2, unanswered: 1 }),
      finalApproval: {
        ...reviewState().finalApproval,
        governingRespondBy: respondBy,
        respondByElapsed: elapsed,
      },
    });

  it("offers NO completion path before the deadline", async () => {
    fetchCustomerReviewState.mockResolvedValue(silent(HOUR_AHEAD, false));
    await renderSheet();

    expect(finalButton()).toBeNull();
    expect(screen.queryByRole("button", { name: /Proceed without customer response/i })).toBeNull();
    expect(screen.getByText(/response deadline has not passed yet/i)).toBeTruthy();
  });

  it("says no request has been sent when there is no deadline at all", async () => {
    fetchCustomerReviewState.mockResolvedValue(silent(null as any, null));
    await renderSheet();
    expect(screen.getByText(/no customer review request has been sent/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Proceed without customer response/i })).toBeNull();
  });

  it("describes the path after the deadline as proceeding WITHOUT a response", async () => {
    fetchCustomerReviewState.mockResolvedValue(silent(HOUR_AGO, true));
    await renderSheet();

    expect(screen.getByText(/has not responded to 1 line\(s\)/i)).toBeTruthy();
    expect(screen.getByText(/not a customer approval/i)).toBeTruthy();
    expect(screen.queryByText(/Customer Approved/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Proceed without customer response/i }));
    expect(
      screen.getByRole("button", { name: /proceed without customer response/i }),
    ).toBeTruthy();
  });

  it("takes deadline eligibility from the SERVER, not from its own clock", async () => {
    // A deliberately contradictory fixture: the server says the cutoff has passed while also reporting
    // a `governingRespondBy` in the future. If the page were comparing dates itself it would refuse.
    // It follows the server, which is what makes the hard payroll cutoff a backend rule.
    fetchCustomerReviewState.mockResolvedValue(silent(HOUR_AHEAD, true));
    await renderSheet();
    expect(
      screen.getByRole("button", { name: /Proceed without customer response/i }),
    ).toBeTruthy();
    expect(screen.queryByText(/deadline has not passed yet/i)).toBeNull();
  });

  it("computes no deadline of its own anywhere in the page", () => {
    const source = readFileSync(join(process.cwd(), "app", "time-entry", "[id]", "page.tsx"), "utf8");
    // It reads the server's verdict and never derives one. No date arithmetic against respondBy, and
    // no min/max over deadlines - the earliest-deadline cutoff is resolved server-side.
    expect(source).toContain("respondByElapsed === true");
    expect(source).not.toMatch(/Date\.now\(\)[\s\S]{0,80}respondBy/);
    expect(source).not.toMatch(/new Date\([^)]*respondBy[^)]*\)\s*[<>]/);
    expect(source).not.toMatch(/Math\.(min|max)\([^)]*respondBy/);
  });

  it("sends NO_RESPONSE with the recorded reason", async () => {
    fetchCustomerReviewState.mockResolvedValue(silent(HOUR_AGO, true));
    await renderSheet();

    fireEvent.click(screen.getByRole("button", { name: /Proceed without customer response/i }));
    fireEvent.change(screen.getByLabelText(/proceeding without a customer response/i), {
      target: { value: REASON },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /MW4H Final Approval — proceed without customer response/i }),
    );

    await waitFor(() =>
      expect(finalApproveWorkingTimesheet).toHaveBeenCalledWith(SHEET_ID, {
        kind: "NO_RESPONSE",
        reason: REASON,
      }),
    );
  });
});

// ===========================================================================================
// THE LOCKED STATE
// ===========================================================================================

describe("TE-S6 shows the finally approved week as locked", () => {
  const lockedDetail = () =>
    detail({
      finalApproval: {
        locked: true,
        snapshotId: "snap-1",
        approvedAt: "2026-09-19T09:00:00.000Z",
        approvedByUserId: "user-final",
      },
    });

  beforeEach(() => {
    fetchWorkingTimesheetDetail.mockResolvedValue(lockedDetail());
    fetchCustomerReviewState.mockResolvedValue(
      reviewState({
        finalApproval: { ...reviewState().finalApproval, locked: true, snapshotId: "snap-1" },
      }),
    );
  });

  it("says so, visibly", async () => {
    await renderSheet();
    expect(screen.getByText(/Final Approval complete — this working timesheet is locked/i)).toBeTruthy();
  });

  it("withdraws every approval action", async () => {
    await renderSheet();
    expect(initialButton()).toBeNull();
    expect(finalButton()).toBeNull();
  });

  it("disables Save Draft", async () => {
    await renderSheet();
    expect(isDisabled(saveButton())).toBe(true);
    expect(saveButton().getAttribute("title")).toMatch(/locked/i);
  });

  it("disables Mark Ready for Approvals", async () => {
    await renderSheet();
    expect(isDisabled(screen.getByRole("button", { name: /Mark Ready for Approvals/i }))).toBe(true);
  });

  it("does not imply the sheet can simply be reopened", async () => {
    await renderSheet();
    expect(screen.getByText(/correction requires an adjustment timesheet/i)).toBeTruthy();
    expect(screen.queryByText(/reopen|unlock|undo/i)).toBeNull();
  });

  it("keeps the approved historical information on screen", async () => {
    await renderSheet();
    // The worker and their hours are still readable; only editing is gone.
    expect(screen.getByText("John Martinez")).toBeTruthy();
  });

  it("names the governed exception when one was used", async () => {
    cleanup();
    fetchCustomerReviewState.mockResolvedValue(
      reviewState({
        finalApproval: {
          ...reviewState().finalApproval,
          locked: true,
          exception: {
            at: "2026-09-19T09:00:00.000Z",
            byUserId: "user-final",
            note: `DISPUTE_OVERRIDE: ${REASON}`,
          },
        },
      }),
    );
    await renderSheet();
    expect(screen.getByText(/governed MW4H exception/i)).toBeTruthy();
    expect(screen.getByText(/DISPUTE_OVERRIDE/)).toBeTruthy();
  });
});

// ===========================================================================================
// THE PAGE CLAIMS NO AUTHORITY
// ===========================================================================================

describe("TE-S6 sends only the Final Approval command", () => {
  const PAGE_SOURCE = readFileSync(join(process.cwd(), "app", "time-entry", "[id]", "page.tsx"), "utf8");
  const API_SOURCE = readFileSync(
    join(process.cwd(), "lib", "timeEntry", "workingTimesheetApi.ts"),
    "utf8",
  );

  it("sends no payload at all on the ordinary path", async () => {
    await renderSheet();
    fireEvent.click(finalButton()!);
    await waitFor(() => expect(finalApproveWorkingTimesheet).toHaveBeenCalled());
    // Only the sheet id. No second argument, so there is nothing to smuggle.
    expect(finalApproveWorkingTimesheet.mock.calls[0]).toEqual([SHEET_ID, undefined]);
  });

  it("puts only the exception kind and reason on the wire", () => {
    const body = API_SOURCE.slice(API_SOURCE.indexOf("export async function finalApproveWorkingTimesheet"));
    expect(body).toContain("exceptionKind");
    expect(body).toContain("exceptionReason");
    expect(body.slice(0, 1200)).not.toMatch(/readiness|reviewRequired|decision|approvedBy|snapshot/i);
  });

  it("sends no readiness verdict and no review-required flag as a fact", () => {
    const call = PAGE_SOURCE.slice(PAGE_SOURCE.indexOf("finalApproveWorkingTimesheet(workingTimesheetId"));
    expect(call.slice(0, 200)).not.toMatch(/readiness|requirement|required|customerReview/i);
  });

  it("treats the server's refusal as the answer rather than retrying past it", async () => {
    finalApproveWorkingTimesheet.mockRejectedValue(
      new Error("This Working Timesheet is not Ready for Approvals (INCOMPLETE)"),
    );
    await renderSheet();
    fireEvent.click(finalButton()!);
    await waitFor(() => expect(screen.getByText(/not Ready for Approvals/i)).toBeTruthy());
    expect(finalApproveWorkingTimesheet).toHaveBeenCalledTimes(1);
  });

  it("does not unlock the page on its own after a failed approval", async () => {
    finalApproveWorkingTimesheet.mockRejectedValue(new Error("nope"));
    await renderSheet();
    fireEvent.click(finalButton()!);
    await waitFor(() => expect(screen.getByText("nope")).toBeTruthy());
    // Still editable, because the approval did not happen.
    expect(isDisabled(saveButton())).toBe(false);
  });
});
