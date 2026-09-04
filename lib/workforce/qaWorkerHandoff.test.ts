/**
 * QA-L3 - the real worker handoff, proved end to end over the network seam.
 *
 * The QA-L2 launch is stubbed at the client boundary; EVERYTHING AFTER IT IS THE DELIVERED CODE
 * RUNNING FOR REAL - the delivered consume client, the delivered transport, the delivered worker
 * session helper and the delivered route builder - because the whole claim of QA-L3 is that it adds
 * no authentication of its own. A test that mocked the consume and the session helper would prove
 * only that this file calls two functions; these prove which endpoint is reached, what travels in
 * the body, which storage keys are written, and what is NOT written anywhere.
 *
 * What these prove:
 *
 *  - The DELIVERED magic-link consume route is what the token is presented to, in the BODY.
 *  - The token appears in NO URL, and in NO storage of any kind afterwards.
 *  - The DELIVERED worker session keys are the ones established, by the delivered helper.
 *  - The STAFF session is exactly as it was, before and after.
 *  - The returned handoff has NO token field, and no spread could have put one there.
 *  - The worker route is built from the invocation and scope the SERVER returned.
 *  - THE SCOPE DECIDES THE DESTINATION AND NOTHING ELSE: a surgical run lands on the module root,
 *    and a complete-packet run lands on the delivered PACKET ROOT rather than inside a module, so
 *    the packet experience is entered where a real worker enters it (owner ruling QA-L5-R1).
 *  - THE REAL CHAIN RUNS FIRST FOR BOTH SCOPES. The magic link is consumed and the worker session
 *    is established BEFORE any path is produced, and a failure at either point yields no path.
 *  - A refused entry, and a session that failed to establish, both raise a safe failure - and
 *    neither one deletes, resets or rolls anything back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("./qaWorkerExperienceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./qaWorkerExperienceApi")>();
  return {
    ...actual,
    launchQaWorkerExperience: vi.fn(),
    reEnterQaWorkerExperience: vi.fn(),
  };
});

const { launchQaWorkerExperience, reEnterQaWorkerExperience } = await import(
  "./qaWorkerExperienceApi"
);
const {
  QA_WORKER_ENTRY_INTENT,
  QaWorkerHandoffError,
  launchQaWorkerHandoff,
  reEnterQaWorkerHandoff,
  qaWorkerModuleSlug,
} = await import("./qaWorkerHandoff");
const { ONBOARDING_HOME } = await import("./onboardingRuntimeApi");
const { getWorkerSession } = await import("./workerSession");

const STAFF_TOKEN_KEY = "jp_accessToken";
const WORKER_TOKEN_KEY = "jp_workerSession";
const CANDIDATE = "seed-worker-mw-003";
const INVOCATION = "inv_qa_1";
const ENTRY_TOKEN = "qa-entry-token-9f2c4a1b7e30d5ac";

function launchResponse(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: CANDIDATE,
    invocationId: INVOCATION,
    scope: "PAYROLL_PAYMENT" as const,
    workerEntryToken: ENTRY_TOKEN,
    expiresAt: "2026-08-28T18:00:00.000Z",
    ...overrides,
  };
}

/**
 * What the server returns for a session-only re-entry.
 *
 * NOTE WHAT IS NOT HERE: no `invocationId` and no `scope`. The fixture mirrors the server contract
 * exactly, so a handoff that tried to build a packet route would have nothing to build it from -
 * which is the guarantee, tested rather than described.
 */
function reEntryResponse(overrides: Record<string, unknown> = {}) {
  return {
    candidateId: CANDIDATE,
    workerEntryToken: ENTRY_TOKEN,
    expiresAt: "2026-08-28T18:00:00.000Z",
    ...overrides,
  };
}

/** The delivered consume endpoint's success shape. */
function consumeAccepted() {
  return {
    ok: true,
    value: {
      authenticated: true,
      applicationSessionId: "app_session_qa_1",
      candidateId: CANDIDATE,
      requestedIntent: { category: QA_WORKER_ENTRY_INTENT, recognized: true },
      session: {
        token: "worker-session-jwt",
        tokenType: "Bearer",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    },
  };
}

function consumeRefused(reason: string) {
  return { ok: true, value: { authenticated: false, reason } };
}

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(STAFF_TOKEN_KEY, "staff-token");
  vi.mocked(launchQaWorkerExperience).mockResolvedValue(launchResponse());
  vi.mocked(reEnterQaWorkerExperience).mockResolvedValue(reEntryResponse());
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

/* ----------------------------------------------------------------- the chain */

describe("the handoff chain", () => {
  it("presents the entry token to the delivered consume route, in the body", async () => {
    const fetchMock = stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT");

    expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledWith(
      CANDIDATE,
      "PAYROLL_PAYMENT",
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/workforce/auth/magic-link/consume");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      token: ENTRY_TOKEN,
      requestedIntent: QA_WORKER_ENTRY_INTENT,
    });
  });

  it("puts the entry token in no URL", async () => {
    const fetchMock = stubFetch(consumeAccepted());

    const handoff = await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT");

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain(ENTRY_TOKEN);
    }
    expect(handoff.workerPath).not.toContain(ENTRY_TOKEN);
  });

  it("establishes the delivered worker session, under the delivered keys", async () => {
    stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT");

    expect(localStorage.getItem(WORKER_TOKEN_KEY)).toBe("worker-session-jwt");
    const session = getWorkerSession();
    expect(session?.applicationSessionId).toBe("app_session_qa_1");
    expect(session?.candidateId).toBe(CANDIDATE);
  });

  it("persists the entry token nowhere", async () => {
    stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT");

    expect(JSON.stringify(window.localStorage)).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(window.sessionStorage)).not.toContain(ENTRY_TOKEN);
    expect(document.cookie).not.toContain(ENTRY_TOKEN);
  });

  it("leaves the staff session exactly as it was", async () => {
    stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT");

    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("returns the server's facts and no token", async () => {
    stubFetch(consumeAccepted());

    const handoff = await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT");

    expect(handoff).toEqual({
      candidateId: CANDIDATE,
      invocationId: INVOCATION,
      scope: "PAYROLL_PAYMENT",
      expiresAt: "2026-08-28T18:00:00.000Z",
      workerPath: `/workforce/onboarding/${INVOCATION}/payroll-payment`,
    });
    expect(Object.keys(handoff)).not.toContain("workerEntryToken");
    expect(JSON.stringify(handoff)).not.toContain(ENTRY_TOKEN);
  });

  it("routes to the module ROOT of the invocation the server returned", async () => {
    vi.mocked(launchQaWorkerExperience).mockResolvedValue(
      launchResponse({ invocationId: "inv_qa_second" }),
    );
    stubFetch(consumeAccepted());

    const handoff = await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT");

    expect(handoff.workerPath).toBe(
      "/workforce/onboarding/inv_qa_second/payroll-payment",
    );
    // The module root, so the delivered entry route asks the SERVER which step resumes.
    expect(handoff.workerPath.endsWith("/payroll-payment")).toBe(true);
  });

  it("derives the module segment from the module scope the server returned", () => {
    expect(qaWorkerModuleSlug("PAYROLL_PAYMENT")).toBe("payroll-payment");
    expect(qaWorkerModuleSlug(" EMPLOYMENT_ELIGIBILITY ")).toBe(
      "employment-eligibility",
    );
  });
});

/* --------------------------------------------------- the complete packet scope */

describe("a COMPLETE_PACKET handoff", () => {
  beforeEach(() => {
    vi.mocked(launchQaWorkerExperience).mockResolvedValue(
      launchResponse({ scope: "COMPLETE_PACKET" }),
    );
  });

  it("asks the server for the complete-packet scope", async () => {
    stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE, "COMPLETE_PACKET");

    expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledWith(
      CANDIDATE,
      "COMPLETE_PACKET",
    );
  });

  it("lands on the delivered PACKET ROOT and never inside a module", async () => {
    stubFetch(consumeAccepted());

    const handoff = await launchQaWorkerHandoff(CANDIDATE, "COMPLETE_PACKET");

    // The packet overview: where a real worker with a multi-module packet starts. The whole point
    // of packet QA is to exercise that surface rather than to skip past it into one module.
    expect(handoff.workerPath).toBe(`/workforce/onboarding/${INVOCATION}`);
    expect(handoff.scope).toBe("COMPLETE_PACKET");
    // No module segment of any kind, and no slug derived from the scope.
    expect(handoff.workerPath).not.toContain("complete-packet");
    expect(handoff.workerPath).not.toContain("payroll-payment");
    expect(handoff.workerPath.split("/").filter(Boolean)).toHaveLength(3);
  });

  it("names no module and composes no module list to get there", async () => {
    stubFetch(consumeAccepted());

    const handoff = await launchQaWorkerHandoff(CANDIDATE, "COMPLETE_PACKET");

    // Which modules the packet holds is the server's answer, rendered by the delivered runtime.
    // Nothing on the handoff carries a module, an order or a count (owner ruling QA-L5-R2).
    expect(Object.keys(handoff).sort()).toEqual([
      "candidateId",
      "expiresAt",
      "invocationId",
      "scope",
      "workerPath",
    ]);
    const serialised = JSON.stringify(handoff);
    for (const forbidden of [
      "EMPLOYMENT_ELIGIBILITY",
      "FEDERAL_TAX",
      "EMERGENCY_CONTACT",
      "modules",
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it("consumes the real magic link and establishes the real session first", async () => {
    const fetchMock = stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE, "COMPLETE_PACKET");

    // The SAME delivered chain as the surgical scope. The complete packet gets no shortcut, no
    // second authentication path and no manufactured session (owner ruling QA-L5-R4).
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/workforce/auth/magic-link/consume");
    expect(JSON.parse(String(init.body))).toEqual({
      token: ENTRY_TOKEN,
      requestedIntent: QA_WORKER_ENTRY_INTENT,
    });
    expect(localStorage.getItem(WORKER_TOKEN_KEY)).toBe("worker-session-jwt");
    expect(getWorkerSession()?.candidateId).toBe(CANDIDATE);
    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("produces no packet path at all when the entry link is refused", async () => {
    stubFetch(consumeRefused("INVALID_LINK"));

    const failure = await launchQaWorkerHandoff(CANDIDATE, "COMPLETE_PACKET").catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(QaWorkerHandoffError);
    expect((failure as { stage: string }).stage).toBe("ENTRY_NOT_ACCEPTED");
    expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toContain(
      "/workforce/onboarding",
    );
    expect(localStorage.getItem(WORKER_TOKEN_KEY)).toBeNull();
  });

  it("lands on the packet root of whichever invocation the SERVER returned", async () => {
    vi.mocked(launchQaWorkerExperience).mockResolvedValue(
      launchResponse({ scope: "COMPLETE_PACKET", invocationId: "inv_qa_packet_2" }),
    );
    stubFetch(consumeAccepted());

    const handoff = await launchQaWorkerHandoff(CANDIDATE, "COMPLETE_PACKET");

    expect(handoff.workerPath).toBe("/workforce/onboarding/inv_qa_packet_2");
  });

  it("follows the SERVER'S scope rather than the requested one, if they ever differ", async () => {
    // The destination is decided by what was actually composed, not by what was asked for. A
    // request that widened and a server that refused to would otherwise disagree silently.
    vi.mocked(launchQaWorkerExperience).mockResolvedValue(
      launchResponse({ scope: "PAYROLL_PAYMENT" }),
    );
    stubFetch(consumeAccepted());

    const handoff = await launchQaWorkerHandoff(CANDIDATE, "COMPLETE_PACKET");

    expect(handoff.scope).toBe("PAYROLL_PAYMENT");
    expect(handoff.workerPath).toBe(
      `/workforce/onboarding/${INVOCATION}/payroll-payment`,
    );
  });
});

/* --------------------------------------------------------------- the failures */

describe("a handoff that stops after the run exists", () => {
  it("reports a refused entry with the delivered reason code", async () => {
    stubFetch(consumeRefused("INVALID_LINK"));

    const failure = await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT").catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(QaWorkerHandoffError);
    expect((failure as QaWorkerHandoffError).stage).toBe("ENTRY_NOT_ACCEPTED");
    expect((failure as QaWorkerHandoffError).reason).toBe("INVALID_LINK");
  });

  it("puts the entry token in no failure it raises", async () => {
    stubFetch(consumeRefused("INVALID_LINK"));

    const failure = (await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT").catch(
      (error: unknown) => error,
    )) as Error;

    expect(failure.message).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toContain(
      ENTRY_TOKEN,
    );
  });

  it("reports a session that did not establish, without inventing one", async () => {
    // Accepted by the server, but this browser could not keep it.
    stubFetch({
      ok: true,
      value: {
        ...consumeAccepted().value,
        session: {
          token: "worker-session-jwt",
          tokenType: "Bearer",
          // Already expired: the delivered helper stores it and the delivered reader refuses it.
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
        },
      },
    });

    const failure = await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT").catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(QaWorkerHandoffError);
    expect((failure as QaWorkerHandoffError).stage).toBe(
      "WORKER_SESSION_NOT_ESTABLISHED",
    );
  });

  it("leaves the staff session intact when the handoff fails", async () => {
    stubFetch(consumeRefused("IDENTITY_NOT_FOUND"));

    await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT").catch(() => undefined);

    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("makes no further request after a refused entry", async () => {
    const fetchMock = stubFetch(consumeRefused("INVALID_LINK"));

    await launchQaWorkerHandoff(CANDIDATE, "PAYROLL_PAYMENT").catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------- re-entry */

describe("a session-only re-entry handoff", () => {
  it("calls the re-entry client and NEVER the launch client", async () => {
    stubFetch(consumeAccepted());

    await reEnterQaWorkerHandoff(CANDIDATE);

    expect(vi.mocked(reEnterQaWorkerExperience)).toHaveBeenCalledWith(CANDIDATE);
    // THE ZERO-PACKET GUARANTEE AT THIS LAYER. Routing a re-entry through the launch would compose
    // a real packet version, which is the single outcome the capability exists to avoid.
    expect(vi.mocked(launchQaWorkerExperience)).not.toHaveBeenCalled();
  });

  it("sends only the candidate, with no scope of any kind", async () => {
    stubFetch(consumeAccepted());

    await reEnterQaWorkerHandoff(CANDIDATE);

    expect(vi.mocked(reEnterQaWorkerExperience).mock.calls[0]).toEqual([CANDIDATE]);
  });

  it("establishes the worker session through the SAME delivered chain a launch uses", async () => {
    const fetchMock = stubFetch(consumeAccepted());

    await reEnterQaWorkerHandoff(CANDIDATE);

    // The SAME delivered consume route, the SAME body shape, the SAME recognized intent. There is
    // no second authentication path for re-entry.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/workforce/auth/magic-link/consume");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      token: ENTRY_TOKEN,
      requestedIntent: QA_WORKER_ENTRY_INTENT,
    });
    // And the session the DELIVERED helper wrote, under the DELIVERED key.
    expect(getWorkerSession()).toBeTruthy();
    expect(localStorage.getItem(WORKER_TOKEN_KEY)).toBeTruthy();
  });

  it("lands on the delivered onboarding home and builds no invocation route", async () => {
    stubFetch(consumeAccepted());

    const handoff = await reEnterQaWorkerHandoff(CANDIDATE);

    expect(handoff.workerPath).toBe("/workforce/onboarding");
    expect(handoff.workerPath).toBe(ONBOARDING_HOME);
    // NO INVOCATION SEGMENT, NO MODULE SEGMENT, NO STEP SEGMENT. The application's own runtime
    // owns packet discovery, and a browser that guessed here could send the worker to a
    // superseded packet.
    expect(handoff.workerPath).not.toContain(INVOCATION);
    expect(handoff.workerPath).not.toContain("payroll-payment");
    expect(handoff.workerPath.split("/").filter(Boolean)).toEqual([
      "workforce",
      "onboarding",
    ]);
  });

  it("returns no token, no invocation and no scope", async () => {
    stubFetch(consumeAccepted());

    const handoff = await reEnterQaWorkerHandoff(CANDIDATE);

    expect(Object.keys(handoff).sort()).toEqual([
      "candidateId",
      "expiresAt",
      "workerPath",
    ]);
    expect(JSON.stringify(handoff)).not.toContain(ENTRY_TOKEN);
    expect(handoff as Record<string, unknown>).not.toHaveProperty("workerEntryToken");
    expect(handoff as Record<string, unknown>).not.toHaveProperty("invocationId");
    expect(handoff as Record<string, unknown>).not.toHaveProperty("scope");
  });

  it("puts the entry token in no URL and in no storage of its own", async () => {
    const fetchMock = stubFetch(consumeAccepted());

    const handoff = await reEnterQaWorkerHandoff(CANDIDATE);

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain(ENTRY_TOKEN);
    }
    expect(handoff.workerPath).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(localStorage)).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(sessionStorage)).not.toContain(ENTRY_TOKEN);
  });

  it("leaves the staff session exactly as it was", async () => {
    stubFetch(consumeAccepted());

    await reEnterQaWorkerHandoff(CANDIDATE);

    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("raises ENTRY_NOT_ACCEPTED, carrying the reason and never the token", async () => {
    stubFetch(consumeRefused("INVALID_LINK"));

    const thrown = await reEnterQaWorkerHandoff(CANDIDATE).catch(
      (error: unknown) => error,
    );

    expect(thrown).toBeInstanceOf(QaWorkerHandoffError);
    expect((thrown as InstanceType<typeof QaWorkerHandoffError>).stage).toBe(
      "ENTRY_NOT_ACCEPTED",
    );
    expect((thrown as InstanceType<typeof QaWorkerHandoffError>).reason).toBe(
      "INVALID_LINK",
    );
    expect(JSON.stringify(thrown)).not.toContain(ENTRY_TOKEN);
    expect(String((thrown as Error).message)).not.toContain(ENTRY_TOKEN);
  });

  it("raises WORKER_SESSION_NOT_ESTABLISHED when the browser holds no worker session", async () => {
    // Accepted by the server, but this browser could not keep it - the same case the launch suite
    // exercises. The read-back through the delivered reader is what catches it: the re-entry path
    // establishes no session itself and must not paper over the absence.
    stubFetch({
      ok: true,
      value: {
        ...consumeAccepted().value,
        session: {
          token: "worker-session-jwt",
          tokenType: "Bearer",
          // Already expired: the delivered helper stores it and the delivered reader refuses it.
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
        },
      },
    });

    const thrown = await reEnterQaWorkerHandoff(CANDIDATE).catch(
      (error: unknown) => error,
    );

    expect(thrown).toBeInstanceOf(QaWorkerHandoffError);
    expect((thrown as InstanceType<typeof QaWorkerHandoffError>).stage).toBe(
      "WORKER_SESSION_NOT_ESTABLISHED",
    );
  });

  it("attempts no cleanup on failure, because there is nothing to clean up", async () => {
    stubFetch(consumeRefused("INVALID_LINK"));

    await reEnterQaWorkerHandoff(CANDIDATE).catch(() => undefined);

    // No compensating call was made, and the launch client was never reached at any point.
    expect(vi.mocked(launchQaWorkerExperience)).not.toHaveBeenCalled();
    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });
});

/* ----------------------------------------------------------------- boundaries */

describe("the boundaries this handoff keeps", () => {
  const file = readFileSync(join(__dirname, "qaWorkerHandoff.ts"), "utf8");
  const source = file.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("writes no storage of its own and logs nothing", () => {
    for (const forbidden of [
      "localStorage",
      "sessionStorage",
      "document.cookie",
      "indexedDB",
      "console.",
      "saveWorkerSession",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("manufactures no credential and defines no session format", () => {
    for (const forbidden of [
      "atob",
      "btoa",
      "jwt",
      "JWT",
      "sign",
      "Bearer",
      "jp_worker",
      "jp_access",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("undoes nothing when a handoff fails", () => {
    for (const forbidden of [
      "delete",
      "reset",
      "rollback",
      "clearWorkerSession",
      "clearWorkerAuth",
      "clearAccessToken",
      "purge",
      "cleanup",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("never spreads the launch response into what it returns", () => {
    expect(source).not.toContain("...launch");
    expect(source).not.toContain("workerEntryToken:");
  });

  it("keeps no module inventory to compose the packet from (QA-L5-R2)", () => {
    // WHAT THE PACKET CONTAINS IS THE SERVER'S ANSWER. A list here - even a correct one today -
    // would be a second registry in the browser, and a module registered in production later would
    // have to be added here too before packet QA could reach it.
    for (const forbidden of [
      "EMPLOYMENT_ELIGIBILITY",
      "FEDERAL_TAX",
      "EMERGENCY_CONTACT",
      "STATE_TAX",
      "BENEFITS",
      "FINAL_REVIEW",
      "modules",
      "moduleKeys",
      "MODULE_ORDER",
      "filter(",
      "sort(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("builds both destinations from the delivered route helpers only", () => {
    // No route literal of its own for either scope: the packet root and the module root are the
    // runtime's published helpers, so QA-L5 adds no page and no second packet surface.
    expect(source).toContain("packetPath(");
    expect(source).toContain("modulePath(");
    expect(source).not.toContain('"/workforce/onboarding');
    expect(source).not.toContain("`/workforce/onboarding");
  });

  it("builds NO route at all inside the re-entry function", () => {
    // THE RE-ENTRY FUNCTION'S BODY, READ FROM SOURCE. It may reference `ONBOARDING_HOME` and
    // nothing else: `modulePath` and `packetPath` both require an invocation identifier, and a
    // re-entry has none to give them. Asserting this against the source rather than only against
    // the returned value is what makes it survive a refactor that changed the route helpers.
    const body = source.slice(source.indexOf("export async function reEnterQaWorkerHandoff"));
    expect(body).toContain("ONBOARDING_HOME");
    expect(body).not.toContain("modulePath(");
    expect(body).not.toContain("packetPath(");
    expect(body).not.toContain("invocationId");
    expect(body).not.toContain("qaWorkerLandingPath(");
    expect(body).not.toContain("qaWorkerModuleSlug(");
    // And it does not reach the launch client either.
    expect(body).not.toContain("launchQaWorkerExperience(");
  });

  it("keeps the re-entry return shape free of a token and an invocation", () => {
    const shape = source.slice(
      source.indexOf("export type QaWorkerReEntry"),
      source.indexOf("export async function reEnterQaWorkerHandoff"),
    );
    expect(shape).not.toContain("workerEntryToken");
    expect(shape).not.toContain("invocationId");
    expect(shape).not.toContain("scope");
  });
});
