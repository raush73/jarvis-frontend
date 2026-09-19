/**
 * TE-S3 Working Timesheet readiness in the UI.
 *
 * WHAT THESE PROVE. The screen CONSUMES the server's readiness verdict and never decides it: the
 * action is unavailable while the server says the sheet is blocked, the server's reasons are shown to
 * the operator, the action calls the governed endpoint, and the refreshed verdict comes back from the
 * server rather than being assumed.
 *
 * WHAT THEY FENCE. The approved shell was not redesigned - the existing footer placeholder was
 * repurposed, "Generate Snapshot" stays disabled because TE-S4 owns it, and no approval, customer
 * review, payroll or invoice action exists anywhere on the page.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchWorkingTimesheetDetail = vi.fn();
const saveWorkingTimesheetDraft = vi.fn();
const fetchCustomerJobs = vi.fn();
const createCustomerJob = vi.fn();
const markWorkingTimesheetReadyForApprovals = vi.fn();

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
}));

import WorkingTimesheetPage from "./page";

const ORDER_A = "order-a";
const WEEK_START = "2026-09-07";
const MON = "2026-09-07";
const SHEET_ID = `${ORDER_A}__${WEEK_START}`;

function readiness(overrides: Record<string, any> = {}) {
  return {
    state: "READY",
    rosterWorkerCount: 1,
    accountedWorkerCount: 1,
    unaccountedWorkers: [],
    dataConflicts: [],
    incompleteEntries: [],
    customerJobsApplicable: false,
    markedReadyAt: null,
    markedReadyByUserId: null,
    evaluatedAt: "2026-09-18T12:00:00.000Z",
    ...overrides,
  };
}

function draftRow(overrides: Record<string, any> = {}) {
  return {
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
    ...overrides,
  };
}

function detail(overrides: Record<string, any> = {}) {
  return {
    id: SHEET_ID,
    entryMode: "DAILY" as const,
    orderId: ORDER_A,
    weekStart: WEEK_START,
    weekEnding: "2026-09-13",
    orderRef: "Main Assembly",
    jobSite: "Acme Plant A",
    customerId: "cust-1",
    customerName: "Acme Manufacturing",
    status: "Draft" as const,
    readiness: readiness(),
    workers: [
      {
        candidateId: "cand-1",
        workerName: "John Martinez",
        trade: "Welder",
        assignmentIds: ["a1"],
        draft: null,
        draftState: {
          hoursEntryId: "h1",
          totalHours: 8,
          sdEligible: null,
          jobRows: [draftRow()],
          items: [],
          classifications: [],
        },
        draftConflict: false,
      },
    ],
    draftConflictCandidateIds: [],
    orphanedDraftCandidateIds: [],
    ...overrides,
  };
}

async function renderSheet() {
  render(<WorkingTimesheetPage />);
  await waitFor(() => expect(fetchWorkingTimesheetDetail).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("Mark Ready for Approvals")).toBeTruthy());
}

const readyButton = () =>
  screen.getByText(/Mark Ready for Approvals|Marking\.\.\./).closest("button") as HTMLButtonElement;

beforeEach(() => {
  fetchCustomerJobs.mockResolvedValue([]);
  fetchWorkingTimesheetDetail.mockResolvedValue(detail());
});

afterEach(() => {
  cleanup();
  fetchWorkingTimesheetDetail.mockReset();
  saveWorkingTimesheetDraft.mockReset();
  fetchCustomerJobs.mockReset();
  createCustomerJob.mockReset();
  markWorkingTimesheetReadyForApprovals.mockReset();
});

// ===========================================================================================
// THE ACTION FOLLOWS THE SERVER
// ===========================================================================================

describe("the readiness action follows the server verdict", () => {
  it("is ENABLED when the server says READY", async () => {
    await renderSheet();
    expect(readyButton().disabled).toBe(false);
  });

  it.each([["INCOMPLETE"], ["NOT_STARTED"]])(
    "is DISABLED when the server says %s",
    async (state) => {
      fetchWorkingTimesheetDetail.mockResolvedValue(
        detail({ readiness: readiness({ state }) }),
      );
      await renderSheet();
      expect(readyButton().disabled).toBe(true);
    },
  );

  it("does not call the endpoint while blocked", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({ readiness: readiness({ state: "INCOMPLETE" }) }),
    );
    await renderSheet();

    fireEvent.click(readyButton());

    expect(markWorkingTimesheetReadyForApprovals).not.toHaveBeenCalled();
  });

  it("calls the governed endpoint with the worksheet identity", async () => {
    markWorkingTimesheetReadyForApprovals.mockResolvedValue({
      workingTimesheetId: SHEET_ID,
      orderId: ORDER_A,
      weekStart: WEEK_START,
      status: "Ready for Approvals",
      readiness: readiness({ markedReadyAt: "2026-09-18T12:00:00.000Z" }),
    });
    await renderSheet();

    fireEvent.click(readyButton());

    await waitFor(() =>
      expect(markWorkingTimesheetReadyForApprovals).toHaveBeenCalledWith(SHEET_ID),
    );
  });

  it("refreshes the displayed state from the SERVER response", async () => {
    // Not from an optimistic assumption: what the server returns is what is shown.
    markWorkingTimesheetReadyForApprovals.mockResolvedValue({
      workingTimesheetId: SHEET_ID,
      orderId: ORDER_A,
      weekStart: WEEK_START,
      status: "Ready for Approvals",
      readiness: readiness({ markedReadyAt: "2026-09-18T12:00:00.000Z" }),
    });
    await renderSheet();

    fireEvent.click(readyButton());

    await waitFor(() => expect(screen.getByText(/Marked Ready for Approvals/)).toBeTruthy());
    expect(screen.getAllByText(/Ready for Approvals/).length).toBeGreaterThan(0);
  });

  it("surfaces a server refusal instead of claiming success", async () => {
    markWorkingTimesheetReadyForApprovals.mockRejectedValue(
      new Error("API 400 Bad Request: not ready"),
    );
    await renderSheet();

    fireEvent.click(readyButton());

    await waitFor(() => expect(screen.getByText(/not ready/i)).toBeTruthy());
    expect(screen.queryByText(/Marked Ready for Approvals/)).toBeNull();
  });

  it("reports honestly when the server saved but readiness has since broken", async () => {
    markWorkingTimesheetReadyForApprovals.mockResolvedValue({
      workingTimesheetId: SHEET_ID,
      orderId: ORDER_A,
      weekStart: WEEK_START,
      status: "Draft",
      readiness: readiness({ state: "INCOMPLETE", markedReadyAt: "2026-09-18T12:00:00.000Z" }),
    });
    await renderSheet();

    fireEvent.click(readyButton());

    await waitFor(() => expect(screen.getByText(/no longer ready/i)).toBeTruthy());
  });
});

// ===========================================================================================
// BLOCKING REASONS ARE SURFACED
// ===========================================================================================

describe("the server's blocking reasons are shown to the operator", () => {
  it("names a rostered worker nobody accounted for", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({
        readiness: readiness({
          state: "INCOMPLETE",
          rosterWorkerCount: 2,
          accountedWorkerCount: 1,
          unaccountedWorkers: [{ candidateId: "cand-2", workerName: "Sarah Chen" }],
        }),
      }),
    );
    await renderSheet();

    expect(
      screen.getByText(/Sarah Chen has no time entered and has not been reviewed/i),
    ).toBeTruthy();
  });

  it("explains unallocated Weekly overtime", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({
        readiness: readiness({
          state: "INCOMPLETE",
          incompleteEntries: [
            {
              kind: "WEEKLY_OT_NOT_FULLY_ALLOCATED",
              candidateId: "cand-1",
              jobRowIndex: null,
              detail: "expected 10, allocated 5",
            },
          ],
        }),
      }),
    );
    await renderSheet();

    expect(screen.getByText(/overtime is not fully allocated/i)).toBeTruthy();
    expect(screen.getByText(/expected 10, allocated 5/)).toBeTruthy();
  });

  it("explains a worked row missing its Customer Job", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({
        readiness: readiness({
          state: "INCOMPLETE",
          customerJobsApplicable: true,
          incompleteEntries: [
            {
              kind: "WORKED_ROW_MISSING_CUSTOMER_JOB",
              candidateId: "cand-1",
              jobRowIndex: 1,
              detail: null,
            },
          ],
        }),
      }),
    );
    await renderSheet();

    // Row index is shown one-based, matching what the operator sees on screen.
    expect(screen.getByText(/job row 2 with no Customer Job selected/i)).toBeTruthy();
  });

  it("explains an ambiguous saved draft", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({
        readiness: readiness({
          state: "INCOMPLETE",
          dataConflicts: [{ kind: "AMBIGUOUS_DRAFT", candidateId: "cand-1" }],
        }),
      }),
    );
    await renderSheet();

    expect(screen.getByText(/more than one saved draft/i)).toBeTruthy();
  });

  it("shows how many workers are accounted for", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({
        readiness: readiness({
          state: "INCOMPLETE",
          rosterWorkerCount: 3,
          accountedWorkerCount: 2,
          unaccountedWorkers: [{ candidateId: "cand-3", workerName: "Pete Nguyen" }],
        }),
      }),
    );
    await renderSheet();

    expect(screen.getByText(/2 of 3 workers accounted for/i)).toBeTruthy();
  });

  it("shows no blocking list when the sheet is READY", async () => {
    await renderSheet();
    expect(screen.getByText(/complete and ready for approvals/i)).toBeTruthy();
    expect(screen.queryByText(/has no time entered/i)).toBeNull();
  });
});

// ===========================================================================================
// THE SHELL AND THE FUTURE BOUNDARY
// ===========================================================================================

describe("the approved shell and the future lifecycle boundary", () => {
  it("keeps Generate Snapshot disabled, because TE-S4 owns it", async () => {
    await renderSheet();
    expect(screen.getByText("Generate Snapshot").closest("button")!.disabled).toBe(true);
  });

  it("adds no customer-delivery, payroll or invoice action", async () => {
    // TE-S6 narrowed this tripwire. The MW4H approvals it forbade are now legitimately on the page -
    // TE-S5 and TE-S6 built them, and their own suites cover them. What must STILL be absent is
    // everything downstream: sending to the customer, running payroll, and creating an invoice.
    await renderSheet();
    for (const forbidden of [
      /Send to Customer/i,
      /Immutable/i,
      /Run Payroll/i,
      /Create Invoice/i,
      /Customer Approved/i,
    ]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });

  it("keeps the TE-S3 readiness transition distinct from the approvals above it", async () => {
    // Marking ready is not approving. Three separate controls, three separate acts.
    await renderSheet();
    expect(screen.getByRole("button", { name: /Mark Ready for Approvals/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /MW4H Initial Approval/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^MW4H Final Approval$/i })).toBeTruthy();
  });

  it("does not use the superseded readiness wording", async () => {
    await renderSheet();
    expect(screen.queryByText(/Mark Ready for Payroll/)).toBeNull();
    expect(screen.queryByText(/Ready to Snapshot/)).toBeNull();
  });

  it("leaves Save Draft and the entry surface working", async () => {
    await renderSheet();
    expect(screen.getByText("Save Draft").closest("button")!.disabled).toBe(false);
    for (const label of ["Daily", "Weekly Totals", "+ Add Job", "Job/Order"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("keeps the sheet editable after it is marked ready", async () => {
    // Ready for Approvals is not immutability - TE-S6 owns the final lock.
    markWorkingTimesheetReadyForApprovals.mockResolvedValue({
      workingTimesheetId: SHEET_ID,
      orderId: ORDER_A,
      weekStart: WEEK_START,
      status: "Ready for Approvals",
      readiness: readiness({ markedReadyAt: "2026-09-18T12:00:00.000Z" }),
    });
    await renderSheet();

    fireEvent.click(readyButton());
    await waitFor(() => expect(screen.getByText(/Marked Ready for Approvals/)).toBeTruthy());

    // Save Draft is still available and the hour inputs are still editable.
    expect(screen.getByText("Save Draft").closest("button")!.disabled).toBe(false);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    expect(inputs.some((i) => !i.disabled)).toBe(true);
  });
});
