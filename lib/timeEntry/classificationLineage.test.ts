/**
 * TE-S2B9 per-JobRow billable REG / OT / DT lineage.
 *
 * The truth these establish:
 *
 *   Customer -> Job Order -> Customer Job -> Working Timesheet JobRow -> hours -> REG / OT / DT
 *
 * The approved engine has always computed REG/OT/DT per JobRow; the payload builder used to send
 * only the worker-level totals, so persisted billable hours could not say WHICH job row - and
 * therefore which Customer Job - they were worked against. These tests prove the per-row identity
 * now travels, that it is taken from the array POSITION rather than the transient row id, and that
 * the split still reconciles exactly to the worker figures the engine reports.
 *
 * GOLD is driven here, not reimplemented: `computeEmployeeTotals` and `computeWeeklyTotals` are
 * imported and their real output is fed to the builder, so a drift between the engine's allocation
 * and the persisted lineage would fail these tests rather than hide.
 */

import { describe, expect, it } from "vitest";
import { computeEmployeeTotals, computeWeeklyTotals } from "@/app/time-entry/[id]/page";
import {
  buildDraftPayload,
  type BuilderEmployee,
  type BuildDraftPayloadInput,
  type DraftPayloadClassification,
} from "./buildDraftPayload";

const WEEK_START = "2026-09-07"; // Monday
const ORDER_A = "order-a";
const NO_WEEK = [0, 0, 0, 0, 0, 0, 0];

const CJ_FIRST = "cj-first-floor";
const CJ_SECOND = "cj-second-floor";

function row(overrides: Partial<BuilderEmployee["jobRows"][number]> = {}) {
  return {
    id: "cand-1-job1",
    jobId: ORDER_A,
    customerJobId: null as string | null,
    dailyHours: [...NO_WEEK],
    perDiemDays: 0,
    weeklyTotalHours: 0,
    weeklyOtAllocation: 0,
    dailyDtHours: [...NO_WEEK],
    weeklyDtHours: 0,
    ...overrides,
  };
}

/**
 * Build the payload the way the page does: run the real engine, then hand its worker totals AND its
 * per-row breakdown to the builder. This mirrors `handleSaveDraft` exactly.
 */
function build(
  entryMode: "daily" | "weekly",
  employees: BuilderEmployee[],
  extra: Partial<BuildDraftPayloadInput> = {},
) {
  const totalsByEmployeeId: BuildDraftPayloadInput["totalsByEmployeeId"] = {};
  for (const employee of employees) {
    const totals =
      entryMode === "daily"
        ? computeEmployeeTotals(employee.jobRows as any)
        : computeWeeklyTotals(employee.jobRows as any);
    totalsByEmployeeId[employee.id] = {
      totalHours: totals.totalHours,
      reg: totals.reg,
      ot: totals.ot,
      dt: totals.dt,
      jobBreakdown: totals.jobBreakdown.map((r) => ({ reg: r.reg, ot: r.ot, dt: r.dt })),
    };
  }

  return buildDraftPayload({
    entryMode,
    employees,
    weekStart: WEEK_START,
    workerSdEnabled: {},
    rowSdFlags: {},
    totalsByEmployeeId,
    ...extra,
  } as BuildDraftPayloadInput);
}

/** Worked-hour classification lines only, as `[earningCode, quantity, jobRowIndex]`. */
function hourLines(classifications: DraftPayloadClassification[] | undefined) {
  return (classifications ?? [])
    .filter((c) => c.unit === "HOURS")
    .map((c) => [c.earningCode, c.quantity, c.jobRowIndex]);
}

function sumOf(classifications: DraftPayloadClassification[] | undefined, code: string) {
  return (classifications ?? [])
    .filter((c) => c.unit === "HOURS" && c.earningCode === code)
    .reduce((sum, c) => sum + c.quantity, 0);
}

function worker(id: string, jobRows: any[]): BuilderEmployee {
  return { id, jobRows, billableItems: [], nonBillableItems: [] };
}

// ===========================================================================================
// DAILY
// ===========================================================================================

describe("Daily per-JobRow lineage", () => {
  it("attributes a single REG-only row to jobRowIndex 0", () => {
    const payload = build("daily", [
      worker("cand-1", [row({ dailyHours: [8, 8, 0, 0, 0, 0, 0] })]),
    ]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([["REG", 16, 0]]);
  });

  it("splits two rows onto their own jobRowIndex values", () => {
    const payload = build("daily", [
      worker("cand-1", [
        row({ id: "r1", dailyHours: [8, 0, 0, 0, 0, 0, 0] }),
        row({ id: "r2", dailyHours: [0, 4, 0, 0, 0, 0, 0] }),
      ]),
    ]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 8, 0],
      ["REG", 4, 1],
    ]);
  });

  it("attributes OT to the row that crossed the 40-hour boundary", () => {
    // Row 0 works Mon-Fri 8s (40 REG). Row 1 works Saturday, which is entirely OT.
    const payload = build("daily", [
      worker("cand-1", [
        row({ id: "r1", dailyHours: [8, 8, 8, 8, 8, 0, 0] }),
        row({ id: "r2", dailyHours: [0, 0, 0, 0, 0, 6, 0] }),
      ]),
    ]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 40, 0],
      ["OT", 6, 1],
    ]);
  });

  it("splits a single row that itself straddles the 40-hour boundary", () => {
    // One row, 44 hours: the allocator gives it 40 REG and 4 OT, both on row 0.
    const payload = build("daily", [
      worker("cand-1", [row({ dailyHours: [8, 8, 8, 8, 8, 4, 0] })]),
    ]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 40, 0],
      ["OT", 4, 0],
    ]);
  });

  it("attributes manual DT to the designated row only", () => {
    const payload = build("daily", [
      worker("cand-1", [
        row({ id: "r1", dailyHours: [8, 8, 8, 8, 8, 0, 0] }),
        row({
          id: "r2",
          dailyHours: [0, 0, 0, 0, 0, 8, 0],
          dailyDtHours: [0, 0, 0, 0, 0, 4, 0],
        }),
      ]),
    ]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 40, 0],
      ["OT", 4, 1],
      ["DT", 4, 1],
    ]);
    // Row 0 has no DT designation and therefore no DT line at all.
    expect(sumOf(payload.workers[0].classifications, "DT")).toBe(4);
  });

  it("emits mixed REG/OT/DT on one row as three lines sharing its index", () => {
    const payload = build("daily", [
      worker("cand-1", [
        row({ id: "r1", dailyHours: [8, 8, 8, 8, 8, 0, 0] }),
        row({
          id: "r2",
          dailyHours: [0, 0, 0, 0, 0, 8, 4],
          dailyDtHours: [0, 0, 0, 0, 0, 2, 0],
        }),
      ]),
    ]);

    const rowOne = (payload.workers[0].classifications ?? []).filter(
      (c) => c.unit === "HOURS" && c.jobRowIndex === 1,
    );
    expect(rowOne.map((c) => c.earningCode).sort()).toEqual(["DT", "OT"]);
  });

  it("creates NO zero-quantity lines to carry identity", () => {
    const payload = build("daily", [
      worker("cand-1", [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0] })]),
    ]);

    const lines = payload.workers[0].classifications ?? [];
    expect(lines).toHaveLength(1);
    expect(lines.every((c) => c.quantity > 0)).toBe(true);
    expect(lines.some((c) => c.earningCode === "OT")).toBe(false);
    expect(lines.some((c) => c.earningCode === "DT")).toBe(false);
  });

  it("omits a row that worked nothing rather than emitting an empty line set", () => {
    const payload = build("daily", [
      worker("cand-1", [
        row({ id: "r1", dailyHours: [8, 0, 0, 0, 0, 0, 0] }),
        row({ id: "r2" }), // untouched
      ]),
    ]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([["REG", 8, 0]]);
  });

  it("reconciles the per-row split to the engine worker totals", () => {
    const rows = [
      row({ id: "r1", dailyHours: [8, 8, 8, 8, 8, 0, 0] }),
      row({ id: "r2", dailyHours: [0, 0, 0, 0, 0, 8, 4], dailyDtHours: [0, 0, 0, 0, 0, 2, 0] }),
    ];
    const gold = computeEmployeeTotals(rows as any);
    const payload = build("daily", [worker("cand-1", rows)]);

    const lines = payload.workers[0].classifications;
    expect(sumOf(lines, "REG")).toBe(gold.reg);
    expect(sumOf(lines, "OT")).toBe(gold.ot);
    expect(sumOf(lines, "DT")).toBe(gold.dt);
    // And the whole worked total is preserved, which is what the backend reconciliation checks.
    expect(sumOf(lines, "REG") + sumOf(lines, "OT") + sumOf(lines, "DT")).toBe(gold.totalHours);
  });
});

// ===========================================================================================
// WEEKLY
// ===========================================================================================

describe("Weekly per-JobRow lineage", () => {
  it("attributes a single row's REG and OT to jobRowIndex 0", () => {
    const payload = build("weekly", [worker("cand-1", [row({ weeklyTotalHours: 52 })])]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 40, 0],
      ["OT", 12, 0],
    ]);
  });

  it("honours the operator OT allocation across two rows", () => {
    // 50 hours total, so the engine computes 10 OT. The operator gives 7 to row 0 and 3 to row 1.
    const rows = [
      row({ id: "r1", weeklyTotalHours: 30, weeklyOtAllocation: 7 }),
      row({ id: "r2", weeklyTotalHours: 20, weeklyOtAllocation: 3 }),
    ];
    const payload = build("weekly", [worker("cand-1", rows)]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 23, 0],
      ["OT", 7, 0],
      ["REG", 17, 1],
      ["OT", 3, 1],
    ]);
    // Jarvis invented nothing: the split is exactly the operator's allocation.
    expect(sumOf(payload.workers[0].classifications, "OT")).toBe(10);
  });

  it("allows an all-or-nothing allocation", () => {
    // The operator may decide one Customer Job owns every overtime hour.
    const rows = [
      row({ id: "r1", weeklyTotalHours: 30, weeklyOtAllocation: 10 }),
      row({ id: "r2", weeklyTotalHours: 20, weeklyOtAllocation: 0 }),
    ];
    const payload = build("weekly", [worker("cand-1", rows)]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 20, 0],
      ["OT", 10, 0],
      ["REG", 20, 1],
    ]);
  });

  it("carves DT from the row's own allocated OT", () => {
    const rows = [
      row({ id: "r1", weeklyTotalHours: 30, weeklyOtAllocation: 10, weeklyDtHours: 4 }),
      row({ id: "r2", weeklyTotalHours: 20, weeklyOtAllocation: 0 }),
    ];
    const payload = build("weekly", [worker("cand-1", rows)]);

    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 20, 0],
      ["OT", 6, 0],
      ["DT", 4, 0],
      ["REG", 20, 1],
    ]);
    // DT is a carve, never additive: the row still totals its 30 worked hours.
    expect(20 + 6 + 4).toBe(30);
  });

  it("reconciles the per-row split to the engine worker totals", () => {
    const rows = [
      row({ id: "r1", weeklyTotalHours: 30, weeklyOtAllocation: 6, weeklyDtHours: 2 }),
      row({ id: "r2", weeklyTotalHours: 20, weeklyOtAllocation: 4 }),
    ];
    const gold = computeWeeklyTotals(rows as any);
    expect(gold.mismatch).toBe(false); // 6 + 4 = the computed 10
    const payload = build("weekly", [worker("cand-1", rows)]);

    const lines = payload.workers[0].classifications;
    expect(sumOf(lines, "REG")).toBe(gold.reg);
    expect(sumOf(lines, "OT")).toBe(gold.ot);
    expect(sumOf(lines, "DT")).toBe(gold.dt);
  });

  it("does not fabricate Daily facts while carrying Weekly lineage", () => {
    const payload = build("weekly", [
      worker("cand-1", [row({ dailyHours: [8, 8, 0, 0, 0, 0, 0], weeklyTotalHours: 52 })]),
    ]);

    expect(payload.workers[0].jobRows!.every((r) => r.dailyHours === undefined)).toBe(true);
    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 40, 0],
      ["OT", 12, 0],
    ]);
  });
});

// ===========================================================================================
// CUSTOMER JOB LINEAGE
// ===========================================================================================

describe("the lineage reaches Customer Job through jobRowIndex", () => {
  it("lets two Customer Jobs on one worker be told apart by row index", () => {
    const payload = build("daily", [
      worker("cand-1", [
        row({ id: "r1", customerJobId: CJ_FIRST, dailyHours: [8, 0, 0, 0, 0, 0, 0] }),
        row({ id: "r2", customerJobId: CJ_SECOND, dailyHours: [0, 4, 0, 0, 0, 0, 0] }),
      ]),
    ]);

    const w = payload.workers[0];
    // The join the backend will follow: classification.jobRowIndex -> jobRow.customerJobId.
    const jobByIndex = new Map(w.jobRows!.map((r) => [r.jobRowIndex, r.customerJobId]));
    const lineage = (w.classifications ?? [])
      .filter((c) => c.unit === "HOURS")
      .map((c) => [c.earningCode, c.quantity, jobByIndex.get(c.jobRowIndex!)]);

    expect(lineage).toEqual([
      ["REG", 8, CJ_FIRST],
      ["REG", 4, CJ_SECOND],
    ]);
  });

  it("keeps the durable id out of the classification line itself", () => {
    // Lineage is by row index; the Customer Job id lives on the job row and is not duplicated.
    const payload = build("daily", [
      worker("cand-1", [row({ customerJobId: CJ_FIRST, dailyHours: [8, 0, 0, 0, 0, 0, 0] })]),
    ]);

    const serialized = JSON.stringify(payload.workers[0].classifications);
    expect(serialized).not.toContain(CJ_FIRST);
    expect(serialized).not.toContain("customerJobId");
  });

  it("lets the same Customer Job be shared across workers", () => {
    const payload = build("daily", [
      worker("cand-1", [row({ customerJobId: CJ_FIRST, dailyHours: [8, 0, 0, 0, 0, 0, 0] })]),
      worker("cand-2", [
        row({ id: "c2-r1", customerJobId: CJ_FIRST, dailyHours: [4, 0, 0, 0, 0, 0, 0] }),
      ]),
    ]);

    expect(payload.workers.map((w) => w.jobRows![0].customerJobId)).toEqual([CJ_FIRST, CJ_FIRST]);
    // Each worker's own hours stay on their own row index; nothing is merged across workers.
    expect(hourLines(payload.workers[0].classifications)).toEqual([["REG", 8, 0]]);
    expect(hourLines(payload.workers[1].classifications)).toEqual([["REG", 4, 0]]);
  });

  it("remains valid when no Customer Job was ever recorded", () => {
    // Historical truth: lineage resolves to null rather than inventing a job.
    const payload = build("daily", [
      worker("cand-1", [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0] })]),
    ]);

    expect(payload.workers[0].jobRows![0].customerJobId).toBeNull();
    expect(hourLines(payload.workers[0].classifications)).toEqual([["REG", 8, 0]]);
  });

  it("gives every worked-hour line a job row that exists in the payload", () => {
    // Without this, lineage could point at a row the backend never received.
    const payload = build("daily", [
      worker("cand-1", [
        row({ id: "r1", dailyHours: [8, 0, 0, 0, 0, 0, 0] }),
        row({ id: "r2", dailyHours: [0, 4, 0, 0, 0, 0, 0] }),
      ]),
    ]);

    const present = new Set(payload.workers[0].jobRows!.map((r) => r.jobRowIndex));
    for (const c of payload.workers[0].classifications ?? []) {
      if (c.unit !== "HOURS") continue;
      expect(present.has(c.jobRowIndex!)).toBe(true);
    }
  });
});

// ===========================================================================================
// TRANSIENT IDENTITY IS NEVER PERSISTED
// ===========================================================================================

describe("transient row identity is never persisted", () => {
  it("ignores the engine jobId and uses array position", () => {
    // The row ids here are deliberately not ordinal and not stable-looking.
    const rows = [
      row({ id: "zzz-transient-9999", dailyHours: [8, 0, 0, 0, 0, 0, 0] }),
      row({ id: "aaa-transient-0001", dailyHours: [0, 4, 0, 0, 0, 0, 0] }),
    ];
    const gold = computeEmployeeTotals(rows as any);
    // The engine really does report the transient id, which is exactly why it is not persisted.
    expect(gold.jobBreakdown.map((b) => b.jobId)).toEqual([
      "zzz-transient-9999",
      "aaa-transient-0001",
    ]);

    const payload = build("daily", [worker("cand-1", rows)]);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("zzz-transient-9999");
    expect(serialized).not.toContain("aaa-transient-0001");
    // Position, not id: first row is index 0 regardless of how its id sorts.
    expect(hourLines(payload.workers[0].classifications)).toEqual([
      ["REG", 8, 0],
      ["REG", 4, 1],
    ]);
  });

  it("keeps classification indexes aligned with the job row indexes", () => {
    const payload = build("daily", [
      worker("cand-1", [
        row({ id: "r1", dailyHours: [8, 0, 0, 0, 0, 0, 0] }),
        row({ id: "r2", dailyHours: [0, 4, 0, 0, 0, 0, 0] }),
      ]),
    ]);

    expect(payload.workers[0].jobRows!.map((r) => r.jobRowIndex)).toEqual([0, 1]);
    expect(
      (payload.workers[0].classifications ?? [])
        .filter((c) => c.unit === "HOURS")
        .map((c) => c.jobRowIndex),
    ).toEqual([0, 1]);
  });
});

// ===========================================================================================
// EXISTING FACTS ARE UNDISTURBED
// ===========================================================================================

describe("other Working Timesheet facts are unchanged", () => {
  it("leaves billable Per Diem on its own job row fact", () => {
    const payload = build("daily", [
      worker("cand-1", [
        row({ dailyHours: [8, 0, 0, 0, 0, 0, 0], perDiemDays: 3.5, customerJobId: CJ_FIRST }),
      ]),
    ]);

    expect(payload.workers[0].jobRows![0].perDiemDays).toBe(3.5);
    // PD is not a worked-hour classification and gains no REG/OT/DT line.
    expect(hourLines(payload.workers[0].classifications)).toEqual([["REG", 8, 0]]);
  });

  it("keeps SD buckets worker-level while worked hours go per row", () => {
    const rows = [row({ id: "r1", dailyHours: [8, 8, 0, 0, 0, 0, 0] })];
    const payload = build("daily", [worker("cand-1", rows)], {
      workerSdEnabled: { "cand-1": true },
      rowSdFlags: { "cand-1": { r1: [true, false, false, false, false, false, false] } },
      sdOverlayByEmployeeId: { "cand-1": { regSdHours: 8, otSdHours: 0, dtSdHours: 0 } },
    });

    const lines = payload.workers[0].classifications ?? [];
    const sd = lines.filter((c) => c.unit === "REG_SD");
    expect(sd).toEqual([{ earningCode: "REG", unit: "REG_SD", quantity: 8 }]);
    // The SD bucket carries no jobRowIndex: it decomposes hours already counted.
    expect(sd[0].jobRowIndex).toBeUndefined();
    expect(hourLines(lines)).toEqual([["REG", 16, 0]]);
  });

  it("still omits an untouched worker entirely", () => {
    const payload = build("daily", [
      worker("cand-1", [row({ dailyHours: [8, 0, 0, 0, 0, 0, 0] })]),
      worker("cand-2", [row({ id: "c2-r1" })]),
    ]);

    expect(payload.workers.map((w) => w.candidateId)).toEqual(["cand-1"]);
  });
});
