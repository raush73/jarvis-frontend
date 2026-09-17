/**
 * TE-S1 - the Working Timesheet Hub transport contract.
 *
 * What these prove is the seam, not the surface:
 *
 *  - The Hub asks the backend for working timesheets and carries the staff credential,
 *    so the Hub is reading real Jarvis data rather than local mock data.
 *  - A requested crew-week is passed through as `weekStart`, and omitting it lets the
 *    backend resolve the most recently completed week.
 *  - The customer-grouping shape the existing Hub renders survives transport intact,
 *    including the deterministic Working Timesheet id used as the navigation target.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE } from "@/lib/api";
import { fetchWorkingTimesheetHub } from "./workingTimesheetApi";

const TOKEN_KEY = "jp_accessToken";

const HUB_BODY = {
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
          status: "Draft",
        },
      ],
    },
  ],
};

function respondWith(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    statusText: status === 200 ? "OK" : "Error",
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response);
}

beforeEach(() => {
  window.localStorage.setItem(TOKEN_KEY, "staff-token");
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchWorkingTimesheetHub", () => {
  it("requests the working timesheets and carries the staff credential", async () => {
    const fetchMock = respondWith(200, HUB_BODY);
    vi.stubGlobal("fetch", fetchMock);

    await fetchWorkingTimesheetHub();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/time-entry/working-timesheets`);

    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("Authorization")).toBe("Bearer staff-token");
  });

  it("passes a requested crew-week through as weekStart", async () => {
    const fetchMock = respondWith(200, HUB_BODY);
    vi.stubGlobal("fetch", fetchMock);

    await fetchWorkingTimesheetHub("2026-09-07");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/time-entry/working-timesheets?weekStart=2026-09-07`);
  });

  it("returns the customer grouping shape the existing Hub renders", async () => {
    vi.stubGlobal("fetch", respondWith(200, HUB_BODY));

    const hub = await fetchWorkingTimesheetHub("2026-09-07");

    expect(hub.weekStart).toBe("2026-09-07");
    expect(hub.weekEnding).toBe("2026-09-13");
    expect(hub.customerGroups).toHaveLength(1);

    const group = hub.customerGroups[0];
    expect(group.customerName).toBe("Acme Manufacturing");
    expect(group.workingTimesheets).toHaveLength(1);

    const sheet = group.workingTimesheets[0];
    expect(sheet.id).toBe("order-a__2026-09-07");
    expect(sheet.orderRef).toBe("Main Assembly");
    expect(sheet.weekEnding).toBe("2026-09-13");
    expect(sheet.workers).toBe(4);
    expect(sheet.status).toBe("Draft");
  });

  it("surfaces a refusal rather than rendering an empty hub silently", async () => {
    vi.stubGlobal("fetch", respondWith(403, { message: "Forbidden" }));

    await expect(fetchWorkingTimesheetHub()).rejects.toThrow(/403/);
  });
});
