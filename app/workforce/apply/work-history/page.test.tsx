import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  WorkHistoryEntryInput,
  WorkHistoryEntryView,
  WorkHistoryStageView,
} from "@/lib/workforce/workforceApi";
import { saveWorkerSession } from "@/lib/workforce/workerSession";
import WorkHistoryPage from "./page";

/**
 * C4D browser validation found that a finished employer form did nothing on Save & Continue
 * until the worker discovered a second button. These tests hold the fixed behaviour: filling
 * the form in IS entering the employer, and Save & Continue commits it.
 */

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
}));

vi.mock("@/lib/workforce/workforceApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/workforce/workforceApi")>();
  return {
    ...actual,
    getWorkHistoryTrades: vi.fn(),
    getWorkHistory: vi.fn(),
    setEmploymentDeclaration: vi.fn(),
    addWorkHistoryEntry: vi.fn(),
    updateWorkHistoryEntry: vi.fn(),
    removeWorkHistoryEntry: vi.fn(),
    syncStageCursor: vi.fn(),
  };
});

const api = await import("@/lib/workforce/workforceApi");
const getWorkHistoryTrades = vi.mocked(api.getWorkHistoryTrades);
const getWorkHistory = vi.mocked(api.getWorkHistory);
const addWorkHistoryEntry = vi.mocked(api.addWorkHistoryEntry);
const updateWorkHistoryEntry = vi.mocked(api.updateWorkHistoryEntry);

const HIRING_QUESTION = "How were you hired for this position?";

function entryView(overrides: Partial<WorkHistoryEntryView> = {}): WorkHistoryEntryView {
  return {
    id: "e-1",
    employerName: "Acme Construction LLC",
    jobTitle: "Journeyman Electrician",
    primaryTradeId: "trade_electrician",
    primaryTradeName: "Electrician",
    startDate: "2018-03-01",
    endDate: "2020-06-30",
    currentlyEmployed: false,
    city: "Tulsa",
    state: "OK",
    supervisorName: null,
    supervisorPhone: null,
    description: "Commercial electrical installation.",
    reasonForLeaving: null,
    hiringMethod: "DIRECT_HIRE",
    ...overrides,
  };
}

function stage(entries: WorkHistoryEntryView[]): WorkHistoryStageView {
  return { hasPreviousEmployment: true, entries };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), {
    target: { value },
  });
}

/** Fill in every required field of the open employer form. */
function fillForm(options: { hiringMethod?: string } = {}) {
  type("Employer", "Acme Construction LLC");
  type("Job title", "Journeyman Electrician");
  type("Trade performed", "trade_electrician");
  type("Start date", "2018-03-01");
  type("End date", "2020-06-30");
  type("City", "Tulsa");
  type("State", "OK");
  type("What work did you do?", "Commercial electrical installation.");

  const method = options.hiringMethod ?? "Hired directly by the company";
  if (method) fireEvent.click(screen.getByLabelText(method, { exact: false }));
}

function continueButton() {
  return screen.getByRole("button", { name: "Save & Continue" });
}

async function openBlankForm() {
  render(<WorkHistoryPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Add a company" }));
  await screen.findByText(HIRING_QUESTION);
}

describe("Work History: Save & Continue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    saveWorkerSession({
      token: "token",
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      applicationSessionId: "apps_durable",
      candidateId: null,
    });
    getWorkHistoryTrades.mockResolvedValue([
      { id: "trade_electrician", name: "Electrician" },
    ]);
    getWorkHistory.mockResolvedValue(stage([]));
  });

  afterEach(cleanup);

  it("commits the employer on screen without the worker pressing anything else first", async () => {
    addWorkHistoryEntry.mockResolvedValue(stage([entryView()]));
    await openBlankForm();
    fillForm();

    fireEvent.click(continueButton());

    await waitFor(() => expect(addWorkHistoryEntry).toHaveBeenCalledTimes(1));
    const input = addWorkHistoryEntry.mock.calls[0][0] as WorkHistoryEntryInput;
    expect(input.employerName).toBe("Acme Construction LLC");
    expect(input.jobTitle).toBe("Journeyman Electrician");
    expect(input.hiringMethod).toBe("DIRECT_HIRE");
  });

  it("advances to the next step once the employer is committed", async () => {
    addWorkHistoryEntry.mockResolvedValue(stage([entryView()]));
    await openBlankForm();
    fillForm();

    fireEvent.click(continueButton());

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it("stays on the page and names the missing fields", async () => {
    await openBlankForm();
    // Only the employer is filled in; everything else is left blank.
    const employer = screen.getByLabelText("Employer", {
      exact: false,
    }) as HTMLInputElement;
    employer.value = "Acme Construction LLC";
    employer.dispatchEvent(new Event("input", { bubbles: true }));

    fireEvent.click(continueButton());

    expect(
      await screen.findByText("Please finish this job before continuing."),
    ).toBeTruthy();
    expect(screen.getByText("Job title is required")).toBeTruthy();
    expect(screen.getByText(`${HIRING_QUESTION} is required`)).toBeTruthy();
    expect(addWorkHistoryEntry).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    // The form is still there with what the worker typed.
    expect(screen.getByText(HIRING_QUESTION)).toBeTruthy();
  });

  it("marks the fields that still need an answer", async () => {
    await openBlankForm();

    fireEvent.click(continueButton());

    await screen.findByText("Please finish this job before continuing.");
    expect(
      screen.getByLabelText("Job title", { exact: false }).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      screen.getByRole("radiogroup", { name: HIRING_QUESTION }).getAttribute("aria-invalid"),
    ).toBe("true");
    // A field the worker is not required to fill in is not marked.
    expect(
      screen
        .getByLabelText("Supervisor name", { exact: false })
        .getAttribute("aria-invalid"),
    ).not.toBe("true");
  });

  it("requires the hiring method before the employer can be saved", async () => {
    await openBlankForm();
    fillForm({ hiringMethod: "" });

    fireEvent.click(continueButton());

    expect(
      await screen.findByText(`${HIRING_QUESTION} is required`),
    ).toBeTruthy();
    expect(addWorkHistoryEntry).not.toHaveBeenCalled();
  });

  it("commits a second employer entered after Add another company", async () => {
    const first = entryView();
    addWorkHistoryEntry.mockResolvedValueOnce(stage([first]));
    await openBlankForm();
    fillForm();

    // Employer #1 committed deliberately, which reopens a blank form for employer #2.
    fireEvent.click(screen.getByRole("button", { name: "Add another company" }));
    await waitFor(() => expect(addWorkHistoryEntry).toHaveBeenCalledTimes(1));

    const second = entryView({
      id: "e-2",
      employerName: "Bedrock Mechanical",
      hiringMethod: "STAFFING_AGENCY",
    });
    addWorkHistoryEntry.mockResolvedValueOnce(stage([first, second]));
    fillForm({ hiringMethod: "Through a staffing agency" });

    // Employer #2 needs no second press: Save & Continue commits it.
    fireEvent.click(continueButton());

    await waitFor(() => expect(addWorkHistoryEntry).toHaveBeenCalledTimes(2));
    const input = addWorkHistoryEntry.mock.calls[1][0] as WorkHistoryEntryInput;
    expect(input.hiringMethod).toBe("STAFFING_AGENCY");
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it("commits an edit in progress rather than discarding it", async () => {
    getWorkHistory.mockResolvedValue(stage([entryView()]));
    updateWorkHistoryEntry.mockResolvedValue(
      stage([entryView({ hiringMethod: "UNION_HIRING_HALL" })]),
    );

    render(<WorkHistoryPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByText(HIRING_QUESTION);
    fireEvent.click(screen.getByLabelText("Through a union hiring hall", { exact: false }));

    fireEvent.click(continueButton());

    await waitFor(() => expect(updateWorkHistoryEntry).toHaveBeenCalledTimes(1));
    expect(updateWorkHistoryEntry.mock.calls[0][0]).toBe("e-1");
    const input = updateWorkHistoryEntry.mock.calls[0][1] as WorkHistoryEntryInput;
    expect(input.hiringMethod).toBe("UNION_HIRING_HALL");
  });

  it("continues without touching the collection when nothing is being edited", async () => {
    getWorkHistory.mockResolvedValue(stage([entryView()]));

    render(<WorkHistoryPage />);
    await screen.findByText("Journeyman Electrician · Acme Construction LLC");

    fireEvent.click(continueButton());

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(addWorkHistoryEntry).not.toHaveBeenCalled();
    expect(updateWorkHistoryEntry).not.toHaveBeenCalled();
  });
});
