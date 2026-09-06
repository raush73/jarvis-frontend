/**
 * Gate 10C-E4 slice E4-4 - the Vetting lane consumes authoritative Onboarding PRE_DISPATCH
 * readiness.
 *
 * This slice is DATA WIRING, so what has to be proven is an interaction rather than a shape:
 * WHO is asked, WITH WHICH IDENTITY, HOW OFTEN, and WHAT IS RECORDED WHEN THE ANSWER DOES
 * NOT ARRIVE.
 *
 *  - THE IDENTITY IS THE WORKFORCE ONE. `candidate.candidateId` is `Candidate.id`;
 *    `candidate.id` is the order-scoped `OrderCandidate.id`. Substituting the second would
 *    ask onboarding about a worker who does not exist, under a staff grant and an audit
 *    event, so the suite asserts the identity used AND that the order-scoped one never
 *    appears in a request.
 *  - ONLY THE LANE IS ASKED, AND EACH WORKER ONCE. Successful reads are audited server-side,
 *    which makes a redundant read a real cost rather than a tidiness question - so other
 *    buckets, identity-less candidates and duplicate appearances are all proven silent.
 *  - A FAILED READ IS NOT A BUSINESS VERDICT. The distinction between "onboarding says X" and
 *    "onboarding could not be reached" is the whole reason the attachment is a union, and it
 *    is asserted structurally: no failed read can present a `readinessState` of any kind, and
 *    least of all `READY`.
 *  - ASSOCIATION SURVIVES COMPLETION ORDER. Responses are matched to the identity they were
 *    requested for, so the suite resolves them backwards and expects no cross-association.
 *  - NOTHING REFRESHES ITSELF. No polling, no timer, no revalidation loop: readiness follows
 *    the loader's existing deliberate lifecycle and only that.
 *
 * No rendering is asserted anywhere, because E4-4 renders nothing. Visual semantics are
 * E4-5's separately governed slice.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BucketId, Candidate } from "@/data/mockRecruitingData";
import type { OnboardingPreDispatchStatus } from "@/lib/workforce/onboardingStatusApi";

vi.mock("@/lib/api", () => ({
  API_BASE: "http://api.test",
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/workforce/onboardingStatusApi", () => ({
  getOnboardingPreDispatchStatus: vi.fn(),
}));

import { apiFetch } from "@/lib/api";
import { getOnboardingPreDispatchStatus } from "@/lib/workforce/onboardingStatusApi";
import { useVettingData } from "./useVettingData";

const ORDER = "order-1";
const LOADER = join(process.cwd(), "app/orders/[id]/vetting/useVettingData.ts");

/** The four governed states. A failed read may present none of them. */
const CANONICAL_STATES = [
  "NO_ONBOARDING_ON_FILE",
  "WORKER_OBLIGATIONS_OUTSTANDING",
  "VERIFICATION_OUTSTANDING",
  "READY",
];

type BackendCandidateFixture = {
  id: string;
  candidateId: string | undefined;
  bucket: BucketId | string;
};

function backendCandidate(fixture: BackendCandidateFixture) {
  return {
    id: fixture.id,
    orderId: ORDER,
    candidateId: fixture.candidateId,
    status: "ACTIVE",
    bucket: fixture.bucket,
    customerApprovalStatus: "NOT_REQUIRED",
    selectedForDispatch: false,
    selectedAt: null,
    createdAt: "2026-09-05T00:00:00.000Z",
    updatedAt: "2026-09-05T00:00:00.000Z",
    candidate: {
      id: fixture.candidateId,
      firstName: `Worker-${fixture.id}`,
      lastName: "Test",
      email: null,
      phone: null,
      status: "ACTIVE",
    },
    originalTrade: null,
    closed: null,
    altTrade: null,
    assignment: null,
    computed: {
      isClosed: false,
      hasAltTradeProposal: false,
      isAltTradeAccepted: false,
      reopenedAt: null,
    },
    signals: null,
  };
}

const backendOrder = {
  id: ORDER,
  title: "Test Order",
  customer: { id: "cust-1", name: "Acme" },
  jobSiteCity: "Denver",
  jobSiteState: "CO",
  jobSiteAddress1: "1 Main",
  tradeRequirements: [],
};

function serveCandidates(fixtures: BackendCandidateFixture[]): void {
  vi.mocked(apiFetch).mockImplementation(((path: string) => {
    if (path === `/orders/${ORDER}`) return Promise.resolve(backendOrder);
    if (path === `/recruiting/order/${ORDER}/candidates`) {
      return Promise.resolve(fixtures.map(backendCandidate));
    }
    return Promise.reject(new Error(`unexpected request: ${path}`));
  }) as typeof apiFetch);
}

/** A PRE_DISPATCH projection for one worker, with the verdict the caller wants to see. */
function projection(
  candidateId: string,
  readinessState: OnboardingPreDispatchStatus["readinessState"],
): OnboardingPreDispatchStatus {
  return {
    candidateId,
    audience: "PRE_DISPATCH",
    published: {
      state: "NOT_YET_PUBLISHED",
      publishedAt: null,
      packetId: null,
      packetVersion: null,
      label: "Not yet published",
    },
    work: readinessState === "READY" ? "ALL_MODULES_COMPLETE" : "OUTSTANDING",
    workLabel: readinessState === "READY" ? "Onboarding complete" : "Onboarding outstanding",
    generatedAt: "2026-09-05T12:00:00.000Z",
    modulesDeclaringPreDispatchEvaluation: [],
    readinessState,
    workerObligationsOutstanding: readinessState === "WORKER_OBLIGATIONS_OUTSTANDING",
    verificationOutstanding: readinessState === "VERIFICATION_OUTSTANDING",
    withheldConfidentialCount: 0,
  };
}

/** A staff refusal, shaped as the delivered onboarding transport throws one. */
function refusal(status: number) {
  return Object.assign(new Error("refused"), { status, code: "FORBIDDEN" });
}

async function loadVetting() {
  const hook = renderHook(() => useVettingData(ORDER));
  await waitFor(() => expect(hook.result.current.state.status).toBe("ready"));
  return hook;
}

function laneOf(
  hook: Awaited<ReturnType<typeof loadVetting>>,
  bucket: BucketId = "PRE_DISPATCH",
): Candidate[] {
  const state = hook.result.current.state;
  if (state.status !== "ready") throw new Error(`vetting not ready: ${state.status}`);
  const found = state.order.buckets.find((candidateBucket) => candidateBucket.id === bucket);
  if (!found) throw new Error(`bucket missing: ${bucket}`);
  return found.candidates;
}

function requestedIdentities(): string[] {
  return vi
    .mocked(getOnboardingPreDispatchStatus)
    .mock.calls.map((call) => call[0] as string);
}

beforeEach(() => {
  vi.mocked(getOnboardingPreDispatchStatus).mockReset();
  vi.mocked(apiFetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Gate 10C-E4 - the Vetting PRE_DISPATCH readiness consumer", () => {
  describe("who is asked, and with which identity", () => {
    it("reads PRE_DISPATCH candidates using the Workforce candidateId", async () => {
      serveCandidates([
        { id: "order-candidate-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockResolvedValue(
        projection("workforce-1", "READY"),
      );

      await loadVetting();

      expect(getOnboardingPreDispatchStatus).toHaveBeenCalledTimes(1);
      expect(getOnboardingPreDispatchStatus).toHaveBeenCalledWith("workforce-1");
    });

    it("never substitutes the order-scoped OrderCandidate id", async () => {
      serveCandidates([
        { id: "order-candidate-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
        { id: "order-candidate-2", candidateId: "workforce-2", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockImplementation((candidateId: string) =>
        Promise.resolve(projection(candidateId, "READY")),
      );

      await loadVetting();

      // Asserted as a SET rather than per-call: the order-scoped identifier must not reach
      // the endpoint in any position, for any candidate.
      expect(requestedIdentities().sort()).toEqual(["workforce-1", "workforce-2"]);
      expect(requestedIdentities()).not.toContain("order-candidate-1");
      expect(requestedIdentities()).not.toContain("order-candidate-2");
    });

    it("asks nothing about candidates outside the PRE_DISPATCH lane", async () => {
      const otherLanes: BucketId[] = [
        "OPTED_IN",
        "AWAITING_CANDIDATE_ACTION",
        "MW4H_APPROVED",
        "DISPATCHED",
        "CLOSED",
      ];
      serveCandidates(
        otherLanes.map((bucket, index) => ({
          id: `order-candidate-${index}`,
          candidateId: `workforce-${index}`,
          bucket,
        })),
      );

      const hook = await loadVetting();

      expect(getOnboardingPreDispatchStatus).not.toHaveBeenCalled();
      // And nothing was attached to them either: `undefined` is "never asked", which is
      // distinct from both a verdict and a failed read.
      for (const bucket of otherLanes) {
        for (const candidate of laneOf(hook, bucket)) {
          expect(candidate.onboardingPreDispatch).toBeUndefined();
        }
      }
    });

    it("asks nothing about a candidate carrying no usable Workforce identity", async () => {
      serveCandidates([
        { id: "order-candidate-1", candidateId: undefined, bucket: "PRE_DISPATCH" },
        { id: "order-candidate-2", candidateId: "", bucket: "PRE_DISPATCH" },
        { id: "order-candidate-3", candidateId: "   ", bucket: "PRE_DISPATCH" },
      ]);

      const hook = await loadVetting();

      expect(getOnboardingPreDispatchStatus).not.toHaveBeenCalled();
      for (const candidate of laneOf(hook)) {
        expect(candidate.onboardingPreDispatch).toBeUndefined();
      }
    });

    it("asks once per worker even when he appears twice in the lane", async () => {
      // Reads are audited server-side, so a duplicate appearance must not become a
      // duplicate audit event.
      serveCandidates([
        { id: "order-candidate-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
        { id: "order-candidate-2", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockResolvedValue(
        projection("workforce-1", "READY"),
      );

      const hook = await loadVetting();

      expect(getOnboardingPreDispatchStatus).toHaveBeenCalledTimes(1);
      // Both rows still carry the verdict: de-duplication is of the REQUEST, not the result.
      for (const candidate of laneOf(hook)) {
        expect(candidate.onboardingPreDispatch?.read).toBe("SUCCEEDED");
      }
    });
  });

  describe("in parallel, and isolated when one fails", () => {
    it("issues every lane request before any of them resolves", async () => {
      const release: Array<(status: OnboardingPreDispatchStatus) => void> = [];
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
        { id: "oc-2", candidateId: "workforce-2", bucket: "PRE_DISPATCH" },
        { id: "oc-3", candidateId: "workforce-3", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockImplementation(
        () =>
          new Promise<OnboardingPreDispatchStatus>((resolve) => {
            release.push(resolve);
          }),
      );

      const hook = renderHook(() => useVettingData(ORDER));

      // All three are in flight with none settled, which a sequential loop could not do.
      await waitFor(() => expect(release).toHaveLength(3));
      expect(getOnboardingPreDispatchStatus).toHaveBeenCalledTimes(3);
      expect(hook.result.current.state.status).toBe("loading");

      await act(async () => {
        release.forEach((resolve, index) =>
          resolve(projection(`workforce-${index + 1}`, "READY")),
        );
      });

      await waitFor(() => expect(hook.result.current.state.status).toBe("ready"));
      expect(requestedIdentities().sort()).toEqual([
        "workforce-1",
        "workforce-2",
        "workforce-3",
      ]);
    });

    it("keeps one worker's failed read from failing the Vetting load", async () => {
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
        { id: "oc-2", candidateId: "workforce-2", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockImplementation((candidateId: string) =>
        candidateId === "workforce-1"
          ? Promise.reject(refusal(403))
          : Promise.resolve(projection(candidateId, "READY")),
      );

      const hook = await loadVetting();

      // The order still loaded, with its buckets and trades intact.
      expect(hook.result.current.state.status).toBe("ready");
      const lane = laneOf(hook);
      expect(lane).toHaveLength(2);
      expect(lane[0].onboardingPreDispatch).toEqual({
        read: "FAILED",
        status: null,
        httpStatus: 403,
      });
      expect(lane[1].onboardingPreDispatch?.read).toBe("SUCCEEDED");
    });

    it("records a failure as unreadable and never as a business verdict", async () => {
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockRejectedValue(refusal(401));

      const hook = await loadVetting();
      const attached = laneOf(hook)[0].onboardingPreDispatch;

      expect(attached).toEqual({ read: "FAILED", status: null, httpStatus: 401 });
      // STRUCTURALLY INCAPABLE of presenting a verdict: there is no projection to read one
      // off, and none of the four governed states appears anywhere in the attachment.
      expect(attached?.status).toBeNull();
      for (const state of CANONICAL_STATES) {
        expect(JSON.stringify(attached)).not.toContain(state);
      }
    });

    it("treats a failure with no status number as unreadable all the same", async () => {
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockRejectedValue(
        new Error("network unreachable"),
      );

      const hook = await loadVetting();

      expect(laneOf(hook)[0].onboardingPreDispatch).toEqual({
        read: "FAILED",
        status: null,
        httpStatus: null,
      });
    });
  });

  describe("association, which never depends on completion order", () => {
    it("attaches each projection to the worker it was requested for", async () => {
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
        { id: "oc-2", candidateId: "workforce-2", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockImplementation((candidateId: string) =>
        Promise.resolve(
          projection(
            candidateId,
            candidateId === "workforce-1" ? "READY" : "VERIFICATION_OUTSTANDING",
          ),
        ),
      );

      const hook = await loadVetting();
      const lane = laneOf(hook);

      expect(lane[0].candidateId).toBe("workforce-1");
      expect(lane[0].onboardingPreDispatch?.status?.readinessState).toBe("READY");
      expect(lane[0].onboardingPreDispatch?.status?.candidateId).toBe("workforce-1");
      expect(lane[1].candidateId).toBe("workforce-2");
      expect(lane[1].onboardingPreDispatch?.status?.readinessState).toBe(
        "VERIFICATION_OUTSTANDING",
      );
      expect(lane[1].onboardingPreDispatch?.status?.candidateId).toBe("workforce-2");
    });

    it("cannot cross-associate when responses arrive in reverse order", async () => {
      const pending = new Map<string, (value: OnboardingPreDispatchStatus) => void>();
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
        { id: "oc-2", candidateId: "workforce-2", bucket: "PRE_DISPATCH" },
        { id: "oc-3", candidateId: "workforce-3", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockImplementation(
        (candidateId: string) =>
          new Promise<OnboardingPreDispatchStatus>((resolve) => {
            pending.set(candidateId, resolve);
          }),
      );

      const hook = renderHook(() => useVettingData(ORDER));
      await waitFor(() => expect(pending.size).toBe(3));

      // LAST REQUESTED, FIRST ANSWERED - and the middle worker's read fails outright, so
      // completion order and outcome kind both differ from request order.
      await act(async () => {
        pending.get("workforce-3")?.(projection("workforce-3", "READY"));
        pending.get("workforce-1")?.(
          projection("workforce-1", "WORKER_OBLIGATIONS_OUTSTANDING"),
        );
        pending.get("workforce-2")?.(projection("workforce-2", "NO_ONBOARDING_ON_FILE"));
      });
      await waitFor(() => expect(hook.result.current.state.status).toBe("ready"));

      const lane = laneOf(hook);
      expect(
        lane.map((candidate) => [
          candidate.candidateId,
          candidate.onboardingPreDispatch?.status?.readinessState,
        ]),
      ).toEqual([
        ["workforce-1", "WORKER_OBLIGATIONS_OUTSTANDING"],
        ["workforce-2", "NO_ONBOARDING_ON_FILE"],
        ["workforce-3", "READY"],
      ]);
      // Each projection also still names the worker it describes.
      for (const candidate of lane) {
        expect(candidate.onboardingPreDispatch?.status?.candidateId).toBe(
          candidate.candidateId,
        );
      }
    });
  });

  describe("refresh, which is deliberate and never automatic", () => {
    it("re-reads readiness when the existing manual refetch runs", async () => {
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockResolvedValueOnce(
        projection("workforce-1", "WORKER_OBLIGATIONS_OUTSTANDING"),
      );

      const hook = await loadVetting();
      expect(laneOf(hook)[0].onboardingPreDispatch?.status?.readinessState).toBe(
        "WORKER_OBLIGATIONS_OUTSTANDING",
      );

      // The worker finishes his obligations; the operator reloads the screen.
      vi.mocked(getOnboardingPreDispatchStatus).mockResolvedValueOnce(
        projection("workforce-1", "READY"),
      );
      await act(async () => {
        hook.result.current.refetch();
      });
      await waitFor(() =>
        expect(hook.result.current.state.status).toBe("ready"),
      );

      expect(getOnboardingPreDispatchStatus).toHaveBeenCalledTimes(2);
      await waitFor(() =>
        expect(laneOf(hook)[0].onboardingPreDispatch?.status?.readinessState).toBe("READY"),
      );
    });

    it("introduces no polling, timer, or revalidation loop", async () => {
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockResolvedValue(
        projection("workforce-1", "READY"),
      );

      await loadVetting();
      const afterLoad = vi.mocked(getOnboardingPreDispatchStatus).mock.calls.length;

      // Nothing re-reads on its own across further ticks of the event loop.
      for (let tick = 0; tick < 5; tick += 1) {
        await act(async () => {
          await Promise.resolve();
        });
      }
      expect(vi.mocked(getOnboardingPreDispatchStatus).mock.calls.length).toBe(afterLoad);

      // And the loader contains no scheduling primitive at all, so no interval can be
      // introduced without this failing.
      const source = readFileSync(LOADER, "utf8");
      expect(source).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/);
    });
  });

  describe("the rest of the Vetting load, unchanged", () => {
    it("still builds the order, its buckets and its trade lines", async () => {
      serveCandidates([
        { id: "oc-1", candidateId: "workforce-1", bucket: "PRE_DISPATCH" },
        { id: "oc-2", candidateId: "workforce-2", bucket: "OPTED_IN" },
      ]);
      vi.mocked(getOnboardingPreDispatchStatus).mockResolvedValue(
        projection("workforce-1", "READY"),
      );

      const hook = await loadVetting();
      const state = hook.result.current.state;
      if (state.status !== "ready") throw new Error("not ready");

      expect(state.order.id).toBe(ORDER);
      expect(state.order.projectName).toBe("Test Order");
      expect(state.order.customerName).toBe("Acme");
      expect(state.order.location).toBe("1 Main, Denver, CO");
      expect(state.order.buckets.map((bucket) => bucket.id)).toEqual([
        "OPTED_IN",
        "AWAITING_CANDIDATE_ACTION",
        "MW4H_APPROVED",
        "PRE_DISPATCH",
        "DISPATCHED",
        "CLOSED",
      ]);
      expect(laneOf(hook, "OPTED_IN")).toHaveLength(1);
      expect(hook.result.current.tradeLines).toEqual([]);
    });

    it("still surfaces a genuine Vetting failure as an error state", async () => {
      vi.mocked(apiFetch).mockRejectedValue(new Error("orders unavailable"));

      const hook = renderHook(() => useVettingData(ORDER));

      await waitFor(() => expect(hook.result.current.state.status).toBe("error"));
      // The readiness read is downstream of the candidate list, so it was never attempted.
      expect(getOnboardingPreDispatchStatus).not.toHaveBeenCalled();
    });
  });
});
