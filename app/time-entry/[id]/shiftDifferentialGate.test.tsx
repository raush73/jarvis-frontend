/**
 * TE-SD-2A the Shift Differential gate in the UI.
 *
 * WHAT THESE PROVE. The screen no longer decides whether Shift Differential exists. It CONSUMES the
 * server's per-date answer, so SD controls appear only when the Job Order actually granted a
 * differential, and an individual day the Order does not cover cannot be selected.
 *
 * WHAT THEY FENCE. The hard-coded `JOB_HAS_SHIFT_DIFF = true` demo constant is gone and cannot come
 * back, the Owner-approved SD interaction is otherwise untouched, and the UI is not the enforcement
 * point - the Save Draft writer independently refuses unauthorized SD.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

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

const WEEK_DATES = [
  "2026-09-07",
  "2026-09-08",
  "2026-09-09",
  "2026-09-10",
  "2026-09-11",
  "2026-09-12",
  "2026-09-13",
];

const sdWeek = (value: boolean) =>
  Object.fromEntries(WEEK_DATES.map((d) => [d, value])) as Record<string, boolean>;

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
    status: "Draft" as const,
    readiness: {
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
    sdEligibilityByDate: sdWeek(true),
    ...overrides,
  };
}

async function renderSheet() {
  render(<WorkingTimesheetPage />);
  await waitFor(() => expect(fetchWorkingTimesheetDetail).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());
}

const sdToggle = () => screen.queryByText(/Shift Diff (ON|OFF)/);

beforeEach(() => {
  fetchCustomerJobs.mockResolvedValue([]);
  fetchWorkingTimesheetDetail.mockResolvedValue(detail());
});

afterEach(() => {
  cleanup();
  fetchWorkingTimesheetDetail.mockReset();
  saveWorkingTimesheetDraft.mockReset();
  fetchCustomerJobs.mockReset();
});

// ===========================================================================================
// THE MOCK GATE IS GONE
// ===========================================================================================

describe("TE-SD-2A the demo SD constant is gone for good", () => {
  const rawSource = readFileSync(
    join(process.cwd(), "app", "time-entry", "[id]", "page.tsx"),
    "utf8",
  );

  /**
   * The page with comments stripped.
   *
   * Asserted against code rather than raw text, because the file legitimately EXPLAINS that the demo
   * constant was removed and why. Prose describing history must not be what fails - or satisfies - an
   * assertion about what the code does.
   */
  const pageSource = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  it("no longer declares or uses JOB_HAS_SHIFT_DIFF", () => {
    expect(pageSource).not.toContain("JOB_HAS_SHIFT_DIFF");
  });

  it("no longer contains the demo instruction that justified it", () => {
    // This one is checked against RAW text on purpose: the instruction itself must be gone, not merely
    // unreferenced.
    expect(rawSource).not.toContain("Set to true for demo");
    expect(rawSource).not.toMatch(/JOB-LEVEL SD GATE \(MOCK\)/);
  });

  it("consumes the server's per-date answer instead", () => {
    expect(pageSource).toContain("sdEligibilityByDate");
    expect(pageSource).toMatch(/detail\.sdEligibilityByDate/);
    // Gated per DAY, not merely per sheet.
    expect(pageSource).toMatch(/isSdEligibleOnDayIndex\(/);
  });

  it("does not hard-code an SD dollar amount or a customer", () => {
    expect(pageSource).not.toMatch(/sdPayDeltaRate|sdBillDeltaRate/);
  });
});

// ===========================================================================================
// NO AGREEMENT: SD IS NOT OFFERED
// ===========================================================================================

describe("TE-SD-2A hides Shift Differential when the Job Order grants none", () => {
  beforeEach(() => {
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({ sdEligibilityByDate: sdWeek(false) }),
    );
  });

  it("offers no worker-level SD toggle", async () => {
    await renderSheet();
    expect(sdToggle()).toBeNull();
  });

  it("says plainly that the Job Order has no Shift Differential", async () => {
    await renderSheet();
    expect(screen.getByText("Not Configured")).toBeTruthy();
    expect(
      screen.getByText("This Job Order does not have Shift Differential configured."),
    ).toBeTruthy();
  });

  it("treats a missing eligibility map as no SD rather than defaulting it on", async () => {
    // The removed constant defaulted to true; absence must now mean absence.
    cleanup();
    fetchWorkingTimesheetDetail.mockResolvedValue(detail({ sdEligibilityByDate: undefined }));
    await renderSheet();
    expect(sdToggle()).toBeNull();
    expect(screen.getByText("Not Configured")).toBeTruthy();
  });
});

// ===========================================================================================
// AGREEMENT PRESENT: THE APPROVED SD INTERACTION IS UNCHANGED
// ===========================================================================================

describe("TE-SD-2A keeps the approved SD interaction when the Order grants SD", () => {
  it("offers the worker-level SD toggle", async () => {
    await renderSheet();
    expect(sdToggle()).toBeTruthy();
  });

  it("does not show the Not Configured indicator", async () => {
    await renderSheet();
    expect(screen.queryByText("Not Configured")).toBeNull();
  });

  it("restores a persisted SD eligibility as ON, exactly as before", async () => {
    cleanup();
    const withSd = detail();
    withSd.workers[0].draftState.sdEligible = true;
    fetchWorkingTimesheetDetail.mockResolvedValue(withSd);
    await renderSheet();
    expect(screen.getByText("Shift Diff ON")).toBeTruthy();
  });
});

// ===========================================================================================
// PER-DAY GATING - THE POINT OF A DATE-KEYED CONTRACT
// ===========================================================================================

describe("TE-SD-2A gates individual days, not just the week", () => {
  /** A week where the Order acquires SD on Wednesday, so Mon and Tue are not covered. */
  const midWeekStart = {
    "2026-09-07": false,
    "2026-09-08": false,
    "2026-09-09": true,
    "2026-09-10": true,
    "2026-09-11": true,
    "2026-09-12": true,
    "2026-09-13": true,
  };

  it("still offers the worker toggle, because some day of the week is covered", async () => {
    cleanup();
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail({ sdEligibilityByDate: midWeekStart }),
    );
    await renderSheet();
    expect(sdToggle()).toBeTruthy();
    expect(screen.queryByText("Not Configured")).toBeNull();
  });

  it("disables the SD checkmark on the days the Order does not cover", async () => {
    cleanup();
    const withSd = detail({ sdEligibilityByDate: midWeekStart });
    withSd.workers[0].draftState.sdEligible = true;
    fetchWorkingTimesheetDetail.mockResolvedValue(withSd);
    await renderSheet();

    const blocked = screen.queryAllByTitle(
      "Shift Differential is not available on this date for this Job Order",
    );
    // Exactly the two uncovered days are refused; the five covered days are not.
    expect(blocked).toHaveLength(2);
    for (const button of blocked) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("disables every SD day when the Order covers none of them", async () => {
    cleanup();
    const withSd = detail({ sdEligibilityByDate: sdWeek(false) });
    withSd.workers[0].draftState.sdEligible = true;
    fetchWorkingTimesheetDetail.mockResolvedValue(withSd);
    await renderSheet();
    // With no covered day the worker toggle is absent, so the SD row never renders at all.
    expect(sdToggle()).toBeNull();
  });
});
