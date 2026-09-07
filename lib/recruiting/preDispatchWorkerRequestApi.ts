/**
 * Phase 17 S2 - the PRE_DISPATCH worker-request read client.
 *
 * Mirrors the server's allowlisted projection and nothing else. There is deliberately NO write
 * function in this file, in any form: S2 exposes no endpoint that could create a request, send
 * or resend a communication, issue a MagicLink, or record a worker response. A helper here that
 * looked like one would be the first step toward a client that fabricates worker obligations.
 *
 * THE STATE IS THE SERVER'S, AND IS NEVER DERIVED HERE. `state` is carried verbatim. Nothing in
 * this file infers a lifecycle position from `initialSentAt`, `respondedAt`, or any other
 * timestamp - a client that computed its own state could tell an operator a worker had been
 * contacted when nothing had been sent.
 *
 * Types are the wire, not a model. Wording lives in the Vetting presentation layer.
 */

import { apiFetch } from "@/lib/api";

// --------------------------------------------------------------------------
// Vocabulary - mirrors the secured S1 Prisma enums exactly
// --------------------------------------------------------------------------

/**
 * The lifecycle position of one job-specific PRE_DISPATCH worker request.
 *
 * `PENDING_INITIAL_COMMUNICATION` is the governed initial state and, while S8-S10 delivery
 * remains blocked, the only state S1 ever writes. It means the request EXISTS and worker action
 * is required, but nothing has been sent. It is emphatically not "waiting for the worker", who
 * has not yet been asked anything.
 */
export type PreDispatchWorkerRequestState =
  | "PENDING_INITIAL_COMMUNICATION"
  | "AWAITING_WORKER_RESPONSE"
  | "WORKER_RESPONDED"
  | "CLEARED"
  | "CLOSED";

/** What the worker answered, once they have. Null until then. */
export type PreDispatchInterestResult =
  | "CONTINUED_INTEREST_CONFIRMED"
  | "WITHDRAWAL_REQUESTED";

/**
 * Why no current request is presentable.
 *
 * Both values are legitimate operational conditions rather than errors, and neither is a fact
 * about the worker:
 *
 * - `NOT_IN_PRE_DISPATCH`: the candidacy is not in the lane, so any stored request belongs to a
 *   concluded cycle and is not a live worker-action request.
 * - `NO_REQUEST_ON_FILE`: the candidacy IS in PRE_DISPATCH but has no durable request, which is
 *   reachable for candidacies that entered the lane before Phase 17 existed.
 */
export type PreDispatchWorkerRequestAbsence =
  | "NOT_IN_PRE_DISPATCH"
  | "NO_REQUEST_ON_FILE";

// --------------------------------------------------------------------------
// Shapes
// --------------------------------------------------------------------------

/**
 * The complete authorized projection. Every field the server sends, and no field it does not.
 *
 * Absent by server design, and therefore absent here: the workforce `candidateId`, the creating
 * staff user, the delivery-provider error, and any customer or commercial detail. There is no
 * optional member below through which any of them could arrive later.
 */
export type PreDispatchWorkerRequestView = {
  id: string;
  /** The candidacy. This is the request's identity, together with the cycle. */
  orderCandidateId: string;
  cycleSequence: number;
  /** AUTHORITATIVE. Rendered as-is; never recomputed from the timestamps below. */
  state: PreDispatchWorkerRequestState;
  interestResult: PreDispatchInterestResult | null;
  createdAt: string;
  initialSentAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  manualResendCount: number;
  lastManualResendAt: string | null;
  respondedAt: string | null;
  clearedAt: string | null;
  closedAt: string | null;
  closeReason: string | null;
};

/**
 * A DISCRIMINATED response, so a consumer cannot read request fields off an absent request or
 * mistake absence for a lifecycle state.
 */
export type PreDispatchWorkerRequestStatus =
  | { orderCandidateId: string; present: true; request: PreDispatchWorkerRequestView }
  | { orderCandidateId: string; present: false; absence: PreDispatchWorkerRequestAbsence };

// --------------------------------------------------------------------------
// Read
// --------------------------------------------------------------------------

/**
 * The current PRE_DISPATCH worker-request state for one candidacy.
 *
 * A GET, and the only function in this module. Calling it cannot create a request, advance a
 * cycle, alter reminder counts, stamp a timestamp, or send anything - the server proves this,
 * and there is no second function here through which a caller could ask for more.
 *
 * Takes the ORDER CANDIDATE id (the candidacy), not the workforce candidate id. The request is
 * job-specific: the same worker can hold an entirely different request state on another order,
 * and keying this by the worker would collapse those into one wrong answer.
 */
export async function getPreDispatchWorkerRequest(
  orderCandidateId: string,
): Promise<PreDispatchWorkerRequestStatus> {
  return apiFetch<PreDispatchWorkerRequestStatus>(
    `/recruiting/order-candidate/${encodeURIComponent(orderCandidateId)}/pre-dispatch-request`,
  );
}
