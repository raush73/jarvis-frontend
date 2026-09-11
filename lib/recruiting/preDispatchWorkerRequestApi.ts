/**
 * Phase 17 S2 - the PRE_DISPATCH worker-request client.
 *
 * Mirrors the server's allowlisted projection and nothing else.
 *
 * ONE WRITE FUNCTION, AND EXACTLY ONE. Initial PRE_DISPATCH Communication adds the deliberate staff
 * SEND action, because governance places communication delivery at a deliberate send action rather
 * than at a read. Nothing else was added with it: there is still no function here that could create
 * a request, resend, remind, issue a credential, or record a worker response, and the send function
 * below cannot be reached by a render, a refetch or a retry - only by a staff click.
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

/**
 * The SAFE, NORMALIZED communication position. Never the provider's own words.
 *
 * The server derives this and withholds the underlying failure detail, so there is no member here
 * and no optional field below through which a provider error, an endpoint, a credential or a
 * message body could arrive.
 *
 * - `NONE`: no communication failure on file. Says nothing about whether anything was sent - the
 *   authoritative `state` answers that, and this must never be read as a second opinion about it.
 * - `DELIVERY_FAILED`: a real provider was asked to carry the message and refused. Durable.
 * - `NOT_CONFIGURED`: transport is unavailable, so nothing left Jarvis. Returned by the send action
 *   only; a later read reports `NONE`, because no delivery has failed.
 */
export type PreDispatchCommunicationStatus =
  | "NONE"
  | "DELIVERY_FAILED"
  | "NOT_CONFIGURED";

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
  /** Whether a worker communication attempt has durably failed. Normalized, never raw detail. */
  communicationStatus: PreDispatchCommunicationStatus;
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

// --------------------------------------------------------------------------
// Send - the one deliberate staff action
// --------------------------------------------------------------------------

/** What the server tells the staff member who acted. Safe by omission as much as by content. */
export type SendInitialPreDispatchCommunicationResult = {
  orderCandidateId: string;
  /** AUTHORITATIVE. The persisted state after the attempt, never inferred here. */
  state: PreDispatchWorkerRequestState;
  /** TRUE only when a real provider took custody. Never true while transport is a stub. */
  handedToRealProvider: boolean;
  communicationStatus: PreDispatchCommunicationStatus;
};

/**
 * Ask ONE worker whether they are still interested in ONE job.
 *
 * A POST, ON A PATH OF ITS OWN, AND ONLY EVER FROM A CLICK. Governance is explicit that reads never
 * send, so this is deliberately not reachable from the read above, from a render, or from the page's
 * refetch: a proxy, prefetch or refresh cannot text a worker. Callers must disable their control
 * while it is in flight and then refetch rather than assuming an outcome.
 *
 * IT TAKES THE CANDIDACY AND NOTHING ELSE. The server resolves the current cycle, checks the lane
 * and state, mints the credential, composes the governed wording and evaluates the transport
 * result. No wording, recipient, credential or expiry is sent from here, because none of them is
 * this layer's to decide.
 *
 * SUCCESS OF THE CALL IS NOT DELIVERY. The promise resolving means the server processed the action;
 * whether a worker was actually reached is `handedToRealProvider`, and while transport remains a
 * stub that is always false. Nothing here may present a resolved promise as a message sent.
 */
export async function sendInitialPreDispatchCommunication(
  orderCandidateId: string,
): Promise<SendInitialPreDispatchCommunicationResult> {
  return apiFetch<SendInitialPreDispatchCommunicationResult>(
    `/recruiting/pre-dispatch/send-initial-communication`,
    { method: "POST", body: JSON.stringify({ orderCandidateId }) },
  );
}
