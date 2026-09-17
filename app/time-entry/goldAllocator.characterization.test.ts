/**
 * TE-S2B4 ZERO-DT REGRESSION GATE.
 *
 * `goldAllocator.baseline.json` was captured by running the SECURED PRE-TE-S2B4 allocator,
 * before any Double Time code existed. It is a frozen record of real observed behaviour, not
 * a set of reasoned expectations.
 *
 * These tests replay every characterization fixture through the post-extension allocator and
 * require the result to be IDENTICAL to that frozen baseline in two distinct situations:
 *
 *   1. DT ABSENT   - the JobRow carries no DT fields at all, as all pre-TE-S2B4 state did.
 *   2. DT EXPLICIT ZERO - the JobRow carries DT fields that are present and zero.
 *
 * If either diverges by any amount on any field, the DT extension has changed existing
 * behaviour and this gate fails.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  computeAllocatorCellBreakdownDaily,
  computeEmployeeTotals,
  computeRowShiftDiffTotals,
  computeShiftDiffOverlayDaily,
  computeWeeklyTotals,
  type JobRow,
} from "./[id]/page";

const BASELINE = JSON.parse(
  readFileSync(join(process.cwd(), "app", "time-entry", "goldAllocator.baseline.json"), "utf8"),
) as Record<string, any>;

const ZERO_WEEK = [0, 0, 0, 0, 0, 0, 0];

/** How a JobRow's DT fields are supplied for a given run of the gate. */
type DtMode = "absent" | "explicit-zero";

function daily(id: string, hours: number[], mode: DtMode): JobRow {
  const row = {
    id,
    jobId: "job1",
    dailyHours: hours,
    perDiemDays: 0,
    weeklyTotalHours: 0,
    weeklyOtAllocation: 0,
  } as JobRow;
  if (mode === "explicit-zero") {
    row.dailyDtHours = [...ZERO_WEEK];
    row.weeklyDtHours = 0;
  }
  return row;
}

function weekly(id: string, total: number, otAlloc: number, mode: DtMode): JobRow {
  const row = {
    id,
    jobId: "job1",
    dailyHours: [...ZERO_WEEK],
    perDiemDays: 0,
    weeklyTotalHours: total,
    weeklyOtAllocation: otAlloc,
  } as JobRow;
  if (mode === "explicit-zero") {
    row.dailyDtHours = [...ZERO_WEEK];
    row.weeklyDtHours = 0;
  }
  return row;
}

const DAILY_FIXTURES: Record<string, (m: DtMode) => JobRow[]> = {
  D1: (m) => [daily("r1", [8, 8, 8, 8, 8, 0, 0], m)],
  D2: (m) => [daily("r1", [8, 8, 8, 8, 8, 5, 0], m)],
  D3: (m) => [daily("r1", [8, 8, 8, 8, 8, 8, 4], m)],
  D4: (m) => [daily("r1", [8, 8, 8, 0, 0, 0, 0], m), daily("r2", [4, 4, 4, 0, 0, 0, 0], m)],
  D5: (m) => [daily("r1", [8, 8, 8, 8, 0, 0, 0], m), daily("r2", [2, 2, 2, 2, 0, 0, 0], m)],
  D6: (m) => [daily("r1", [8, 8, 8, 8, 8, 0, 0], m), daily("r2", [0, 0, 0, 0, 0, 8, 4], m)],
  D7: (m) => [daily("r1", [8, 8, 8, 8, 0, 0, 0], m), daily("r2", [3, 3, 3, 3, 0, 0, 0], m)],
  D8: (m) => [daily("r1", [8, 8, 0, 0, 0, 0, 0], m), daily("r2", [6, 6, 0, 0, 0, 0, 0], m)],
  D13: (m) => [daily("r1", [8.25, 8.5, 7.75, 8, 8, 0, 0], m)],
  D14: (m) => [
    daily("r1", [8, 8, 8, 0, 0, 0, 0], m),
    daily("r2", [4, 4, 4, 0, 0, 0, 0], m),
    daily("r3", [2, 2, 2, 4, 0, 0, 0], m),
  ],
};

/** SD fixtures reuse the 52-hour week: Mon-Fri REG, Sat and Sun OT. */
const SD_FIXTURES: Record<string, { flags: Record<string, boolean[]> }> = {
  D9: { flags: {} },
  D10: { flags: { r1: [true, false, false, false, false, false, false] } },
  D11: { flags: { r1: [false, false, false, false, false, true, false] } },
  D12: { flags: { r1: [true, false, false, false, false, true, true] } },
};

const WEEKLY_FIXTURES: Record<string, (m: DtMode) => JobRow[]> = {
  W1: (m) => [weekly("r1", 40, 0, m)],
  W2: (m) => [weekly("r1", 45, 0, m)],
  W3: (m) => [weekly("r1", 52, 0, m)],
  W4: (m) => [weekly("r1", 20, 0, m), weekly("r2", 15, 0, m)],
  W5: (m) => [weekly("r1", 25, 0, m), weekly("r2", 15, 0, m)],
  W6: (m) => [weekly("r1", 30, 0, m), weekly("r2", 22, 0, m)],
  W7: (m) => [weekly("r1", 30, 0, m), weekly("r2", 22, 12, m)],
  W8: (m) => [weekly("r1", 20, 0, m), weekly("r2", 20, 0, m), weekly("r3", 20, 20, m)],
  W9: (m) => [weekly("r1", 30.25, 0, m), weekly("r2", 22.5, 12.75, m)],
  W10: (m) => [weekly("r1", 30, 5, m), weekly("r2", 30, 5, m)],
};

/**
 * Project `actual` down to exactly the keys the frozen baseline recorded.
 *
 * `dtInvalid` is a new additive field that did not exist pre-TE-S2B4, so comparing raw
 * objects would fail for a reason that has nothing to do with behaviour. Every field the
 * baseline DID record is compared strictly.
 */
function pickBaselineShape(baseline: unknown, actual: unknown): unknown {
  if (Array.isArray(baseline)) {
    expect(Array.isArray(actual)).toBe(true);
    return (baseline as unknown[]).map((item, i) =>
      pickBaselineShape(item, (actual as unknown[])[i]),
    );
  }
  if (baseline !== null && typeof baseline === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(baseline as Record<string, unknown>)) {
      out[key] = pickBaselineShape(
        (baseline as Record<string, unknown>)[key],
        (actual as Record<string, unknown>)[key],
      );
    }
    return out;
  }
  return actual;
}

function assertIdentical(name: string, actual: unknown) {
  const expected = BASELINE[name];
  expect(expected, `baseline fixture ${name} must exist`).toBeDefined();
  expect(pickBaselineShape(expected, actual)).toEqual(expected);
}

describe.each<DtMode>(["absent", "explicit-zero"])("zero-DT identity with DT %s", (mode) => {
  it.each(Object.keys(DAILY_FIXTURES))("daily fixture %s is identical to baseline", (name) => {
    const rows = DAILY_FIXTURES[name](mode);
    assertIdentical(name, {
      totals: computeEmployeeTotals(rows),
      cells: computeAllocatorCellBreakdownDaily(rows).cell,
    });
  });

  it.each(Object.keys(SD_FIXTURES))("SD fixture %s is identical to baseline", (name) => {
    const rows = [daily("r1", [8, 8, 8, 8, 8, 8, 4], mode)];
    const flags = SD_FIXTURES[name].flags;
    const breakdown = computeAllocatorCellBreakdownDaily(rows);
    assertIdentical(name, {
      totals: computeEmployeeTotals(rows),
      overlay: computeShiftDiffOverlayDaily({
        jobRows: rows,
        cellBreakdown: breakdown.cell,
        rowSdFlagsForEmployee: flags,
      }),
      rowSd: rows.map((r, i) =>
        computeRowShiftDiffTotals({
          rowIdx: i,
          cellBreakdown: breakdown.cell,
          sdFlags: flags[r.id] ?? [...ZERO_WEEK.map(() => false)],
        }),
      ),
    });
  });

  it.each(Object.keys(WEEKLY_FIXTURES))("weekly fixture %s is identical to baseline", (name) => {
    assertIdentical(name, { weekly: computeWeeklyTotals(WEEKLY_FIXTURES[name](mode)) });
  });
});

describe("the frozen baseline itself", () => {
  it("covers every required characterization fixture", () => {
    const required = [
      ...Array.from({ length: 14 }, (_, i) => `D${i + 1}`),
      ...Array.from({ length: 10 }, (_, i) => `W${i + 1}`),
    ];
    for (const name of required) {
      expect(Object.keys(BASELINE)).toContain(name);
    }
    expect(Object.keys(BASELINE)).toHaveLength(24);
  });

  it("was captured before DT existed, so it records no DT field", () => {
    // A baseline that already knew about dtInvalid would not be a pre-DT baseline.
    expect(JSON.stringify(BASELINE)).not.toContain("dtInvalid");
    // And every recorded DT figure is zero, because DT could not be produced at all.
    expect(JSON.stringify(BASELINE)).not.toMatch(/"dt":\s*[1-9]/);
  });
});
