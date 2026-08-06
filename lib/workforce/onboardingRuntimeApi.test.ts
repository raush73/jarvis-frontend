/**
 * Phase 1 - the runtime API client.
 *
 * Covers the wire contract the runtime depends on: worker-scoped requests, packet-addressed
 * paths, refusal classification shared with the Phase 0 client, and the route helpers that
 * build every runtime URL from server-supplied values.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveWorkerSession } from "./workerSession";
import { OnboardingApiError } from "./onboardingApi";
import { WorkerSessionExpiredError } from "./workforceApi";
import {
  ONBOARDING_HOME,
  getOnboardingPacket,
  getOnboardingResume,
  getOnboardingRuntime,
  getOnboardingSession,
  getRuntimeModuleDraft,
  modulePath,
  packetPath,
  resumePath,
  saveRuntimeModuleDraft,
} from "./onboardingRuntimeApi";

function respondWith(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response);
}

function ok(value: unknown) {
  return respondWith(200, { ok: true, value });
}

beforeEach(() => {
  localStorage.clear();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: "candidate-1",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("runtime reads", () => {
  it("reads the runtime projection from the worker-scoped path", async () => {
    const fetchMock = ok({ candidateId: "candidate-1", packets: [] });
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingRuntime();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/workforce/onboarding/runtime"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("attaches the worker session to every request", async () => {
    const fetchMock = ok({ candidateId: "candidate-1", packets: [] });
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingRuntime();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer worker-token",
    );
  });

  it("refuses to call at all without a session, rather than making an anonymous request", async () => {
    localStorage.clear();
    const fetchMock = ok({});
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOnboardingRuntime()).rejects.toBeInstanceOf(
      WorkerSessionExpiredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the session status", async () => {
    const fetchMock = ok({ candidateId: "candidate-1", status: "ACTIVE" });
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingSession();

    expect(fetchMock.mock.calls[0][0]).toContain(
      "/workforce/onboarding/runtime/session",
    );
  });

  it("scopes a resume lookup to one packet when asked", async () => {
    const fetchMock = ok(null);
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingResume("inv 1");

    expect(fetchMock.mock.calls[0][0]).toContain(
      "/runtime/resume?invocationId=inv%201",
    );
  });

  it("reads one packet by invocation", async () => {
    const fetchMock = ok({ invocationId: "inv-1" });
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingPacket("inv-1");

    expect(fetchMock.mock.calls[0][0]).toContain("/runtime/packets/inv-1");
  });
});

describe("draft capture", () => {
  it("addresses the draft by packet and module slug", async () => {
    const fetchMock = ok({ packetId: "pkt-1", moduleKey: "FIXTURE_ALPHA", data: {} });
    vi.stubGlobal("fetch", fetchMock);

    await getRuntimeModuleDraft("inv-1", "fixture-alpha");

    expect(fetchMock.mock.calls[0][0]).toContain(
      "/runtime/packets/inv-1/modules/fixture-alpha/draft",
    );
  });

  it("sends the module's captured input verbatim on save", async () => {
    const fetchMock = ok({ packetId: "pkt-1", moduleKey: "FIXTURE_ALPHA", data: {} });
    vi.stubGlobal("fetch", fetchMock);

    await saveRuntimeModuleDraft("inv-1", "fixture-alpha", { answer: "yes" });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ data: { answer: "yes" } });
  });

  it("escapes identifiers so a crafted slug cannot reshape the path", async () => {
    const fetchMock = ok({ packetId: "pkt-1", moduleKey: "X", data: {} });
    vi.stubGlobal("fetch", fetchMock);

    await getRuntimeModuleDraft("inv-1", "../../internal");

    expect(fetchMock.mock.calls[0][0]).toContain("%2F");
    expect(fetchMock.mock.calls[0][0]).not.toContain("/../");
  });
});

describe("refusals", () => {
  it("carries a refusal code the runtime can classify", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(400, { code: "MODULE_NOT_IN_PACKET", message: "Nope" }),
    );

    await expect(getOnboardingPacket("inv-1")).rejects.toMatchObject({
      code: "MODULE_NOT_IN_PACKET",
    });
  });

  it("treats an authorization refusal as an answer, not a broken session", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(403, {
        code: "INVOCATION_NOT_OWNED_BY_WORKER",
        message: "Not yours",
      }),
    );

    const error = await getOnboardingPacket("inv-1").catch((err) => err);

    expect(error).toBeInstanceOf(OnboardingApiError);
    // The credential is still good, so it must survive a refusal that is about
    // entitlement rather than about the session.
    expect(localStorage.getItem("jp_workerSession")).toBe("worker-token");
  });

  it("treats an expired session as a session failure and clears the credential", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(401, { code: "WORKER_SESSION_EXPIRED", message: "Expired" }),
    );

    await expect(getOnboardingRuntime()).rejects.toBeInstanceOf(
      WorkerSessionExpiredError,
    );
    expect(localStorage.getItem("jp_workerSession")).toBeNull();
    // The durable application session survives, so nothing the worker saved is orphaned.
    expect(localStorage.getItem("jp_workerApplicationSessionId")).toBe("app-session-1");
  });

  it("absorbs a reissued session token so continuity needs no separate call", async () => {
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    vi.stubGlobal(
      "fetch",
      respondWith(
        200,
        { ok: true, value: { candidateId: "candidate-1", packets: [] } },
        {
          "X-Worker-Session-Token": "renewed-token",
          "X-Worker-Session-Expires-At": later,
        },
      ),
    );

    await getOnboardingRuntime();

    expect(localStorage.getItem("jp_workerSession")).toBe("renewed-token");
  });
});

describe("route helpers", () => {
  it("builds a module step path from server-supplied values", () => {
    expect(modulePath("inv-1", "fixture-alpha", "one")).toBe(
      "/workforce/onboarding/inv-1/fixture-alpha/one",
    );
  });

  it("omits the step for a module that declares none", () => {
    expect(modulePath("inv-1", "fixture-alpha", null)).toBe(
      "/workforce/onboarding/inv-1/fixture-alpha",
    );
  });

  it("sends a worker with nothing to resume to his onboarding home", () => {
    expect(resumePath(null)).toBe(ONBOARDING_HOME);
  });

  it("sends a worker with a resume target straight to it, including mid-module", () => {
    expect(
      resumePath({
        invocationId: "inv-1",
        moduleKey: "FIXTURE_BETA",
        moduleSlug: "fixture-beta",
        stepSlug: "second",
      }),
    ).toBe("/workforce/onboarding/inv-1/fixture-beta/second");
  });

  it("builds a packet path", () => {
    expect(packetPath("inv-1")).toBe("/workforce/onboarding/inv-1");
  });
});
