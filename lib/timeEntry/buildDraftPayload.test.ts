/**
 * TE-S2B5 Save Draft payload contract, FE5-1 through FE5-9.
 *
 * These prove the payload the screen actually sends: that source facts are scoped to the
 * current mode, that nothing is fabricated across modes, and that each Working Timesheet fact
 * keeps its own identity on the way to its own persistence home.
 */

import { describe, expect, it } from "vitest";

import {
  buildDraftPayload,
  workDateForDayIndex,
  type BuilderEmployee,
  type BuildDraftPayloadInput,
} from "./buildDraftPayload";

const WEEK_START = "2026-09-07"; // Monday
const MON = "2026-09-07";
const TUE = "2026-09-08";
const SAT = "2026-09-12";

const NO_WEEK = [0, 0, 0, 0, 0, 0, 0];

function row(overrides: Partial<BuilderEmployee["jobRows"][number]> = {}) {
  return {
    id: "cand-1-job1",
    jobId: "order-a",
    dailyHours: [...NO_WEEK],
    perDiemDays: 0,
    weeklyTotalHours: 0,
    weeklyOtAllocation: 0,
    dailyDtHours: [...NO_WEEK],
    weeklyDtHours: 0,
    ...overrides,
  };
}

function employee(overrides: Partial<BuilderEmployee> = {}): BuilderEmployee {
  return {
    id: "cand-1",
    jobRows: [row()],
    billableItems: [],
    nonBillableItems: [],
    ...overrides,
  };
}

function input(overrides: Partial<BuildDraftPayloadInput> = {}): BuildDraftPayloadInput {
  return {
    entryMode: "daily",
    employees: [employee()],
    weekStart: WEEK_START,
    workerSdEnabled: {},
    rowSdFlags: {},
    totalsByEmployeeId: { "cand-1": { totalHours: 0, reg: 0, ot: 0, dt: 0 } },
    ...overrides,
  };
}

describe("day index mapping", () => {
  it("maps Monday-first day indexes onto real crew-week dates", () => {
    expect(workDateForDayIndex(WEEK_START, 0)).toBe(MON);
    expect(workDateForDayIndex(WEEK_START, 1)).toBe(TUE);
    expect(workDateForDayIndex(WEEK_START, 5)).toBe(SAT);
    expect(workDateForDayIndex(WEEK_START, 6)).toBe("2026-09-13");
  });
});

describe("FE5-1: DAILY mode sends actual Daily source facts", () => {
  it("sends DAILY mode with only the days that were entered", () => {
    const payload = buildDraftPayload(
      input({
        entryMode: "daily",
        employees: [employee({ jobRows: [row({ dailyHours: [8, 8, 0, 0, 0, 0, 0] })] })],
        totalsByEmployeeId: { "cand-1": { totalHours: 16, reg: 16, ot: 0, dt: 0 } },
      }),
    );

    expect(payload.entryMode).toBe("DAILY");
    expect(payload.workers).toHaveLength(1);
    const jobRow = payload.workers[0].jobRows![0];
    expect(jobRow.jobRowIndex).toBe(0);
    expect(jobRow.dailyHours).toEqual([
      { workDate: MON, quantity: 8 },
      { workDate: TUE, quantity: 8 },
    ]);
    // Zero days are omitted rather than sent as empty facts.
    expect(jobRow.dailyHours).toHaveLength(2);
    // No weekly source fact is invented from the daily entries.
    expect(jobRow.weeklyHours).toBeUndefined();
    // Governed classification travels with it.
    expect(payload.workers[0].classifications).toEqual([
      { earningCode: "REG", unit: "HOURS", quantity: 16 },
    ]);
    expect(payload.workers[0].totalHours).toBe(16);
  });
});

describe("FE5-2: WEEKLY mode sends weekly source facts without fabricating Daily values", () => {
  it("sends WEEKLY mode and no dailyHours at all", () => {
    const payload = buildDraftPayload(
      input({
        entryMode: "weekly",
        // Daily state still holds values from earlier daily entry; they must NOT be sent.
        employees: [
          employee({ jobRows: [row({ dailyHours: [8, 8, 0, 0, 0, 0, 0], weeklyTotalHours: 52 })] }),
        ],
        totalsByEmployeeId: { "cand-1": { totalHours: 52, reg: 40, ot: 12, dt: 0 } },
      }),
    );

    expect(payload.entryMode).toBe("WEEKLY");
    const jobRow = payload.workers[0].jobRows![0];
    expect(jobRow.weeklyHours).toBe(52);
    // The critical assertion: no Mon-Sun distribution is manufactured, and the stale daily
    // state is not smuggled through.
    expect(jobRow.dailyHours).toBeUndefined();
    expect(jobRow.dailyDt).toBeUndefined();
    expect(jobRow.sdDates).toBeUndefined();
  });
});

describe("FE5-3: Weekly multi-job OT allocation", () => {
  it("includes each row's operator OT allocation at worker + JobRow grain", () => {
    const payload = buildDraftPayload(
      input({
        entryMode: "weekly",
        employees: [
          employee({
            jobRows: [
              row({ id: "r1", jobId: "order-a", weeklyTotalHours: 30, weeklyOtAllocation: 10 }),
              row({ id: "r2", jobId: "order-b", weeklyTotalHours: 30, weeklyOtAllocation: 10 }),
            ],
          }),
        ],
        totalsByEmployeeId: { "cand-1": { totalHours: 60, reg: 40, ot: 20, dt: 0 } },
      }),
    );

    const rows = payload.workers[0].jobRows!;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.jobRowIndex, r.projectRef, r.weeklyHours, r.weeklyOtAllocation])).toEqual([
      [0, "order-a", 30, 10],
      [1, "order-b", 30, 10],
    ]);
  });
});

describe("FE5-4: Daily DT designations use worker + JobRow + day", () => {
  it("sends dated DT rows against the correct job row", () => {
    const payload = buildDraftPayload(
      input({
        entryMode: "daily",
        employees: [
          employee({
            jobRows: [
              row({ id: "r1", dailyHours: [8, 0, 0, 0, 0, 0, 0] }),
              row({
                id: "r2",
                jobId: "order-b",
                dailyHours: [0, 0, 0, 0, 0, 8, 0],
                dailyDtHours: [0, 0, 0, 0, 0, 4, 0],
              }),
            ],
          }),
        ],
        totalsByEmployeeId: { "cand-1": { totalHours: 16, reg: 12, ot: 0, dt: 4 } },
      }),
    );

    const rows = payload.workers[0].jobRows!;
    expect(rows[0].dailyDt).toBeUndefined(); // row 1 has no designation
    expect(rows[1].jobRowIndex).toBe(1);
    expect(rows[1].dailyDt).toEqual([{ workDate: SAT, quantity: 4 }]);
    // DT never masquerades as worked source hours.
    expect(rows[1].dailyHours).toEqual([{ workDate: SAT, quantity: 8 }]);
  });
});

describe("FE5-5: Weekly DT designations use worker + JobRow only", () => {
  it("sends a row-level DT quantity with no day dimension", () => {
    const payload = buildDraftPayload(
      input({
        entryMode: "weekly",
        employees: [
          employee({ jobRows: [row({ weeklyTotalHours: 52, weeklyDtHours: 4 })] }),
        ],
        totalsByEmployeeId: { "cand-1": { totalHours: 52, reg: 40, ot: 8, dt: 4 } },
      }),
    );

    const jobRow = payload.workers[0].jobRows![0];
    expect(jobRow.weeklyDt).toBe(4);
    expect(jobRow.dailyDt).toBeUndefined();
    expect(payload.workers[0].classifications).toEqual([
      { earningCode: "REG", unit: "HOURS", quantity: 40 },
      { earningCode: "OT", unit: "HOURS", quantity: 8 },
      { earningCode: "DT", unit: "HOURS", quantity: 4 },
    ]);
  });
});

describe("FE5-6: SD eligibility and Daily selections stay distinct", () => {
  it("sends worker-week eligibility separately from per-row day selections", () => {
    const payload = buildDraftPayload(
      input({
        entryMode: "daily",
        employees: [
          employee({ jobRows: [row({ id: "r1", dailyHours: [8, 8, 0, 0, 0, 0, 0] })] }),
        ],
        workerSdEnabled: { "cand-1": true },
        rowSdFlags: { "cand-1": { r1: [true, false, false, false, false, false, false] } },
        totalsByEmployeeId: { "cand-1": { totalHours: 16, reg: 16, ot: 0, dt: 0 } },
        sdOverlayByEmployeeId: { "cand-1": { regSdHours: 8, otSdHours: 0, dtSdHours: 0 } },
      }),
    );

    // Eligibility is a worker-level fact...
    expect(payload.workers[0].sdEligible).toBe(true);
    // ...and the selection is a per-row, per-day fact. Two Mondays' worth of hours were
    // entered but only one day was marked.
    expect(payload.workers[0].jobRows![0].sdDates).toEqual([MON]);
    // The SD decomposition rides along as classification, never as extra worked time.
    expect(payload.workers[0].classifications).toEqual([
      { earningCode: "REG", unit: "HOURS", quantity: 16 },
      { earningCode: "REG", unit: "REG_SD", quantity: 8 },
    ]);
  });

  it("eligibility alone still creates a worker entry with no day selections", () => {
    const payload = buildDraftPayload(
      input({ workerSdEnabled: { "cand-1": true } }),
    );
    expect(payload.workers).toHaveLength(1);
    expect(payload.workers[0].sdEligible).toBe(true);
    expect(payload.workers[0].jobRows).toBeUndefined();
  });

  it("sends no SD classification in weekly mode, because SD is Daily-only", () => {
    const payload = buildDraftPayload(
      input({
        entryMode: "weekly",
        employees: [employee({ jobRows: [row({ weeklyTotalHours: 40 })] })],
        workerSdEnabled: { "cand-1": true },
        totalsByEmployeeId: { "cand-1": { totalHours: 40, reg: 40, ot: 0, dt: 0 } },
        sdOverlayByEmployeeId: { "cand-1": { regSdHours: 8, otSdHours: 0, dtSdHours: 0 } },
      }),
    );
    expect(payload.workers[0].classifications).toEqual([
      { earningCode: "REG", unit: "HOURS", quantity: 40 },
    ]);
  });
});

describe("FE5-7: billable JobRow PD is serialized separately from non-billable Per Diem", () => {
  it("keeps 3.5 billable days and 2.0 payroll-only days as two independent facts", () => {
    const payload = buildDraftPayload(
      input({
        employees: [
          employee({
            jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0], perDiemDays: 3.5 })],
            nonBillableItems: [{ id: "i1", type: "Per Diem", note: "", value: 2 }],
          }),
        ],
        totalsByEmployeeId: { "cand-1": { totalHours: 8, reg: 8, ot: 0, dt: 0 } },
      }),
    );

    // Billable PD travels on the job row, in DAYS.
    expect(payload.workers[0].jobRows![0].perDiemDays).toBe(3.5);
    // Non-billable PD travels as its own item, also in DAYS.
    expect(payload.workers[0].items).toEqual([
      {
        billability: "NON_BILLABLE",
        itemType: "PER_DIEM",
        unit: "DAYS",
        value: 2,
        note: null,
        sortOrder: 0,
      },
    ]);
    // Neither is 5.5 or 1.5: no derivation of any kind.
    expect(payload.workers[0].jobRows![0].perDiemDays).not.toBe(5.5);
  });
});

describe("FE5-8: monetary items preserve their dollar values", () => {
  it("maps billable and non-billable monetary items with DOLLARS and notes", () => {
    const payload = buildDraftPayload(
      input({
        employees: [
          employee({
            billableItems: [
              { id: "b1", type: "Mobilization", note: "Crew mob", value: 275.5 },
              { id: "b2", type: "Reimbursement", note: "Drug testing", value: 450 },
            ],
            nonBillableItems: [{ id: "n1", type: "Hazard", note: "", value: 75 }],
          }),
        ],
      }),
    );

    expect(payload.workers[0].items).toEqual([
      {
        billability: "BILLABLE",
        itemType: "MOBILIZATION",
        unit: "DOLLARS",
        value: 275.5,
        note: "Crew mob",
        sortOrder: 0,
      },
      {
        billability: "BILLABLE",
        itemType: "REIMBURSEMENT",
        unit: "DOLLARS",
        value: 450,
        note: "Drug testing",
        sortOrder: 1,
      },
      {
        billability: "NON_BILLABLE",
        itemType: "HAZARD",
        unit: "DOLLARS",
        value: 75,
        note: null,
        sortOrder: 0,
      },
    ]);
  });

  it("omits an untouched placeholder item that carries no value", () => {
    const payload = buildDraftPayload(
      input({
        employees: [
          employee({
            jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0] })],
            billableItems: [{ id: "b1", type: "Bonus", note: "", value: 0 }],
          }),
        ],
        totalsByEmployeeId: { "cand-1": { totalHours: 8, reg: 8, ot: 0, dt: 0 } },
      }),
    );
    expect(payload.workers[0].items).toBeUndefined();
  });
});

describe("FE5-9: an untouched roster worker produces no payload entry", () => {
  it("omits a worker with no entered facts entirely", () => {
    const payload = buildDraftPayload(
      input({
        employees: [
          employee({ id: "cand-1", jobRows: [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0] })] }),
          employee({ id: "cand-2" }), // untouched
        ],
        totalsByEmployeeId: {
          "cand-1": { totalHours: 8, reg: 8, ot: 0, dt: 0 },
          "cand-2": { totalHours: 0, reg: 0, ot: 0, dt: 0 },
        },
      }),
    );

    expect(payload.workers.map((w) => w.candidateId)).toEqual(["cand-1"]);
    // No fabricated worked-hours payload for the untouched worker.
    expect(payload.workers).toHaveLength(1);
  });

  it("omits every worker when the whole worksheet is untouched", () => {
    const payload = buildDraftPayload(input());
    expect(payload.workers).toEqual([]);
    expect(payload.entryMode).toBe("DAILY");
  });
});
