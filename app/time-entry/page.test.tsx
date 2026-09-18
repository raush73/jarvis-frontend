/**
 * TE-S1 - the Working Timesheet Hub renders real Jarvis data.
 *
 * What these prove is that the Owner-approved Hub is now reading real working
 * timesheets, that its presentation is preserved, and that "Open Working Timesheet"
 * navigates to the real deterministic Working Timesheet identity rather than a mock id.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const fetchWorkingTimesheetHub = vi.fn();

vi.mock("@/lib/timeEntry/workingTimesheetApi", () => ({
  fetchWorkingTimesheetHub: (...args: unknown[]) => fetchWorkingTimesheetHub(...args),
}));

import TimeEntryHubPage from "./page";

const HUB = {
  weekStart: "2026-09-07",
  weekEnding: "2026-09-13",
  customerGroups: [
    {
      customerId: "cust-1",
      customerName: "Acme Manufacturing",
      workingTimesheets: [
        {
          id: "order-a__2026-09-07",
          orderId: "order-a",
          orderRef: "Main Assembly",
          customerId: "cust-1",
          customerName: "Acme Manufacturing",
          weekStart: "2026-09-07",
          weekEnding: "2026-09-13",
          workers: 4,
          status: "Draft" as const,
        },
      ],
    },
    {
      customerId: "cust-2",
      customerName: "Summit Industries",
      workingTimesheets: [
        {
          id: "order-b__2026-09-07",
          orderId: "order-b",
          orderRef: "TX-002",
          customerId: "cust-2",
          customerName: "Summit Industries",
          weekStart: "2026-09-07",
          weekEnding: "2026-09-13",
          workers: 11,
          status: "Draft" as const,
        },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
  fetchWorkingTimesheetHub.mockReset();
});

describe("Working Timesheet Hub", () => {
  it("renders real customer groups, order refs, week ending and worker counts", async () => {
    fetchWorkingTimesheetHub.mockResolvedValue(HUB);

    render(<TimeEntryHubPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Manufacturing")).toBeTruthy();
    });

    expect(screen.getByText("Summit Industries")).toBeTruthy();
    expect(screen.getByText("Main Assembly")).toBeTruthy();
    expect(screen.getByText("TX-002")).toBeTruthy();
    expect(screen.getAllByText("Week Ending: 2026-09-13")).toHaveLength(2);
    expect(screen.getByText("4 workers")).toBeTruthy();
    expect(screen.getByText("11 workers")).toBeTruthy();
  });

  it("navigates to the real deterministic Working Timesheet identity", async () => {
    fetchWorkingTimesheetHub.mockResolvedValue(HUB);

    render(<TimeEntryHubPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Open Working Timesheet")).toHaveLength(2);
    });

    const links = screen.getAllByText("Open Working Timesheet");
    expect(links[0].getAttribute("href")).toBe("/time-entry/order-a__2026-09-07");
    expect(links[1].getAttribute("href")).toBe("/time-entry/order-b__2026-09-07");
  });

  it("asks the backend for the most recently completed crew-week", async () => {
    fetchWorkingTimesheetHub.mockResolvedValue(HUB);

    render(<TimeEntryHubPage />);

    await waitFor(() => expect(fetchWorkingTimesheetHub).toHaveBeenCalledTimes(1));
    // No weekStart is supplied, so the backend resolves the completed week.
    expect(fetchWorkingTimesheetHub).toHaveBeenCalledWith();
  });

  it("preserves the Owner-approved header, subtitle and full status legend", async () => {
    fetchWorkingTimesheetHub.mockResolvedValue(HUB);

    render(<TimeEntryHubPage />);
    await waitFor(() => expect(screen.getByText("Main Assembly")).toBeTruthy());

    expect(screen.getByText("Time Entry")).toBeTruthy();
    expect(
      screen.getByText("Internal MW4H hub of open working timesheets — grouped by customer."),
    ).toBeTruthy();

    // The legend is preserved in full even though later states are not yet reachable.
    expect(screen.getByText("Status Legend")).toBeTruthy();
    expect(screen.getByText("Submitted")).toBeTruthy();
    expect(screen.getByText("Needs Customer")).toBeTruthy();
    expect(screen.getByText("Ready to Snapshot")).toBeTruthy();
    // TE-S3 added the one state beyond Draft that is real today, without removing the placeholders.
    expect(screen.getByText("Ready for Approvals")).toBeTruthy();
  });

  // =========================================================================================
  // TE-S3 the Hub displays readiness but is never the approval console.
  // =========================================================================================

  it("displays Ready for Approvals when the backend reports it", async () => {
    fetchWorkingTimesheetHub.mockResolvedValue({
      ...HUB,
      customerGroups: [
        {
          ...HUB.customerGroups[0],
          workingTimesheets: [
            { ...HUB.customerGroups[0].workingTimesheets[0], status: "Ready for Approvals" },
          ],
        },
      ],
    });

    render(<TimeEntryHubPage />);
    await waitFor(() => expect(screen.getByText("Main Assembly")).toBeTruthy());

    // Twice: once in the legend, once as this sheet's badge.
    expect(screen.getAllByText("Ready for Approvals").length).toBeGreaterThanOrEqual(2);
  });

  it("still shows Draft for a sheet the backend reports as Draft", async () => {
    fetchWorkingTimesheetHub.mockResolvedValue(HUB);

    render(<TimeEntryHubPage />);
    await waitFor(() => expect(screen.getByText("Main Assembly")).toBeTruthy());

    expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(2);
  });

  it("is NOT the approval console: it offers no approval action of any kind", async () => {
    // Owner ruling: the person approving must open the actual Working Timesheet and review it. The Hub
    // may show the status and nothing more, so there is deliberately no one-click path from here.
    fetchWorkingTimesheetHub.mockResolvedValue({
      ...HUB,
      customerGroups: [
        {
          ...HUB.customerGroups[0],
          workingTimesheets: [
            { ...HUB.customerGroups[0].workingTimesheets[0], status: "Ready for Approvals" },
          ],
        },
      ],
    });

    render(<TimeEntryHubPage />);
    await waitFor(() => expect(screen.getByText("Main Assembly")).toBeTruthy());

    // Asserted against INTERACTIVE CONTROLS, not against any occurrence of the words. The approved
    // legend legitimately describes future states in prose - "Submitted for customer review" is one of
    // its own descriptions - and the rule is about what an operator can CLICK here, not what the page
    // is allowed to say.
    expect(screen.queryAllByRole("button")).toHaveLength(0);

    const actionable = [
      ...screen.queryAllByRole("button"),
      ...screen.queryAllByRole("link"),
    ].map((el) => el.textContent ?? '');

    for (const forbidden of [
      /Mark Ready/i,
      /Approval/i,
      /Approve/i,
      /Generate Snapshot/i,
      /Customer Review/i,
      /Immutable/i,
      /Payroll/i,
      /Invoice/i,
    ]) {
      expect(actionable.filter((text) => forbidden.test(text))).toHaveLength(0);
    }

    // The only way in remains opening the working timesheet itself.
    expect(screen.getAllByText(/Open Working Timesheet/i).length).toBeGreaterThan(0);
  });

  it("shows the empty state when the completed week produced no working timesheets", async () => {
    fetchWorkingTimesheetHub.mockResolvedValue({
      weekStart: "2026-09-07",
      weekEnding: "2026-09-13",
      customerGroups: [],
    });

    render(<TimeEntryHubPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No open working timesheets for the completed week."),
      ).toBeTruthy();
    });

    expect(screen.queryByText("Open Working Timesheet")).toBeNull();
  });

  it("surfaces a load failure instead of showing an empty hub", async () => {
    fetchWorkingTimesheetHub.mockRejectedValue(new Error("API 403 Forbidden"));

    render(<TimeEntryHubPage />);

    await waitFor(() => {
      expect(screen.getByText("API 403 Forbidden")).toBeTruthy();
    });

    expect(screen.queryByText("Open Working Timesheet")).toBeNull();
  });
});
