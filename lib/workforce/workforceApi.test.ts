import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WORKER_SESSION_EXPIRED_CODE,
  WORKER_SESSION_INVALID_CODE,
  WorkerSessionExpiredError,
  WorkforceApiError,
  getToolsPpe,
  savePpe,
} from "./workforceApi";
import { getWorkerSession, saveWorkerSession } from "./workerSession";

/**
 * C4D: the worker session must slide while an applicant is working, and an ended session
 * must never take the durable draft identifier down with it.
 */

const TOKEN_KEY = "jp_workerSession";
const EXPIRES_KEY = "jp_workerSessionExpiresAt";
const APPLICATION_SESSION_KEY = "jp_workerApplicationSessionId";
const CANDIDATE_KEY = "jp_workerCandidateId";

const RENEWED_TOKEN_HEADER = "X-Worker-Session-Token";
const RENEWED_EXPIRES_HEADER = "X-Worker-Session-Expires-At";

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** A live session mid-application: token, expiry, and the durable application session. */
function seedLiveSession(expiresAt = inMinutes(20)) {
  saveWorkerSession({
    token: "original-token",
    expiresAt,
    applicationSessionId: "apps_durable",
    candidateId: null,
  });
}

function respondWith(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const response = {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    json: async () => body,
  };
  return vi.fn().mockResolvedValue(response as unknown as Response);
}

describe("workerFetch session handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* ------------------------------------------------------------------ */
  /*  Sliding renewal                                                    */
  /* ------------------------------------------------------------------ */

  it("adopts a renewed token and expiry from the response headers", async () => {
    seedLiveSession();
    const renewedExpiry = inMinutes(60);
    vi.stubGlobal(
      "fetch",
      respondWith(200, { ok: true, value: { hasTools: null } }, {
        [RENEWED_TOKEN_HEADER]: "renewed-token",
        [RENEWED_EXPIRES_HEADER]: renewedExpiry,
      }),
    );

    await getToolsPpe();

    expect(localStorage.getItem(TOKEN_KEY)).toBe("renewed-token");
    expect(localStorage.getItem(EXPIRES_KEY)).toBe(renewedExpiry);
  });

  it("keeps the application session and candidate linkage across a renewal", async () => {
    saveWorkerSession({
      token: "original-token",
      expiresAt: inMinutes(20),
      applicationSessionId: "apps_durable",
      candidateId: "cand_9",
    });
    vi.stubGlobal(
      "fetch",
      respondWith(200, { ok: true, value: { hasTools: null } }, {
        [RENEWED_TOKEN_HEADER]: "renewed-token",
        [RENEWED_EXPIRES_HEADER]: inMinutes(60),
      }),
    );

    await getToolsPpe();

    expect(localStorage.getItem(APPLICATION_SESSION_KEY)).toBe("apps_durable");
    expect(localStorage.getItem(CANDIDATE_KEY)).toBe("cand_9");
  });

  it("leaves the stored session untouched when no renewal headers are sent", async () => {
    const expiresAt = inMinutes(20);
    seedLiveSession(expiresAt);
    vi.stubGlobal("fetch", respondWith(200, { ok: true, value: { hasTools: null } }));

    await getToolsPpe();

    expect(localStorage.getItem(TOKEN_KEY)).toBe("original-token");
    expect(localStorage.getItem(EXPIRES_KEY)).toBe(expiresAt);
  });

  it("sends the stored token and later sends the renewed one", async () => {
    seedLiveSession();
    const fetchMock = respondWith(200, { ok: true, value: { hasTools: null } }, {
      [RENEWED_TOKEN_HEADER]: "renewed-token",
      [RENEWED_EXPIRES_HEADER]: inMinutes(60),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getToolsPpe();
    await getToolsPpe();

    const authorizations = fetchMock.mock.calls.map(
      (call) => (call[1] as RequestInit).headers as Record<string, string>,
    );
    expect(authorizations[0].Authorization).toBe("Bearer original-token");
    expect(authorizations[1].Authorization).toBe("Bearer renewed-token");
  });

  /* ------------------------------------------------------------------ */
  /*  An ended session must not orphan the durable draft                 */
  /* ------------------------------------------------------------------ */

  it("clears only the credential when the session expired, preserving applicationSessionId", async () => {
    seedLiveSession();
    vi.stubGlobal(
      "fetch",
      respondWith(401, {
        statusCode: 401,
        code: WORKER_SESSION_EXPIRED_CODE,
        message: "Worker session expired",
      }),
    );

    await expect(getToolsPpe()).rejects.toBeInstanceOf(WorkerSessionExpiredError);

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(EXPIRES_KEY)).toBeNull();
    // The draft on the server is keyed by this. Losing it would strand the application.
    expect(localStorage.getItem(APPLICATION_SESSION_KEY)).toBe("apps_durable");
  });

  it("preserves applicationSessionId when the session is rejected as invalid", async () => {
    seedLiveSession();
    vi.stubGlobal(
      "fetch",
      respondWith(401, {
        statusCode: 401,
        code: WORKER_SESSION_INVALID_CODE,
        message: "Invalid worker session",
      }),
    );

    await expect(savePpe(["ppe_1"])).rejects.toBeInstanceOf(WorkerSessionExpiredError);
    expect(localStorage.getItem(APPLICATION_SESSION_KEY)).toBe("apps_durable");
  });

  it("distinguishes an expired session from a rejected one", async () => {
    seedLiveSession();
    vi.stubGlobal(
      "fetch",
      respondWith(401, { code: WORKER_SESSION_EXPIRED_CODE, message: "Worker session expired" }),
    );
    await expect(getToolsPpe()).rejects.toMatchObject({
      code: WORKER_SESSION_EXPIRED_CODE,
      expired: true,
    });

    seedLiveSession();
    vi.stubGlobal(
      "fetch",
      respondWith(401, { code: WORKER_SESSION_INVALID_CODE, message: "Invalid worker session" }),
    );
    await expect(getToolsPpe()).rejects.toMatchObject({
      code: WORKER_SESSION_INVALID_CODE,
      expired: false,
    });
  });

  it("treats a 401 with no code as an expired session", async () => {
    seedLiveSession();
    vi.stubGlobal("fetch", respondWith(401, { message: "Worker session required" }));

    await expect(getToolsPpe()).rejects.toMatchObject({
      code: WORKER_SESSION_EXPIRED_CODE,
    });
    expect(localStorage.getItem(APPLICATION_SESSION_KEY)).toBe("apps_durable");
  });

  /* ------------------------------------------------------------------ */
  /*  An unrelated 403 is not a session failure                          */
  /* ------------------------------------------------------------------ */

  it("does not destroy the session on a 403 that is not about the session", async () => {
    const expiresAt = inMinutes(20);
    seedLiveSession(expiresAt);
    vi.stubGlobal("fetch", respondWith(403, { message: "This stage is closed." }));

    const error = await getToolsPpe().catch((err: unknown) => err);

    expect(error).toBeInstanceOf(WorkforceApiError);
    expect(error).not.toBeInstanceOf(WorkerSessionExpiredError);
    expect((error as WorkforceApiError).message).toBe("This stage is closed.");
    // Nothing about the session was wrong, so nothing about it is discarded.
    expect(getWorkerSession()).toEqual({
      token: "original-token",
      expiresAt,
      applicationSessionId: "apps_durable",
      candidateId: null,
    });
  });

  it("treats a 403 that names a session code as a session failure", async () => {
    seedLiveSession();
    vi.stubGlobal(
      "fetch",
      respondWith(403, { code: WORKER_SESSION_INVALID_CODE, message: "Invalid worker session" }),
    );

    await expect(getToolsPpe()).rejects.toBeInstanceOf(WorkerSessionExpiredError);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(APPLICATION_SESSION_KEY)).toBe("apps_durable");
  });

  /* ------------------------------------------------------------------ */
  /*  No usable credential at all                                        */
  /* ------------------------------------------------------------------ */

  it("fails before calling the backend when the stored session has already lapsed", async () => {
    seedLiveSession(inMinutes(-1));
    const fetchMock = respondWith(200, { ok: true, value: {} });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getToolsPpe()).rejects.toBeInstanceOf(WorkerSessionExpiredError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(APPLICATION_SESSION_KEY)).toBe("apps_durable");
  });
});
