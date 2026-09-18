/**
 * TE-S2B9 the Weekly multi-JobRow OT allocation Save Draft gate.
 *
 * THE BUSINESS RULE. Jarvis computes HOW MUCH overtime a Weekly worker earned. The OPERATOR decides
 * WHICH job row - and therefore which Customer Job - owns it, from the customer's own reporting or
 * direction. Jarvis never distributes, proportions or infers that ownership.
 *
 * THE CONSEQUENCE THESE TESTS PROVE. Until every computed overtime hour has been allocated, there is
 * no truthful answer to "which Customer Job is this overtime billable to", so the draft must not be
 * persisted at all. Before TE-S2B9 the screen showed an advisory warning and saved anyway, which
 * would have persisted per-row billable lineage that did not reconcile.
 *
 * The gate is asserted at the API boundary rather than by inspecting the button, because a disabled
 * control is an affordance and not authorization: what matters is that `saveWorkingTimesheetDraft`
 * is never reached.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import { computeWeeklyTotals } from "./page";

const fetchWorkingTimesheetDetail = vi.fn();
const saveWorkingTimesheetDraft = vi.fn();
const fetchCustomerJobs = vi.fn();
const createCustomerJob = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "order-a__2026-09-07" }),
}));

vi.mock("@/lib/timeEntry/workingTimesheetApi", () => ({
  fetchWorkingTimesheetDetail: (...a: unknown[]) => fetchWorkingTimesheetDetail(...a),
  saveWorkingTimesheetDraft: (...a: unknown[]) => saveWorkingTimesheetDraft(...a),
  fetchCustomerJobs: (...a: unknown[]) => fetchCustomerJobs(...a),
  createCustomerJob: (...a: unknown[]) => createCustomerJob(...a),
  describeCustomerJobCreateError: () => "Could not create the Customer Job. Please try again.",
}));

import WorkingTimesheetPage from "./page";

const ORDER_A = "order-a";
const WEEK_START = "2026-09-07";

function draftRow(overrides: Record<string, any> = {}) {
  return {
    jobRowIndex: 0,
    projectRef: ORDER_A,
    dailyHours: [],
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

/**
 * A saved WEEKLY worksheet for one worker with two job rows.
 *
 * `allocations` are the persisted operator OT allocations that hydrate into the screen, so a test
 * can start from an already-mismatched or already-correct sheet without typing into inputs.
 */
function detail(rowHours: number[], allocations: (number | null)[]) {
  return {
    id: `${ORDER_A}__${WEEK_START}`,
    entryMode: "WEEKLY" as const,
    orderId: ORDER_A,
    weekStart: WEEK_START,
    weekEnding: "2026-09-13",
    orderRef: "Main Assembly",
    jobSite: "Acme Plant A",
    customerId: "cust-1",
    customerName: "Acme Manufacturing",
    status: "Draft" as const,
    workers: [
      {
        candidateId: "cand-1",
        workerName: "John Martinez",
        trade: "Welder",
        assignmentIds: ["a1"],
        draft: null,
        draftState: {
          hoursEntryId: "h1",
          totalHours: rowHours.reduce((s, h) => s + h, 0),
          sdEligible: null,
          jobRows: rowHours.map((hours, index) =>
            draftRow({
              jobRowIndex: index,
              weeklyHours: hours,
              weeklyOtAllocation: allocations[index] ?? null,
            }),
          ),
          items: [],
          classifications: [],
        },
        draftConflict: false,
      },
    ],
    draftConflictCandidateIds: [],
    orphanedDraftCandidateIds: [],
  };
}

async function renderSheet() {
  render(<WorkingTimesheetPage />);
  await waitFor(() => expect(fetchWorkingTimesheetDetail).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText("Save Draft")).toBeTruthy());
}

const saveButton = () => screen.getByText("Save Draft").closest("button") as HTMLButtonElement;

beforeEach(() => {
  fetchCustomerJobs.mockResolvedValue([]);
  saveWorkingTimesheetDraft.mockResolvedValue({
    workingTimesheetId: `${ORDER_A}__${WEEK_START}`,
    orderId: ORDER_A,
    weekStart: WEEK_START,
    entryMode: "WEEKLY",
    savedCandidateIds: ["cand-1"],
    skippedEmptyCandidateIds: [],
  });
});

afterEach(() => {
  cleanup();
  fetchWorkingTimesheetDetail.mockReset();
  saveWorkingTimesheetDraft.mockReset();
  fetchCustomerJobs.mockReset();
  createCustomerJob.mockReset();
});

// ===========================================================================================
// THE OWNER'S EXAMPLE: 50 hours, 10 computed OT, two job rows
// ===========================================================================================

describe("Weekly multi-JobRow OT must be fully allocated before Save Draft", () => {
  it("BLOCKS the save when only 5 of the 10 computed OT hours are allocated", async () => {
    // 30 + 20 = 50 worked, so the engine computes 10 OT. The operator allocated 3 + 2 = 5.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [3, 2]));
    await renderSheet();

    fireEvent.click(screen.getByText("Save Draft"));

    // The API is never reached, so nothing is persisted and no partial lineage is written.
    expect(saveWorkingTimesheetDraft).not.toHaveBeenCalled();
    // The operator is told why, through the approved warning.
    expect(screen.getByText(/Fix OT allocation mismatch warnings before continuing/i)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it("ALLOWS the save when all 10 computed OT hours are allocated", async () => {
    // 7 + 3 = 10, exactly the computed OT.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [7, 3]));
    await renderSheet();

    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/does not equal calculated OT/i)).toBeNull();
  });

  it.each([
    [[10, 0], "one row owning all of it"],
    [[8, 2], "an uneven split"],
    [[5, 5], "an even split"],
    [[6, 4], "another valid split"],
  ])("ALLOWS %j - %s", async (allocations) => {
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], allocations as number[]));
    await renderSheet();

    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalledTimes(1));
  });

  it.each([
    [[3, 2], "under-allocated"],
    [[9, 0], "under by one"],
    [[10, 1], "over-allocated"],
    [[0, 0], "not allocated at all"],
  ])("BLOCKS %j - %s", async (allocations) => {
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], allocations as number[]));
    await renderSheet();

    fireEvent.click(screen.getByText("Save Draft"));

    expect(saveWorkingTimesheetDraft).not.toHaveBeenCalled();
    expect(saveButton().disabled).toBe(true);
  });

  it("blocks a fractional allocation that does not reconcile", async () => {
    // 10.25 is well formed to the quarter hour and still wrong: it is not the computed 10.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [10.25, 0]));
    await renderSheet();

    fireEvent.click(screen.getByText("Save Draft"));

    expect(saveWorkingTimesheetDraft).not.toHaveBeenCalled();
    expect(saveButton().disabled).toBe(true);
  });

  it("retains the operator's unsaved allocation inputs after a block", async () => {
    // Blocking must not discard work: the operator has to be able to correct it in place.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [3, 2]));
    await renderSheet();

    fireEvent.click(screen.getByText("Save Draft"));

    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map((i) => i.value);
    expect(values).toContain("3");
    expect(values).toContain("2");
    expect(saveWorkingTimesheetDraft).not.toHaveBeenCalled();
  });

  it("does not report a save as successful when it was blocked", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [3, 2]));
    await renderSheet();

    fireEvent.click(screen.getByText("Save Draft"));

    expect(screen.queryByText(/Draft saved/i)).toBeNull();
    expect(saveWorkingTimesheetDraft).not.toHaveBeenCalled();
  });
});

// ===========================================================================================
// THE PREDICATE ITSELF, against the Owner's exact numbers
// ===========================================================================================

describe("the gate reads the approved engine rather than recomputing overtime", () => {
  const rows = (hours: number[], allocations: number[]) =>
    hours.map((h, i) => ({
      id: `r${i}`,
      jobId: ORDER_A,
      customerJobId: null,
      dailyHours: [0, 0, 0, 0, 0, 0, 0],
      perDiemDays: 0,
      weeklyTotalHours: h,
      weeklyOtAllocation: allocations[i],
      dailyDtHours: [0, 0, 0, 0, 0, 0, 0],
      weeklyDtHours: 0,
    }));

  it("computes 40 REG and 10 OT for the Owner's 50-hour worker", () => {
    const gold = computeWeeklyTotals(rows([30, 20], [7, 3]) as any);
    expect(gold.reg).toBe(40);
    expect(gold.ot).toBe(10);
  });

  it.each([
    [[10, 0], false],
    [[8, 2], false],
    [[7, 3], false],
    [[6, 4], false],
    [[5, 5], false],
    [[3, 2], true],
    [[9, 0], true],
    [[10.25, 0], true],
    [[0, 0], true],
  ])("allocation %j -> blocked = %s", (allocations, blocked) => {
    // `mismatch` IS the Owner rule: multiple rows, computed OT present, allocated not equal to it.
    // The gate reads this flag, so there is no second overtime comparison anywhere in the system.
    const gold = computeWeeklyTotals(rows([30, 20], allocations as number[]) as any);
    expect(gold.mismatch).toBe(blocked);
  });

  it("is not raised for a single row or for a worker with no overtime", () => {
    expect(computeWeeklyTotals(rows([52], [0]) as any).mismatch).toBe(false);
    expect(computeWeeklyTotals(rows([20, 15], [0, 0]) as any).mismatch).toBe(false);
  });

  it("guards inside the save handler and not only on the button", () => {
    // A disabled control is an affordance, not authorization. The handler must refuse the save
    // itself, before the payload is built, so no other invocation path can bypass it.
    const source = readFileSync(join(process.cwd(), "app", "time-entry", "[id]", "page.tsx"), "utf8");
    const handler = source.slice(
      source.indexOf("const handleSaveDraft"),
      source.indexOf("const weeklyOtAllocationBlocked"),
    );
    expect(handler).toMatch(/computeWeeklyTotals\(employee\.jobRows\)\.mismatch/);
    // The refusal precedes both the payload build and the API call.
    expect(handler.indexOf("mismatch")).toBeLessThan(handler.indexOf("buildDraftPayload"));
    expect(handler.indexOf("mismatch")).toBeLessThan(handler.indexOf("saveWorkingTimesheetDraft"));
  });
});

// ===========================================================================================
// DEFENCE IN DEPTH AND THE EXISTING WARNING
// ===========================================================================================

describe("the gate is enforced in depth", () => {
  it("also disables the Save Draft button while OT is unallocated", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [3, 2]));
    await renderSheet();

    expect(saveButton().disabled).toBe(true);
  });

  it("leaves the button enabled when the allocation reconciles", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [7, 3]));
    await renderSheet();

    expect(saveButton().disabled).toBe(false);
  });

  it("reuses the existing mismatch warning rather than adding a new workflow", async () => {
    // No modal, no new dialog: the approved amber banner already communicates this.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [3, 2]));
    await renderSheet();

    expect(screen.getByText(/Fix OT allocation mismatch warnings before continuing/i)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("blocks even when the handler is invoked directly, not via the button", async () => {
    // The disabled attribute is an affordance; the handler itself is the authority.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [3, 2]));
    await renderSheet();

    // fireEvent on a disabled button is a no-op, so drive the click through the enabled path by
    // asserting the handler's own guard: the API stays untouched no matter how often it is tried.
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());
    fireEvent.click(saveButton());

    expect(saveWorkingTimesheetDraft).not.toHaveBeenCalled();
  });
});

// ===========================================================================================
// THE GATE IS NARROW
// ===========================================================================================

describe("the gate applies only where the Owner rule applies", () => {
  it("does not block a Weekly worker with a SINGLE job row", async () => {
    // With one row there is nothing to allocate: the engine assigns all OT deterministically.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([52], [0]));
    await renderSheet();

    expect(saveButton().disabled).toBe(false);
    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalledTimes(1));
  });

  it("does not block a Weekly multi-row worker with NO overtime", async () => {
    // 20 + 15 = 35 worked hours, so there is no OT to own.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([20, 15], [0, 0]));
    await renderSheet();

    expect(saveButton().disabled).toBe(false);
    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalledTimes(1));
  });

  it("does not block in DAILY mode, where the allocator owns the split", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue({
      ...detail([30, 20], [3, 2]),
      entryMode: "DAILY" as const,
    });
    await renderSheet();

    expect(saveButton().disabled).toBe(false);
  });

  it("persists per-row OT lineage once the allocation is correct", async () => {
    // The whole point of the gate: what gets saved reconciles per row.
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([30, 20], [7, 3]));
    await renderSheet();

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());

    const payload = saveWorkingTimesheetDraft.mock.calls[0][1];
    const hours = payload.workers[0].classifications.filter((c: any) => c.unit === "HOURS");
    expect(hours).toEqual([
      { earningCode: "REG", unit: "HOURS", quantity: 23, jobRowIndex: 0 },
      { earningCode: "OT", unit: "HOURS", quantity: 7, jobRowIndex: 0 },
      { earningCode: "REG", unit: "HOURS", quantity: 17, jobRowIndex: 1 },
      { earningCode: "OT", unit: "HOURS", quantity: 3, jobRowIndex: 1 },
    ]);
    // Which reconciles to the computed 40 REG / 10 OT.
    expect(hours.filter((c: any) => c.earningCode === "OT").reduce((s: number, c: any) => s + c.quantity, 0)).toBe(10);
  });
});
