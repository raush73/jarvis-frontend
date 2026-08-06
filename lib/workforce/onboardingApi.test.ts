import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ONBOARDING_NO_ACTIVE_INVOCATION_CODE,
  OnboardingApiError,
  completeOnboardingModule,
  getCurrentOnboarding,
  getOnboardingModuleDraft,
  saveOnboardingModuleDraft,
  type OnboardingInvocation,
} from "./onboardingApi";
import { WORKER_SESSION_EXPIRED_CODE, WorkerSessionExpiredError } from "./workforceApi";
import {
  getApplicationSessionId,
  getWorkerSession,
  saveWorkerSession,
} from "./workerSession";

/**
 * Phase 0: the typed onboarding client. These prove the transport contract Phase 1 builds
 * against - that the server's module set and progress arrive intact, that a refusal keeps
 * its code, and that session handling matches the delivered worker client exactly.
 */

const RENEWED_TOKEN_HEADER = "X-Worker-Session-Token";
const RENEWED_EXPIRES_HEADER = "X-Worker-Session-Expires-At";

function inMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function seedLiveSession() {
  saveWorkerSession({
    token: "worker-token",
    expiresAt: inMinutes(20),
    applicationSessionId: "apps_durable",
    candidateId: "candidate-1",
  });
}

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

const INVOCATION: OnboardingInvocation = {
  invocationId: "inv-1",
  packetId: "packet-1",
  packetVersion: 1,
  packetState: "IN_PROGRESS",
  candidateId: "candidate-1",
  kind: "NAMED_MODULES",
  workflowKey: null,
  callerWorkflow: "TEST_WORKFLOW",
  invocationReason: "Test invocation",
  replayed: false,
  modules: [
    {
      moduleKey: "MODULE_A",
      moduleNumber: "4.101",
      title: "Module A",
      requirementReason: "INITIAL",
      requiredQualifier: null,
      position: 0,
      status: "PENDING",
      hasWorkerPhase: true,
      completionGranularity: "MODULE",
      producesGeneratedArtifact: false,
      dependsOn: [],
      mw4hPhaseRecorded: false,
    },
    {
      moduleKey: "MODULE_B",
      moduleNumber: "4.102",
      title: "Module B",
      requirementReason: "INITIAL",
      requiredQualifier: null,
      position: 1,
      status: "BLOCKED",
      hasWorkerPhase: true,
      completionGranularity: "MODULE",
      producesGeneratedArtifact: false,
      dependsOn: ["MODULE_A"],
      mw4hPhaseRecorded: false,
    },
  ],
  nextModuleKey: "MODULE_A",
  completion: { complete: false, requiredCount: 2, completeCount: 0 },
};

describe("onboardingApi", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("current invocation", () => {
    it("returns the server-supplied module set, order, status, and denominator", async () => {
      seedLiveSession();
      vi.stubGlobal("fetch", respondWith(200, { ok: true, value: INVOCATION }));

      const result = await getCurrentOnboarding();

      expect(result.modules.map((m) => m.moduleKey)).toEqual(["MODULE_A", "MODULE_B"]);
      expect(result.modules.map((m) => m.position)).toEqual([0, 1]);
      expect(result.modules.map((m) => m.status)).toEqual(["PENDING", "BLOCKED"]);
      expect(result.completion.requiredCount).toBe(2);
      // The next module is the server's answer, not a local index into the list.
      expect(result.nextModuleKey).toBe("MODULE_A");
    });

    it("sends the worker credential and calls the worker onboarding route", async () => {
      seedLiveSession();
      const fetchMock = respondWith(200, { ok: true, value: INVOCATION });
      vi.stubGlobal("fetch", fetchMock);

      await getCurrentOnboarding();

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain("/workforce/onboarding");
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: "Bearer worker-token",
      });
    });

    it("exposes no way to require onboarding from the worker client", async () => {
      const client = await import("./onboardingApi");
      expect(
        Object.keys(client).filter((name) => /^invoke|^start|^require/i.test(name)),
      ).toEqual([]);
    });
  });

  describe("module drafts", () => {
    it("reads a module draft", async () => {
      seedLiveSession();
      vi.stubGlobal(
        "fetch",
        respondWith(200, {
          ok: true,
          value: {
            packetId: "packet-1",
            moduleKey: "MODULE_A",
            data: { answer: "yes" },
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      );

      const draft = await getOnboardingModuleDraft("MODULE_A");
      expect(draft.data).toEqual({ answer: "yes" });
    });

    it("saves a module draft with PUT and the data envelope", async () => {
      seedLiveSession();
      const fetchMock = respondWith(200, {
        ok: true,
        value: {
          packetId: "packet-1",
          moduleKey: "MODULE_A",
          data: { answer: "yes" },
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      });
      vi.stubGlobal("fetch", fetchMock);

      await saveOnboardingModuleDraft("MODULE_A", { answer: "yes" });

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain("/workforce/onboarding/modules/MODULE_A/draft");
      expect((init as RequestInit).method).toBe("PUT");
      expect(JSON.parse(String((init as RequestInit).body))).toEqual({
        data: { answer: "yes" },
      });
    });

    it("encodes a module key into the path", async () => {
      seedLiveSession();
      const fetchMock = respondWith(200, {
        ok: true,
        value: { packetId: "p", moduleKey: "A/B", data: {}, updatedAt: null },
      });
      vi.stubGlobal("fetch", fetchMock);

      await getOnboardingModuleDraft("A/B");
      expect(String(fetchMock.mock.calls[0][0])).toContain("modules/A%2FB/draft");
    });
  });

  describe("module completion", () => {
    it("returns the completion outcome and the recomputed progress", async () => {
      seedLiveSession();
      vi.stubGlobal(
        "fetch",
        respondWith(200, {
          ok: true,
          value: {
            moduleKey: "MODULE_A",
            completionId: "completion-1",
            effectiveFrom: "2026-01-01T00:00:00.000Z",
            versionCreated: true,
            alreadyComplete: false,
            completion: { complete: false, requiredCount: 2, completeCount: 1 },
            nextModuleKey: "MODULE_B",
          },
        }),
      );

      const result = await completeOnboardingModule("MODULE_A");
      expect(result.versionCreated).toBe(true);
      expect(result.completion.completeCount).toBe(1);
      expect(result.nextModuleKey).toBe("MODULE_B");
    });

    it("sends a no-change confirmation when the worker confirms nothing changed", async () => {
      seedLiveSession();
      const fetchMock = respondWith(200, {
        ok: true,
        value: {
          moduleKey: "MODULE_A",
          completionId: "completion-1",
          effectiveFrom: "2026-01-01T00:00:00.000Z",
          versionCreated: false,
          alreadyComplete: false,
          completion: { complete: true, requiredCount: 1, completeCount: 1 },
          nextModuleKey: null,
        },
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await completeOnboardingModule("MODULE_A", { confirmNoChange: true });

      expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
        confirmNoChange: true,
      });
      expect(result.versionCreated).toBe(false);
    });

    it("surfaces the module's own validation codes on a refusal", async () => {
      seedLiveSession();
      vi.stubGlobal(
        "fetch",
        respondWith(400, {
          statusCode: 400,
          code: "MODULE_COMPLETION_INVALID",
          details: { moduleKey: "MODULE_A", errors: ["ANSWER_REQUIRED"] },
        }),
      );

      await expect(completeOnboardingModule("MODULE_A")).rejects.toMatchObject({
        name: "OnboardingApiError",
        status: 400,
        code: "MODULE_COMPLETION_INVALID",
        fieldErrors: ["ANSWER_REQUIRED"],
      });
    });
  });

  describe("refusals and session handling", () => {
    it("keeps the session when onboarding refuses on authorization grounds", async () => {
      seedLiveSession();
      vi.stubGlobal(
        "fetch",
        respondWith(403, {
          statusCode: 403,
          code: "INVOCATION_NOT_OWNED_BY_WORKER",
          message: "This onboarding packet belongs to a different worker",
        }),
      );

      await expect(getCurrentOnboarding()).rejects.toBeInstanceOf(OnboardingApiError);
      // The credential was refused authorization, not invalidated.
      expect(getWorkerSession()?.token).toBe("worker-token");
    });

    it("distinguishes having no onboarding from an error", async () => {
      seedLiveSession();
      vi.stubGlobal(
        "fetch",
        respondWith(404, {
          statusCode: 404,
          code: ONBOARDING_NO_ACTIVE_INVOCATION_CODE,
          message: "This worker has no active onboarding invocation",
        }),
      );

      try {
        await getCurrentOnboarding();
        throw new Error("expected a refusal");
      } catch (error) {
        expect(error).toBeInstanceOf(OnboardingApiError);
        expect((error as OnboardingApiError).noActiveInvocation).toBe(true);
      }
    });

    it("clears the credential but keeps the application session when the session ends", async () => {
      seedLiveSession();
      vi.stubGlobal(
        "fetch",
        respondWith(401, { statusCode: 401, code: WORKER_SESSION_EXPIRED_CODE }),
      );

      await expect(getCurrentOnboarding()).rejects.toBeInstanceOf(WorkerSessionExpiredError);
      // The credential is gone, but the durable application session identifier survives so
      // the draft it keys is not orphaned.
      expect(getWorkerSession()).toBeNull();
      expect(getApplicationSessionId()).toBe("apps_durable");
    });

    it("refuses to call the server at all without a worker credential", async () => {
      const fetchMock = respondWith(200, { ok: true, value: INVOCATION });
      vi.stubGlobal("fetch", fetchMock);

      await expect(getCurrentOnboarding()).rejects.toBeInstanceOf(WorkerSessionExpiredError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("adopts a renewed session from the response headers", async () => {
      seedLiveSession();
      const renewedExpiry = inMinutes(60);
      vi.stubGlobal(
        "fetch",
        respondWith(
          200,
          { ok: true, value: INVOCATION },
          {
            [RENEWED_TOKEN_HEADER]: "renewed-token",
            [RENEWED_EXPIRES_HEADER]: renewedExpiry,
          },
        ),
      );

      await getCurrentOnboarding();

      const session = getWorkerSession();
      expect(session?.token).toBe("renewed-token");
      expect(session?.expiresAt).toBe(renewedExpiry);
    });
  });
});
