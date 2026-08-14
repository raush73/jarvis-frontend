/**
 * The worker portal identity client.
 *
 * Three claims, and they are the reason this client is four lines of behaviour:
 *
 *  - it reads the CERTIFIED worker-scoped projection, with the worker's own session;
 *  - it projects a name and nothing else, so no surface can render a date of birth or anything
 *    else the bootstrap happens to carry;
 *  - it cannot write. Canonical identity is not a business module's to change, and there is no
 *    function here through which one could try.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { saveWorkerSession } from "./workerSession";
import { WorkerSessionExpiredError } from "./workforceApi";
import { getWorkerPortalIdentity } from "./workerPortalApi";

const CANDIDATE = "candidate-1";

function ok(value: unknown) {
  return vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    headers: new Headers(),
    json: async () => ({ ok: true, value }),
  } as unknown as Response);
}

function bootstrap(displayName: string | null) {
  return {
    identity: {
      candidateId: CANDIDATE,
      displayName,
      dateOfBirthOnFile: true,
      phone: "918-555-0100",
    },
    navigation: [{ key: "ONBOARDING" }],
  };
}

beforeEach(() => {
  localStorage.clear();
  saveWorkerSession({
    token: "worker-token",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    applicationSessionId: "app-session-1",
    candidateId: CANDIDATE,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("the worker's own canonical identity", () => {
  it("reads the certified worker-scoped projection with the worker session", async () => {
    const fetchMock = ok(bootstrap("Dana Rivers"));
    vi.stubGlobal("fetch", fetchMock);

    const identity = await getWorkerPortalIdentity();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/workforce/portal");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer worker-token",
    );
    expect(identity).toEqual({ candidateId: CANDIDATE, displayName: "Dana Rivers" });
  });

  it("projects the name and nothing else the bootstrap carries", async () => {
    vi.stubGlobal("fetch", ok(bootstrap("Dana Rivers")));

    const identity = await getWorkerPortalIdentity();

    expect(Object.keys(identity).sort()).toEqual(["candidateId", "displayName"]);
  });

  it("reports an absent name as absent rather than inventing one", async () => {
    vi.stubGlobal("fetch", ok(bootstrap(null)));

    await expect(getWorkerPortalIdentity()).resolves.toEqual({
      candidateId: CANDIDATE,
      displayName: null,
    });
  });

  it("attempts nothing at all without a worker session", async () => {
    const fetchMock = ok(bootstrap("Dana Rivers"));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.clear();

    await expect(getWorkerPortalIdentity()).rejects.toBeInstanceOf(
      WorkerSessionExpiredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the boundaries this client keeps", () => {
  const file = readFileSync(join(__dirname, "workerPortalApi.ts"), "utf8");
  const source = file.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("cannot write, correct or resolve anything about identity", () => {
    for (const forbidden of [
      "method: \"POST\"",
      "method: \"PUT\"",
      "method: \"PATCH\"",
      "method: \"DELETE\"",
      "correct",
      "resolve",
      "discrepancy",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("reads no protected attribute, under any name", () => {
    for (const forbidden of ["dateOfBirth", "ssn", "socialSecurity"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("adds no transport of its own", () => {
    expect(source).toContain('from "./onboardingApi"');
    expect(source).not.toContain("await fetch(");
  });
});
