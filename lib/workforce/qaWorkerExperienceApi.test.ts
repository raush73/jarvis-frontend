/**
 * QA-L3 - the QA launcher transport contract.
 *
 * What these prove is the seam:
 *
 *  - The two QA-L2 routes are the ones called, at the paths QA-L2 mounts.
 *  - A launch sends the CANDIDATE IDENTIFIER AND THE GOVERNED SCOPE, AND NOTHING ELSE. No module,
 *    no module array, no packet, no invocation, no step: a request shape that cannot name a module
 *    cannot ask for one, and the scope it CAN name is closed at the two the server authorizes.
 *  - The field is `scope`, spelled as the backend spells it, so the two contracts agree.
 *  - The STAFF credential is what a QA request carries, and nothing is attempted without one.
 *  - The identifier never reaches a URL on the launch: a launch is not bookmarkable, and a browser
 *    history, a proxy log and a referrer header are none of them places for the target of one.
 *  - A refusal keeps its status and code, which is what lets the surface distinguish a disabled
 *    facility from a missing grant from a worker who is not test-classified.
 *  - This client has no notion of a token, a session, a classification write, or an old invocation,
 *    and its source is asserted to contain no route for any of them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OnboardingAdminApiError,
  StaffSessionMissingError,
} from "./onboardingAdminApi";
import {
  QA_WORKER_EXPERIENCE_LAUNCH_PERMISSION,
  QA_WORKER_EXPERIENCE_SCOPES,
  launchQaWorkerExperience,
  listQaTestWorkers,
} from "./qaWorkerExperienceApi";

const TOKEN_KEY = "jp_accessToken";
const CANDIDATE = "seed-worker-mw-003";

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

/* ------------------------------------------------------------------ directory */

describe("the TEST worker directory", () => {
  it("reads the QA-L2 directory route with the staff credential", async () => {
    const fetchMock = ok({
      workers: [
        {
          candidateId: CANDIDATE,
          displayName: "Grant, William",
          workerClassification: "TEST",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const workers = await listQaTestWorkers();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/workforce/qa/worker-experience/test-workers");
    expect(init.method ?? "GET").toBe("GET");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer staff-token");
    expect(workers).toEqual([
      {
        candidateId: CANDIDATE,
        displayName: "Grant, William",
        workerClassification: "TEST",
      },
    ]);
  });

  it("takes no search term, filter or page", () => {
    expect(listQaTestWorkers.length).toBe(0);
  });

  it("attempts nothing at all without a staff session", async () => {
    localStorage.removeItem(TOKEN_KEY);
    const fetchMock = ok({ workers: [] });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listQaTestWorkers()).rejects.toBeInstanceOf(StaffSessionMissingError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an empty directory as empty rather than as a failure", async () => {
    vi.stubGlobal("fetch", ok({ workers: [] }));
    await expect(listQaTestWorkers()).resolves.toEqual([]);
  });
});

/* --------------------------------------------------------------------- launch */

describe("the launch request", () => {
  function launched(scope: string) {
    return ok({
      candidateId: CANDIDATE,
      invocationId: "inv_qa_1",
      scope,
      workerEntryToken: "entry-token-value",
      expiresAt: "2026-08-28T18:00:00.000Z",
    });
  }

  it("sends the candidate identifier and the chosen scope, and nothing else", async () => {
    const fetchMock = launched("PAYROLL_PAYMENT");
    vi.stubGlobal("fetch", fetchMock);

    await launchQaWorkerExperience(CANDIDATE, "PAYROLL_PAYMENT");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/workforce/qa/worker-experience/launch");
    expect(init.method).toBe("POST");
    // `scope`, spelled exactly as the backend contract spells it (owner judgment call JC-2), and
    // NOT `moduleScope`: a client that sent the old name would be stripped and refused.
    expect(JSON.parse(String(init.body))).toEqual({
      candidateId: CANDIDATE,
      scope: "PAYROLL_PAYMENT",
    });
  });

  it("sends the complete-packet scope when that is what was chosen", async () => {
    const fetchMock = launched("COMPLETE_PACKET");
    vi.stubGlobal("fetch", fetchMock);

    await launchQaWorkerExperience(CANDIDATE, "COMPLETE_PACKET");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      candidateId: CANDIDATE,
      scope: "COMPLETE_PACKET",
    });
    // No module array, no module key, no kind and no workflow travels with it: the packet's
    // composition is the server's registry-derived answer (owner ruling QA-L5-R2).
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["candidateId", "scope"]);
  });

  it("offers exactly the two authorized scopes, and no third", () => {
    expect([...QA_WORKER_EXPERIENCE_SCOPES]).toEqual([
      "PAYROLL_PAYMENT",
      "COMPLETE_PACKET",
    ]);
    expect(QA_WORKER_EXPERIENCE_SCOPES).toHaveLength(2);
  });

  it("keeps the target out of the URL", async () => {
    const fetchMock = launched("PAYROLL_PAYMENT");
    vi.stubGlobal("fetch", fetchMock);

    await launchQaWorkerExperience(CANDIDATE, "PAYROLL_PAYMENT");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).not.toContain(CANDIDATE);
    expect(url).not.toContain("PAYROLL_PAYMENT");
    expect(url).not.toContain("?");
  });

  it("takes the candidate identifier and the scope, and no third argument", () => {
    expect(launchQaWorkerExperience.length).toBe(2);
  });

  it("preserves a refusal with its status and code", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith(403, {
        message: "The QA worker experience launcher is disabled",
      }),
    );

    const failure = await launchQaWorkerExperience(
      CANDIDATE,
      "COMPLETE_PACKET",
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OnboardingAdminApiError);
    expect((failure as OnboardingAdminApiError).status).toBe(403);
    expect((failure as OnboardingAdminApiError).message).toBe(
      "The QA worker experience launcher is disabled",
    );
  });
});

/* ----------------------------------------------------------------- boundaries */

describe("the boundaries this client keeps", () => {
  const file = readFileSync(join(__dirname, "qaWorkerExperienceApi.ts"), "utf8");
  const source = file.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("names the sensitive grant exactly as the backend spells it", () => {
    expect(QA_WORKER_EXPERIENCE_LAUNCH_PERMISSION).toBe(
      "workforce.qa.worker-experience.launch",
    );
  });

  it("mounts only the two routes QA-L2 offers", () => {
    expect(source).toContain("/test-workers");
    expect(source).toContain("/launch");
    for (const forbidden of [
      "consume",
      "resume",
      "reopen",
      "delete",
      "reset",
      "DELETE",
      "PATCH",
      "PUT",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("persists nothing anywhere", () => {
    for (const forbidden of [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "indexedDB",
      "console.",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("offers no module, packet or invocation parameter, and keeps no module list", () => {
    // The governed scope is a legitimate parameter now (owner ruling QA-L5-R1). A MODULE is not:
    // the complete packet's composition is the production registry's answer, so a module key,
    // module array or packet identifier here would be a second inventory (owner ruling QA-L5-R2).
    for (const forbidden of [
      "moduleKey",
      "modules",
      "moduleScope",
      "packetId",
      "stepSlug",
      "workflowKey",
      "NAMED_MODULES",
      "NAMED_WORKFLOW",
      "EMPLOYMENT_ELIGIBILITY",
      "FEDERAL_TAX",
      "EMERGENCY_CONTACT",
      "STATE_TAX",
      "BENEFITS",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("mirrors the server's closed scope set and composes nothing from it", () => {
    // The two authorized scopes are NAMED here, because a request must carry one of them. What is
    // absent is any code that turns a scope into a set of modules: that is the server's.
    expect(source).toContain("PAYROLL_PAYMENT");
    expect(source).toContain("COMPLETE_PACKET");
    for (const forbidden of [".filter(", ".map(", ".sort(", ".concat("]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
