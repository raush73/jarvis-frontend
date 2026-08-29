/**
 * QA-L3 - the browser client for the QA-L2 Workforce QA worker experience launcher.
 *
 * TWO CALLS, MIRRORING THE TWO ROUTES QA-L2 MOUNTS, and no third. There is deliberately no
 * function here that changes a worker's classification, consumes an entry token, establishes a
 * session, resumes an earlier invocation, or deletes anything: QA-L2 mounts no such route, and a
 * client function for one would be a request waiting for a surface to appear.
 *
 * THE STAFF TRANSPORT IS THE DELIVERED ONE. `onboardingAdminFetch` already carries the staff
 * credential, unwraps the framework envelope, clears a rejected session on 401 and raises the
 * refusal contract the workspace classifies; a second staff transport here would be a second place
 * for all four to drift. That it is spelled `onboardingAdmin*` is a name, not a scope - the
 * delivered module clients reach for the same function for their staff reads.
 *
 * THE ENTRY TOKEN IS ON THE LAUNCH RESPONSE BECAUSE THE SERVER PUTS IT THERE, and this file is the
 * only place in the browser whose types name it. It is not handled here: `qaWorkerHandoff.ts`
 * performs the immediate handoff and returns a shape with nowhere to put a token, so no component
 * ever holds one. Nothing in this file writes to `localStorage`, `sessionStorage`, a cookie, a
 * query string or a URL, and nothing may.
 */

import { onboardingAdminFetch } from "./onboardingAdminApi";

/**
 * The sensitive grant QA-L2 requires, spelled so a surface can decide whether to RENDER.
 *
 * NEVER THE AUTHORIZATION ITSELF. The server enforces it with `SensitiveDataGuard`, which treats
 * no role as a bypass, and re-asserts it inside the launch. A control being present here is not
 * permission, and a control being absent is not protection.
 */
export const QA_WORKER_EXPERIENCE_LAUNCH_PERMISSION =
  "workforce.qa.worker-experience.launch";

const BASE = "/workforce/qa/worker-experience";

/**
 * One worker eligible for a QA worker experience.
 *
 * A MIRROR OF `qa-worker-experience.contracts.ts`, WHICH MEANS A LIST OF ABSENCES: an identifier,
 * a display name, and the classification that made the record eligible. There is no field here for
 * a Social Security Number, a date of birth, an address, a telephone number, an email address, a
 * banking value, a document, a tax election or any onboarding evidence, because there is no such
 * field on the server's projection. A type that cannot express a protected value cannot render one.
 */
export type QaTestWorker = {
  candidateId: string;
  displayName: string;
  /** Echoed by the server so a surface can show WHY a record is eligible, never infer it. */
  workerClassification: string;
};

/**
 * What a successful QA-L2 launch returns.
 *
 * `workerEntryToken` IS A SINGLE-USE SECRET FOR IMMEDIATE CONSUMPTION ONLY. It exists on this type
 * because the server returns it, and it exists nowhere else in the browser: see `qaWorkerHandoff.ts`.
 */
export type QaWorkerExperienceLaunch = {
  candidateId: string;
  /** The NEW real onboarding invocation this launch created. */
  invocationId: string;
  /** The governed module scope the server composed the invocation for. */
  moduleScope: string;
  workerEntryToken: string;
  expiresAt: string;
};

/**
 * The formally TEST-classified workers a QA worker experience may be launched for.
 *
 * NO SEARCH TERM, NO FILTER AND NO PAGE ARGUMENT, deliberately. The server returns the QA
 * classification itself, so there is no parameter here that could widen the read towards a
 * production worker: production candidates are not filtered out of this listing, they are never
 * queried for it.
 */
export async function listQaTestWorkers(): Promise<QaTestWorker[]> {
  const value = await onboardingAdminFetch<{ workers: QaTestWorker[] }>(
    `${BASE}/test-workers`,
  );
  return value?.workers ? [...value.workers] : [];
}

/**
 * Open a NEW QA worker experience for one TEST-classified worker.
 *
 * THE CANDIDATE IDENTIFIER IS THE ONLY THING SENT. There is no module, scope, packet, invocation,
 * step, qualifier or reason parameter, so a caller cannot name a module the QA scope does not
 * cover, cannot reach an earlier invocation, and cannot ask for anything but a new run. The scope
 * is the server's constant and arrives back on the response as a fact, not as an echo of a request.
 */
export async function launchQaWorkerExperience(
  candidateId: string,
): Promise<QaWorkerExperienceLaunch> {
  return onboardingAdminFetch<QaWorkerExperienceLaunch>(`${BASE}/launch`, {
    method: "POST",
    body: { candidateId },
  });
}
