/**
 * QA-L3 - the real worker handoff, and the only place a raw entry token is ever held.
 *
 * THE WHOLE POINT OF THIS FILE IS THAT NOTHING ELSE NEEDS TO SEE THE TOKEN. QA-L2 returns a
 * single-use Worker Portal entry token; the delivered worker authentication route consumes one and
 * establishes the real session. This function stands between them for the length of one `await` and
 * returns a shape with NOWHERE TO PUT A TOKEN, so no component, no state, no render and no error
 * message can carry it even by accident.
 *
 * THE CHAIN, WHICH IS THE DELIVERED ONE FROM THE SECOND LINK ONWARD:
 *
 *   QA-L2 launch -> raw entry token (local, this scope only) -> the delivered
 *   `consumeWorkforceLink` -> the delivered `saveWorkerSession` (inside it) -> the delivered
 *   `WORKFORCE_WORKER_SESSION` -> `WorkerAuthGuard` -> the real worker runtime
 *
 * THE CHAIN IS THE SAME FOR BOTH AUTHORIZED SCOPES, AND THE SCOPE CHANGES ONLY WHERE THE BROWSER
 * LANDS. A complete-packet run consumes the same real magic link, establishes the same real worker
 * session and enters the same production runtime as a surgical one; what differs is that it lands on
 * the delivered PACKET OVERVIEW rather than inside one module. There is no second authentication
 * path here for either, and no scope reaches the runtime without the session being established
 * first.
 *
 * NOTHING HERE AUTHENTICATES A WORKER. No token is decoded, rewritten, re-signed or manufactured;
 * no session is assembled by hand; no session storage format is invented. The consume call is the
 * one the worker application landing already uses, and the session it establishes is written by the
 * delivered helper under the delivered keys.
 *
 * WHAT THIS FILE MUST NEVER DO, and the tests assert each one against this source:
 *
 *  - place the token in a URL, a path, a query string or a fragment;
 *  - write the token to `localStorage`, `sessionStorage`, a cookie or IndexedDB;
 *  - log the token, or any part of it, anywhere;
 *  - return the token, or spread a launch response into a returned value;
 *  - put the token into a thrown error or its message;
 *  - touch the staff session, which stays exactly as it was.
 *
 * A FAILURE AFTER THE LAUNCH UNDOES NOTHING. The invocation QA-L2 created is a real packet version
 * in the worker's history; there is no delete, reset, rollback or compensating call here, and there
 * must never be one. The recovery is another launch, which produces another new run.
 *
 * TWO HANDOFFS OVER THAT ONE CHAIN, SHARING EVERY LINK OF IT FROM THE TOKEN ONWARD.
 * `launchQaWorkerHandoff` hands over a NEW run and lands where the server's scope says. The ratified
 * `reEnterQaWorkerHandoff` hands over the SAME worker with no new run at all and lands on the
 * delivered onboarding home, leaving packet discovery to the application's normal runtime. Both use
 * the same consume call, the same session helper and the same token-free return discipline; neither
 * authenticates a worker itself.
 */

import { ONBOARDING_HOME, modulePath, packetPath } from "./onboardingRuntimeApi";
import {
  launchQaWorkerExperience,
  reEnterQaWorkerExperience,
  type QaWorkerExperienceScope,
} from "./qaWorkerExperienceApi";
import { getWorkerSession } from "./workerSession";
import { consumeWorkforceLink } from "./workforceApi";

/**
 * The recognized Worker Portal intent category for this handoff.
 *
 * `COMPLETE_ONBOARDING` rather than the application default: the intent is descriptive only - the
 * server records it on the session and no guard consults it - so the honest description of a run
 * that opens an onboarding module is the one to send.
 */
export const QA_WORKER_ENTRY_INTENT = "COMPLETE_ONBOARDING";

/** Why a handoff stopped after the launch had already succeeded. */
export type QaWorkerHandoffStage =
  /** The delivered consume route did not accept the entry token. */
  | "ENTRY_NOT_ACCEPTED"
  /** The consume succeeded but no usable worker session is present in this browser. */
  | "WORKER_SESSION_NOT_ESTABLISHED";

/**
 * A handoff that stopped after QA-L2 had already created the run.
 *
 * CARRIES A STAGE AND A SAFE REASON CODE AND NOTHING ELSE. `reason` is the delivered authentication
 * outcome code - `INVALID_LINK`, `IDENTITY_NOT_FOUND`, `IDENTITY_AMBIGUOUS` - which names what
 * happened without naming a worker, and never the token.
 */
export class QaWorkerHandoffError extends Error {
  readonly stage: QaWorkerHandoffStage;
  readonly reason: string | null;

  constructor(stage: QaWorkerHandoffStage, reason: string | null = null) {
    super(
      stage === "ENTRY_NOT_ACCEPTED"
        ? "The worker entry link was not accepted."
        : "No worker session was established in this browser.",
    );
    this.name = "QaWorkerHandoffError";
    this.stage = stage;
    this.reason = reason;
  }
}

/**
 * A completed handoff: the facts a QA operator needs, and no secret.
 *
 * THERE IS NO TOKEN FIELD AND THERE MUST NEVER BE ONE. This type is the reason the token cannot
 * reach a component: there is no shape here to carry it.
 */
export type QaWorkerHandoff = {
  candidateId: string;
  /** The NEW invocation QA-L2 created, as returned by the server. */
  invocationId: string;
  /** The authorized scope the SERVER composed the run for (owner judgment call JC-2). */
  scope: QaWorkerExperienceScope;
  /** When the (already consumed) entry token would have stopped working. */
  expiresAt: string;
  /** The real worker route this run lands on, built from the server's own values. */
  workerPath: string;
};

/**
 * The URL segment for a governed module key.
 *
 * The same deterministic transform the runtime publishes its slugs with, applied to the module scope
 * the SERVER returned. Not a module map: a table of module keys to paths in the browser would be the
 * compile-time module list the runtime is built to avoid, and an unknown or unassigned slug is
 * resolved against the server's own module set for the packet and refused there.
 */
export function qaWorkerModuleSlug(moduleKey: string): string {
  return moduleKey.trim().toLowerCase().replace(/_/g, "-");
}

/**
 * Where a launched run lands, decided by the scope the SERVER returned.
 *
 * TWO DESTINATIONS, BOTH OF THEM DELIVERED ROUTES:
 *
 *  - `PAYROLL_PAYMENT` lands on the MODULE ROOT, exactly as QA-L2/QA-L3 delivered it. The scope IS
 *    the module key for that scope, so the segment is derived from it and from no table kept here.
 *  - `COMPLETE_PACKET` lands on the PACKET ROOT - the existing worker packet overview - and
 *    deliberately NOT inside a module. Choosing a module here would require this file to know which
 *    module comes first, which is the server's answer (the packet's own ordered membership and its
 *    next-actionable resolution), and would defeat the point of packet QA: the worker is meant to
 *    start where a real worker starts, at the overview of everything he has been required to do.
 *
 * NEITHER PATH IS NEW. `modulePath` and `packetPath` are the delivered route helpers the worker
 * runtime already publishes; QA-L5 adds no route, no page and no second packet surface.
 */
function qaWorkerLandingPath(
  invocationId: string,
  scope: QaWorkerExperienceScope,
): string {
  return scope === "COMPLETE_PACKET"
    ? packetPath(invocationId)
    : modulePath(invocationId, qaWorkerModuleSlug(scope), null);
}

/**
 * Launch a NEW QA worker experience in one authorized scope and hand the browser over to the real
 * worker runtime.
 *
 * A ROOT IS RETURNED RATHER THAN A STEP, for both scopes: the delivered entry routes ask the server
 * what this worker resumes at, and anything chosen here would eventually disagree with what he has
 * actually recorded.
 */
export async function launchQaWorkerHandoff(
  candidateId: string,
  scope: QaWorkerExperienceScope,
): Promise<QaWorkerHandoff> {
  const launch = await launchQaWorkerExperience(candidateId, scope);

  // The raw entry token is read off the response and passed straight into the delivered consume
  // call. It is never assigned to a variable of its own, never copied, and the launch response it
  // arrived on becomes unreachable when this function returns.
  const entry = await consumeWorkforceLink(
    launch.workerEntryToken,
    QA_WORKER_ENTRY_INTENT,
  );

  if (!entry.authenticated) {
    throw new QaWorkerHandoffError("ENTRY_NOT_ACCEPTED", entry.reason ?? null);
  }

  // The delivered consume writes the session itself. Reading it back is a check that this browser
  // really can act as the worker, not a second place that establishes one.
  if (!getWorkerSession()) {
    throw new QaWorkerHandoffError("WORKER_SESSION_NOT_ESTABLISHED");
  }

  // Built field by field, deliberately. A spread of the launch response would carry the token out
  // of this scope, which is the one thing this file exists to prevent.
  return {
    candidateId: launch.candidateId,
    invocationId: launch.invocationId,
    scope: launch.scope,
    expiresAt: launch.expiresAt,
    // Built from the SERVER'S scope and the SERVER'S invocation, never from the request: what was
    // actually composed is the server's answer, and a route built from the ask could disagree.
    workerPath: qaWorkerLandingPath(launch.invocationId, launch.scope),
  };
}

/**
 * A completed session-only RE-ENTRY: the facts a QA operator needs, and no secret.
 *
 * NO TOKEN FIELD, on exactly the terms `QaWorkerHandoff` states - and NO INVOCATION FIELD EITHER,
 * which is the difference. A re-entry composed nothing, so there is no invocation, packet, version
 * or scope to report, and `workerPath` is therefore the onboarding HOME rather than a route into a
 * particular packet. A shape that cannot carry an invocation cannot be used to navigate to one.
 */
export type QaWorkerReEntry = {
  candidateId: string;
  /** When the (already consumed) entry token would have stopped working. */
  expiresAt: string;
  /** Always the delivered onboarding home. The application decides what happens next. */
  workerPath: string;
};

/**
 * Re-authenticate an existing TEST worker and hand the browser to the real worker runtime.
 *
 * THE SAME CHAIN AS A LAUNCH FROM THE SECOND LINK ONWARD, AND THE SAME CODE PATH FOR IT. The token
 * goes straight into the delivered `consumeWorkforceLink`, the delivered helper inside it writes the
 * session under the delivered keys, and the session is read back through the delivered
 * `getWorkerSession`. Nothing here decodes, rewrites, re-signs or manufactures a token, assembles a
 * session by hand, or invents a storage format - and no second authentication path exists for
 * re-entry, which is the reason this function is nine lines rather than a subsystem.
 *
 * IT LANDS ON `ONBOARDING_HOME` AND CANNOT LAND ANYWHERE ELSE. `modulePath` and `packetPath` are
 * not reachable from this function: both need an invocation identifier, and this function never
 * receives one, never requests one and has nowhere to put one. THE APPLICATION'S NORMAL RUNTIME
 * OWNS PACKET DISCOVERY - which is the correct authority for it and the whole reason re-entry is
 * safe. A browser that guessed a packet here could send the worker to a superseded one, or to one
 * that is no longer writable, and would be asserting something only the server can know.
 *
 * A FAILURE HERE UNDOES NOTHING AND HAS NOTHING TO UNDO. Unlike a launch, no invocation was created
 * before the handoff, so an unaccepted entry link leaves the worker's onboarding exactly as it was.
 * The recovery is another re-entry, which still creates nothing.
 */
export async function reEnterQaWorkerHandoff(
  candidateId: string,
): Promise<QaWorkerReEntry> {
  const reEntry = await reEnterQaWorkerExperience(candidateId);

  // The raw entry token is read off the response and passed straight into the delivered consume
  // call, exactly as the launch handoff does. It is never assigned to a variable of its own and
  // never copied, and the response it arrived on becomes unreachable when this function returns.
  const entry = await consumeWorkforceLink(
    reEntry.workerEntryToken,
    QA_WORKER_ENTRY_INTENT,
  );

  if (!entry.authenticated) {
    throw new QaWorkerHandoffError("ENTRY_NOT_ACCEPTED", entry.reason ?? null);
  }

  if (!getWorkerSession()) {
    throw new QaWorkerHandoffError("WORKER_SESSION_NOT_ESTABLISHED");
  }

  // Built field by field, deliberately: a spread of the response would carry the token out of this
  // scope, which is the one thing this file exists to prevent.
  return {
    candidateId: reEntry.candidateId,
    expiresAt: reEntry.expiresAt,
    workerPath: ONBOARDING_HOME,
  };
}
