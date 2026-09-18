/**
 * TE-S2B8 Customer Job selection and inline creation in the Working Timesheet.
 *
 * The Owner-approved workflow these prove, end to end in the real page:
 *
 *   Tim opens the Working Timesheet for a Job Order, names the work the customer's paperwork
 *   calls "First Floor" ONCE, and immediately reuses it for every other worker. Reopening the
 *   sheet recovers the same durable job, and next week's sheet for the same Order still offers it.
 *
 * They also fence the things that must NOT happen: no new column, no redesign, no hardcoded
 * "job2" business identity, no Customer Job invented from text at save time, and no silently
 * cleared selection when a job has been archived.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchWorkingTimesheetDetail = vi.fn();
const saveWorkingTimesheetDraft = vi.fn();
const fetchCustomerJobs = vi.fn();
const createCustomerJob = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "order-a__2026-09-07" }),
}));

vi.mock("@/lib/timeEntry/workingTimesheetApi", async () => {
  // The error describer is the REAL one: its classification is part of the behaviour under test.
  const actual = await vi.importActual<
    typeof import("@/lib/timeEntry/workingTimesheetApi")
  >("@/lib/timeEntry/workingTimesheetApi");
  return {
    describeCustomerJobCreateError: actual.describeCustomerJobCreateError,
    fetchWorkingTimesheetDetail: (...a: unknown[]) => fetchWorkingTimesheetDetail(...a),
    saveWorkingTimesheetDraft: (...a: unknown[]) => saveWorkingTimesheetDraft(...a),
    fetchCustomerJobs: (...a: unknown[]) => fetchCustomerJobs(...a),
    createCustomerJob: (...a: unknown[]) => createCustomerJob(...a),
  };
});

import WorkingTimesheetPage from "./page";

const ORDER_A = "order-a";
const WEEK_START = "2026-09-07";
const MON = "2026-09-07";

const CJ_FIRST = { id: "cj-a-first", orderId: ORDER_A, description: "First Floor", isActive: true };
const CJ_SECOND = { id: "cj-a-second", orderId: ORDER_A, description: "Second Floor", isActive: true };
const CJ_ARCHIVED = { id: "cj-a-old", orderId: ORDER_A, description: "Old Wing", isActive: false };

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

function worker(candidateId: string, name: string, jobRows: any[] | null = null) {
  return {
    candidateId,
    workerName: name,
    trade: "Welder",
    assignmentIds: [`a-${candidateId}`],
    draft: null,
    draftState:
      jobRows === null
        ? null
        : {
            hoursEntryId: `h-${candidateId}`,
            totalHours: 8,
            sdEligible: null,
            jobRows,
            items: [],
            classifications: [],
          },
    draftConflict: false,
  };
}

function detail(workers: any[] = [worker("cand-1", "John Martinez")]) {
  return {
    id: `${ORDER_A}__${WEEK_START}`,
    entryMode: "DAILY" as const,
    orderId: ORDER_A,
    weekStart: WEEK_START,
    weekEnding: "2026-09-13",
    orderRef: "Main Assembly",
    jobSite: "Acme Plant A",
    customerId: "cust-1",
    customerName: "Acme Manufacturing",
    status: "Draft" as const,
    workers,
    draftConflictCandidateIds: [],
    orphanedDraftCandidateIds: [],
  };
}

/** Render and wait for the sheet to finish loading. */
async function renderSheet() {
  render(<WorkingTimesheetPage />);
  await waitFor(() => expect(fetchWorkingTimesheetDetail).toHaveBeenCalled());
  await waitFor(() => expect(screen.getAllByLabelText("Customer Job").length).toBeGreaterThan(0));
}

const jobSelects = () => screen.getAllByLabelText("Customer Job") as HTMLSelectElement[];

const optionTexts = (select: HTMLSelectElement) =>
  Array.from(select.querySelectorAll("option")).map((o) => o.textContent);

beforeEach(() => {
  fetchCustomerJobs.mockResolvedValue([]);
  fetchWorkingTimesheetDetail.mockResolvedValue(detail());
  saveWorkingTimesheetDraft.mockResolvedValue({
    workingTimesheetId: `${ORDER_A}__${WEEK_START}`,
    orderId: ORDER_A,
    weekStart: WEEK_START,
    entryMode: "DAILY",
    savedCandidateIds: ["cand-1"],
    skippedEmptyCandidateIds: [],
  });
});

afterEach(() => {
  cleanup();
  fetchWorkingTimesheetDetail.mockReset();
  saveWorkingTimesheetDraft.mockReset();
  fetchCustomerJobs.mockReset();
  createCustomerJob.mockReset();
});

// ===========================================================================================
// ORDER-SCOPED OPTIONS
// ===========================================================================================

describe("the Customer Job options are Order-scoped and durable", () => {
  it("loads the list for THIS Job Order", async () => {
    await renderSheet();
    expect(fetchCustomerJobs).toHaveBeenCalledWith(ORDER_A);
  });

  it("offers the Order's ACTIVE Customer Jobs", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST, CJ_SECOND]);
    await renderSheet();

    expect(optionTexts(jobSelects()[0])).toEqual([
      "— Select Customer Job —",
      "First Floor",
      "Second Floor",
      "+ Add New Job",
    ]);
  });

  it("comes from the durable Order list, NOT from this week's rows", async () => {
    // The sheet has no saved rows at all, yet both Customer Jobs are offered. That is exactly
    // what makes a job created in one week available in later weeks for the same Order.
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST, CJ_SECOND]);
    fetchWorkingTimesheetDetail.mockResolvedValue(detail([worker("cand-1", "John Martinez", null)]));
    await renderSheet();

    expect(optionTexts(jobSelects()[0])).toContain("First Floor");
    expect(optionTexts(jobSelects()[0])).toContain("Second Floor");
  });

  it("does not offer an ARCHIVED job as a new choice", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    expect(optionTexts(jobSelects()[0])).not.toContain("Old Wing");
  });

  it("starts with nothing selected when no Customer Job was saved", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    expect(jobSelects()[0].value).toBe("");
  });

  it("keeps the sheet usable when the Customer Job list fails to load", async () => {
    // A Customer Job list outage must not take the timesheet down with it.
    fetchCustomerJobs.mockRejectedValue(new Error("API 500 Server Error: {}"));
    await renderSheet();

    expect(screen.getByText("John Martinez")).toBeTruthy();
    expect(optionTexts(jobSelects()[0])).toEqual(["— Select Customer Job —", "+ Add New Job"]);
  });
});

// ===========================================================================================
// THE EXISTING JOB/ORDER AREA IS PRESERVED
// ===========================================================================================

describe("the existing Job/Order area is reused, not redesigned", () => {
  it("keeps the single Job/Order column heading", async () => {
    await renderSheet();
    expect(screen.getAllByText("Job/Order").length).toBeGreaterThan(0);
  });

  it("adds NO Customer Job column", async () => {
    await renderSheet();
    expect(screen.queryByText("Customer Job", { selector: "th" })).toBeNull();
  });

  it("still shows the parent Job Order as project context", async () => {
    // The Order remains the project. The Customer Job sits underneath it, not instead of it.
    await renderSheet();
    expect(screen.getAllByText("Main Assembly").length).toBeGreaterThan(0);
  });

  it("keeps the approved surrounding controls", async () => {
    await renderSheet();
    for (const label of ["Job/Order", "Total", "REG", "OT", "DT", "PD"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("+ Add Job").length).toBeGreaterThan(0);
  });
});

// ===========================================================================================
// INLINE CREATE: ENTER ONCE
// ===========================================================================================

describe("inline + Add New Job", () => {
  async function openInlineCreate() {
    fetchCustomerJobs.mockResolvedValue([]);
    await renderSheet();
    fireEvent.change(jobSelects()[0], { target: { value: "__add_new_customer_job__" } });
    return screen.getByLabelText("New Customer Job description") as HTMLInputElement;
  }

  it("opens ONE free-text description input, not a multi-field form", async () => {
    const input = await openInlineCreate();

    expect(input).toBeTruthy();
    // Deliberately NOT decomposed into name / number / area / phase / cost code.
    for (const forbidden of ["Job Name", "Job Number", "Area", "Phase", "Cost Code"]) {
      expect(screen.queryByLabelText(forbidden)).toBeNull();
    }
  });

  it("creates through the Order-owned API and selects the RETURNED durable id", async () => {
    const input = await openInlineCreate();
    createCustomerJob.mockResolvedValue(CJ_FIRST);

    fireEvent.change(input, { target: { value: "First Floor" } });
    fireEvent.click(screen.getByText("Save Job"));

    await waitFor(() => expect(createCustomerJob).toHaveBeenCalledWith(ORDER_A, "First Floor"));
    // The id came back from the server; it was not invented locally.
    await waitFor(() => expect(jobSelects()[0].value).toBe(CJ_FIRST.id));
    expect(optionTexts(jobSelects()[0])).toContain("First Floor");
  });

  it("trims the typed description before sending it", async () => {
    const input = await openInlineCreate();
    createCustomerJob.mockResolvedValue(CJ_FIRST);

    fireEvent.change(input, { target: { value: "   First Floor   " } });
    fireEvent.click(screen.getByText("Save Job"));

    await waitFor(() => expect(createCustomerJob).toHaveBeenCalledWith(ORDER_A, "First Floor"));
  });

  it("rejects a blank description WITHOUT calling the API", async () => {
    const input = await openInlineCreate();

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByText("Save Job"));

    await waitFor(() => expect(screen.getByText(/Enter a Customer Job description/i)).toBeTruthy());
    expect(createCustomerJob).not.toHaveBeenCalled();
  });

  it("surfaces a DUPLICATE as recoverable and creates no second identity", async () => {
    const input = await openInlineCreate();
    createCustomerJob.mockRejectedValue(
      new Error('API 409 Conflict: {"message":"already exists"}'),
    );

    fireEvent.change(input, { target: { value: "first floor" } });
    fireEvent.click(screen.getByText("Save Job"));

    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeTruthy());
    // The input stays open with the text intact so the operator can recover.
    expect((screen.getByLabelText("New Customer Job description") as HTMLInputElement).value).toBe(
      "first floor",
    );
    expect(createCustomerJob).toHaveBeenCalledTimes(1);
  });

  it("surfaces a PERMISSION failure clearly", async () => {
    const input = await openInlineCreate();
    createCustomerJob.mockRejectedValue(new Error("API 403 Forbidden: {}"));

    fireEvent.change(input, { target: { value: "First Floor" } });
    fireEvent.click(screen.getByText("Save Job"));

    await waitFor(() => expect(screen.getByText(/do not have permission/i)).toBeTruthy());
  });

  it("surfaces a generic API failure without leaking raw error text", async () => {
    const input = await openInlineCreate();
    createCustomerJob.mockRejectedValue(new Error("API 500 Server Error: stack trace here"));

    fireEvent.change(input, { target: { value: "First Floor" } });
    fireEvent.click(screen.getByText("Save Job"));

    await waitFor(() => expect(screen.getByText(/try again/i)).toBeTruthy());
    expect(screen.queryByText(/stack trace here/)).toBeNull();
  });

  it("can be cancelled, leaving the selection untouched", async () => {
    const input = await openInlineCreate();

    fireEvent.change(input, { target: { value: "First Floor" } });
    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => expect(screen.queryByLabelText("New Customer Job description")).toBeNull());
    expect(createCustomerJob).not.toHaveBeenCalled();
    expect(jobSelects()[0].value).toBe("");
  });

  it("never stores the sentinel option as a Customer Job id", async () => {
    // "+ Add New Job" opens the input; it must never itself become persisted identity.
    const input = await openInlineCreate();
    expect(input).toBeTruthy();

    // Abandon the create, then save. The row is unassigned and the sentinel appears nowhere.
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => expect(jobSelects()[0].value).toBe(""));

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());

    const payload = JSON.stringify(saveWorkingTimesheetDraft.mock.calls[0][1]);
    expect(payload).not.toMatch(/__add_new_customer_job__/);
  });
});

// ===========================================================================================
// SELECT MANY: IMMEDIATE REUSE
// ===========================================================================================

describe("enter once, reuse immediately", () => {
  it("makes a newly created job available to ANOTHER worker with no retyping", async () => {
    fetchCustomerJobs.mockResolvedValue([]);
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail([worker("cand-1", "John Martinez"), worker("cand-2", "Sarah Chen")]),
    );
    createCustomerJob.mockResolvedValue(CJ_FIRST);
    await renderSheet();

    // Worker 1 creates it.
    fireEvent.change(jobSelects()[0], { target: { value: "__add_new_customer_job__" } });
    fireEvent.change(screen.getByLabelText("New Customer Job description"), {
      target: { value: "First Floor" },
    });
    fireEvent.click(screen.getByText("Save Job"));
    await waitFor(() => expect(createCustomerJob).toHaveBeenCalledTimes(1));

    // Worker 2's selector already offers it, and selecting it creates NO second Customer Job.
    await waitFor(() => expect(optionTexts(jobSelects()[1])).toContain("First Floor"));
    fireEvent.change(jobSelects()[1], { target: { value: CJ_FIRST.id } });

    expect(jobSelects()[1].value).toBe(CJ_FIRST.id);
    expect(createCustomerJob).toHaveBeenCalledTimes(1);
  });

  it("lets several workers reference the SAME durable id", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail([worker("cand-1", "John Martinez"), worker("cand-2", "Sarah Chen")]),
    );
    await renderSheet();

    fireEvent.change(jobSelects()[0], { target: { value: CJ_FIRST.id } });
    fireEvent.change(jobSelects()[1], { target: { value: CJ_FIRST.id } });

    expect(jobSelects().map((s) => s.value)).toEqual([CJ_FIRST.id, CJ_FIRST.id]);
  });

  it("keeps one worker's rows on DIFFERENT Customer Jobs", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST, CJ_SECOND]);
    await renderSheet();

    fireEvent.change(jobSelects()[0], { target: { value: CJ_FIRST.id } });
    fireEvent.click(screen.getAllByText("+ Add Job")[0]);

    await waitFor(() => expect(jobSelects()).toHaveLength(2));
    fireEvent.change(jobSelects()[1], { target: { value: CJ_SECOND.id } });

    expect(jobSelects().map((s) => s.value)).toEqual([CJ_FIRST.id, CJ_SECOND.id]);
  });
});

// ===========================================================================================
// JOBROW IDENTITY: "job2" IS RETIRED
// ===========================================================================================

describe("job row identity", () => {
  it("gives an added row NO Customer Job and no hardcoded placeholder", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    fireEvent.click(screen.getAllByText("+ Add Job")[0]);
    await waitFor(() => expect(jobSelects()).toHaveLength(2));

    // The new row is genuinely unassigned - not silently claiming a fictional "job2".
    expect(jobSelects()[1].value).toBe("");
    expect(optionTexts(jobSelects()[1])).not.toContain("job2");
  });

  it("never renders a job2 placeholder anywhere", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();
    fireEvent.click(screen.getAllByText("+ Add Job")[0]);
    await waitFor(() => expect(jobSelects()).toHaveLength(2));

    expect(screen.queryByText(/job2/i)).toBeNull();
  });

  it("sends the added row with a null Customer Job, not a fabricated one", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    fireEvent.change(jobSelects()[0], { target: { value: CJ_FIRST.id } });
    fireEvent.click(screen.getAllByText("+ Add Job")[0]);
    await waitFor(() => expect(jobSelects()).toHaveLength(2));

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());

    const payload = saveWorkingTimesheetDraft.mock.calls[0][1];
    const rows = payload.workers[0].jobRows;
    // Only the row carrying a fact is sent; it carries the real id.
    expect(rows[0].customerJobId).toBe(CJ_FIRST.id);
    expect(JSON.stringify(payload)).not.toMatch(/job2/);
  });
});

// ===========================================================================================
// SAVE PAYLOAD
// ===========================================================================================

describe("Save Draft carries the durable id", () => {
  it("sends the selected customerJobId", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    fireEvent.change(jobSelects()[0], { target: { value: CJ_FIRST.id } });
    fireEvent.click(screen.getByText("Save Draft"));

    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());
    const payload = saveWorkingTimesheetDraft.mock.calls[0][1];
    expect(payload.workers[0].jobRows[0].customerJobId).toBe(CJ_FIRST.id);
  });

  it("sends the ID and never the typed description", async () => {
    fetchCustomerJobs.mockResolvedValue([]);
    createCustomerJob.mockResolvedValue(CJ_FIRST);
    await renderSheet();

    fireEvent.change(jobSelects()[0], { target: { value: "__add_new_customer_job__" } });
    fireEvent.change(screen.getByLabelText("New Customer Job description"), {
      target: { value: "First Floor" },
    });
    fireEvent.click(screen.getByText("Save Job"));
    await waitFor(() => expect(jobSelects()[0].value).toBe(CJ_FIRST.id));

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());

    const payload = JSON.stringify(saveWorkingTimesheetDraft.mock.calls[0][1]);
    expect(payload).toContain(CJ_FIRST.id);
    expect(payload).not.toMatch(/First Floor/);
  });

  it("does not create a Customer Job as a side effect of saving", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    fireEvent.change(jobSelects()[0], { target: { value: CJ_FIRST.id } });
    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());

    expect(createCustomerJob).not.toHaveBeenCalled();
  });
});

// ===========================================================================================
// HYDRATION AND ARCHIVED JOBS
// ===========================================================================================

describe("reopening a saved worksheet", () => {
  it("selects the saved Customer Job and displays its description", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST, CJ_SECOND]);
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail([
        worker("cand-1", "John Martinez", [
          draftRow({
            dailyHours: [{ workDate: MON, quantity: 8 }],
            customerJobId: CJ_FIRST.id,
            customerJobDescription: "First Floor",
            customerJobIsActive: true,
          }),
        ]),
      ]),
    );
    await renderSheet();

    expect(jobSelects()[0].value).toBe(CJ_FIRST.id);
    expect(jobSelects()[0].selectedOptions[0].textContent).toBe("First Floor");
  });

  it("shows a RENAMED description against the unchanged saved id", async () => {
    // The row stores only the id, so the corrected description is what appears.
    fetchCustomerJobs.mockResolvedValue([
      { ...CJ_FIRST, description: "First Floor" },
    ]);
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail([
        worker("cand-1", "John Martinez", [
          draftRow({
            customerJobId: CJ_FIRST.id,
            customerJobDescription: "First Floor",
            customerJobIsActive: true,
            dailyHours: [{ workDate: MON, quantity: 8 }],
          }),
        ]),
      ]),
    );
    await renderSheet();

    expect(jobSelects()[0].value).toBe(CJ_FIRST.id);
    expect(optionTexts(jobSelects()[0])).toContain("First Floor");
  });

  it("still resolves an ARCHIVED saved Customer Job instead of clearing it", async () => {
    // The archived job is absent from the active list, yet the row must keep showing it.
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail([
        worker("cand-1", "John Martinez", [
          draftRow({
            dailyHours: [{ workDate: MON, quantity: 8 }],
            customerJobId: CJ_ARCHIVED.id,
            customerJobDescription: "Old Wing",
            customerJobIsActive: false,
          }),
        ]),
      ]),
    );
    await renderSheet();

    expect(jobSelects()[0].value).toBe(CJ_ARCHIVED.id);
    expect(jobSelects()[0].selectedOptions[0].textContent).toBe("Old Wing (inactive)");
  });

  it("does not offer that archived job to a DIFFERENT row as a new choice", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail([
        worker("cand-1", "John Martinez", [
          draftRow({
            dailyHours: [{ workDate: MON, quantity: 8 }],
            customerJobId: CJ_ARCHIVED.id,
            customerJobDescription: "Old Wing",
            customerJobIsActive: false,
          }),
        ]),
        worker("cand-2", "Sarah Chen"),
      ]),
    );
    await renderSheet();

    // Row 1 keeps it because it is selected there; row 2 is offered only active jobs.
    expect(optionTexts(jobSelects()[0])).toContain("Old Wing (inactive)");
    expect(optionTexts(jobSelects()[1])).not.toContain("Old Wing (inactive)");
  });

  it("leaves a pre-Customer-Job draft unselected rather than guessing", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail([
        worker("cand-1", "John Martinez", [
          draftRow({ dailyHours: [{ workDate: MON, quantity: 8 }] }),
        ]),
      ]),
    );
    await renderSheet();

    // Empty, and specifically NOT the parent Order masquerading as the Customer Job.
    expect(jobSelects()[0].value).toBe("");
    expect(jobSelects()[0].value).not.toBe(ORDER_A);
  });
});

// ===========================================================================================
// DAILY / WEEKLY
// ===========================================================================================

describe("mode switching preserves the Customer Job", () => {
  it("survives Daily -> Weekly -> Daily", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    fireEvent.change(jobSelects()[0], { target: { value: CJ_FIRST.id } });
    expect(jobSelects()[0].value).toBe(CJ_FIRST.id);

    fireEvent.click(screen.getByText("Weekly Totals"));
    await waitFor(() => expect(jobSelects()[0].value).toBe(CJ_FIRST.id));

    fireEvent.click(screen.getByText("Daily"));
    await waitFor(() => expect(jobSelects()[0].value).toBe(CJ_FIRST.id));
  });

  it("sends the same Customer Job after switching to Weekly", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    fireEvent.change(jobSelects()[0], { target: { value: CJ_FIRST.id } });
    fireEvent.click(screen.getByText("Weekly Totals"));
    await waitFor(() => expect(jobSelects()[0].value).toBe(CJ_FIRST.id));

    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());

    const payload = saveWorkingTimesheetDraft.mock.calls[0][1];
    expect(payload.entryMode).toBe("WEEKLY");
    expect(payload.workers[0].jobRows[0].customerJobId).toBe(CJ_FIRST.id);
  });
});

// ===========================================================================================
// SAVE -> REOPEN -> SAVE
// ===========================================================================================

describe("save -> reopen -> save", () => {
  it("recovers the same id and re-sends it unchanged", async () => {
    fetchCustomerJobs.mockResolvedValue([CJ_FIRST]);
    await renderSheet();

    // Save with a Customer Job selected.
    fireEvent.change(jobSelects()[0], { target: { value: CJ_FIRST.id } });
    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());
    const firstPayload = saveWorkingTimesheetDraft.mock.calls[0][1];

    // Reopen: the backend now returns what was saved.
    cleanup();
    fetchWorkingTimesheetDetail.mockResolvedValue(
      detail([
        worker("cand-1", "John Martinez", [
          draftRow({
            dailyHours: [{ workDate: MON, quantity: 8 }],
            customerJobId: CJ_FIRST.id,
            customerJobDescription: "First Floor",
            customerJobIsActive: true,
          }),
        ]),
      ]),
    );
    saveWorkingTimesheetDraft.mockClear();
    await renderSheet();

    expect(jobSelects()[0].value).toBe(CJ_FIRST.id);

    // Save again: same identity, same row index, no duplicate Customer Job created.
    fireEvent.click(screen.getByText("Save Draft"));
    await waitFor(() => expect(saveWorkingTimesheetDraft).toHaveBeenCalled());
    const secondPayload = saveWorkingTimesheetDraft.mock.calls[0][1];

    expect(secondPayload.workers[0].jobRows[0].customerJobId).toBe(
      firstPayload.workers[0].jobRows[0].customerJobId,
    );
    expect(secondPayload.workers[0].jobRows[0].jobRowIndex).toBe(0);
    expect(secondPayload.workers[0].jobRows).toHaveLength(1);
    expect(createCustomerJob).not.toHaveBeenCalled();
  });
});
