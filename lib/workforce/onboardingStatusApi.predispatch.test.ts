/**
 * Gate 10C-E4 slice E4-2 - the PRE_DISPATCH readiness contract, at the wire.
 *
 * This slice added no behaviour. It made the client's description of an EXISTING response
 * accurate, so what has to be proven is a description rather than an interaction:
 *
 *  - THE FOUR SECURED FIELDS ARE ALL MIRRORED, and are mirrored with the server's types. The
 *    fixture below is typed as the contract, so a missing or wrongly-typed field is a
 *    typecheck failure rather than something a reviewer has to notice.
 *  - THE VOCABULARY IS THE SERVER'S FOUR STATES AND THERE IS NO FIFTH. A client that
 *    invented a state would be a client deciding a verdict the server is answerable for, so
 *    exhaustiveness is asserted in both directions and the deferred verification-category
 *    tokens are proven unassignable.
 *  - THE REQUEST DID NOT CHANGE. Same route, same read, same staff credential, still no
 *    query string, and still nothing attempted without a session.
 *  - EXACTLY ONE SURFACE CONSUMES IT. The read is performed by the Vetting PRE_DISPATCH
 *    loader and by nothing else, and the fields themselves reach only that loader, the
 *    candidate model it attaches them to, and the ONE Vetting surface authorized to word
 *    them. This is asserted against the source tree rather than promised in prose, and the
 *    lists are exact, so a second loader or an unauthorized screen fails here rather than
 *    arriving unnoticed. `READY` is a fact about onboarding; ENFORCING it remains a later
 *    slice's authorization, and this one must be provably short of it.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE } from "@/lib/api";
import * as statusApi from "./onboardingStatusApi";
import {
  getOnboardingPreDispatchStatus,
  type OnboardingPreDispatchReadinessState,
  type OnboardingPreDispatchStatus,
} from "./onboardingStatusApi";

const TOKEN_KEY = "jp_accessToken";
const CANDIDATE = "candidate-1";
const ROUTE = `${API_BASE}/workforce/onboarding/status/internal/pre-dispatch/${CANDIDATE}`;
const ROOT = process.cwd();

/** Compile-time only: whether `A` is assignable to `B`. */
type Assignable<A, B> = A extends B ? true : false;

/** Compile-time only: fails to typecheck unless the parameter is exactly `false`. */
type Refused<T extends false> = T;

/**
 * THE WHOLE PRE_DISPATCH RESPONSE, AS A VALUE.
 *
 * Typed as the contract rather than as a loose object, which is what makes it a proof: this
 * literal does not compile if a secured field is absent, is optional, or carries a different
 * type, and it does not compile if a field the Owner deferred is added to it.
 */
const READY: OnboardingPreDispatchStatus = {
  candidateId: CANDIDATE,
  audience: "PRE_DISPATCH",
  published: {
    state: "NOT_YET_PUBLISHED",
    publishedAt: null,
    packetId: null,
    packetVersion: null,
    label: "Not yet published",
  },
  work: "ALL_MODULES_COMPLETE",
  workLabel: "Onboarding complete",
  generatedAt: "2026-09-05T12:00:00.000Z",
  modulesDeclaringPreDispatchEvaluation: [],
  readinessState: "READY",
  workerObligationsOutstanding: false,
  verificationOutstanding: false,
  withheldConfidentialCount: 0,
};

/** The same response for a worker who is not ready, and for a confidential blocker. */
const OUTSTANDING: OnboardingPreDispatchStatus = {
  ...READY,
  work: "OUTSTANDING",
  workLabel: "Onboarding outstanding",
  readinessState: "WORKER_OBLIGATIONS_OUTSTANDING",
  workerObligationsOutstanding: true,
  withheldConfidentialCount: 2,
};

/** The enumerated contract. A field added to the wire has to be added here deliberately. */
const CONTRACT_KEYS = [
  "audience",
  "candidateId",
  "generatedAt",
  "modulesDeclaringPreDispatchEvaluation",
  "published",
  "readinessState",
  "verificationOutstanding",
  "withheldConfidentialCount",
  "work",
  "workLabel",
  "workerObligationsOutstanding",
];

/** Every spelling by which a surface could reach this contract or its readiness facts. */
const READINESS_TOKENS = [
  "OnboardingPreDispatchStatus",
  "OnboardingPreDispatchReadinessState",
  "getOnboardingPreDispatchStatus",
  "readinessState",
  "workerObligationsOutstanding",
  "verificationOutstanding",
  "withheldConfidentialCount",
];

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

/** The one request that was made. */
function sentTo(): { url: string; method: string; authorization: string | null } {
  const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
  return {
    url: String(url),
    method: String(init.method ?? "GET"),
    authorization: (init.headers as Headers).get("Authorization"),
  };
}

function sourceFilesUnder(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);
  return files;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(TOKEN_KEY, "staff-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Gate 10C-E4 - the PRE_DISPATCH readiness contract", () => {
  describe("the mirrored contract", () => {
    it("carries all four secured readiness fields, with the server's types", () => {
      expect(READY.readinessState).toBe("READY");
      expect(READY.workerObligationsOutstanding).toBe(false);
      expect(READY.verificationOutstanding).toBe(false);
      expect(READY.withheldConfidentialCount).toBe(0);

      // Present as required fields, not as optional ones a server could omit.
      for (const field of [
        "readinessState",
        "workerObligationsOutstanding",
        "verificationOutstanding",
        "withheldConfidentialCount",
      ]) {
        expect({ field, present: field in READY }).toEqual({ field, present: true });
      }
    });

    it("describes the whole response and invents no field of its own", () => {
      // The pre-E4 fields are still here: the extension was additive, so a caller written
      // against the delivered contract keeps working unchanged.
      expect(Object.keys(READY).sort()).toEqual(CONTRACT_KEYS);
      expect(CONTRACT_KEYS).toContain("modulesDeclaringPreDispatchEvaluation");
      expect(CONTRACT_KEYS).toContain("published");
    });

    it("permits exactly the four governed states, and no fifth", () => {
      // Exhaustive in BOTH directions: a missing state fails to satisfy the record, and an
      // invented one is an excess property.
      const EVERY_STATE: Record<OnboardingPreDispatchReadinessState, true> = {
        NO_ONBOARDING_ON_FILE: true,
        WORKER_OBLIGATIONS_OUTSTANDING: true,
        VERIFICATION_OUTSTANDING: true,
        READY: true,
      };

      expect(Object.keys(EVERY_STATE).sort()).toEqual([
        "NO_ONBOARDING_ON_FILE",
        "READY",
        "VERIFICATION_OUTSTANDING",
        "WORKER_OBLIGATIONS_OUTSTANDING",
      ]);
    });

    it("holds neither the deferred verification-category detail nor a scope field", () => {
      /**
       * OWNER DECISIONS E4-C2 AND E4-C3, PROVEN RATHER THAN PROMISED.
       *
       * `RECORD_STALE` and `RECORD_ABSENT` were deferred because reporting WHICH revalidation
       * category remains would either difference the confidential count or widen the
       * readiness contract. A scope field was deferred because no canonical production
       * action-classification vocabulary exists to mirror. Neither may arrive here by being
       * quietly assignable to the state union.
       *
       * These constants are `false` BY TYPE: `Refused<...>` fails to compile unless the
       * literal really is unassignable, so a widened vocabulary breaks the typecheck.
       */
      const recordStale: Refused<
        Assignable<"RECORD_STALE", OnboardingPreDispatchReadinessState>
      > = false;
      const recordAbsent: Refused<
        Assignable<"RECORD_ABSENT", OnboardingPreDispatchReadinessState>
      > = false;
      const invented: Refused<
        Assignable<"DISPATCH_READY", OnboardingPreDispatchReadinessState>
      > = false;

      expect([recordStale, recordAbsent, invented]).toEqual([false, false, false]);

      // And no field of either kind exists on the response at all.
      expect(CONTRACT_KEYS).not.toContain("scope");
      expect(CONTRACT_KEYS).not.toContain("verificationCategory");
      const source = readFileSync(
        join(ROOT, "lib/workforce/onboardingStatusApi.ts"),
        "utf8",
      );
      expect(source).not.toContain("RECORD_STALE");
      expect(source).not.toContain("RECORD_ABSENT");
      // No DECLARED scope property anywhere in the client, on this or any other projection.
      // Matched as a declaration rather than as the English word, so the guard catches the
      // field the Owner deferred without forbidding prose that discusses it.
      expect(source).not.toMatch(/^\s*scope\??:/m);
    });
  });

  describe("the read, unchanged by this slice", () => {
    it("asks the delivered route as a read, with no query at all", async () => {
      vi.stubGlobal("fetch", ok(READY));

      await getOnboardingPreDispatchStatus(CANDIDATE);

      // NO `?` ANYWHERE, and the staff credential the delivered client always carried.
      expect(sentTo()).toEqual({
        url: ROUTE,
        method: "GET",
        authorization: "Bearer staff-token",
      });
    });

    it("returns the server's readiness facts verbatim, adding and dropping nothing", async () => {
      vi.stubGlobal("fetch", ok(OUTSTANDING));

      const value = await getOnboardingPreDispatchStatus(CANDIDATE);

      // Verbatim: the client does not recompute the verdict from the booleans, and does not
      // "correct" a blocked verdict whose only blocker is a withheld confidential module.
      expect(value.readinessState).toBe("WORKER_OBLIGATIONS_OUTSTANDING");
      expect(value.workerObligationsOutstanding).toBe(true);
      expect(value.verificationOutstanding).toBe(false);
      expect(value.withheldConfidentialCount).toBe(2);
      expect(Object.keys(value).sort()).toEqual(CONTRACT_KEYS);
    });

    it("escapes the candidate identifier rather than trusting its shape", async () => {
      vi.stubGlobal("fetch", ok(READY));

      await getOnboardingPreDispatchStatus("cand/a b&c=d");

      expect(sentTo().url).toBe(
        `${API_BASE}/workforce/onboarding/status/internal/pre-dispatch/cand%2Fa%20b%26c%3Dd`,
      );
    });

    it("attempts nothing at all without a staff session", async () => {
      localStorage.removeItem(TOKEN_KEY);
      const fetchMock = ok(READY);
      vi.stubGlobal("fetch", fetchMock);

      await expect(getOnboardingPreDispatchStatus(CANDIDATE)).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps a refusal a refusal, with its framework code", async () => {
      vi.stubGlobal(
        "fetch",
        respondWith(403, {
          statusCode: 403,
          code: "FORBIDDEN",
          message: "This read requires a grant you do not hold",
        }),
      );

      const failure = await getOnboardingPreDispatchStatus(CANDIDATE).catch(
        (error: unknown) => error,
      );

      expect((failure as { status?: number }).status).toBe(403);
      expect((failure as { code?: string }).code).toBe("FORBIDDEN");
    });
  });

  describe("exactly one authorized consumer, which is now the whole of the restraint", () => {
    /**
     * E4-2 asserted that NOTHING consumed this contract, because at that point nothing was
     * authorized to. Slice E4-4 authorized exactly one consumer - the Vetting PRE_DISPATCH
     * data loader - so the assertion moves from "no consumer" to "THAT CONSUMER AND NO OTHER".
     * It is deliberately not relaxed into a floor: the lists below are exact, so an indicator,
     * a gate, a dispatch button or a second loader still fails here rather than arriving
     * unnoticed.
     */
    it("is CALLED by the authorized Vetting loader and by nothing else", () => {
      const callers = ["components", "app", "lib", "data"]
        .flatMap((directory) => sourceFilesUnder(join(ROOT, directory)))
        .filter((file) => {
          // A CALL, not a type reference: the risk being guarded is an unaudited read
          // arriving from a surface nobody authorized, and every such read is a call.
          const source = readFileSync(file, "utf8");
          return /getOnboardingPreDispatchStatus\s*\(/.test(source);
        })
        .map((file) => relative(ROOT, file).split(sep).join("/"))
        // The client itself DECLARES the function; declaring it is not consuming it.
        .filter((path) => path !== "lib/workforce/onboardingStatusApi.ts")
        .sort();

      // The Vetting loader, and this suite exercising the client against a stubbed transport.
      // The E4-4 suite is deliberately absent: it MOCKS the read rather than performing one,
      // which is why a test cannot become a second consumer by accident.
      expect(callers).toEqual([
        "app/orders/[id]/vetting/useVettingData.ts",
        "lib/workforce/onboardingStatusApi.predispatch.test.ts",
      ]);
    });

    it("reaches no surface beyond that loader, the candidate model, and the one authorized screen", () => {
      const referrers = ["components", "app", "lib", "data"]
        .flatMap((directory) => sourceFilesUnder(join(ROOT, directory)))
        .filter((file) => {
          const source = readFileSync(file, "utf8");
          return READINESS_TOKENS.some((token) => source.includes(token));
        })
        .map((file) => relative(ROOT, file).split(sep).join("/"))
        .sort();

      // The client that declares the contract, the four suites that prove it, the ONE
      // authorized loader, the candidate model the loader attaches the projection to, and -
      // as of E4-5 - the ONE screen authorized to word the verdict. A second screen, a
      // Recruiting surface or a dispatch gate would appear here and fail.
      //
      // The selection-gate suite joined this list when the verdict began governing the
      // PRE_DISPATCH dispatch-selection checkbox. It is still ONE screen: that gate lives in
      // the same authorized page, which is why no new production entry accompanies it.
      expect(referrers).toEqual([
        "app/orders/[id]/vetting/page.tsx",
        "app/orders/[id]/vetting/useVettingData.onboarding.test.ts",
        "app/orders/[id]/vetting/useVettingData.ts",
        "app/orders/[id]/vetting/vettingOnboardingClearance.test.tsx",
        "app/orders/[id]/vetting/vettingOnboardingSelectionGate.test.tsx",
        "data/mockRecruitingData.ts",
        "lib/workforce/onboardingStatusApi.predispatch.test.ts",
        "lib/workforce/onboardingStatusApi.ts",
      ]);
    });

    it("reaches no shared component, so no other screen can render the verdict", () => {
      // E4-5 AUTHORIZED ONE SCREEN, NOT A REUSABLE WIDGET. The clearance indicator lives
      // inside the Vetting page, so the shared component library stays innocent of this
      // contract and no other surface can grow a verdict by importing one. A shared
      // `OnboardingClearanceBadge` would appear here and fail, which is the point.
      const components = sourceFilesUnder(join(ROOT, "components")).filter((file) => {
        const source = readFileSync(file, "utf8");
        return READINESS_TOKENS.some((token) => source.includes(token));
      });

      expect(components).toEqual([]);
    });

    it("added no write, no movement, and no dispatch to the status client", () => {
      // The client's entire runtime surface. Every export is a READ, by name and by count, so
      // a function that moved a candidate, created an assignment, gated a button, or
      // dispatched a worker cannot have arrived unnoticed.
      const surface = Object.keys(statusApi).sort();

      expect(surface).toEqual([
        "getOnboardingAdministrativeStatus",
        "getOnboardingCompletionDetail",
        "getOnboardingPreDispatchStatus",
        "getOnboardingPublishedCompletion",
        "getOnboardingRecruitingStatus",
        "getOnboardingVettingStatus",
        "getOnboardingWorkerCompletionDetail",
        "getOnboardingWorkerStatus",
      ]);
      expect(surface.filter((name) => !name.startsWith("get"))).toEqual([]);
    });
  });
});
