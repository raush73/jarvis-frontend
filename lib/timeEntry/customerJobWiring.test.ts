/**
 * TE-S2B8 Customer Job wiring through the payload builder and hydration.
 *
 * What these prove, at the layer where the contract actually lives:
 *
 *   - the DURABLE ID travels, never the typed description;
 *   - a selected Customer Job is itself worth persisting;
 *   - hydration restores the id verbatim and never reconstructs it from text;
 *   - a null Customer Job stays null and never becomes the parent Order;
 *   - an ARCHIVED Customer Job referenced by a saved row remains displayable;
 *   - Daily/Weekly mode switching cannot disturb Customer Job identity;
 *   - save -> reopen -> save is a fixed point.
 */

import { describe, expect, it } from "vitest";
import { buildDraftPayload, type BuildDraftPayloadInput } from "./buildDraftPayload";
import { hydrateDraftState } from "./hydrateDraftState";
import { describeCustomerJobCreateError } from "./workingTimesheetApi";
import type { WorkingTimesheetDetail } from "./workingTimesheetApi";

const WEEK_START = "2026-09-07"; // Monday
const MON = "2026-09-07";
const TUE = "2026-09-08";
const ORDER_A = "order-a";

const CJ_FIRST = "cj-a-first";
const CJ_SECOND = "cj-a-second";
const CJ_ARCHIVED = "cj-a-old";

// -------------------------------------------------------------------------------------------
// builder input helpers
// -------------------------------------------------------------------------------------------

/**
 * Worker totals plus the approved engine's per-JobRow REG/OT/DT split.
 *
 * TE-S2B9 made `jobBreakdown` part of the builder contract. These Customer Job cases are all
 * single-row-per-worker, so the default is "one row owns all of this worker's hours".
 */
function totals(
  t: { totalHours: number; reg: number; ot: number; dt: number },
  rows?: { reg: number; ot: number; dt: number }[],
) {
  return { ...t, jobBreakdown: rows ?? [{ reg: t.reg, ot: t.ot, dt: t.dt }] };
}
function row(overrides: Record<string, any> = {}) {
  return {
    id: "cand-1-job1",
    jobId: ORDER_A,
    customerJobId: null as string | null,
    dailyHours: [0, 0, 0, 0, 0, 0, 0],
    perDiemDays: 0,
    weeklyTotalHours: 0,
    weeklyOtAllocation: 0,
    dailyDtHours: [0, 0, 0, 0, 0, 0, 0],
    weeklyDtHours: 0,
    ...overrides,
  };
}

function input(overrides: Partial<BuildDraftPayloadInput> = {}): BuildDraftPayloadInput {
  return {
    entryMode: "daily",
    weekStart: WEEK_START,
    employees: [
      {
        id: "cand-1",
        jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0] })],
        billableItems: [],
        nonBillableItems: [],
      },
    ],
    workerSdEnabled: {},
    rowSdFlags: {},
    totalsByEmployeeId: { "cand-1": totals({ totalHours: 8, reg: 8, ot: 0, dt: 0 }) },
    ...overrides,
  } as BuildDraftPayloadInput;
}

// -------------------------------------------------------------------------------------------
// hydration input helpers
// -------------------------------------------------------------------------------------------

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

function detail(overrides: Record<string, any> = {}): WorkingTimesheetDetail {
  return {
    id: `${ORDER_A}__${WEEK_START}`,
    entryMode: "DAILY",
    orderId: ORDER_A,
    weekStart: WEEK_START,
    weekEnding: "2026-09-13",
    orderRef: "Main Assembly",
    jobSite: "Acme Plant A",
    customerId: "cust-1",
    customerName: "Acme Manufacturing",
    status: "Draft",
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
          jobRows: [draftRow({ dailyHours: [{ workDate: MON, quantity: 8 }] })],
          items: [],
          classifications: [],
        },
        draftConflict: false,
      },
    ],
    draftConflictCandidateIds: [],
    orphanedDraftCandidateIds: [],
    ...overrides,
  } as unknown as WorkingTimesheetDetail;
}

// ===========================================================================================
// PAYLOAD
// ===========================================================================================

describe("the Save Draft payload carries the durable id", () => {
  it("sends customerJobId for a row that selected one", () => {
    const payload = buildDraftPayload(
      input({
        employees: [
          {
            id: "cand-1",
            jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0], customerJobId: CJ_FIRST })],
            billableItems: [],
            nonBillableItems: [],
          },
        ],
      }),
    );

    expect(payload.workers[0].jobRows![0].customerJobId).toBe(CJ_FIRST);
  });

  it("sends null for a row that selected none", () => {
    const payload = buildDraftPayload(input());
    expect(payload.workers[0].jobRows![0].customerJobId).toBeNull();
  });

  it("NEVER sends the description", () => {
    // Identity is the id. Text would be ambiguous across Orders and stale after a rename.
    const payload = buildDraftPayload(
      input({
        employees: [
          {
            id: "cand-1",
            jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0], customerJobId: CJ_FIRST })],
            billableItems: [],
            nonBillableItems: [],
          },
        ],
      }),
    );

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/First Floor/i);
    expect(serialized).not.toMatch(/customerJobDescription/);
    expect(serialized).not.toMatch(/description/);
  });

  it("normalizes an empty selection to null rather than an empty string", () => {
    const payload = buildDraftPayload(
      input({
        employees: [
          {
            id: "cand-1",
            jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0], customerJobId: "" })],
            billableItems: [],
            nonBillableItems: [],
          },
        ],
      }),
    );

    expect(payload.workers[0].jobRows![0].customerJobId).toBeNull();
  });

  it("persists a row whose ONLY input is the Customer Job", () => {
    // Selecting "First Floor" is operator input. Dropping such a row as empty would lose it.
    const payload = buildDraftPayload(
      input({
        employees: [
          {
            id: "cand-1",
            jobRows: [
              row({ dailyHours: [8, 0, 0, 0, 0, 0, 0] }),
              row({ id: "cand-1-job2", customerJobId: CJ_SECOND }),
            ],
            billableItems: [],
            nonBillableItems: [],
          },
        ],
      }),
    );

    const rows = payload.workers[0].jobRows!;
    expect(rows).toHaveLength(2);
    expect(rows[1].jobRowIndex).toBe(1);
    expect(rows[1].customerJobId).toBe(CJ_SECOND);
  });

  it("still omits a genuinely untouched row", () => {
    // An untouched row has no Customer Job, so Save Draft manufactures nothing for it.
    const payload = buildDraftPayload(
      input({
        employees: [
          {
            id: "cand-1",
            jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0] }), row({ id: "cand-1-job2" })],
            billableItems: [],
            nonBillableItems: [],
          },
        ],
      }),
    );

    expect(payload.workers[0].jobRows!).toHaveLength(1);
  });

  it("keeps the row's Customer Job independent of the parent Order reference", () => {
    // projectRef keeps its own meaning: the project. They are separate concepts on one row.
    const payload = buildDraftPayload(
      input({
        employees: [
          {
            id: "cand-1",
            jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0], customerJobId: CJ_FIRST })],
            billableItems: [],
            nonBillableItems: [],
          },
        ],
      }),
    );

    const r = payload.workers[0].jobRows![0];
    expect(r.projectRef).toBe(ORDER_A);
    expect(r.customerJobId).toBe(CJ_FIRST);
    expect(r.customerJobId).not.toBe(r.projectRef);
  });

  it("carries the same id for MANY workers sharing one Customer Job", () => {
    const payload = buildDraftPayload(
      input({
        employees: [
          {
            id: "cand-1",
            jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0], customerJobId: CJ_FIRST })],
            billableItems: [],
            nonBillableItems: [],
          },
          {
            id: "cand-2",
            jobRows: [
              row({ id: "cand-2-job1", dailyHours: [8, 0, 0, 0, 0, 0, 0], customerJobId: CJ_FIRST }),
            ],
            billableItems: [],
            nonBillableItems: [],
          },
        ],
        totalsByEmployeeId: {
          "cand-1": totals({ totalHours: 8, reg: 8, ot: 0, dt: 0 }),
          "cand-2": totals({ totalHours: 8, reg: 8, ot: 0, dt: 0 }),
        },
      }),
    );

    expect(payload.workers.map((w) => w.jobRows![0].customerJobId)).toEqual([CJ_FIRST, CJ_FIRST]);
  });

  it("keeps one worker's two rows on DIFFERENT Customer Jobs", () => {
    const payload = buildDraftPayload(
      input({
        employees: [
          {
            id: "cand-1",
            jobRows: [
              row({ dailyHours: [8, 0, 0, 0, 0, 0, 0], customerJobId: CJ_FIRST }),
              row({ id: "cand-1-job2", dailyHours: [0, 8, 0, 0, 0, 0, 0], customerJobId: CJ_SECOND }),
            ],
            billableItems: [],
            nonBillableItems: [],
          },
        ],
        totalsByEmployeeId: { "cand-1": totals({ totalHours: 16, reg: 16, ot: 0, dt: 0 }) },
      }),
    );

    expect(payload.workers[0].jobRows!.map((r) => [r.jobRowIndex, r.customerJobId])).toEqual([
      [0, CJ_FIRST],
      [1, CJ_SECOND],
    ]);
  });

  it("sends the same Customer Job in WEEKLY mode as in DAILY", () => {
    // Identity belongs to the row, not to the granularity.
    const rows = row({ weeklyTotalHours: 40, customerJobId: CJ_FIRST });
    const weekly = buildDraftPayload(
      input({
        entryMode: "weekly",
        employees: [
          { id: "cand-1", jobRows: [rows], billableItems: [], nonBillableItems: [] },
        ],
        totalsByEmployeeId: { "cand-1": totals({ totalHours: 40, reg: 40, ot: 0, dt: 0 }) },
      }),
    );

    expect(weekly.entryMode).toBe("WEEKLY");
    expect(weekly.workers[0].jobRows![0].customerJobId).toBe(CJ_FIRST);
    expect(weekly.workers[0].jobRows![0].dailyHours).toBeUndefined();
  });
});

// ===========================================================================================
// HYDRATION
// ===========================================================================================

describe("hydration restores the durable id", () => {
  it("restores customerJobId onto the row", () => {
    const hydrated = hydrateDraftState(
      detail({
        workers: [
          {
            ...detail().workers[0],
            draftState: {
              ...detail().workers[0].draftState!,
              jobRows: [
                draftRow({
                  dailyHours: [{ workDate: MON, quantity: 8 }],
                  customerJobId: CJ_FIRST,
                  customerJobDescription: "First Floor",
                  customerJobIsActive: true,
                }),
              ],
            },
          },
        ],
      }),
    );

    expect(hydrated.employees[0].jobRows[0].customerJobId).toBe(CJ_FIRST);
  });

  it("exposes the referenced Customer Job with its description", () => {
    const hydrated = hydrateDraftState(
      detail({
        workers: [
          {
            ...detail().workers[0],
            draftState: {
              ...detail().workers[0].draftState!,
              jobRows: [
                draftRow({
                  customerJobId: CJ_FIRST,
                  customerJobDescription: "First Floor",
                  customerJobIsActive: true,
                  dailyHours: [{ workDate: MON, quantity: 8 }],
                }),
              ],
            },
          },
        ],
      }),
    );

    expect(hydrated.referencedCustomerJobs).toEqual([
      { id: CJ_FIRST, orderId: ORDER_A, description: "First Floor", isActive: true },
    ]);
  });

  it("surfaces an ARCHIVED referenced Customer Job so its row can still display it", () => {
    // The Order's selectable list is active-only, so without this the select would have no option
    // matching its value and would appear to have silently changed the operator's selection.
    const hydrated = hydrateDraftState(
      detail({
        workers: [
          {
            ...detail().workers[0],
            draftState: {
              ...detail().workers[0].draftState!,
              jobRows: [
                draftRow({
                  customerJobId: CJ_ARCHIVED,
                  customerJobDescription: "Old Wing",
                  customerJobIsActive: false,
                  dailyHours: [{ workDate: MON, quantity: 8 }],
                }),
              ],
            },
          },
        ],
      }),
    );

    expect(hydrated.employees[0].jobRows[0].customerJobId).toBe(CJ_ARCHIVED);
    expect(hydrated.referencedCustomerJobs).toEqual([
      { id: CJ_ARCHIVED, orderId: ORDER_A, description: "Old Wing", isActive: false },
    ]);
  });

  it("deduplicates a Customer Job shared by several workers", () => {
    const base = detail().workers[0];
    const shared = draftRow({
      customerJobId: CJ_FIRST,
      customerJobDescription: "First Floor",
      customerJobIsActive: true,
      dailyHours: [{ workDate: MON, quantity: 8 }],
    });

    const hydrated = hydrateDraftState(
      detail({
        workers: [
          { ...base, draftState: { ...base.draftState!, jobRows: [shared] } },
          {
            ...base,
            candidateId: "cand-2",
            workerName: "Sarah Chen",
            draftState: { ...base.draftState!, jobRows: [shared] },
          },
        ],
      }),
    );

    expect(hydrated.referencedCustomerJobs).toHaveLength(1);
    expect(hydrated.employees.map((e) => e.jobRows[0].customerJobId)).toEqual([
      CJ_FIRST,
      CJ_FIRST,
    ]);
  });

  it("leaves a historical row with NO Customer Job at null", () => {
    const hydrated = hydrateDraftState(detail());

    expect(hydrated.employees[0].jobRows[0].customerJobId).toBeNull();
    expect(hydrated.referencedCustomerJobs).toEqual([]);
  });

  it("NEVER substitutes the parent Order for a missing Customer Job", () => {
    const hydrated = hydrateDraftState(detail());
    const r = hydrated.employees[0].jobRows[0];

    expect(r.customerJobId).toBeNull();
    expect(r.customerJobId).not.toBe(ORDER_A);
    // projectRef still hydrates into jobId with its own separate meaning.
    expect(r.jobId).toBe(ORDER_A);
  });

  it("leaves a legacy draft with no persisted rows at null", () => {
    const hydrated = hydrateDraftState(
      detail({
        workers: [
          {
            candidateId: "cand-1",
            workerName: "John Martinez",
            trade: "Welder",
            assignmentIds: ["a1"],
            draft: { hoursEntryId: "h1", totalHours: 40, lines: [] },
            draftState: {
              hoursEntryId: "h1",
              totalHours: 40,
              sdEligible: null,
              jobRows: [],
              items: [],
              classifications: [],
            },
            draftConflict: false,
          },
        ],
      }),
    );

    expect(hydrated.employees[0].jobRows[0].customerJobId).toBeNull();
    expect(hydrated.employees[0].jobRows[0].weeklyTotalHours).toBe(40);
  });

  it("ignores an id that arrived without a resolved description", () => {
    // No description is invented for it; the row keeps its id but contributes no option.
    const base = detail().workers[0];
    const hydrated = hydrateDraftState(
      detail({
        workers: [
          {
            ...base,
            draftState: {
              ...base.draftState!,
              jobRows: [draftRow({ customerJobId: CJ_FIRST, customerJobDescription: null })],
            },
          },
        ],
      }),
    );

    expect(hydrated.employees[0].jobRows[0].customerJobId).toBe(CJ_FIRST);
    expect(hydrated.referencedCustomerJobs).toEqual([]);
  });
});

// ===========================================================================================
// ROUND TRIP
// ===========================================================================================

describe("save -> reopen -> save is a fixed point", () => {
  function roundTrip(customerJobId: string, isActive = true) {
    const base = detail().workers[0];
    const reopened = hydrateDraftState(
      detail({
        workers: [
          {
            ...base,
            draftState: {
              ...base.draftState!,
              jobRows: [
                draftRow({
                  dailyHours: [
                    { workDate: MON, quantity: 8 },
                    { workDate: TUE, quantity: 8 },
                  ],
                  customerJobId,
                  customerJobDescription: "First Floor",
                  customerJobIsActive: isActive,
                }),
              ],
            },
          },
        ],
      }),
    );

    const resaved = buildDraftPayload({
      entryMode: "daily",
      weekStart: WEEK_START,
      employees: reopened.employees,
      workerSdEnabled: reopened.workerSdEnabled,
      rowSdFlags: reopened.rowSdFlags,
      totalsByEmployeeId: { "cand-1": totals({ totalHours: 16, reg: 16, ot: 0, dt: 0 }) },
    } as BuildDraftPayloadInput);

    return { reopened, resaved };
  }

  it("re-sends the same id and the same source facts", () => {
    const { reopened, resaved } = roundTrip(CJ_FIRST);

    expect(reopened.employees[0].jobRows[0].customerJobId).toBe(CJ_FIRST);
    const r = resaved.workers[0].jobRows![0];
    expect(r.customerJobId).toBe(CJ_FIRST);
    expect(r.jobRowIndex).toBe(0);
    expect(r.dailyHours).toEqual([
      { workDate: MON, quantity: 8 },
      { workDate: TUE, quantity: 8 },
    ]);
  });

  it("does not shift the row index or invent a second row", () => {
    const { resaved } = roundTrip(CJ_FIRST);
    expect(resaved.workers[0].jobRows!).toHaveLength(1);
  });

  it("re-sends an ARCHIVED Customer Job unchanged rather than dropping it", () => {
    const { resaved } = roundTrip(CJ_ARCHIVED, false);
    expect(resaved.workers[0].jobRows![0].customerJobId).toBe(CJ_ARCHIVED);
  });
});

// ===========================================================================================
// ERROR CLASSIFICATION
// ===========================================================================================

describe("create failures are described recoverably", () => {
  it("treats a 409 as an existing Customer Job, not a second identity", () => {
    const message = describeCustomerJobCreateError(
      new Error("API 409 Conflict: {\"message\":\"already exists\"}"),
    );
    expect(message).toMatch(/already exists/i);
    expect(message).toMatch(/select it/i);
  });

  it("treats 403 as a permission problem", () => {
    expect(describeCustomerJobCreateError(new Error("API 403 Forbidden: {}"))).toMatch(
      /permission/i,
    );
  });

  it("treats 400 as a description problem", () => {
    expect(describeCustomerJobCreateError(new Error("API 400 Bad Request: {}"))).toMatch(
      /description/i,
    );
  });

  it("falls back to a generic recoverable message", () => {
    expect(describeCustomerJobCreateError(new Error("network down"))).toMatch(/try again/i);
  });

  it("never leaks the raw API error text to the operator", () => {
    const raw = 'API 409 Conflict: {"message":"CustomerJob_orderId_normalizedDescription_key"}';
    const message = describeCustomerJobCreateError(new Error(raw));
    expect(message).not.toMatch(/normalizedDescription/);
    expect(message).not.toMatch(/API 409/);
  });
});
