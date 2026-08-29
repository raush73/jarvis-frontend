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
 *  - A refused entry, and a session that failed to establish, both raise a safe failure - and
 *    neither one deletes, resets or rolls anything back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("./qaWorkerExperienceApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./qaWorkerExperienceApi")>();
  return { ...actual, launchQaWorkerExperience: vi.fn() };
});

const { launchQaWorkerExperience } = await import("./qaWorkerExperienceApi");
const {
  QA_WORKER_ENTRY_INTENT,
  QaWorkerHandoffError,
  launchQaWorkerHandoff,
  qaWorkerModuleSlug,
} = await import("./qaWorkerHandoff");
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
    moduleScope: "PAYROLL_PAYMENT",
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

    await launchQaWorkerHandoff(CANDIDATE);

    expect(vi.mocked(launchQaWorkerExperience)).toHaveBeenCalledWith(CANDIDATE);
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

    const handoff = await launchQaWorkerHandoff(CANDIDATE);

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain(ENTRY_TOKEN);
    }
    expect(handoff.workerPath).not.toContain(ENTRY_TOKEN);
  });

  it("establishes the delivered worker session, under the delivered keys", async () => {
    stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE);

    expect(localStorage.getItem(WORKER_TOKEN_KEY)).toBe("worker-session-jwt");
    const session = getWorkerSession();
    expect(session?.applicationSessionId).toBe("app_session_qa_1");
    expect(session?.candidateId).toBe(CANDIDATE);
  });

  it("persists the entry token nowhere", async () => {
    stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE);

    expect(JSON.stringify(window.localStorage)).not.toContain(ENTRY_TOKEN);
    expect(JSON.stringify(window.sessionStorage)).not.toContain(ENTRY_TOKEN);
    expect(document.cookie).not.toContain(ENTRY_TOKEN);
  });

  it("leaves the staff session exactly as it was", async () => {
    stubFetch(consumeAccepted());

    await launchQaWorkerHandoff(CANDIDATE);

    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("returns the server's facts and no token", async () => {
    stubFetch(consumeAccepted());

    const handoff = await launchQaWorkerHandoff(CANDIDATE);

    expect(handoff).toEqual({
      candidateId: CANDIDATE,
      invocationId: INVOCATION,
      moduleScope: "PAYROLL_PAYMENT",
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

    const handoff = await launchQaWorkerHandoff(CANDIDATE);

    expect(handoff.workerPath).toBe(
      "/workforce/onboarding/inv_qa_second/payroll-payment",
    );
    // The module root, so the delivered entry route asks the SERVER which step resumes.
    expect(handoff.workerPath.endsWith("/payroll-payment")).toBe(true);
  });

  it("derives the module segment from the scope the server returned", () => {
    expect(qaWorkerModuleSlug("PAYROLL_PAYMENT")).toBe("payroll-payment");
    expect(qaWorkerModuleSlug(" EMPLOYMENT_ELIGIBILITY ")).toBe(
      "employment-eligibility",
    );
  });
});

/* --------------------------------------------------------------- the failures */

describe("a handoff that stops after the run exists", () => {
  it("reports a refused entry with the delivered reason code", async () => {
    stubFetch(consumeRefused("INVALID_LINK"));

    const failure = await launchQaWorkerHandoff(CANDIDATE).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(QaWorkerHandoffError);
    expect((failure as QaWorkerHandoffError).stage).toBe("ENTRY_NOT_ACCEPTED");
    expect((failure as QaWorkerHandoffError).reason).toBe("INVALID_LINK");
  });

  it("puts the entry token in no failure it raises", async () => {
    stubFetch(consumeRefused("INVALID_LINK"));

    const failure = (await launchQaWorkerHandoff(CANDIDATE).catch(
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

    const failure = await launchQaWorkerHandoff(CANDIDATE).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(QaWorkerHandoffError);
    expect((failure as QaWorkerHandoffError).stage).toBe(
      "WORKER_SESSION_NOT_ESTABLISHED",
    );
  });

  it("leaves the staff session intact when the handoff fails", async () => {
    stubFetch(consumeRefused("IDENTITY_NOT_FOUND"));

    await launchQaWorkerHandoff(CANDIDATE).catch(() => undefined);

    expect(localStorage.getItem(STAFF_TOKEN_KEY)).toBe("staff-token");
  });

  it("makes no further request after a refused entry", async () => {
    const fetchMock = stubFetch(consumeRefused("INVALID_LINK"));

    await launchQaWorkerHandoff(CANDIDATE).catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledTimes(1);
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
});
