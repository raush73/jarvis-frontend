/**
 * Phase 5 - the execution API client.
 *
 * Covers the wire contract the execution surface depends on: packet-addressed paths, the
 * shared worker session, refusal codes preserved for the surface to classify, and the one
 * property this client exists to protect - the presented content identity goes back exactly
 * as it arrived.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { saveWorkerSession } from "./workerSession";
import { OnboardingApiError } from "./onboardingApi";
import { WorkerSessionExpiredError } from "./workforceApi";
import {
  ONBOARDING_EXECUTION_FORMS,
  getOnboardingExecutionSubjects,
  getOnboardingExecutions,
  isOnboardingExecutionForm,
  requiresNativeCapture,
  submitOnboardingExecution,
} from "./onboardingExecutionApi";

const INVOCATION = "invocation-1";

const PRESENTED = {
  revision: "2026.1",
  contentHash: "a".repeat(64),
  ruleRevision: "rule-2026.1",
};

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

function bodyOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as { body: string };
  return JSON.parse(init.body) as Record<string, unknown>;
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

describe("routes and transport", () => {
  it("reads subjects from the packet-addressed execution path", async () => {
    const fetchMock = ok([]);
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingExecutionSubjects(INVOCATION);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        `/workforce/onboarding/runtime/packets/${INVOCATION}/executions/subjects`,
      ),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reads the worker's own acts from the executions collection", async () => {
    const fetchMock = ok([]);
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingExecutions(INVOCATION);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(
      `/workforce/onboarding/runtime/packets/${INVOCATION}/executions`,
    );
    expect(url).not.toContain("/subjects");
    expect(init).toMatchObject({ method: "GET" });
  });

  it("submits an act by POST to the executions collection", async () => {
    const fetchMock = ok({ executionId: "exec-1" });
    vi.stubGlobal("fetch", fetchMock);

    await submitOnboardingExecution(INVOCATION, {
      moduleKey: "FIXTURE_SIMPLE",
      subjectKey: "FIXTURE_READ",
      performedForm: "READ_ACKNOWLEDGEMENT",
      presented: PRESENTED,
      acknowledged: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        `/workforce/onboarding/runtime/packets/${INVOCATION}/executions`,
      ),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("encodes the invocation identifier rather than interpolating it raw", async () => {
    const fetchMock = ok([]);
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingExecutionSubjects("a/../b");

    expect(fetchMock.mock.calls[0][0]).toContain("a%2F..%2Fb");
  });

  it("attaches the existing worker session to every request", async () => {
    const fetchMock = ok([]);
    vi.stubGlobal("fetch", fetchMock);

    await getOnboardingExecutionSubjects(INVOCATION);

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer worker-token" }),
    });
  });

  it("unwraps the ok/value envelope", async () => {
    vi.stubGlobal("fetch", ok([{ subjectKey: "FIXTURE_READ" }]));

    const subjects = await getOnboardingExecutionSubjects(INVOCATION);

    expect(subjects).toEqual([{ subjectKey: "FIXTURE_READ" }]);
  });

  it("refuses to send anything without a worker session", async () => {
    localStorage.clear();
    const fetchMock = ok([]);
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOnboardingExecutionSubjects(INVOCATION)).rejects.toBeInstanceOf(
      WorkerSessionExpiredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("refusals", () => {
  it("preserves the refusal code for the surface to classify", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(400, {
        statusCode: 400,
        code: "EXECUTION_CONTENT_STALE",
        message: "Execution subject FIXTURE_READ was presented at revision 2026.0",
      }),
    );

    const failure = await submitOnboardingExecution(INVOCATION, {
      moduleKey: "FIXTURE_SIMPLE",
      subjectKey: "FIXTURE_READ",
      performedForm: "READ_ACKNOWLEDGEMENT",
      presented: PRESENTED,
      acknowledged: true,
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OnboardingApiError);
    expect((failure as OnboardingApiError).code).toBe("EXECUTION_CONTENT_STALE");
  });

  it("surfaces a foreign packet as an authorization answer, not a broken session", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(403, {
        statusCode: 403,
        code: "INVOCATION_NOT_OWNED_BY_WORKER",
        message: "not yours",
      }),
    );

    const failure = await getOnboardingExecutionSubjects(INVOCATION).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(OnboardingApiError);
    expect((failure as OnboardingApiError).code).toBe("INVOCATION_NOT_OWNED_BY_WORKER");
    // The token survives a refusal that was never about the token.
    expect(localStorage.getItem("jp_workerSession")).toBe("worker-token");
  });
});

describe("the presented content identity", () => {
  it("returns the revision, hash, and rule revision exactly as they arrived", async () => {
    const fetchMock = ok({ executionId: "exec-1" });
    vi.stubGlobal("fetch", fetchMock);

    await submitOnboardingExecution(INVOCATION, {
      moduleKey: "FIXTURE_SIMPLE",
      subjectKey: "FIXTURE_READ",
      performedForm: "READ_ACKNOWLEDGEMENT",
      presented: PRESENTED,
      acknowledged: true,
    });

    expect(bodyOf(fetchMock).presented).toEqual(PRESENTED);
  });

  it("computes no hash of its own anywhere in the module", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/workforce/onboardingExecutionApi.ts"),
      "utf8",
    );

    for (const forbidden of [
      "crypto",
      "subtle",
      "digest",
      "createHash",
      "sha256",
      "SHA-256",
    ]) {
      expect({ forbidden, present: source.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    }
  });
});

describe("the submission body", () => {
  it("carries no worker, candidate, actor, or packet identity", async () => {
    const fetchMock = ok({ executionId: "exec-1" });
    vi.stubGlobal("fetch", fetchMock);

    await submitOnboardingExecution(INVOCATION, {
      moduleKey: "FIXTURE_SIMPLE",
      subjectKey: "FIXTURE_SIGN",
      performedForm: "ELECTRONIC_SIGNATURE",
      presented: PRESENTED,
      capture: { strokes: [{ points: [{ x: 1, y: 2 }] }], capturedDurationMs: 900 },
    });

    const keys = Object.keys(bodyOf(fetchMock));
    for (const forbidden of [
      "candidateId",
      "workerId",
      "actorId",
      "actorType",
      "packetId",
      "executedAt",
    ]) {
      expect({ forbidden, present: keys.includes(forbidden) }).toEqual({
        forbidden,
        present: false,
      });
    }
    expect(keys.sort()).toEqual([
      "capture",
      "moduleKey",
      "performedForm",
      "presented",
      "subjectKey",
    ]);
  });

  it("omits the acknowledgement flag entirely for a drawn act", async () => {
    const fetchMock = ok({ executionId: "exec-1" });
    vi.stubGlobal("fetch", fetchMock);

    await submitOnboardingExecution(INVOCATION, {
      moduleKey: "FIXTURE_SIMPLE",
      subjectKey: "FIXTURE_INITIAL",
      performedForm: "INITIALS",
      presented: PRESENTED,
      capture: { strokes: [{ points: [{ x: 1, y: 2 }] }], capturedDurationMs: 500 },
    });

    // The backend refuses a native capture that carries the flag at all, not merely one
    // that carries it as false.
    expect("acknowledged" in bodyOf(fetchMock)).toBe(false);
  });

  it("omits the capture entirely for an attestation", async () => {
    const fetchMock = ok({ executionId: "exec-1" });
    vi.stubGlobal("fetch", fetchMock);

    await submitOnboardingExecution(INVOCATION, {
      moduleKey: "FIXTURE_SIMPLE",
      subjectKey: "FIXTURE_CHECK",
      performedForm: "CHECKBOX_ACKNOWLEDGEMENT",
      presented: PRESENTED,
      acknowledged: true,
    });

    const body = bodyOf(fetchMock);
    expect("capture" in body).toBe(false);
    expect(body.acknowledged).toBe(true);
  });
});

describe("the governed form vocabulary", () => {
  it("is exactly the four ratified forms", () => {
    expect([...ONBOARDING_EXECUTION_FORMS]).toEqual([
      "READ_ACKNOWLEDGEMENT",
      "CHECKBOX_ACKNOWLEDGEMENT",
      "INITIALS",
      "ELECTRONIC_SIGNATURE",
    ]);
  });

  it("rejects anything outside it", () => {
    expect(isOnboardingExecutionForm("TYPED_NAME")).toBe(false);
    expect(isOnboardingExecutionForm("")).toBe(false);
    expect(isOnboardingExecutionForm(undefined)).toBe(false);
    expect(isOnboardingExecutionForm("READ_ACKNOWLEDGEMENT")).toBe(true);
  });

  it("derives which forms are drawn rather than letting a caller decide", () => {
    expect(requiresNativeCapture("INITIALS")).toBe(true);
    expect(requiresNativeCapture("ELECTRONIC_SIGNATURE")).toBe(true);
    expect(requiresNativeCapture("READ_ACKNOWLEDGEMENT")).toBe(false);
    expect(requiresNativeCapture("CHECKBOX_ACKNOWLEDGEMENT")).toBe(false);
  });
});
