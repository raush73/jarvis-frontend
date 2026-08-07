/**
 * Phase 2 - the administrative transport contract.
 *
 * What these prove is the seam, not the surface:
 *
 *  - The STAFF credential is what an administrative request carries, and nothing is attempted
 *    without one. A worker session cannot reach these endpoints because this client has no
 *    notion of one.
 *  - A refusal keeps its framework code, which is what lets a surface say which authorization
 *    was missing rather than printing a status number.
 *  - A rejected credential clears the staff session exactly as the delivered client does, so the
 *    whole application agrees the operator is out.
 *  - Every read is a request. There is no client cache, because an unaudited administrative read
 *    is precisely what this workspace must not permit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OnboardingAdminApiError,
  StaffSessionMissingError,
  executeOnboardingAdminAction,
  getOnboardingAdminDashboard,
  getOnboardingAdminInvestigation,
  getOnboardingAdminPacket,
  getOnboardingAdminQueue,
  onboardingAdminPacketPath,
  onboardingAdminQueuePath,
  onboardingAdminWorkerPath,
  revealOnboardingAdminSsn,
  searchOnboardingAdminWorkers,
} from "./onboardingAdminApi";

const TOKEN_KEY = "jp_accessToken";

function respondWith(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response);
}

function ok(value: unknown) {
  return respondWith(200, { ok: true, value });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(TOKEN_KEY, "staff-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("administrative transport", () => {
  it("carries the staff bearer credential", async () => {
    const fetchMock = ok({ outstandingCount: 0, categories: [] });
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingAdminDashboard();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/workforce/onboarding/admin/dashboard");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer staff-token");
  });

  it("attempts nothing at all without a staff session", async () => {
    localStorage.removeItem(TOKEN_KEY);
    const fetchMock = ok({});
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOnboardingAdminDashboard()).rejects.toBeInstanceOf(
      StaffSessionMissingError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unwraps the framework envelope", async () => {
    const packet = { packetId: "pkt_1", packetState: "IN_PROGRESS" };
    vi.stubGlobal("fetch", ok(packet));

    await expect(getOnboardingAdminPacket("pkt_1")).resolves.toMatchObject(packet);
  });

  it("preserves the refusal code on a refusal", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(403, {
        code: "ADMIN_FUNCTION_NOT_AUTHORIZED",
        message: "This administrative function requires an explicit grant.",
      }),
    );

    const failure = await getOnboardingAdminQueue("FIXTURE_QUEUE").catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(OnboardingAdminApiError);
    expect((failure as OnboardingAdminApiError).code).toBe("ADMIN_FUNCTION_NOT_AUTHORIZED");
    expect((failure as OnboardingAdminApiError).status).toBe(403);
  });

  it("clears the staff session when the credential is rejected", async () => {
    vi.stubGlobal("fetch", respondWith(401, { message: "Unauthorized" }));

    await getOnboardingAdminDashboard().catch(() => undefined);

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it("still refuses coherently when the server sends no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        ok: false,
        headers: new Headers(),
        json: async () => {
          throw new Error("not json");
        },
      } as unknown as Response),
    );

    const failure = await getOnboardingAdminDashboard().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OnboardingAdminApiError);
    expect((failure as OnboardingAdminApiError).code).toBeNull();
    expect((failure as OnboardingAdminApiError).status).toBe(500);
  });
});

describe("administrative requests", () => {
  it("sends lookup terms and paging as query parameters", async () => {
    const fetchMock = ok({ total: 0, page: 1, pageSize: 25, results: [] });
    vi.stubGlobal("fetch", fetchMock);

    await searchOnboardingAdminWorkers("Rivers", { page: 2, pageSize: 10 });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("term=Rivers");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=10");
  });

  it("omits absent queue filters rather than sending empty ones", async () => {
    const fetchMock = ok({ total: 0, page: 1, pageSize: 25, items: [] });
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingAdminQueue("FIXTURE_QUEUE", {
      page: 1,
      status: null,
      moduleKey: null,
      sort: "WAITING_SINCE",
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("sort=WAITING_SINCE");
    expect(url).not.toContain("status=");
    expect(url).not.toContain("moduleKey=");
  });

  it("posts an action with its packet and drops an empty reason", async () => {
    const fetchMock = ok({ actionKey: "FIXTURE_ACT", outcome: "DONE" });
    vi.stubGlobal("fetch", fetchMock);

    await executeOnboardingAdminAction("FIXTURE_ACT", {
      candidateId: "cand_1",
      packetId: "pkt_1",
      reason: "   ",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/actions/FIXTURE_ACT");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      candidateId: "cand_1",
      packetId: "pkt_1",
    });
  });

  it("sends the stated purpose with a reveal", async () => {
    const fetchMock = ok({ candidateId: "cand_1", value: "123-45-6789" });
    vi.stubGlobal("fetch", fetchMock);

    await revealOnboardingAdminSsn("cand_1", "Payroll correction");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/workers/cand_1/reveal-ssn");
    expect(JSON.parse(String(init.body))).toEqual({ purpose: "Payroll correction" });
  });

  it("escapes identifiers into the path", async () => {
    const fetchMock = ok({});
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingAdminInvestigation("cand/1");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/workers/cand%2F1/investigation");
  });

  it("reads again on every call, holding no cache", async () => {
    const fetchMock = ok({ outstandingCount: 0, categories: [] });
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingAdminDashboard();
    await getOnboardingAdminDashboard();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("route helpers", () => {
  it("keeps the administrative workspace apart from the worker runtime", () => {
    expect(onboardingAdminWorkerPath("cand_1")).toBe("/onboarding/workers/cand_1");
    expect(onboardingAdminPacketPath("pkt_1")).toBe("/onboarding/packets/pkt_1");
    expect(onboardingAdminQueuePath("FIXTURE_QUEUE")).toBe(
      "/onboarding/queues/FIXTURE_QUEUE",
    );

    // The worker runtime lives under /workforce/onboarding. Nothing here routes into it.
    for (const path of [
      onboardingAdminWorkerPath("cand_1"),
      onboardingAdminPacketPath("pkt_1"),
      onboardingAdminQueuePath("FIXTURE_QUEUE"),
    ]) {
      expect(path.startsWith("/workforce/")).toBe(false);
    }
  });
});
