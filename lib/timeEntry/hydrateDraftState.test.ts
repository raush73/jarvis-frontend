/**
 * TE-S2B6 reopen / hydration fidelity, FE6-1 through FE6-22.
 *
 * The round-trip tests are the central proof: starting from a Save Draft payload, the detail the
 * backend would return for it is hydrated and the payload rebuilt WITHOUT user edits. Every
 * business fact must survive. Backend fidelity between that detail and the database is proven
 * separately by the HY6 suite, so together the two close the loop.
 */

import { describe, expect, it } from "vitest";

import { computeEmployeeTotals, computeWeeklyTotals } from "@/app/time-entry/[id]/page";
import {
  buildDraftPayload,
  type BuildDraftPayloadInput,
  type SaveDraftPayload,
} from "./buildDraftPayload";
import { dayIndexForWorkDate, hydrateDraftState, jobRowId } from "./hydrateDraftState";
import type { WorkingTimesheetDetail } from "./workingTimesheetApi";

const WEEK_START = "2026-09-07"; // Monday
const MON = "2026-09-07";
const TUE = "2026-09-08";
const WED = "2026-09-09";
const THU = "2026-09-10";
const FRI = "2026-09-11";
const SAT = "2026-09-12";
const SUN = "2026-09-13";
const ORDER_A = "order-a";

function detail(overrides: Partial<WorkingTimesheetDetail> = {}): WorkingTimesheetDetail {
  return {
    id: `${ORDER_A}__${WEEK_START}`,
    entryMode: null,
    orderId: ORDER_A,
    weekStart: WEEK_START,
    weekEnding: "2026-09-13",
    orderRef: "Main Assembly",
    jobSite: "Acme Plant A",
    customerId: "cust-1",
    customerName: "Acme Manufacturing",
    status: "Draft",
    workers: [],
    draftConflictCandidateIds: [],
    orphanedDraftCandidateIds: [],
    ...overrides,
  };
}

function worker(overrides: Partial<WorkingTimesheetDetail["workers"][number]> = {}) {
  return {
    candidateId: "cand-1",
    workerName: "John Martinez",
    trade: "Welder",
    assignmentIds: ["a1"],
    draft: null,
    draftState: null,
    draftConflict: false,
    ...overrides,
  };
}

function draftState(
  overrides: Partial<NonNullable<WorkingTimesheetDetail["workers"][number]["draftState"]>> = {},
) {
  return {
    hoursEntryId: "h1",
    totalHours: 0,
    sdEligible: null,
    jobRows: [],
    items: [],
    classifications: [],
    ...overrides,
  };
}

function jobRow(overrides: Record<string, any> = {}) {
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
    // TE-S2B8. The default is deliberately "no Customer Job recorded", which is what every one of
    // these pre-Customer-Job TE-S2B6 cases means - so they keep asserting exactly what they did
    // before, and hydration must still reopen them truthfully.
    customerJobId: null,
    customerJobDescription: null,
    customerJobIsActive: null,
    ...overrides,
  };
}

describe("date mapping", () => {
  it("maps crew-week dates back to Monday-first day indexes", () => {
    expect(dayIndexForWorkDate(WEEK_START, MON)).toBe(0);
    expect(dayIndexForWorkDate(WEEK_START, TUE)).toBe(1);
    expect(dayIndexForWorkDate(WEEK_START, SAT)).toBe(5);
    expect(dayIndexForWorkDate(WEEK_START, "2026-09-13")).toBe(6);
    // Outside the week is refused rather than wrapped.
    expect(dayIndexForWorkDate(WEEK_START, "2026-09-14")).toBe(-1);
    expect(dayIndexForWorkDate(WEEK_START, "2026-09-06")).toBe(-1);
  });
});

describe("FE6-1 / FE6-2: entry mode restoration", () => {
  it("FE6-1: a saved DAILY mode selects Daily", () => {
    expect(hydrateDraftState(detail({ entryMode: "DAILY" })).entryMode).toBe("daily");
  });

  it("FE6-2: a saved WEEKLY mode selects Weekly Totals", () => {
    expect(hydrateDraftState(detail({ entryMode: "WEEKLY" })).entryMode).toBe("weekly");
  });

  it("a never-saved worksheet keeps the existing default", () => {
    expect(hydrateDraftState(detail({ entryMode: null })).entryMode).toBe("daily");
  });
});

describe("FE6-3 / FE6-4: source fact restoration", () => {
  it("FE6-3: Daily source facts populate the exact dates and cells", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "DAILY",
        workers: [
          worker({
            draftState: draftState({
              totalHours: 16,
              jobRows: [
                jobRow({
                  dailyHours: [
                    { workDate: MON, quantity: 8 },
                    { workDate: SAT, quantity: 8 },
                  ],
                }),
              ],
            }),
          }),
        ],
      }),
    );

    const row = hydrated.employees[0].jobRows[0];
    // Monday and Saturday exactly; the untouched days stay zero.
    expect(row.dailyHours).toEqual([8, 0, 0, 0, 0, 8, 0]);
    // No weekly value was manufactured from the daily cells.
    expect(row.weeklyTotalHours).toBe(0);
  });

  it("FE6-4: a Weekly source fact populates the weekly input and creates no Daily values", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "WEEKLY",
        workers: [
          worker({
            draftState: draftState({ totalHours: 52, jobRows: [jobRow({ weeklyHours: 52 })] }),
          }),
        ],
      }),
    );

    const row = hydrated.employees[0].jobRows[0];
    expect(row.weeklyTotalHours).toBe(52);
    // The decisive assertion: no fabricated Mon-Sun distribution.
    expect(row.dailyHours).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("FE6-5 / FE6-6 / FE6-7: mode history", () => {
  const mixedDetail = (mode: "DAILY" | "WEEKLY") =>
    detail({
      entryMode: mode,
      workers: [
        worker({
          draftState: draftState({
            totalHours: 60,
            jobRows: [
              jobRow({
                dailyHours: [
                  { workDate: MON, quantity: 8 },
                  { workDate: TUE, quantity: 8 },
                ],
                weeklyHours: 60,
              }),
            ],
          }),
        }),
      ],
    });

  it("FE6-5: both source granularities survive hydration together", () => {
    const row = hydrateDraftState(mixedDetail("WEEKLY")).employees[0].jobRows[0];
    expect(row.dailyHours).toEqual([8, 8, 0, 0, 0, 0, 0]);
    expect(row.weeklyTotalHours).toBe(60);
    // 8 + 8 is not 60, proving neither was derived from the other.
    expect(row.dailyHours.reduce((a, b) => a + b, 0)).not.toBe(row.weeklyTotalHours);
  });

  it("FE6-6: reopening in WEEKLY still holds the saved Daily facts for a switch to DAILY", () => {
    const hydrated = hydrateDraftState(mixedDetail("WEEKLY"));
    expect(hydrated.entryMode).toBe("weekly");
    // Switching the selector is a pure mode change; the daily values are already in state.
    const row = hydrated.employees[0].jobRows[0];
    expect(row.dailyHours).toEqual([8, 8, 0, 0, 0, 0, 0]);
    // And GOLD reads them as real hours once DAILY is active.
    expect(computeEmployeeTotals(hydrated.employees[0].jobRows as any).totalHours).toBe(16);
  });

  it("FE6-7: reopening in DAILY still holds the saved Weekly facts for a switch to WEEKLY", () => {
    const hydrated = hydrateDraftState(mixedDetail("DAILY"));
    expect(hydrated.entryMode).toBe("daily");
    const row = hydrated.employees[0].jobRows[0];
    expect(row.weeklyTotalHours).toBe(60);
    expect(computeWeeklyTotals(hydrated.employees[0].jobRows as any).totalHours).toBe(60);
  });
});

describe("FE6-8 / FE6-9 / FE6-10: operator inputs", () => {
  it("FE6-8: weeklyOtAllocation restores to the exact JobRows", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "WEEKLY",
        workers: [
          worker({
            draftState: draftState({
              totalHours: 60,
              jobRows: [
                jobRow({ jobRowIndex: 0, weeklyHours: 30, weeklyOtAllocation: 0 }),
                jobRow({ jobRowIndex: 1, projectRef: "job2", weeklyHours: 30, weeklyOtAllocation: 12 }),
              ],
            }),
          }),
        ],
      }),
    );

    expect(hydrated.employees[0].jobRows.map((r) => r.weeklyOtAllocation)).toEqual([0, 12]);
    expect(hydrated.employees[0].jobRows.map((r) => r.jobId)).toEqual([ORDER_A, "job2"]);
  });

  it("FE6-9: Daily DT restores to the exact row and day", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "DAILY",
        workers: [
          worker({
            draftState: draftState({
              totalHours: 16,
              jobRows: [
                jobRow({ jobRowIndex: 0, dailyHours: [{ workDate: MON, quantity: 8 }] }),
                jobRow({
                  jobRowIndex: 1,
                  projectRef: "job2",
                  dailyHours: [{ workDate: SAT, quantity: 8 }],
                  dailyDt: [{ workDate: SAT, quantity: 4 }],
                }),
              ],
            }),
          }),
        ],
      }),
    );

    const rows = hydrated.employees[0].jobRows;
    expect(rows[0].dailyDtHours).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(rows[1].dailyDtHours).toEqual([0, 0, 0, 0, 0, 4, 0]);
    // The worked cell is untouched: DT classifies, it does not rewrite hours.
    expect(rows[1].dailyHours).toEqual([0, 0, 0, 0, 0, 8, 0]);
  });

  it("FE6-10: Weekly DT restores to the exact row", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "WEEKLY",
        workers: [
          worker({
            draftState: draftState({
              totalHours: 52,
              jobRows: [jobRow({ weeklyHours: 52, weeklyDt: 4 })],
            }),
          }),
        ],
      }),
    );

    expect(hydrated.employees[0].jobRows[0].weeklyDtHours).toBe(4);
    expect(hydrated.employees[0].jobRows[0].dailyDtHours).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("FE6-11 / FE6-12: shift differential", () => {
  it("FE6-11: SD eligibility restores ON and OFF correctly", () => {
    const on = hydrateDraftState(
      detail({ workers: [worker({ draftState: draftState({ sdEligible: true }) })] }),
    );
    expect(on.workerSdEnabled).toEqual({ "cand-1": true });

    // Never-recorded and explicitly-false both leave the toggle off, without inventing a value.
    for (const value of [null, false] as const) {
      const off = hydrateDraftState(
        detail({ workers: [worker({ draftState: draftState({ sdEligible: value }) })] }),
      );
      expect(off.workerSdEnabled["cand-1"]).toBeUndefined();
    }
  });

  it("FE6-12: SD day selections restore to the exact row and day", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "DAILY",
        workers: [
          worker({
            draftState: draftState({
              sdEligible: true,
              totalHours: 16,
              jobRows: [
                jobRow({
                  jobRowIndex: 0,
                  dailyHours: [{ workDate: MON, quantity: 8 }],
                  sdDates: [MON],
                }),
                jobRow({
                  jobRowIndex: 1,
                  projectRef: "job2",
                  dailyHours: [{ workDate: SAT, quantity: 8 }],
                }),
              ],
            }),
          }),
        ],
      }),
    );

    // Keyed by the SAME synthesized row ids the page uses, so the toggles light up correctly.
    expect(hydrated.rowSdFlags["cand-1"][jobRowId("cand-1", 0)]).toEqual([
      true, false, false, false, false, false, false,
    ]);
    expect(hydrated.rowSdFlags["cand-1"][jobRowId("cand-1", 1)]).toBeUndefined();
    expect(hydrated.employees[0].jobRows[0].id).toBe(jobRowId("cand-1", 0));
  });
});

describe("FE6-13 / FE6-14: per diem dual path", () => {
  it("FE6-13 and FE6-14: billable 3.5 and payroll-only 2.0 restore independently", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "DAILY",
        workers: [
          worker({
            draftState: draftState({
              totalHours: 8,
              jobRows: [
                jobRow({ jobRowIndex: 0, dailyHours: [{ workDate: MON, quantity: 8 }] }),
                jobRow({ jobRowIndex: 1, projectRef: "job2", perDiemDays: 3.5 }),
              ],
              items: [
                {
                  billability: "NON_BILLABLE",
                  itemType: "PER_DIEM",
                  unit: "DAYS",
                  value: 2,
                  note: null,
                  sortOrder: 0,
                },
              ],
            }),
          }),
        ],
      }),
    );

    const employee = hydrated.employees[0];
    // Billable PD returns to its own job row...
    expect(employee.jobRows[1].perDiemDays).toBe(3.5);
    expect(employee.jobRows[0].perDiemDays).toBe(0);
    // ...and payroll-only PD returns to the lower non-billable section, in Days.
    expect(employee.nonBillableItems).toEqual([
      { id: "cand-1-nonbillable-0-0", type: "Per Diem", note: "", value: 2 },
    ]);
    // Neither became 5.5 or 1.5.
    expect(employee.jobRows[1].perDiemDays).not.toBe(5.5);
    expect(employee.nonBillableItems[0].value).not.toBe(1.5);
  });
});

describe("FE6-15 / FE6-16: items", () => {
  it("FE6-15 and FE6-16: monetary items restore value, type, note and order, per section", () => {
    const hydrated = hydrateDraftState(
      detail({
        workers: [
          worker({
            draftState: draftState({
              items: [
                // Deliberately out of order to prove sortOrder governs.
                {
                  billability: "BILLABLE",
                  itemType: "REIMBURSEMENT",
                  unit: "DOLLARS",
                  value: 450,
                  note: "Drug testing",
                  sortOrder: 1,
                },
                {
                  billability: "BILLABLE",
                  itemType: "MOBILIZATION",
                  unit: "DOLLARS",
                  value: 275.5,
                  note: "Crew mob",
                  sortOrder: 0,
                },
                {
                  billability: "NON_BILLABLE",
                  itemType: "HAZARD",
                  unit: "DOLLARS",
                  value: 75,
                  note: null,
                  sortOrder: 0,
                },
              ],
            }),
          }),
        ],
      }),
    );

    const employee = hydrated.employees[0];
    expect(employee.billableItems.map((i) => [i.type, i.value, i.note])).toEqual([
      ["Mobilization", 275.5, "Crew mob"],
      ["Reimbursement", 450, "Drug testing"],
    ]);
    expect(employee.nonBillableItems.map((i) => [i.type, i.value])).toEqual([["Hazard", 75]]);
  });
});

describe("FE6-17 / FE6-18 / FE6-19: rows and blank workers", () => {
  it("FE6-17: multi-job facts do not cross rows", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "DAILY",
        workers: [
          worker({
            draftState: draftState({
              totalHours: 16,
              sdEligible: true,
              jobRows: [
                jobRow({
                  jobRowIndex: 0,
                  projectRef: ORDER_A,
                  dailyHours: [{ workDate: MON, quantity: 8 }],
                  perDiemDays: 3.5,
                  sdDates: [MON],
                }),
                jobRow({
                  jobRowIndex: 1,
                  projectRef: "job2",
                  dailyHours: [{ workDate: SAT, quantity: 8 }],
                  dailyDt: [{ workDate: SAT, quantity: 4 }],
                  weeklyOtAllocation: 6,
                }),
              ],
            }),
          }),
        ],
      }),
    );

    const [rowA, rowB] = hydrated.employees[0].jobRows;
    expect(rowA).toMatchObject({ jobId: ORDER_A, perDiemDays: 3.5, weeklyOtAllocation: 0 });
    expect(rowA.dailyHours).toEqual([8, 0, 0, 0, 0, 0, 0]);
    expect(rowA.dailyDtHours).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(rowB).toMatchObject({ jobId: "job2", perDiemDays: 0, weeklyOtAllocation: 6 });
    expect(rowB.dailyHours).toEqual([0, 0, 0, 0, 0, 8, 0]);
    expect(rowB.dailyDtHours).toEqual([0, 0, 0, 0, 0, 4, 0]);
    // SD selection belongs to row A only.
    expect(Object.keys(hydrated.rowSdFlags["cand-1"])).toEqual([jobRowId("cand-1", 0)]);
  });

  it("FE6-18: a blank roster worker stays present and blank", () => {
    const hydrated = hydrateDraftState(
      detail({
        entryMode: "DAILY",
        workers: [worker({ candidateId: "cand-2", workerName: "Sarah Chen", draftState: null })],
      }),
    );

    const employee = hydrated.employees[0];
    expect(employee.id).toBe("cand-2");
    expect(employee.jobRows).toHaveLength(1); // the single default row
    expect(employee.jobRows[0].dailyHours).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(employee.jobRows[0].weeklyTotalHours).toBe(0);
    expect(employee.jobRows[0].perDiemDays).toBe(0);
    expect(employee.billableItems).toEqual([]);
    expect(hydrated.workerSdEnabled["cand-2"]).toBeUndefined();
  });

  it("FE6-19: an item-only worker receives no fabricated worked hours", () => {
    const hydrated = hydrateDraftState(
      detail({
        workers: [
          worker({
            draftState: draftState({
              totalHours: 0,
              items: [
                {
                  billability: "BILLABLE",
                  itemType: "BONUS",
                  unit: "DOLLARS",
                  value: 100,
                  note: null,
                  sortOrder: 0,
                },
              ],
            }),
          }),
        ],
      }),
    );

    const employee = hydrated.employees[0];
    expect(employee.billableItems).toHaveLength(1);
    expect(employee.jobRows[0].dailyHours).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(employee.jobRows[0].weeklyTotalHours).toBe(0);
  });
});

// ============================================================================================
// SAVE -> REOPEN -> SAVE ROUND TRIP
// ============================================================================================

/** Rebuild the Save Draft payload from hydrated state, with no user edits in between. */
function resave(hydrated: ReturnType<typeof hydrateDraftState>): SaveDraftPayload {
  const totalsByEmployeeId: BuildDraftPayloadInput["totalsByEmployeeId"] = {};
  for (const employee of hydrated.employees) {
    const totals =
      hydrated.entryMode === "daily"
        ? computeEmployeeTotals(employee.jobRows as any)
        : computeWeeklyTotals(employee.jobRows as any);
    totalsByEmployeeId[employee.id] = {
      totalHours: totals.totalHours,
      reg: totals.reg,
      ot: totals.ot,
      dt: totals.dt,
    };
  }

  return buildDraftPayload({
    entryMode: hydrated.entryMode,
    employees: hydrated.employees,
    weekStart: WEEK_START,
    workerSdEnabled: hydrated.workerSdEnabled,
    rowSdFlags: hydrated.rowSdFlags,
    totalsByEmployeeId,
  });
}

describe("FE6-20 / FE6-21 / FE6-22: save -> reopen -> save preserves business facts", () => {
  it("FE6-20: DAILY round trip", () => {
    // A realistic 52-hour week: row A takes the 40 REG hours Mon-Fri, row B owns the 12 OT
    // hours on Sat and Sun, and 4 of row B's Saturday OT is designated DT.
    const saved = detail({
      entryMode: "DAILY",
      workers: [
        worker({
          draftState: draftState({
            totalHours: 52,
            sdEligible: true,
            jobRows: [
              jobRow({
                jobRowIndex: 0,
                projectRef: ORDER_A,
                dailyHours: [
                  { workDate: MON, quantity: 8 },
                  { workDate: TUE, quantity: 8 },
                  { workDate: WED, quantity: 8 },
                  { workDate: THU, quantity: 8 },
                  { workDate: FRI, quantity: 8 },
                ],
                sdDates: [MON],
                perDiemDays: 3.5,
              }),
              jobRow({
                jobRowIndex: 1,
                projectRef: "job2",
                dailyHours: [
                  { workDate: SAT, quantity: 8 },
                  { workDate: SUN, quantity: 4 },
                ],
                dailyDt: [{ workDate: SAT, quantity: 4 }],
              }),
            ],
            items: [
              {
                billability: "BILLABLE",
                itemType: "REIMBURSEMENT",
                unit: "DOLLARS",
                value: 450,
                note: "Drug testing",
                sortOrder: 0,
              },
              {
                billability: "NON_BILLABLE",
                itemType: "PER_DIEM",
                unit: "DAYS",
                value: 2,
                note: null,
                sortOrder: 0,
              },
            ],
          }),
        }),
      ],
    });

    const payload = resave(hydrateDraftState(saved));

    expect(payload.entryMode).toBe("DAILY");
    expect(payload.workers).toHaveLength(1);
    const w = payload.workers[0];
    expect(w.candidateId).toBe("cand-1");
    expect(w.sdEligible).toBe(true);

    // Both job rows returned with their own facts intact.
    expect(w.jobRows![0]).toMatchObject({ jobRowIndex: 0, projectRef: ORDER_A, perDiemDays: 3.5 });
    expect(w.jobRows![0].dailyHours).toEqual([
      { workDate: MON, quantity: 8 },
      { workDate: TUE, quantity: 8 },
      { workDate: WED, quantity: 8 },
      { workDate: THU, quantity: 8 },
      { workDate: FRI, quantity: 8 },
    ]);
    expect(w.jobRows![0].sdDates).toEqual([MON]);
    expect(w.jobRows![1]).toMatchObject({ jobRowIndex: 1, projectRef: "job2" });
    expect(w.jobRows![1].dailyHours).toEqual([
      { workDate: SAT, quantity: 8 },
      { workDate: SUN, quantity: 4 },
    ]);
    expect(w.jobRows![1].dailyDt).toEqual([{ workDate: SAT, quantity: 4 }]);

    // Both item paths survive independently.
    expect(w.items).toEqual([
      {
        billability: "BILLABLE",
        itemType: "REIMBURSEMENT",
        unit: "DOLLARS",
        value: 450,
        note: "Drug testing",
        sortOrder: 0,
      },
      {
        billability: "NON_BILLABLE",
        itemType: "PER_DIEM",
        unit: "DAYS",
        value: 2,
        note: null,
        sortOrder: 0,
      },
    ]);

    // Worked total is preserved, and DT is carved from OT rather than added to it:
    // 40 REG + 8 OT + 4 DT = 52.
    expect(w.totalHours).toBe(52);
    const hours = w.classifications!.filter((c) => c.unit === "HOURS");
    expect(hours.reduce((s, c) => s + c.quantity, 0)).toBe(52);
    expect(hours.find((c) => c.earningCode === "REG")?.quantity).toBe(40);
    expect(hours.find((c) => c.earningCode === "OT")?.quantity).toBe(8);
    expect(hours.find((c) => c.earningCode === "DT")?.quantity).toBe(4);
  });

  it("FE6-21: WEEKLY round trip", () => {
    const saved = detail({
      entryMode: "WEEKLY",
      workers: [
        worker({
          draftState: draftState({
            totalHours: 60,
            sdEligible: true,
            jobRows: [
              jobRow({ jobRowIndex: 0, projectRef: ORDER_A, weeklyHours: 30, weeklyOtAllocation: 10, perDiemDays: 3.5 }),
              jobRow({ jobRowIndex: 1, projectRef: "job2", weeklyHours: 30, weeklyOtAllocation: 10, weeklyDt: 6 }),
            ],
            items: [
              {
                billability: "BILLABLE",
                itemType: "BONUS",
                unit: "DOLLARS",
                value: 100,
                note: null,
                sortOrder: 0,
              },
            ],
          }),
        }),
      ],
    });

    const payload = resave(hydrateDraftState(saved));

    expect(payload.entryMode).toBe("WEEKLY");
    const w = payload.workers[0];
    expect(w.jobRows!.map((r) => [r.jobRowIndex, r.projectRef, r.weeklyHours, r.weeklyOtAllocation])).toEqual([
      [0, ORDER_A, 30, 10],
      [1, "job2", 30, 10],
    ]);
    expect(w.jobRows![1].weeklyDt).toBe(6);
    expect(w.jobRows![0].perDiemDays).toBe(3.5);
    // No daily facts were manufactured on the way back out.
    expect(w.jobRows!.every((r) => r.dailyHours === undefined)).toBe(true);
    expect(w.totalHours).toBe(60);
    // 40 REG + 14 OT + 6 DT = 60, the governed carve-out.
    const hours = w.classifications!.filter((c) => c.unit === "HOURS");
    expect(hours.reduce((s, c) => s + c.quantity, 0)).toBe(60);
    expect(hours.find((c) => c.earningCode === "DT")?.quantity).toBe(6);
    expect(hours.find((c) => c.earningCode === "OT")?.quantity).toBe(14);
    expect(w.items).toEqual([
      {
        billability: "BILLABLE",
        itemType: "BONUS",
        unit: "DOLLARS",
        value: 100,
        note: null,
        sortOrder: 0,
      },
    ]);
  });

  it("FE6-22: mixed source history keeps the inactive granularity through a resave", () => {
    // Saved DAILY facts, then saved WEEKLY facts; current mode is WEEKLY.
    const saved = detail({
      entryMode: "WEEKLY",
      workers: [
        worker({
          draftState: draftState({
            totalHours: 60,
            jobRows: [
              jobRow({
                jobRowIndex: 0,
                projectRef: ORDER_A,
                dailyHours: [
                  { workDate: MON, quantity: 8 },
                  { workDate: TUE, quantity: 8 },
                ],
                weeklyHours: 60,
              }),
            ],
          }),
        }),
      ],
    });

    const hydrated = hydrateDraftState(saved);

    // Reopened in WEEKLY: resaving sends the weekly truth and leaves DAILY rows untouched in
    // the database, because a WEEKLY save only replaces WEEKLY granularity.
    const weeklyPayload = resave(hydrated);
    expect(weeklyPayload.entryMode).toBe("WEEKLY");
    expect(weeklyPayload.workers[0].jobRows![0].weeklyHours).toBe(60);
    expect(weeklyPayload.workers[0].jobRows![0].dailyHours).toBeUndefined();

    // Now the operator switches the selector to DAILY without editing anything. The saved
    // Daily facts are still in state, so they resave truthfully.
    const dailyPayload = resave({ ...hydrated, entryMode: "daily" });
    expect(dailyPayload.entryMode).toBe("DAILY");
    expect(dailyPayload.workers[0].jobRows![0].dailyHours).toEqual([
      { workDate: MON, quantity: 8 },
      { workDate: TUE, quantity: 8 },
    ]);
    expect(dailyPayload.workers[0].jobRows![0].weeklyHours).toBeUndefined();
    // The preserved Daily facts were never derived from the weekly 60.
    expect(dailyPayload.workers[0].totalHours).toBe(16);
  });

  it("a blank roster worker still resaves as nothing", () => {
    const saved = detail({
      entryMode: "DAILY",
      workers: [worker({ candidateId: "cand-2", draftState: null })],
    });
    expect(resave(hydrateDraftState(saved)).workers).toEqual([]);
  });
});
