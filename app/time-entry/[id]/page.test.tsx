/**
 * TE-S2A - the Working Timesheet detail page reads real data.
 *
 * What these prove:
 *  - the route identity is consumed and used to fetch the real Working Timesheet;
 *  - the dispatched roster hydrates the existing worker rows;
 *  - a persisted OPEN draft is restored, and a worker without one is NOT given
 *    fabricated saved values;
 *  - the Owner-approved header, controls, labels and footer actions are unchanged;
 *  - Save Draft remains disabled - TE-S2A introduces no write.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchWorkingTimesheetDetail = vi.fn();
const saveWorkingTimesheetDraft = vi.fn();
// TE-S2B8: the page now also reads the Order-owned Customer Job list. Mocked here so this suite
// keeps testing the approved TE-S2A surface against the page's real module contract rather than a
// stale one.
const fetchCustomerJobs = vi.fn();
const createCustomerJob = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "order-a__2026-09-07" }),
}));

vi.mock("@/lib/timeEntry/workingTimesheetApi", () => ({
  fetchWorkingTimesheetDetail: (...args: unknown[]) => fetchWorkingTimesheetDetail(...args),
  saveWorkingTimesheetDraft: (...args: unknown[]) => saveWorkingTimesheetDraft(...args),
  fetchCustomerJobs: (...args: unknown[]) => fetchCustomerJobs(...args),
  createCustomerJob: (...args: unknown[]) => createCustomerJob(...args),
  describeCustomerJobCreateError: () => "Could not create the Customer Job. Please try again.",
}));

import WorkingTimesheetPage from "./page";

const DETAIL = {
  id: "order-a__2026-09-07",
  orderId: "order-a",
  weekStart: "2026-09-07",
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
      draft: {
        hoursEntryId: "h1",
        totalHours: 40,
        lines: [
          {
            earningCode: "REG",
            unit: "HOURS",
            quantity: 40,
            projectRef: null,
            tradeId: null,
          },
          {
            earningCode: "PD",
            unit: "DAYS",
            quantity: 3.25,
            projectRef: null,
            tradeId: null,
          },
        ],
      },
      draftConflict: false,
    },
    {
      candidateId: "cand-2",
      workerName: "Sarah Chen",
      trade: "Assembler",
      assignmentIds: ["a2"],
      draft: null,
      draftConflict: false,
    },
  ],
  draftConflictCandidateIds: [],
  orphanedDraftCandidateIds: [],
};

beforeEach(() => {
  // No Customer Jobs by default: these TE-S2A cases predate them, so the sheet must behave
  // exactly as it always did when the Order has none.
  fetchCustomerJobs.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  fetchWorkingTimesheetDetail.mockReset();
  saveWorkingTimesheetDraft.mockReset();
  fetchCustomerJobs.mockReset();
  createCustomerJob.mockReset();
});

describe("Working Timesheet detail page", () => {
  it("consumes the route identity and fetches that Working Timesheet", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);

    await waitFor(() => expect(fetchWorkingTimesheetDetail).toHaveBeenCalledTimes(1));
    expect(fetchWorkingTimesheetDetail).toHaveBeenCalledWith("order-a__2026-09-07");
  });

  it("hydrates the header context with real Job Site, Customer and Week Ending", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);

    await waitFor(() => expect(screen.getByText("Acme Plant A")).toBeTruthy());
    expect(screen.getByText("Acme Manufacturing")).toBeTruthy();
    expect(screen.getByText("2026-09-13")).toBeTruthy();

    // The header labels themselves are unchanged.
    expect(screen.getByText("Job Site")).toBeTruthy();
    expect(screen.getByText("Customer")).toBeTruthy();
    expect(screen.getByText("Week Ending")).toBeTruthy();
  });

  it("hydrates the dispatched roster into the existing worker rows", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);

    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());
    expect(screen.getByText("Sarah Chen")).toBeTruthy();
    expect(screen.getByText("Welder")).toBeTruthy();
    expect(screen.getByText("Assembler")).toBeTruthy();
  });

  it("restores the persisted per-diem DAY count in the default daily view", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());

    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map((i) => i.value);
    // PD days are persisted, so they are restored.
    expect(values).toContain("3.25");
  });

  it("leaves day cells empty because no per-day hours are persisted yet", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());

    // A weekly total exists for John, but the day-by-day split does not. Nothing is
    // invented: the seven day cells stay empty rather than fabricating a distribution.
    //
    // Two workers x (7 day cells + 7 manual DT cells + 1 PD cell) = 30 inputs. The DT cells
    // were added by TE-S2B4 and start empty, because a DT designation is an operator decision
    // and none is persisted yet. The ONLY populated input remains John's persisted PD days.
    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map((i) => i.value);
    expect(values).toHaveLength(30);
    expect(values.filter((v) => v !== "")).toEqual(["3.25"]);
  });

  it("restores the persisted weekly total when the Weekly Totals view is selected", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());

    // The weekly total input only exists in the Weekly Totals view.
    fireEvent.click(screen.getByText("Weekly Totals"));

    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map((i) => i.value);
    expect(values).toContain("40");
  });

  it("does not fabricate saved values for a roster worker with no draft", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue({
      ...DETAIL,
      workers: [DETAIL.workers[1]], // Sarah only - draft is null
    });

    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("Sarah Chen")).toBeTruthy());

    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    // Every entry field is empty: nothing was persisted, so nothing is shown.
    for (const input of inputs) {
      expect(input.value).toBe("");
    }
  });

  it("shows a late-corrected worker alongside previously saved workers", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue({
      ...DETAIL,
      workers: [
        ...DETAIL.workers,
        {
          candidateId: "cand-john",
          workerName: "John Late",
          trade: "Pipefitter",
          assignmentIds: ["a-john"],
          draft: null,
          draftConflict: false,
        },
      ],
    });

    render(<WorkingTimesheetPage />);

    await waitFor(() => expect(screen.getByText("John Late")).toBeTruthy());

    // The previously saved worker is still present with their saved draft intact.
    expect(screen.getByText("John Martinez")).toBeTruthy();
    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map((i) => i.value);
    expect(values).toContain("3.25");

    // And the late worker carries no fabricated saved data.
    fireEvent.click(screen.getByText("Weekly Totals"));
    const weeklyValues = (screen.getAllByRole("textbox") as HTMLInputElement[]).map(
      (i) => i.value,
    );
    expect(weeklyValues).toContain("40"); // John Martinez's saved total survived
    expect(weeklyValues.filter((v) => v === "")).not.toHaveLength(0); // John Late is blank
  });

  it("surfaces a load failure instead of rendering a fabricated timesheet", async () => {
    fetchWorkingTimesheetDetail.mockRejectedValue(new Error("API 403 Forbidden"));

    render(<WorkingTimesheetPage />);

    await waitFor(() => expect(screen.getByText("API 403 Forbidden")).toBeTruthy());
    expect(screen.queryByText("John Martinez")).toBeNull();
  });

  it("shows an empty state when no worker was dispatched for the crew-week", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue({ ...DETAIL, workers: [] });

    render(<WorkingTimesheetPage />);

    await waitFor(() =>
      expect(screen.getByText("No dispatched workers for this crew-week.")).toBeTruthy(),
    );
  });
});

describe("Owner-approved Working Timesheet UI is unchanged", () => {
  it("keeps the entry mode controls, labels and footer actions exactly as approved", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());

    // Entry mode toggle.
    expect(screen.getByText("Entry Mode:")).toBeTruthy();
    expect(screen.getByText("Daily")).toBeTruthy();
    expect(screen.getByText("Weekly Totals")).toBeTruthy();

    // Row-level controls.
    expect(screen.getAllByText("+ Add Job").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+ Add Item").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+ Add Non-Billable Item").length).toBeGreaterThan(0);

    // Footer actions, in their approved order.
    expect(screen.getByText("Save Draft")).toBeTruthy();
    expect(screen.getByText("Generate Snapshot")).toBeTruthy();
    expect(screen.getByText("Mark Ready for Approvals")).toBeTruthy();

    // Navigation.
    expect(screen.getByText("← Back to Time Entry")).toBeTruthy();
  });

  it("enables only Save Draft, leaving the approval actions disabled", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());

    // TE-S2B5 wired Save Draft, so it is now actionable.
    const saveDraft = screen.getByText("Save Draft").closest("button")!;
    expect(saveDraft.hasAttribute("disabled")).toBe(false);

    // The SNAPSHOT boundary is untouched: TE-S4 owns it and it was not wired.
    expect(screen.getByText("Generate Snapshot").closest("button")!.hasAttribute("disabled")).toBe(
      true,
    );

    // TE-S3 wired the readiness action, and it is correctly UNAVAILABLE here: this fixture's detail
    // carries no readiness verdict, so the screen has no server statement that the sheet is ready.
    // Readiness is the server's to grant, never the screen's to assume.
    expect(
      screen
        .getByText("Mark Ready for Approvals")
        .closest("button")!
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("still renders the shift-differential surface without persisting eligibility", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());

    // The SD control is present and defaults to OFF, because no SD eligibility is
    // persisted yet. The calculation engine is untouched.
    expect(screen.getAllByText("Shift Diff OFF").length).toBeGreaterThan(0);
  });
});

/**
 * TE-S2B4 - manual Double Time is entered through the real screen.
 *
 * These drive the actual page rather than the allocator directly, so they prove the input
 * grain is genuinely wired: a Daily designation belongs to one worker, one JobRow and one day,
 * and a Weekly designation belongs to one worker and one JobRow.
 */
describe("manual DT designation through the Working Timesheet", () => {
  /** In Daily view each worker owns: 7 day cells, 1 PD cell, then 7 manual DT cells. */
  const DAY_CELLS = 7;
  const CELLS_PER_WORKER_DAILY = 15;

  function dailyInputs(workerIdx: number) {
    const all = screen.getAllByRole("textbox") as HTMLInputElement[];
    const base = workerIdx * CELLS_PER_WORKER_DAILY;
    return {
      day: (dayIdx: number) => all[base + dayIdx],
      perDiem: all[base + DAY_CELLS],
      dt: (dayIdx: number) => all[base + DAY_CELLS + 1 + dayIdx],
    };
  }

  async function renderDetail() {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);
    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());
  }

  it("carves DT out of OT for the exact JobRow and day it was designated on", async () => {
    await renderDetail();

    // 48 worked hours for John: Mon-Fri REG, Saturday entirely OT.
    for (let day = 0; day < 5; day++) {
      fireEvent.change(dailyInputs(0).day(day), { target: { value: "8" } });
    }
    fireEvent.change(dailyInputs(0).day(5), { target: { value: "8" } });
    expect(screen.getByText("Employee Weekly: REG 40 | OT 8 | DT 0 | Total 48")).toBeTruthy();

    // Designate 4 DT on Saturday only.
    fireEvent.change(dailyInputs(0).dt(5), { target: { value: "4" } });

    // OT falls by exactly 4, REG is untouched, and worked hours do not move.
    expect(screen.getByText("Employee Weekly: REG 40 | OT 4 | DT 4 | Total 48")).toBeTruthy();
    // The worked Saturday cell still reads 8 - DT classifies, it does not rewrite hours.
    expect(dailyInputs(0).day(5).value).toBe("8");
  });

  it("rejects a Daily designation on a REG-only day and leaves REG intact", async () => {
    await renderDetail();

    // Exactly 40 hours: every cell is REG, so there is no OT pool anywhere.
    for (let day = 0; day < 5; day++) {
      fireEvent.change(dailyInputs(0).day(day), { target: { value: "8" } });
    }
    fireEvent.change(dailyInputs(0).dt(0), { target: { value: "4" } });

    expect(screen.getByText(/Invalid DT designation/)).toBeTruthy();
    expect(screen.getByText("Employee Weekly: REG 40 | OT 0 | DT 0 | Total 40")).toBeTruthy();
  });

  it("rejects a non-quarter-hour Daily designation", async () => {
    await renderDetail();

    for (let day = 0; day < 6; day++) {
      fireEvent.change(dailyInputs(0).day(day), { target: { value: "8" } });
    }
    fireEvent.change(dailyInputs(0).dt(5), { target: { value: "1.33" } });

    expect(screen.getByText(/Invalid DT designation/)).toBeTruthy();
    expect(screen.getByText("Employee Weekly: REG 40 | OT 8 | DT 0 | Total 48")).toBeTruthy();
  });

  it("designates Weekly DT per JobRow without any day being involved", async () => {
    await renderDetail();
    fireEvent.click(screen.getByText("Weekly Totals"));

    // In Weekly Totals each worker owns: weekly total, DT, then PD.
    const weekly = () => screen.getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(weekly()[0], { target: { value: "52" } });
    expect(screen.getByText("Employee Weekly: REG 40 | OT 12 | DT 0 | Total 52")).toBeTruthy();

    fireEvent.change(weekly()[1], { target: { value: "4" } });
    expect(screen.getByText("Employee Weekly: REG 40 | OT 8 | DT 4 | Total 52")).toBeTruthy();
  });

  it("rejects a Weekly designation larger than the row's OT pool, without clamping", async () => {
    await renderDetail();
    fireEvent.click(screen.getByText("Weekly Totals"));

    const weekly = () => screen.getAllByRole("textbox") as HTMLInputElement[];
    fireEvent.change(weekly()[0], { target: { value: "45" } }); // OT pool is 5
    fireEvent.change(weekly()[1], { target: { value: "8" } });

    expect(screen.getByText(/Invalid DT designation/)).toBeTruthy();
    // Not clamped to 5: the designation is refused outright.
    expect(screen.getByText("Employee Weekly: REG 40 | OT 5 | DT 0 | Total 45")).toBeTruthy();
  });

  it("keeps one worker's DT designation off another worker", async () => {
    await renderDetail();

    for (let day = 0; day < 6; day++) {
      fireEvent.change(dailyInputs(0).day(day), { target: { value: "8" } });
    }
    fireEvent.change(dailyInputs(0).dt(5), { target: { value: "4" } });

    // John reclassified; Sarah still has nothing at all.
    expect(screen.getByText("Employee Weekly: REG 40 | OT 4 | DT 4 | Total 48")).toBeTruthy();
    expect(screen.getByText("Employee Weekly: REG 0 | OT 0 | DT 0 | Total 0")).toBeTruthy();
    for (let day = 0; day < 7; day++) {
      expect(dailyInputs(1).dt(day).value).toBe("");
    }
  });

  it("shows no DT designation cells in the Weekly Totals view", async () => {
    await renderDetail();

    // Daily view: 2 workers x 15 inputs.
    expect(screen.getAllByRole("textbox")).toHaveLength(30);

    fireEvent.click(screen.getByText("Weekly Totals"));
    // Weekly view: 2 workers x (weekly total + DT + PD). The 7-day DT row is gone, because a
    // weekly designation has no day dimension.
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });
});

/**
 * TE-S2B5 - the existing Save Draft button writes through the authoritative API.
 */
describe("Save Draft wiring", () => {
  const CELLS_PER_WORKER_DAILY = 15;

  function dayInput(workerIdx: number, dayIdx: number) {
    const all = screen.getAllByRole("textbox") as HTMLInputElement[];
    return all[workerIdx * CELLS_PER_WORKER_DAILY + dayIdx];
  }

  async function renderDetail() {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);
    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());
  }

  it("sends the Working Timesheet identity and the entered Daily facts", async () => {
    saveWorkingTimesheetDraft.mockResolvedValue({
      workingTimesheetId: "order-a__2026-09-07",
      orderId: "order-a",
      weekStart: "2026-09-07",
      entryMode: "DAILY",
      savedCandidateIds: ["cand-1"],
      skippedEmptyCandidateIds: [],
    });

    await renderDetail();
    fireEvent.change(dayInput(0, 0), { target: { value: "8" } });
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalledTimes(1));
    const [id, payload] = saveWorkingTimesheetDraft.mock.calls[0];
    expect(id).toBe("order-a__2026-09-07");
    expect(payload.entryMode).toBe("DAILY");

    // Only John carries a fact; Sarah is untouched and therefore absent.
    expect(payload.workers.map((w: any) => w.candidateId)).toEqual(["cand-1"]);
    expect(payload.workers[0].jobRows[0].dailyHours).toEqual([
      { workDate: "2026-09-07", quantity: 8 },
    ]);
    // Real dates, not day indexes, and no weekly value invented.
    expect(payload.workers[0].jobRows[0].weeklyHours).toBeUndefined();
  });

  it("FE5-11: a successful save uses the existing plain-text success convention", async () => {
    saveWorkingTimesheetDraft.mockResolvedValue({
      workingTimesheetId: "order-a__2026-09-07",
      orderId: "order-a",
      weekStart: "2026-09-07",
      entryMode: "DAILY",
      savedCandidateIds: ["cand-1"],
      skippedEmptyCandidateIds: [],
    });

    await renderDetail();
    fireEvent.change(dayInput(0, 0), { target: { value: "8" } });
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(screen.getByText(/Draft saved/)).toBeTruthy());
    expect(screen.getByText(/1 worker\(s\)/)).toBeTruthy();
  });

  it("FE5-10: a failed save never displays success", async () => {
    saveWorkingTimesheetDraft.mockRejectedValue(new Error("Backend refused the draft"));

    await renderDetail();
    fireEvent.change(dayInput(0, 0), { target: { value: "8" } });
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(screen.getByText("Backend refused the draft")).toBeTruthy());
    // The decisive assertion: no success message anywhere.
    expect(screen.queryByText(/Draft saved/)).toBeNull();
  });

  it("FE5-10b: a later success clears the earlier failure message", async () => {
    saveWorkingTimesheetDraft.mockRejectedValueOnce(new Error("Transient failure"));
    saveWorkingTimesheetDraft.mockResolvedValue({
      workingTimesheetId: "order-a__2026-09-07",
      orderId: "order-a",
      weekStart: "2026-09-07",
      entryMode: "DAILY",
      savedCandidateIds: ["cand-1"],
      skippedEmptyCandidateIds: [],
    });

    await renderDetail();
    fireEvent.change(dayInput(0, 0), { target: { value: "8" } });

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(screen.getByText("Transient failure")).toBeTruthy());

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(screen.getByText(/Draft saved/)).toBeTruthy());
    expect(screen.queryByText("Transient failure")).toBeNull();
  });

  it("sends WEEKLY mode with no fabricated Daily facts", async () => {
    saveWorkingTimesheetDraft.mockResolvedValue({
      workingTimesheetId: "order-a__2026-09-07",
      orderId: "order-a",
      weekStart: "2026-09-07",
      entryMode: "WEEKLY",
      savedCandidateIds: ["cand-1"],
      skippedEmptyCandidateIds: [],
    });

    await renderDetail();
    // Enter Daily hours FIRST, then switch to Weekly. The daily state still exists in memory.
    fireEvent.change(dayInput(0, 0), { target: { value: "8" } });
    fireEvent.click(screen.getByText("Weekly Totals"));
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalledTimes(1));
    const payload = saveWorkingTimesheetDraft.mock.calls[0][1];
    expect(payload.entryMode).toBe("WEEKLY");
    // John's persisted weekly total (40) is sent; the in-memory daily state is NOT.
    expect(payload.workers[0].jobRows[0].weeklyHours).toBe(40);
    expect(payload.workers[0].jobRows[0].dailyHours).toBeUndefined();
  });

  it("FE5-12: wiring Save Draft changed no layout, label or control", async () => {
    await renderDetail();

    // Header, columns, controls, item sections and footer actions are all still present and
    // named exactly as before.
    for (const label of [
      "Job Site",
      "Customer",
      "Week Ending",
      "Daily",
      "Weekly Totals",
      "Save Draft",
      "Generate Snapshot",
      "Mark Ready for Approvals",
      "← Back to Time Entry",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // Exact existing labels, including "+ Add Item" for billable items.
    for (const label of ["+ Add Job", "+ Add Item", "+ Add Non-Billable Item"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // No status text is shown before a save is attempted.
    expect(screen.queryByText(/Draft saved/)).toBeNull();
    expect(screen.queryByText(/Saving draft/)).toBeNull();
  });
});

/**
 * TE-S2B6 - a saved draft reopens onto the approved screen.
 *
 * These drive the real page, so they prove the hydration actually reaches the controls the
 * operator sees, and that Save Draft still works afterwards.
 */
describe("reopen hydration through the Working Timesheet", () => {
  /** A saved WEEKLY draft: 52 hours, 4 DT, PD 3.5, SD on, and both item paths. */
  const HYDRATED = {
    ...DETAIL,
    entryMode: "WEEKLY" as const,
    workers: [
      {
        ...DETAIL.workers[0],
        draftState: {
          hoursEntryId: "h1",
          totalHours: 52,
          sdEligible: true,
          jobRows: [
            {
              jobRowIndex: 0,
              projectRef: "order-a",
              dailyHours: [],
              weeklyHours: 52,
              weeklyOtAllocation: null,
              dailyDt: [],
              weeklyDt: 4,
              sdDates: [],
              perDiemDays: 3.5,
            },
          ],
          items: [
            {
              billability: "BILLABLE" as const,
              itemType: "REIMBURSEMENT",
              unit: "DOLLARS" as const,
              value: 450,
              note: "Drug testing",
              sortOrder: 0,
            },
            {
              billability: "NON_BILLABLE" as const,
              itemType: "PER_DIEM",
              unit: "DAYS" as const,
              value: 2,
              note: null,
              sortOrder: 0,
            },
          ],
          classifications: [],
        },
      },
      DETAIL.workers[1], // Sarah: no draft at all
    ],
  };

  async function renderHydrated() {
    fetchWorkingTimesheetDetail.mockResolvedValue(HYDRATED);
    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());
  }

  it("reopens in the saved WEEKLY mode with the saved facts on screen", async () => {
    await renderHydrated();

    // The saved mode was restored, so the weekly total input exists and holds 52.
    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map((i) => i.value);
    expect(values).toContain("52");
    // The governed classification is recomputed by GOLD from the restored facts:
    // 40 REG + 8 OT + 4 DT = 52, with DT carved out of OT rather than added.
    expect(screen.getByText("Employee Weekly: REG 40 | OT 8 | DT 4 | Total 52")).toBeTruthy();
  });

  it("restores SD eligibility, billable PD and both item paths", async () => {
    await renderHydrated();

    // SD eligibility is ON for John and untouched for Sarah.
    expect(screen.getAllByText("Shift Diff ON")).toHaveLength(1);
    expect(screen.getAllByText("Shift Diff OFF")).toHaveLength(1);

    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map((i) => i.value);
    expect(values).toContain("3.5"); // billable JobRow PD
    expect(values).toContain("4"); // weekly DT designation
    expect(values).toContain("450"); // billable monetary item
    expect(values).toContain("2"); // payroll-only Per Diem, in DAYS

    // The two Per Diem facts stayed separate: neither became 5.5.
    expect(values).not.toContain("5.5");
    // The item note is restored into its own input, so it is a textbox value not page text.
    expect(values).toContain("Drug testing");
  });

  it("FE6-18 at page level: the roster worker with no draft stays present and blank", async () => {
    await renderHydrated();
    expect(screen.getByText("Sarah Chen")).toBeTruthy();
    expect(screen.getByText("Employee Weekly: REG 0 | OT 0 | DT 0 | Total 0")).toBeTruthy();
  });

  it("FE6-23: Save Draft remains wired and resaves the hydrated facts", async () => {
    saveWorkingTimesheetDraft.mockResolvedValue({
      workingTimesheetId: "order-a__2026-09-07",
      orderId: "order-a",
      weekStart: "2026-09-07",
      entryMode: "WEEKLY",
      savedCandidateIds: ["cand-1"],
      skippedEmptyCandidateIds: [],
    });

    await renderHydrated();
    const saveDraft = screen.getByText("Save Draft").closest("button")!;
    expect(saveDraft.hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalledTimes(1));

    // Round trip with no edits: the same business facts go back out.
    const payload = saveWorkingTimesheetDraft.mock.calls[0][1];
    expect(payload.entryMode).toBe("WEEKLY");
    expect(payload.workers.map((w: any) => w.candidateId)).toEqual(["cand-1"]);
    const row = payload.workers[0].jobRows[0];
    expect(row.weeklyHours).toBe(52);
    expect(row.weeklyDt).toBe(4);
    expect(row.perDiemDays).toBe(3.5);
    expect(row.dailyHours).toBeUndefined(); // nothing fabricated
    expect(payload.workers[0].sdEligible).toBe(true);
    expect(payload.workers[0].items).toHaveLength(2);

    await waitFor(() => expect(screen.getByText(/Draft saved/)).toBeTruthy());
  });

  it("FE6-24: hydration changed no layout, label or control", async () => {
    await renderHydrated();

    for (const label of [
      "Job Site",
      "Customer",
      "Week Ending",
      "Daily",
      "Weekly Totals",
      "Save Draft",
      "Generate Snapshot",
      "Mark Ready for Approvals",
      "← Back to Time Entry",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    for (const label of ["+ Add Job", "+ Add Item", "+ Add Non-Billable Item"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // The approval boundary is still closed.
    for (const label of ["Generate Snapshot"]) {
      expect(screen.getByText(label).closest("button")!.hasAttribute("disabled")).toBe(true);
    }
  });
});
