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
 */

import { modulePath } from "./onboardingRuntimeApi";
import { launchQaWorkerExperience } from "./qaWorkerExperienceApi";
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
  moduleScope: string;
  /** When the (already consumed) entry token would have stopped working. */
  expiresAt: string;
  /** The real worker route for the launched module, built from the server's own values. */
  workerPath: string;
};

/**
 * The URL segment for a governed module key.
 *
 * The same deterministic transform the runtime publishes its slugs with, applied to the scope the
 * SERVER returned. Not a module map: a table of module keys to paths in the browser would be the
 * compile-time module list the runtime is built to avoid, and an unknown or unassigned slug is
 * resolved against the server's own module set for the packet and refused there.
 */
export function qaWorkerModuleSlug(moduleScope: string): string {
  return moduleScope.trim().toLowerCase().replace(/_/g, "-");
}

/**
 * Launch a NEW QA worker experience and hand the browser over to the real worker runtime.
 *
 * The module ROOT is returned rather than a step: the delivered module entry route asks the server
 * which step this worker resumes at, and a step chosen here would eventually disagree with what he
 * has actually recorded.
 */
export async function launchQaWorkerHandoff(
  candidateId: string,
): Promise<QaWorkerHandoff> {
  const launch = await launchQaWorkerExperience(candidateId);

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
    moduleScope: launch.moduleScope,
    expiresAt: launch.expiresAt,
    workerPath: modulePath(
      launch.invocationId,
      qaWorkerModuleSlug(launch.moduleScope),
      null,
    ),
  };
}
