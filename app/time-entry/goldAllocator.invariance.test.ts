/**
 * TE-S1 protection test.
 *
 * The Working Timesheet calculation architecture is Owner-protected. TE-S1 is a Hub
 * wiring slice and must leave it untouched. These assertions are a tripwire: they fail
 * if the GOLD allocator, its banner, its Monday->Sunday chronology, its employee-level
 * 40-hour threshold, its shift-differential overlay, or the deferred DT behavior are
 * altered outside an authorized calculation slice.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKING_TIMESHEET_PAGE = join(
  process.cwd(),
  "app",
  "time-entry",
  "[id]",
  "page.tsx",
);

const source = readFileSync(WORKING_TIMESHEET_PAGE, "utf8");

describe("GOLD allocator is unchanged by TE-S1", () => {
  it("retains the protection banner", () => {
    expect(source).toContain("GOLD ALLOCATOR — DO NOT MODIFY");
  });

  it("retains every protected calculation function", () => {
    for (const fn of [
      "function computeEmployeeTotals(",
      "function computeWeeklyTotals(",
      "function computeAllocatorCellBreakdownDaily(",
      "function computeShiftDiffOverlayDaily(",
      "function computeRowShiftDiffTotals(",
    ]) {
      expect(source).toContain(fn);
    }
  });

  it("retains Monday->Sunday chronology and the employee-level 40-hour threshold", () => {
    expect(source).toContain('const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]');
    expect(source).toContain("for (let dayIdx = 0; dayIdx < 7; dayIdx++)");
    expect(source).toContain("const reg = Math.min(totalHours, 40)");
    expect(source).toContain("const ot = Math.max(totalHours - 40, 0)");
    expect(source).toContain("const regPortion = 40 - hoursBeforeThisCell");
  });

  it("retains the weekly-mode OT allocation and mismatch enforcement", () => {
    expect(source).toContain("const regComputed = Math.min(totalHours, 40)");
    expect(source).toContain("const otComputed = Math.max(totalHours - 40, 0)");
    expect(source).toContain("const otEditable = hasMultipleRows && hasOtHours");
    expect(source).toContain("const mismatch = otEditable && allocatedOt !== otComputed");
  });

  it("retains the shift-differential overlay as hours-only, with no rates", () => {
    expect(source).toContain("regSdHours");
    expect(source).toContain("otSdHours");
    expect(source).toContain("dtSdHours");
    // The overlay must remain a quantity concern. No pay/bill rate may appear.
    expect(source).not.toMatch(/sdPayDeltaRate|sdBillDeltaRate|basePayRate|baseBillRate/);
  });

  it("leaves DT deferred, exactly as the protected source had it", () => {
    // DT restoration is a later authorized slice. TE-S1 must not reintroduce it.
    expect(source).toContain("const dt = 0");
    expect(source).not.toContain("function computeRegOt(");
    expect(source).not.toContain("handleDtChange");
  });

  it("introduces no punch-clock semantics", () => {
    expect(source).not.toMatch(/clockIn|clockOut|punch/i);
  });

  it("remains free of Time Entry write wiring in this slice", () => {
    // TE-S1 wires the Hub only. The Working Timesheet body stays unwired.
    expect(source).not.toMatch(/apiFetch|fetch\(/);
  });
});
