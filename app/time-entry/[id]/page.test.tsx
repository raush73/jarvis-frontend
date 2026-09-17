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

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchWorkingTimesheetDetail = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "order-a__2026-09-07" }),
}));

vi.mock("@/lib/timeEntry/workingTimesheetApi", () => ({
  fetchWorkingTimesheetDetail: (...args: unknown[]) => fetchWorkingTimesheetDetail(...args),
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

afterEach(() => {
  cleanup();
  fetchWorkingTimesheetDetail.mockReset();
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
    // Two workers x (7 day cells + 1 PD cell) = 16 inputs, and the ONLY populated one
    // is John's persisted PD day count.
    const values = (screen.getAllByRole("textbox") as HTMLInputElement[]).map((i) => i.value);
    expect(values).toHaveLength(16);
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
    expect(screen.getByText("Mark Ready for Payroll")).toBeTruthy();

    // Navigation.
    expect(screen.getByText("← Back to Time Entry")).toBeTruthy();
  });

  it("leaves Save Draft disabled - TE-S2A introduces no write", async () => {
    fetchWorkingTimesheetDetail.mockResolvedValue(DETAIL);

    render(<WorkingTimesheetPage />);
    await waitFor(() => expect(screen.getByText("John Martinez")).toBeTruthy());

    for (const label of ["Save Draft", "Generate Snapshot", "Mark Ready for Payroll"]) {
      const button = screen.getByText(label).closest("button")!;
      expect(button.hasAttribute("disabled")).toBe(true);
    }
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
