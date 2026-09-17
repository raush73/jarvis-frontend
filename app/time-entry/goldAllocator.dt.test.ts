/**
 * TE-S2B4 manual Double Time functional scenarios, DT-1 through DT-20.
 *
 * MW4H designates DT by hand. It is never derived. It is carved out of hours the existing
 * allocator has ALREADY classified as OT, so:
 *   - REG can never shrink,
 *   - worked hours can never grow,
 *   - a designation can never migrate to another JobRow or another day,
 *   - an invalid designation is REJECTED rather than silently clamped.
 */

import { describe, expect, it } from "vitest";

import {
  computeAllocatorCellBreakdownDaily,
  computeEmployeeTotals,
  computeShiftDiffOverlayDaily,
  computeWeeklyTotals,
  type JobRow,
} from "./[id]/page";

const NO_HOURS = [0, 0, 0, 0, 0, 0, 0];
const NO_DT = [0, 0, 0, 0, 0, 0, 0];
const NO_SD = [false, false, false, false, false, false, false];

const MON = 0;
const FRI = 4;
const SAT = 5;

function dailyRow(
  id: string,
  hours: number[],
  dt: number[] = [...NO_DT],
  jobId = "job1",
): JobRow {
  return {
    id,
    jobId,
    dailyHours: hours,
    perDiemDays: 0,
    weeklyTotalHours: 0,
    weeklyOtAllocation: 0,
    dailyDtHours: dt,
    weeklyDtHours: 0,
  };
}

function weeklyRow(id: string, total: number, otAlloc: number, dt: number): JobRow {
  return {
    id,
    jobId: "job1",
    dailyHours: [...NO_HOURS],
    perDiemDays: 0,
    weeklyTotalHours: total,
    weeklyOtAllocation: otAlloc,
    dailyDtHours: [...NO_DT],
    weeklyDtHours: dt,
  };
}

/** Mon-Fri 8, Sat 8, Sun 4 = 52 worked hours. Mon-Fri is REG; Sat and Sun are OT. */
function week52(dt: number[] = [...NO_DT]): JobRow[] {
  return [dailyRow("r1", [8, 8, 8, 8, 8, 8, 4], dt)];
}

function dtOn(dayIdx: number, hours: number): number[] {
  const dt = [...NO_DT];
  dt[dayIdx] = hours;
  return dt;
}

// ============================================================================================
// WEEKLY TOTALS MODE
// ============================================================================================

describe("DT weekly totals scenarios", () => {
  it("DT-1: single job, 52 total with 4 DT gives 40 REG / 8 OT / 4 DT", () => {
    const result = computeWeeklyTotals([weeklyRow("r1", 52, 0, 4)]);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(8);
    expect(result.dt).toBe(4);
    expect(result.totalHours).toBe(52);
    expect(result.reg + result.ot + result.dt).toBe(52);
    expect(result.dtInvalid).toBe(false);
  });

  it("DT-2: single job, 52 total with 0 DT is the pre-TE-S2B4 result", () => {
    const result = computeWeeklyTotals([weeklyRow("r1", 52, 0, 0)]);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(12);
    expect(result.dt).toBe(0);
    expect(result.jobBreakdown[0]).toMatchObject({ reg: 40, ot: 12, dt: 0, total: 52 });
    expect(result.dtInvalid).toBe(false);
  });

  it("DT-3: exactly 40 total rejects DT and never converts REG into DT", () => {
    const result = computeWeeklyTotals([weeklyRow("r1", 40, 0, 4)]);
    expect(result.dtInvalid).toBe(true);
    expect(result.reg).toBe(40); // REG protected
    expect(result.ot).toBe(0);
    expect(result.dt).toBe(0);
    expect(result.reg + result.ot + result.dt).toBe(40);
  });

  it("DT-4: 45 total with 8 DT is rejected outright, NOT clamped to the 5 available", () => {
    const result = computeWeeklyTotals([weeklyRow("r1", 45, 0, 8)]);
    expect(result.dtInvalid).toBe(true);
    expect(result.dt).not.toBe(5); // the whole point: no silent clamp
    expect(result.dt).toBe(0);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(5);
  });

  it("DT-5: quarter hours are exact - 52.25 total with 4.25 DT", () => {
    const result = computeWeeklyTotals([weeklyRow("r1", 52.25, 0, 4.25)]);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(8);
    expect(result.dt).toBe(4.25);
    expect(result.totalHours).toBe(52.25);
    expect(result.reg + result.ot + result.dt).toBe(52.25);
  });

  it("DT-6: multi-job - DT applies to the row that truthfully owns the OT", () => {
    // Job A 30 with no OT allocated, Job B 22 owning all 12 OT.
    const result = computeWeeklyTotals([
      weeklyRow("rA", 30, 0, 0),
      weeklyRow("rB", 22, 12, 4),
    ]);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(8);
    expect(result.dt).toBe(4);
    expect(result.totalHours).toBe(52);
    expect(result.dtInvalid).toBe(false);
    // Row attribution: only Job B carries the DT.
    expect(result.jobBreakdown[0]).toMatchObject({ reg: 30, ot: 0, dt: 0, total: 30 });
    expect(result.jobBreakdown[1]).toMatchObject({ reg: 10, ot: 8, dt: 4, total: 22 });
  });

  it("DT-7: multi-job - DT on a row with no allocated OT is invalid and borrows nothing", () => {
    // Job A owns zero OT; Job B owns all 12. Designating on A must not consume B's pool.
    const result = computeWeeklyTotals([
      weeklyRow("rA", 30, 0, 4),
      weeklyRow("rB", 22, 12, 0),
    ]);
    expect(result.dtInvalid).toBe(true);
    expect(result.dt).toBe(0);
    expect(result.jobBreakdown[0]).toMatchObject({ reg: 30, ot: 0, dt: 0 });
    expect(result.jobBreakdown[1]).toMatchObject({ reg: 10, ot: 12, dt: 0 }); // untouched
    expect(result.ot).toBe(12);
  });

  it("DT-8: explicit weeklyOtAllocation remains authoritative under a DT carve-out", () => {
    // 60 total, operator allocates 10 OT to each row, then designates 6 DT on Job A.
    const result = computeWeeklyTotals([
      weeklyRow("rA", 30, 10, 6),
      weeklyRow("rB", 30, 10, 0),
    ]);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(14);
    expect(result.dt).toBe(6);
    expect(result.totalHours).toBe(60);
    expect(result.reg + result.ot + result.dt).toBe(60);
    // The operator's allocation still decides ownership, and mismatch keeps its meaning.
    expect(result.allocatedOt).toBe(20);
    expect(result.mismatch).toBe(false);
    expect(result.jobBreakdown[0]).toMatchObject({ reg: 20, ot: 4, dt: 6, total: 30 });
    expect(result.jobBreakdown[1]).toMatchObject({ reg: 20, ot: 10, dt: 0, total: 30 });
  });

  it("fabricates no Daily facts in weekly mode", () => {
    const rows = [weeklyRow("r1", 52, 0, 4)];
    computeWeeklyTotals(rows);
    // The weekly path never writes a per-day value.
    expect(rows[0].dailyHours).toEqual(NO_HOURS);
    expect(rows[0].dailyDtHours).toEqual(NO_DT);
  });
});

// ============================================================================================
// DAILY MODE
// ============================================================================================

describe("DT daily scenarios", () => {
  it("DT-9: single job - 4 DT on an OT-eligible day gives 40 REG / 8 OT / 4 DT", () => {
    const result = computeEmployeeTotals(week52(dtOn(SAT, 4)));
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(8);
    expect(result.dt).toBe(4);
    expect(result.totalHours).toBe(52);
    expect(result.reg + result.ot + result.dt).toBe(52);
    expect(result.dtInvalid).toBe(false);
  });

  it("DT-10: DT on a cell allocated entirely to REG is invalid and leaves REG intact", () => {
    const result = computeEmployeeTotals(week52(dtOn(MON, 4)));
    expect(result.dtInvalid).toBe(true);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(12);
    expect(result.dt).toBe(0);
  });

  it("DT-11: on a threshold-crossing cell, DT carves only from that cell's OT portion", () => {
    // Mon-Thu 8 = 32, Fri 6 = 38, then Sat 8 crosses 40: 2 REG + 6 OT.
    const rows = [dailyRow("r1", [8, 8, 8, 8, 6, 8, 0], dtOn(SAT, 4))];
    const result = computeEmployeeTotals(rows);
    expect(result.totalHours).toBe(46);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(2);
    expect(result.dt).toBe(4);
    expect(result.reg + result.ot + result.dt).toBe(46);

    // The crossing cell itself: 2 REG kept, 6 OT reduced to 2, 4 carved to DT.
    const cells = computeAllocatorCellBreakdownDaily(rows).cell;
    expect(cells[0][SAT]).toEqual({ reg: 2, ot: 2, dt: 4 });
  });

  it("DT-12: multi-job - DT on a later row's OT leaves the earlier row's REG untouched", () => {
    // Job A takes all 40 REG Mon-Fri; Job B owns Sat 8 and Sun 4 as OT.
    const rows = [
      dailyRow("rA", [8, 8, 8, 8, 8, 0, 0]),
      dailyRow("rB", [0, 0, 0, 0, 0, 8, 4], dtOn(SAT, 4), "job2"),
    ];
    const result = computeEmployeeTotals(rows);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(8);
    expect(result.dt).toBe(4);
    expect(result.totalHours).toBe(52);
    expect(result.jobBreakdown[0]).toMatchObject({ reg: 40, ot: 0, dt: 0, total: 40 });
    expect(result.jobBreakdown[1]).toMatchObject({ reg: 0, ot: 8, dt: 4, total: 12 });
  });

  it("DT-13: DT on a row/day with no OT is invalid and does not borrow another cell's OT", () => {
    const rows = [
      dailyRow("rA", [8, 8, 8, 8, 8, 0, 0], dtOn(MON, 4)), // Monday is pure REG
      dailyRow("rB", [0, 0, 0, 0, 0, 8, 4], [...NO_DT], "job2"), // owns 12 OT
    ];
    const result = computeEmployeeTotals(rows);
    expect(result.dtInvalid).toBe(true);
    expect(result.dt).toBe(0);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(12);
    expect(result.jobBreakdown[1]).toMatchObject({ ot: 12, dt: 0 }); // B untouched
  });

  it("DT-14: an SD-selected OT cell splits into OT_SD and DT_SD, never double counted", () => {
    const rows = week52(dtOn(SAT, 4));
    const breakdown = computeAllocatorCellBreakdownDaily(rows);
    const overlay = computeShiftDiffOverlayDaily({
      jobRows: rows,
      cellBreakdown: breakdown.cell,
      rowSdFlagsForEmployee: { r1: [false, false, false, false, false, true, false] },
    });

    expect(overlay.otSdHours).toBe(4);
    expect(overlay.dtSdHours).toBe(4);
    expect(overlay.regSdHours).toBe(0);
    // The SD-selected cell still accounts for exactly its 8 worked hours.
    expect(overlay.otSdHours + overlay.dtSdHours).toBe(8);
  });

  it("DT-15: the same facts with SD off produce DT but no DT_SD", () => {
    const rows = week52(dtOn(SAT, 4));
    const breakdown = computeAllocatorCellBreakdownDaily(rows);
    const overlay = computeShiftDiffOverlayDaily({
      jobRows: rows,
      cellBreakdown: breakdown.cell,
      rowSdFlagsForEmployee: { r1: [...NO_SD] },
    });

    expect(overlay.regSdHours).toBe(0);
    expect(overlay.otSdHours).toBe(0);
    expect(overlay.dtSdHours).toBe(0);

    const totals = computeEmployeeTotals(rows);
    expect(totals.ot).toBe(8);
    expect(totals.dt).toBe(4);
  });

  it("DT-16: quarter-hour worked values and quarter-hour DT are exact", () => {
    // Mon-Thu 8 = 32, Fri 8 = 40, Sat 8.5 is entirely OT.
    const rows = [dailyRow("r1", [8, 8, 8, 8, 8, 8.5, 0], dtOn(SAT, 4.25))];
    const result = computeEmployeeTotals(rows);
    expect(result.totalHours).toBe(48.5);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(4.25);
    expect(result.dt).toBe(4.25);
    expect(result.reg + result.ot + result.dt).toBe(48.5);
  });
});

// ============================================================================================
// VALIDATION
// ============================================================================================

describe("DT validation", () => {
  it.each([0.1, 1.33, 0.3, 2.7])("DT-17: rejects non-quarter-hour value %s", (bad) => {
    const daily = computeEmployeeTotals(week52(dtOn(SAT, bad)));
    expect(daily.dtInvalid).toBe(true);
    expect(daily.dt).toBe(0);

    const weekly = computeWeeklyTotals([weeklyRow("r1", 52, 0, bad)]);
    expect(weekly.dtInvalid).toBe(true);
    expect(weekly.dt).toBe(0);
  });

  it.each([0.25, 0.5, 0.75, 1, 4.25, 8])("accepts quarter-hour value %s", (good) => {
    const weekly = computeWeeklyTotals([weeklyRow("r1", 52, 0, good)]);
    expect(weekly.dtInvalid).toBe(false);
    expect(weekly.dt).toBe(good);
  });

  it("DT-18: rejects a negative designation", () => {
    const daily = computeEmployeeTotals(week52(dtOn(SAT, -1)));
    expect(daily.dtInvalid).toBe(true);
    expect(daily.dt).toBe(0);
    expect(daily.reg).toBe(40);

    const weekly = computeWeeklyTotals([weeklyRow("r1", 52, 0, -1)]);
    expect(weekly.dtInvalid).toBe(true);
    expect(weekly.dt).toBe(0);
  });

  it("DT-19: rejects a designation larger than the worked cell, and so larger than its OT", () => {
    const result = computeEmployeeTotals(week52(dtOn(SAT, 12))); // Saturday worked only 8
    expect(result.dtInvalid).toBe(true);
    expect(result.dt).toBe(0);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(12);
  });

  it("rejects a designation that exceeds the OT within an otherwise valid cell", () => {
    // Saturday crosses the threshold: 2 REG + 6 OT. Designating 7 exceeds the 6 available.
    const rows = [dailyRow("r1", [8, 8, 8, 8, 6, 8, 0], dtOn(SAT, 7))];
    const result = computeEmployeeTotals(rows);
    expect(result.dtInvalid).toBe(true);
    expect(result.dt).toBe(0);
    expect(result.reg).toBe(40);
  });

  it("accepts a designation exactly equal to the available OT", () => {
    const result = computeEmployeeTotals(week52(dtOn(SAT, 8)));
    expect(result.dtInvalid).toBe(false);
    expect(result.dt).toBe(8);
    expect(result.reg).toBe(40);
    expect(result.ot).toBe(4); // Sunday's 4 OT remains
  });
});

// ============================================================================================
// HARD INVARIANTS
// ============================================================================================

describe("DT calculation invariants", () => {
  const dailyCases: JobRow[][] = [
    week52(dtOn(SAT, 4)),
    week52(dtOn(SAT, 8)),
    [dailyRow("r1", [8, 8, 8, 8, 6, 8, 0], dtOn(SAT, 4))],
    [dailyRow("r1", [8, 8, 8, 8, 8, 0, 0]), dailyRow("r2", [0, 0, 0, 0, 0, 8, 4], dtOn(SAT, 4), "job2")],
    [dailyRow("r1", [8, 8, 8, 8, 8, 8.5, 0], dtOn(SAT, 4.25))],
  ];

  it("REG + OT + DT always equals worked hours (daily)", () => {
    for (const rows of dailyCases) {
      const r = computeEmployeeTotals(rows);
      const worked = rows.reduce((s, row) => s + row.dailyHours.reduce((a, b) => a + b, 0), 0);
      expect(r.totalHours).toBe(worked);
      expect(r.reg + r.ot + r.dt).toBe(worked);
    }
  });

  it("DT never reduces REG (daily)", () => {
    for (const rows of dailyCases) {
      const withDt = computeEmployeeTotals(rows);
      const withoutDt = computeEmployeeTotals(
        rows.map((r) => ({ ...r, dailyDtHours: [...NO_DT] })),
      );
      expect(withDt.reg).toBe(withoutDt.reg);
    }
  });

  it("DT only ever converts OT, so OT falls by exactly the DT carved (daily)", () => {
    for (const rows of dailyCases) {
      const withDt = computeEmployeeTotals(rows);
      const withoutDt = computeEmployeeTotals(
        rows.map((r) => ({ ...r, dailyDtHours: [...NO_DT] })),
      );
      expect(withoutDt.ot - withDt.ot).toBe(withDt.dt);
    }
  });

  it("row classifications sum to the employee classifications (daily)", () => {
    for (const rows of dailyCases) {
      const r = computeEmployeeTotals(rows);
      const sum = (k: "reg" | "ot" | "dt" | "total") =>
        r.jobBreakdown.reduce((s, b) => s + b[k], 0);
      expect(sum("reg")).toBe(r.reg);
      expect(sum("ot")).toBe(r.ot);
      expect(sum("dt")).toBe(r.dt);
      expect(sum("total")).toBe(r.totalHours);
    }
  });

  it("daily DT stays attributed to the owning row and day", () => {
    const rows = [
      dailyRow("rA", [8, 8, 8, 8, 8, 0, 0]),
      dailyRow("rB", [0, 0, 0, 0, 0, 8, 4], dtOn(SAT, 4), "job2"),
    ];
    const cells = computeAllocatorCellBreakdownDaily(rows).cell;
    // Only row B / Saturday carries DT.
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const expected = rowIdx === 1 && dayIdx === SAT ? 4 : 0;
        expect(cells[rowIdx][dayIdx].dt).toBe(expected);
      }
    }
  });

  it("weekly DT stays attributed to the owning row, and totals reconcile", () => {
    const r = computeWeeklyTotals([weeklyRow("rA", 30, 10, 6), weeklyRow("rB", 30, 10, 0)]);
    expect(r.jobBreakdown[0].dt).toBe(6);
    expect(r.jobBreakdown[1].dt).toBe(0);
    const sum = (k: "reg" | "ot" | "dt") => r.jobBreakdown.reduce((s, b) => s + b[k], 0);
    expect(sum("reg")).toBe(r.reg);
    expect(sum("ot")).toBe(r.ot);
    expect(sum("dt")).toBe(r.dt);
  });

  it("SD decomposition never exceeds its class and never adds hours", () => {
    const rows = week52(dtOn(SAT, 4));
    const totals = computeEmployeeTotals(rows);
    const breakdown = computeAllocatorCellBreakdownDaily(rows);
    const overlay = computeShiftDiffOverlayDaily({
      jobRows: rows,
      cellBreakdown: breakdown.cell,
      rowSdFlagsForEmployee: { r1: [true, false, false, false, false, true, true] },
    });
    expect(overlay.regSdHours).toBeLessThanOrEqual(totals.reg);
    expect(overlay.otSdHours).toBeLessThanOrEqual(totals.ot);
    expect(overlay.dtSdHours).toBeLessThanOrEqual(totals.dt);
  });

  it("DT-20: an entirely zero-DT workbook is unchanged in every classification", () => {
    // The exhaustive form of this gate lives in goldAllocator.characterization.test.ts,
    // which replays all 24 frozen fixtures. This is the direct statement of the rule.
    const rows = week52();
    const result = computeEmployeeTotals(rows);
    expect(result).toMatchObject({ totalHours: 52, reg: 40, ot: 12, dt: 0, dtInvalid: false });

    const weekly = computeWeeklyTotals([weeklyRow("r1", 52, 0, 0)]);
    expect(weekly).toMatchObject({ totalHours: 52, reg: 40, ot: 12, dt: 0, dtInvalid: false });
  });
});
