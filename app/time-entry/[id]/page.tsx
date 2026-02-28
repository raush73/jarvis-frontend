"use client";

import React, { useState } from "react";
import Link from "next/link";

// =============================================================================
// JOB-LEVEL SD GATE (MOCK)
// If false, all SD UI is hidden. Set to true for demo.
// =============================================================================
const JOB_HAS_SHIFT_DIFF = true;

// Mock job/order options for dropdown
const MOCK_JOB_OPTIONS = [
  { id: "job1", name: "ORD-1042 - Main Assembly" },
  { id: "job2", name: "ORD-1043 - Line 2 Support" },
  { id: "job3", name: "ORD-1044 - Shutdown Crew" },
  { id: "job4", name: "ORD-1045 - Maintenance" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type EntryMode = "daily" | "weekly";

interface JobRow {
  id: string;
  jobId: string;
  dailyHours: number[]; // Mon-Sun raw hours
  perDiemDays: number;
  weeklyTotalHours: number;
  weeklyOtAllocation: number;
}

interface NonHourItem {
  id: string;
  type: string;
  note: string;
  value: number;
}

interface EmployeeData {
  id: string;
  name: string;
  trade: string;
  jobRows: JobRow[];
  billableItems: NonHourItem[];
  nonBillableItems: NonHourItem[];
}

// Compute weekly mode totals for an employee
// Returns per-row breakdown, employee totals, and mismatch info
function computeWeeklyTotals(jobRows: JobRow[]): {
  totalHours: number;
  reg: number;
  ot: number;
  dt: number;
  jobBreakdown: { jobId: string; reg: number; ot: number; dt: number; total: number }[];
  allocatedOt: number;
  otEditable: boolean;
  mismatch: boolean;
} {
  const totalHours = jobRows.reduce((sum, row) => sum + row.weeklyTotalHours, 0);
  const regComputed = Math.min(totalHours, 40);
  const otComputed = Math.max(totalHours - 40, 0);
  const dt = 0;

  const hasMultipleRows = jobRows.length >= 2;
  const hasOtHours = totalHours > 40;
  const otEditable = hasMultipleRows && hasOtHours;

  const jobBreakdown: { jobId: string; reg: number; ot: number; dt: number; total: number }[] = [];
  let allocatedOt = 0;

  if (otEditable) {
    // OT is user-editable: use weeklyOtAllocation
    jobRows.forEach((row) => {
      const otAlloc = Math.max(0, Math.min(row.weeklyOtAllocation, row.weeklyTotalHours));
      const regRow = Math.max(row.weeklyTotalHours - otAlloc, 0);
      jobBreakdown.push({
        jobId: row.id,
        reg: regRow,
        ot: otAlloc,
        dt: 0,
        total: row.weeklyTotalHours,
      });
      allocatedOt += otAlloc;
    });
  } else {
    // OT is NOT editable: compute deterministically (top row to bottom row)
    let runningTotal = 0;
    jobRows.forEach((row) => {
      const hours = row.weeklyTotalHours;
      const hoursBeforeThisRow = runningTotal;
      const hoursAfterThisRow = runningTotal + hours;

      let regRow = 0;
      let otRow = 0;

      if (hoursBeforeThisRow >= 40) {
        // All OT
        otRow = hours;
      } else if (hoursAfterThisRow <= 40) {
        // All REG
        regRow = hours;
      } else {
        // Split: some REG, some OT
        regRow = 40 - hoursBeforeThisRow;
        otRow = hours - regRow;
      }

      jobBreakdown.push({
        jobId: row.id,
        reg: regRow,
        ot: otRow,
        dt: 0,
        total: hours,
      });

      runningTotal = hoursAfterThisRow;
      allocatedOt += otRow;
    });
  }

  const mismatch = otEditable && allocatedOt !== otComputed;

  return {
    totalHours,
    reg: regComputed,
    ot: otComputed,
    dt,
    jobBreakdown,
    allocatedOt,
    otEditable,
    mismatch,
  };
}

// =============================================================================
// GOLD ALLOCATOR — DO NOT MODIFY
// =============================================================================
// Compute derived REG/OT/DT for an employee across all job rows
// Chronological allocation: Mon→Sun, within day: top row to bottom row
// First 40 hours = REG, remaining = OT, DT = 0 for now
function computeEmployeeTotals(jobRows: JobRow[]): {
  totalHours: number;
  reg: number;
  ot: number;
  dt: number;
  jobBreakdown: { jobId: string; reg: number; ot: number; dt: number; total: number }[];
} {
  let runningTotal = 0;
  const jobBreakdown: { jobId: string; reg: number; ot: number; dt: number; total: number }[] = [];

  // Initialize breakdown for each job row
  jobRows.forEach((row) => {
    jobBreakdown.push({ jobId: row.id, reg: 0, ot: 0, dt: 0, total: 0 });
  });

  // Iterate chronologically: Mon→Sun, within day: row order
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    for (let rowIdx = 0; rowIdx < jobRows.length; rowIdx++) {
      const hours = jobRows[rowIdx].dailyHours[dayIdx] || 0;
      if (hours <= 0) continue;

      const breakdown = jobBreakdown[rowIdx];
      breakdown.total += hours;

      // Allocate hours: first 40 total = REG, rest = OT
      const hoursBeforeThisCell = runningTotal;
      const hoursAfterThisCell = runningTotal + hours;

      if (hoursBeforeThisCell >= 40) {
        // All OT
        breakdown.ot += hours;
      } else if (hoursAfterThisCell <= 40) {
        // All REG
        breakdown.reg += hours;
      } else {
        // Split: some REG, some OT
        const regPortion = 40 - hoursBeforeThisCell;
        const otPortion = hours - regPortion;
        breakdown.reg += regPortion;
        breakdown.ot += otPortion;
      }

      runningTotal = hoursAfterThisCell;
    }
  }

  const totalHours = runningTotal;
  const reg = Math.min(totalHours, 40);
  const ot = Math.max(totalHours - 40, 0);
  const dt = 0;

  return { totalHours, reg, ot, dt, jobBreakdown };
}

// =============================================================================
// CELL BREAKDOWN HELPER — DAILY MODE ONLY (PARALLEL BREAKDOWN, NO GOLD MUTATION)
// =============================================================================
// Returns per-cell REG/OT/DT breakdown for SD overlay consumption.
// Uses SAME allocation logic as computeEmployeeTotals: Mon→Sun, row order, first 40 REG.
// This is a READ-ONLY parallel breakdown — does NOT affect GOLD totals.
function computeAllocatorCellBreakdownDaily(jobRows: JobRow[]): {
  cell: { reg: number; ot: number; dt: number }[][];
} {
  const cell: { reg: number; ot: number; dt: number }[][] = [];

  // Initialize 2D array: cell[rowIdx][dayIdx]
  for (let rowIdx = 0; rowIdx < jobRows.length; rowIdx++) {
    cell[rowIdx] = [];
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      cell[rowIdx][dayIdx] = { reg: 0, ot: 0, dt: 0 };
    }
  }

  let runningTotal = 0;

  // Iterate chronologically: Mon→Sun, within day: row order (SAME as computeEmployeeTotals)
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    for (let rowIdx = 0; rowIdx < jobRows.length; rowIdx++) {
      const hours = jobRows[rowIdx].dailyHours[dayIdx] || 0;
      if (hours <= 0) continue;

      const hoursBeforeThisCell = runningTotal;
      const hoursAfterThisCell = runningTotal + hours;

      if (hoursBeforeThisCell >= 40) {
        // All OT
        cell[rowIdx][dayIdx].ot = hours;
      } else if (hoursAfterThisCell <= 40) {
        // All REG
        cell[rowIdx][dayIdx].reg = hours;
      } else {
        // Split: some REG, some OT
        const regPortion = 40 - hoursBeforeThisCell;
        const otPortion = hours - regPortion;
        cell[rowIdx][dayIdx].reg = regPortion;
        cell[rowIdx][dayIdx].ot = otPortion;
      }

      runningTotal = hoursAfterThisCell;
    }
  }

  return { cell };
}

// =============================================================================
// SD OVERLAY HELPER — DAILY MODE ONLY (HOURS ONLY, NO RATES)
// =============================================================================
// Computes SD hour buckets by reading the per-cell breakdown.
// rowSdFlagsForEmployee: { [rowId]: boolean[7] } — SD intent flags per row/day
function computeShiftDiffOverlayDaily({
  jobRows,
  cellBreakdown,
  rowSdFlagsForEmployee,
}: {
  jobRows: JobRow[];
  cellBreakdown: { reg: number; ot: number; dt: number }[][];
  rowSdFlagsForEmployee: Record<string, boolean[]>;
}): { regSdHours: number; otSdHours: number; dtSdHours: number } {
  let regSdHours = 0;
  let otSdHours = 0;
  let dtSdHours = 0;

  // Iterate Mon→Sun, row order (SAME order as cell breakdown)
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    for (let rowIdx = 0; rowIdx < jobRows.length; rowIdx++) {
      const row = jobRows[rowIdx];
      const sdFlags = rowSdFlagsForEmployee[row.id] || [false, false, false, false, false, false, false];
      const isSdOn = sdFlags[dayIdx];

      if (isSdOn) {
        const cellData = cellBreakdown[rowIdx]?.[dayIdx];
        if (cellData) {
          regSdHours += cellData.reg;
          otSdHours += cellData.ot;
          dtSdHours += cellData.dt;
        }
      }
    }
  }

  return { regSdHours, otSdHours, dtSdHours };
}

// =============================================================================
// PER-ROW SD TOTALS HELPER — DAILY MODE ONLY
// =============================================================================
// Computes SD hour buckets for a SINGLE row (scoped by rowIdx).
// Uses the same cellBreakdown but only sums for the specific row.
function computeRowShiftDiffTotals({
  rowIdx,
  cellBreakdown,
  sdFlags,
}: {
  rowIdx: number;
  cellBreakdown: { reg: number; ot: number; dt: number }[][];
  sdFlags: boolean[];
}): { regSd: number; otSd: number; dtSd: number } {
  let regSd = 0;
  let otSd = 0;
  let dtSd = 0;

  // Iterate Mon→Sun for this specific row only
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const isSdOn = sdFlags[dayIdx];
    if (isSdOn) {
      const cellData = cellBreakdown[rowIdx]?.[dayIdx];
      if (cellData) {
        regSd += cellData.reg;
        otSd += cellData.ot;
        dtSd += cellData.dt;
      }
    }
  }

  return { regSd, otSd, dtSd };
}

export default function TimeEntryPage() {
  // Mock context data
  const mockContext = {
    jobSite: "Acme Manufacturing - Plant A",
    customer: "Acme Manufacturing",
    weekEnding: "2026-02-08",
    status: "Working",
  };

  // Entry mode state
  const [entryMode, setEntryMode] = useState<EntryMode>("daily");

  // =============================================================================
  // SD STATE — Worker-level enable, Project-Row/Day toggles (INTENT ONLY)
  // =============================================================================
  // Worker-level SD enable: { [employeeId]: boolean }
  // This gates ALL SD UI for the employee (week-scoped enable)
  // Meaning: "This employee is eligible for shift differential THIS WEEK."
  const [workerSdEnabled, setWorkerSdEnabled] = useState<Record<string, boolean>>({
    emp1: false,
    emp2: true, // Demo: Sarah Chen has SD enabled
  });

  // Project-Row/Day SD flags: { [employeeId]: { [jobRowId]: boolean[7] } }
  // Each job row has its OWN SD-by-day state (SNAPSHOT-SAFE shape)
  // Records INTENT only — which PROJECT + DAY hours are marked as SD
  const [rowSdFlags, setRowSdFlags] = useState<Record<string, Record<string, boolean[]>>>({
    emp1: {
      "emp1-job1": [false, false, false, false, false, false, false],
    },
    emp2: {
      "emp2-job1": [true, true, true, true, true, false, false], // Demo: Mon-Fri SD for Sarah's first job
    },
  });

  // Toggle worker-level SD (gates all SD UI for this employee)
  const toggleWorkerSd = (employeeId: string) => {
    setWorkerSdEnabled((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId],
    }));
  };

  // Toggle day-level SD for a specific job row
  const toggleRowDaySd = (employeeId: string, rowId: string, dayIdx: number) => {
    setRowSdFlags((prev) => {
      const empRows = prev[employeeId] || {};
      const current = empRows[rowId] || [false, false, false, false, false, false, false];
      const updated = [...current];
      updated[dayIdx] = !updated[dayIdx];
      return {
        ...prev,
        [employeeId]: {
          ...empRows,
          [rowId]: updated,
        },
      };
    });
  };

  // Initialize SD flags for a new job row
  const initRowSdFlags = (employeeId: string, rowId: string) => {
    setRowSdFlags((prev) => {
      const empRows = prev[employeeId] || {};
      if (empRows[rowId]) return prev; // Already exists
      return {
        ...prev,
        [employeeId]: {
          ...empRows,
          [rowId]: [false, false, false, false, false, false, false],
        },
      };
    });
  };

  // Helper: Get SD flags for a row (with fallback)
  const getRowSdFlags = (employeeId: string, rowId: string): boolean[] => {
    return rowSdFlags[employeeId]?.[rowId] || [false, false, false, false, false, false, false];
  };

  // Initialize with 2 mock employees, each with 1 default job row
  const [employees, setEmployees] = useState<EmployeeData[]>([
    {
      id: "emp1",
      name: "John Martinez",
      trade: "Welder",
      jobRows: [
        {
          id: "emp1-job1",
          jobId: "job1",
          dailyHours: [8, 8, 8, 8, 8, 0, 0],
          perDiemDays: 3.5,
          weeklyTotalHours: 40, // sum of dailyHours
          weeklyOtAllocation: 0,
        },
      ],
      billableItems: [],
      nonBillableItems: [],
    },
    {
      id: "emp2",
      name: "Sarah Chen",
      trade: "Assembler",
      jobRows: [
        {
          id: "emp2-job1",
          jobId: "job1",
          dailyHours: [10, 10, 10, 10, 10, 4, 0],
          perDiemDays: 3.5,
          weeklyTotalHours: 54, // sum of dailyHours
          weeklyOtAllocation: 0,
        },
      ],
      billableItems: [],
      nonBillableItems: [],
    },
  ]);

  // Add a new job row for an employee
  const addJobRow = (employeeId: string) => {
    const newRowId = `${employeeId}-job${Date.now()}`;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: [
            ...emp.jobRows,
            {
              id: newRowId,
              jobId: "job2",
              dailyHours: [0, 0, 0, 0, 0, 0, 0],
              perDiemDays: 0,
              weeklyTotalHours: 0,
              weeklyOtAllocation: 0,
            },
          ],
        };
      })
    );
    // Initialize SD flags for the new row
    initRowSdFlags(employeeId, newRowId);
  };

  // Remove a job row for an employee
  const removeJobRow = (employeeId: string, rowId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        // Don't remove if it's the only row
        if (emp.jobRows.length <= 1) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.filter((r) => r.id !== rowId),
        };
      })
    );
  };

  // Update job selection for a row
  const updateJobSelection = (employeeId: string, rowId: string, jobId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, jobId } : r
          ),
        };
      })
    );
  };

  // Update daily hours for a job row
  const updateDailyHours = (
    employeeId: string,
    rowId: string,
    dayIdx: number,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) => {
            if (r.id !== rowId) return r;
            const newDailyHours = [...r.dailyHours];
            newDailyHours[dayIdx] = numValue;
            return { ...r, dailyHours: newDailyHours };
          }),
        };
      })
    );
  };

  // Update per diem days for a job row
  const updatePerDiemDays = (
    employeeId: string,
    rowId: string,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, perDiemDays: numValue } : r
          ),
        };
      })
    );
  };

  // Update weekly total hours for a job row
  const updateWeeklyTotalHours = (
    employeeId: string,
    rowId: string,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, weeklyTotalHours: numValue } : r
          ),
        };
      })
    );
  };

  // Update weekly OT allocation for a job row
  const updateWeeklyOtAllocation = (
    employeeId: string,
    rowId: string,
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          jobRows: emp.jobRows.map((r) =>
            r.id === rowId ? { ...r, weeklyOtAllocation: numValue } : r
          ),
        };
      })
    );
  };

  // Get job name by id
  const getJobName = (jobId: string): string => {
    const job = MOCK_JOB_OPTIONS.find((j) => j.id === jobId);
    return job ? job.name : "Unknown Job";
  };

  // Billable item type options
  const BILLABLE_ITEM_TYPES = ["Bonus", "Hazard", "Mobilization", "Demobilization", "Reimbursement", "Other"];
  // Non-billable item type options
  const NON_BILLABLE_ITEM_TYPES = ["Per Diem", "Bonus", "Hazard", "Reimbursement", "Other"];

  // Add a billable item for an employee
  const addBillableItem = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        const newItemId = `${emp.id}-billable-${Date.now()}`;
        return {
          ...emp,
          billableItems: [
            ...emp.billableItems,
            { id: newItemId, type: "Bonus", note: "", value: 0 },
          ],
        };
      })
    );
  };

  // Add a non-billable item for an employee
  const addNonBillableItem = (employeeId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        const newItemId = `${emp.id}-nonbillable-${Date.now()}`;
        return {
          ...emp,
          nonBillableItems: [
            ...emp.nonBillableItems,
            { id: newItemId, type: "Per Diem", note: "", value: 0 },
          ],
        };
      })
    );
  };

  // Remove a billable item
  const removeBillableItem = (employeeId: string, itemId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          billableItems: emp.billableItems.filter((item) => item.id !== itemId),
        };
      })
    );
  };

  // Remove a non-billable item
  const removeNonBillableItem = (employeeId: string, itemId: string) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          nonBillableItems: emp.nonBillableItems.filter((item) => item.id !== itemId),
        };
      })
    );
  };

  // Update a billable item
  const updateBillableItem = (
    employeeId: string,
    itemId: string,
    patch: Partial<NonHourItem>
  ) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          billableItems: emp.billableItems.map((item) =>
            item.id === itemId ? { ...item, ...patch } : item
          ),
        };
      })
    );
  };

  // Update a non-billable item
  const updateNonBillableItem = (
    employeeId: string,
    itemId: string,
    patch: Partial<NonHourItem>
  ) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== employeeId) return emp;
        return {
          ...emp,
          nonBillableItems: emp.nonBillableItems.map((item) =>
            item.id === itemId ? { ...item, ...patch } : item
          ),
        };
      })
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header Card */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-6">
        <div className="flex flex-wrap items-center gap-6 mb-4">
          <div>
            <div className="text-xs text-slate-400 mb-1">Job Site</div>
            <div className="text-base font-medium text-slate-100">
              {mockContext.jobSite}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Customer</div>
            <div className="text-base font-medium text-slate-100">
              {mockContext.customer}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Week Ending</div>
            <div className="text-base font-medium text-slate-100">
              {mockContext.weekEnding}
            </div>
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400 border border-amber-700">
              {mockContext.status}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Working sheet — snapshot generated after approval
        </p>

        {/* Entry Mode Toggle */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">Entry Mode:</span>
            <div className="flex items-center gap-1 bg-slate-800 rounded p-0.5">
              <button
                onClick={() => setEntryMode("daily")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  entryMode === "daily"
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setEntryMode("weekly")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  entryMode === "weekly"
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Weekly Totals
              </button>
            </div>
            {entryMode === "weekly" && (
              <span className="text-xs text-slate-500">
                Weekly Totals mode — OT editable only when 2+ jobs and &gt;40 hrs
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Employee Sections */}
      {employees.map((employee) => {
        const dailyTotals = computeEmployeeTotals(employee.jobRows);
        const weeklyTotals = computeWeeklyTotals(employee.jobRows);
        const totals = entryMode === "daily" ? dailyTotals : weeklyTotals;
        const showMismatchWarning = entryMode === "weekly" && weeklyTotals.mismatch;

        // SD state for this worker (INTENT ONLY — no calculations)
        const isWorkerSdEnabled = JOB_HAS_SHIFT_DIFF && (workerSdEnabled[employee.id] ?? false);

        return (
          <div
            key={employee.id}
            className={`bg-slate-900 border rounded-lg mb-6 overflow-hidden ${
              showMismatchWarning ? "border-amber-600" : "border-slate-700"
            }`}
          >
            {/* Employee Header */}
            <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-100">
                    {employee.name}
                  </span>
                  <span className="text-sm text-slate-400">
                    {employee.trade}
                  </span>
                  {/* Worker-level SD Toggle — only shown if job has SD */}
                  {JOB_HAS_SHIFT_DIFF && (
                    <button
                      onClick={() => toggleWorkerSd(employee.id)}
                      className={`ml-2 px-2 py-0.5 text-xs font-medium rounded border transition-colors ${
                        isWorkerSdEnabled
                          ? "bg-purple-900/50 text-purple-300 border-purple-600"
                          : "bg-slate-700 text-slate-400 border-slate-600 hover:text-slate-300"
                      }`}
                    >
                      Shift Diff {isWorkerSdEnabled ? "ON" : "OFF"}
                    </button>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  Employee Weekly: REG {totals.reg} | OT {totals.ot} | DT {totals.dt} | Total {totals.totalHours}
                </div>
              </div>

              {/* OT Mismatch Warning */}
              {showMismatchWarning && (
                <div className="mt-2 px-2 py-1 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-400">
                  OT allocation mismatch — computed OT: {weeklyTotals.ot}, allocated OT: {weeklyTotals.allocatedOt}
                </div>
              )}

              {/* ================================================================
                  SHIFT DIFFERENTIAL BREAKDOWN — VISUAL VERIFICATION LAYER
                  Read-only display of SD vs non-SD hour buckets.
                  Reflects existing data; does NOT compute or modify anything.
                  ================================================================ */}
              {JOB_HAS_SHIFT_DIFF && entryMode === "daily" && (() => {
                // Compute SD overlay for this employee (read-only, parallel to GOLD)
                const cellBreakdown = computeAllocatorCellBreakdownDaily(employee.jobRows);
                const rowSdFlagsForEmployee = rowSdFlags[employee.id] || {};
                const sdOverlay = computeShiftDiffOverlayDaily({
                  jobRows: employee.jobRows,
                  cellBreakdown: cellBreakdown.cell,
                  rowSdFlagsForEmployee,
                });

                // Derive non-SD hours (total minus SD)
                const regNonSd = totals.reg - sdOverlay.regSdHours;
                const otNonSd = totals.ot - sdOverlay.otSdHours;
                const dtNonSd = totals.dt - sdOverlay.dtSdHours;

                const hasSdHours = sdOverlay.regSdHours > 0 || sdOverlay.otSdHours > 0 || sdOverlay.dtSdHours > 0;

                return (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide">
                        Shift Differential Breakdown
                      </span>
                      {isWorkerSdEnabled ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-600">
                          SD Applied
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 border border-slate-600">
                          SD Not Enabled
                        </span>
                      )}
                    </div>

                    {isWorkerSdEnabled ? (
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        {/* REG Bucket */}
                        <div className="bg-slate-800/50 rounded px-3 py-2 border border-slate-700">
                          <div className="text-[10px] text-slate-400 mb-1 font-medium">REG Hours</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-slate-300">Non-SD:</span>
                              <span className="ml-1 font-medium text-slate-100">{regNonSd}</span>
                            </div>
                            <div>
                              <span className="text-purple-400">SD:</span>
                              <span className="ml-1 font-medium text-purple-300">{sdOverlay.regSdHours}</span>
                            </div>
                          </div>
                        </div>

                        {/* OT Bucket */}
                        <div className="bg-slate-800/50 rounded px-3 py-2 border border-slate-700">
                          <div className="text-[10px] text-slate-400 mb-1 font-medium">OT Hours</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-slate-300">Non-SD:</span>
                              <span className="ml-1 font-medium text-slate-100">{otNonSd}</span>
                            </div>
                            <div>
                              <span className="text-purple-400">SD:</span>
                              <span className="ml-1 font-medium text-purple-300">{sdOverlay.otSdHours}</span>
                            </div>
                          </div>
                        </div>

                        {/* DT Bucket */}
                        <div className="bg-slate-800/50 rounded px-3 py-2 border border-slate-700">
                          <div className="text-[10px] text-slate-400 mb-1 font-medium">DT Hours</div>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-slate-300">Non-SD:</span>
                              <span className="ml-1 font-medium text-slate-100">{dtNonSd}</span>
                            </div>
                            <div>
                              <span className="text-purple-400">SD:</span>
                              <span className="ml-1 font-medium text-purple-300">{sdOverlay.dtSdHours}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">
                        Enable Shift Diff for this worker to see SD vs non-SD breakdown.
                      </div>
                    )}

                    {/* Source attribution */}
                    {isWorkerSdEnabled && hasSdHours && (
                      <div className="mt-2 text-[9px] text-slate-500">
                        Derived from Job Order SD rules • Per-row/day SD flags shown below
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Job Order has NO Shift Differential — explicit indicator */}
              {!JOB_HAS_SHIFT_DIFF && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      Shift Differential
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">
                      Not Configured
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 italic">
                    This Job Order does not have Shift Differential configured.
                  </div>
                </div>
              )}
            </div>

            {/* Job Rows Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-400 border-b border-slate-700 min-w-[200px]">
                      Job/Order
                    </th>
                    {entryMode === "daily" ? (
                      <>
                        {DAYS.map((day) => (
                          <th
                            key={day}
                            className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-16"
                          >
                            <div>{day}</div>
                          </th>
                        ))}
                      </>
                    ) : (
                      <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-16">
                        Hours
                      </th>
                    )}
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      Total
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      REG
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      OT
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      DT
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-14">
                      PD
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-slate-400 border-b border-slate-700 w-10">
                      &nbsp;
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employee.jobRows.map((row, rowIdx) => {
                    const rowTotalDaily = row.dailyHours.reduce((s, h) => s + h, 0);
                    const breakdown = totals.jobBreakdown[rowIdx];
                    const isFirstRow = rowIdx === 0;
                    const rowSdFlagsArr = getRowSdFlags(employee.id, row.id);

                    return (
                      <React.Fragment key={row.id}>
                        {/* Main job row */}
                        <tr className="border-b border-slate-700/50">
                          <td className="px-4 py-2">
                            {isFirstRow ? (
                              <span className="text-sm text-slate-200">
                                {getJobName(row.jobId)}
                              </span>
                            ) : (
                              <select
                                value={row.jobId}
                                onChange={(e) =>
                                  updateJobSelection(employee.id, row.id, e.target.value)
                                }
                                className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                              >
                                {MOCK_JOB_OPTIONS.map((job) => (
                                  <option key={job.id} value={job.id}>
                                    {job.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          {entryMode === "daily" ? (
                            <>
                              {DAYS.map((day, dayIdx) => (
                                <td key={day} className="px-1 py-2 text-center">
                                  <input
                                    type="text"
                                    value={row.dailyHours[dayIdx] || ""}
                                    onChange={(e) =>
                                      updateDailyHours(employee.id, row.id, dayIdx, e.target.value)
                                    }
                                    className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                                  />
                                </td>
                              ))}
                            </>
                          ) : (
                            <td className="px-1 py-2 text-center">
                              <input
                                type="text"
                                value={row.weeklyTotalHours || ""}
                                onChange={(e) =>
                                  updateWeeklyTotalHours(employee.id, row.id, e.target.value)
                                }
                                className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                              />
                            </td>
                          )}
                          <td className="px-2 py-2 text-center text-sm font-medium text-slate-200">
                            {entryMode === "daily" ? rowTotalDaily : row.weeklyTotalHours}
                          </td>
                          <td className="px-2 py-2 text-center text-sm text-slate-400">
                            {breakdown?.reg || 0}
                          </td>
                          {/* OT column: editable input in weekly mode when otEditable, otherwise display-only */}
                          <td className="px-1 py-2 text-center">
                            {entryMode === "weekly" && weeklyTotals.otEditable ? (
                              <input
                                type="text"
                                value={row.weeklyOtAllocation || ""}
                                onChange={(e) =>
                                  updateWeeklyOtAllocation(employee.id, row.id, e.target.value)
                                }
                                className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                              />
                            ) : (
                              <span className="text-sm text-slate-400">
                                {breakdown?.ot || 0}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center text-sm text-slate-400">
                            {breakdown?.dt || 0}
                          </td>
                          <td className="px-1 py-2 text-center">
                            <input
                              type="text"
                              value={row.perDiemDays || ""}
                              onChange={(e) =>
                                updatePerDiemDays(employee.id, row.id, e.target.value)
                              }
                              className="w-12 px-1 py-1 text-center text-sm bg-slate-800 border border-slate-600 rounded text-slate-200"
                            />
                          </td>
                          <td className="px-2 py-2 text-center">
                            {!isFirstRow && (
                              <button
                                onClick={() => removeJobRow(employee.id, row.id)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Per-row SD toggles — only shown when worker SD is enabled (INTENT ONLY) */}
                        {isWorkerSdEnabled && entryMode === "daily" && (() => {
                          const cellBreakdown = computeAllocatorCellBreakdownDaily(employee.jobRows);
                          const rowSdTotals = computeRowShiftDiffTotals({
                            rowIdx,
                            cellBreakdown: cellBreakdown.cell,
                            sdFlags: rowSdFlagsArr,
                          });
                          const hasAnySd = rowSdTotals.regSd > 0 || rowSdTotals.otSd > 0 || rowSdTotals.dtSd > 0;
                          return (
                            <tr className="bg-purple-900/10 border-b border-slate-700/30">
                              <td className="px-4 py-1 text-[10px] text-purple-400">
                                SD
                              </td>
                              {DAYS.map((day, dayIdx) => (
                                <td key={day} className="px-1 py-1 text-center">
                                  <button
                                    onClick={() => toggleRowDaySd(employee.id, row.id, dayIdx)}
                                    className={`w-8 h-5 text-[10px] font-medium rounded transition-colors ${
                                      rowSdFlagsArr[dayIdx]
                                        ? "bg-purple-700/70 text-purple-200 border border-purple-500"
                                        : "bg-slate-700/40 text-slate-500 border border-slate-600 hover:text-slate-400"
                                    }`}
                                  >
                                    {rowSdFlagsArr[dayIdx] ? "✓" : ""}
                                  </button>
                                </td>
                              ))}
                              {/* Per-row SD totals: REG_SD / OT_SD / DT_SD */}
                              <td className="px-2 py-1 text-center">
                                {/* Total column - empty for SD row */}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {hasAnySd && (
                                  <span className="text-[10px] font-medium text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">
                                    {rowSdTotals.regSd}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {hasAnySd && (
                                  <span className="text-[10px] font-medium text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">
                                    {rowSdTotals.otSd}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {hasAnySd && (
                                  <span className="text-[10px] font-medium text-purple-400 bg-purple-900/40 px-1.5 py-0.5 rounded">
                                    {rowSdTotals.dtSd}
                                  </span>
                                )}
                              </td>
                              <td colSpan={2}>&nbsp;</td>
                            </tr>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>


            {/* Add Job Control Row */}
            <div className="px-4 py-3 border-t border-slate-700/50 flex gap-2">
              <button
                onClick={() => addJobRow(employee.id)}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-3 py-1"
              >
                + Add Job
              </button>
              <button
                onClick={() => addBillableItem(employee.id)}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-3 py-1"
              >
                + Add Item
              </button>
              <button
                onClick={() => addNonBillableItem(employee.id)}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-3 py-1"
              >
                + Add Non-Billable Item
              </button>
            </div>

            {/* Non-Hour Items Section */}
            {(employee.billableItems.length > 0 || employee.nonBillableItems.length > 0) && (
              <div className="px-4 py-3 border-t border-slate-700/50">
                <div className="text-xs font-medium text-slate-300 mb-3">Non-Hour Items</div>

                {/* Billable Items */}
                <div className="mb-3">
                  <div className="text-xs text-slate-400 mb-2">Billable Items</div>
                  {employee.billableItems.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">None</div>
                  ) : (
                    <div className="space-y-2">
                      {employee.billableItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 border border-slate-700 rounded px-2 py-1"
                        >
                          <select
                            value={item.type}
                            onChange={(e) =>
                              updateBillableItem(employee.id, item.id, { type: e.target.value })
                            }
                            className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                          >
                            {BILLABLE_ITEM_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Note"
                            value={item.note}
                            onChange={(e) =>
                              updateBillableItem(employee.id, item.id, { note: e.target.value })
                            }
                            className="flex-1 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                          />
                          <input
                            type="text"
                            value={item.value || ""}
                            onChange={(e) =>
                              updateBillableItem(employee.id, item.id, {
                                value: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-20 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-right"
                          />
                          <span className="text-xs text-slate-500 w-8">$</span>
                          <button
                            onClick={() => removeBillableItem(employee.id, item.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Non-Billable Items */}
                <div>
                  <div className="text-xs text-slate-400 mb-2">Non-Billable Items (Payroll Only)</div>
                  {employee.nonBillableItems.length === 0 ? (
                    <div className="text-xs text-slate-500 italic">None</div>
                  ) : (
                    <div className="space-y-2">
                      {employee.nonBillableItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 border border-slate-700 rounded px-2 py-1"
                        >
                          <select
                            value={item.type}
                            onChange={(e) =>
                              updateNonBillableItem(employee.id, item.id, { type: e.target.value })
                            }
                            className="text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                          >
                            {NON_BILLABLE_ITEM_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Note"
                            value={item.note}
                            onChange={(e) =>
                              updateNonBillableItem(employee.id, item.id, { note: e.target.value })
                            }
                            className="flex-1 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                          />
                          <input
                            type="text"
                            value={item.value || ""}
                            onChange={(e) =>
                              updateNonBillableItem(employee.id, item.id, {
                                value: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-20 text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-right"
                          />
                          <span className="text-xs text-slate-500 w-8">
                            {item.type === "Per Diem" ? "Days" : "$"}
                          </span>
                          <button
                            onClick={() => removeNonBillableItem(employee.id, item.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Bottom Actions (disabled UI shell) */}
      {/* OT mismatch blocking warning */}
      {entryMode === "weekly" && employees.some((emp) => computeWeeklyTotals(emp.jobRows).mismatch) && (
        <div className="mb-3 px-3 py-2 bg-amber-900/30 border border-amber-700 rounded text-xs text-amber-400">
          Fix OT allocation mismatch warnings before continuing.
        </div>
      )}
      <div className="flex gap-3 mb-6">
        <button
          disabled
          className="px-5 py-2 text-sm font-medium bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
        >
          Save Draft
        </button>
        <button
          disabled
          className="px-5 py-2 text-sm font-medium bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
        >
          Generate Snapshot
        </button>
        <button
          disabled
          className="px-5 py-2 text-sm font-medium bg-slate-800 text-slate-500 border border-slate-700 rounded cursor-not-allowed"
        >
          Mark Ready for Payroll
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-6">UI shell</p>

      {/* Navigation */}
      <div className="flex gap-6 items-center">
        <Link
          href="/time-entry"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Time Entry
        </Link>
      </div>
    </div>
  );
}
