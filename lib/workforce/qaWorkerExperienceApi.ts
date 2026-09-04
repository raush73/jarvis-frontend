/**
 * QA-L3 - the browser client for the QA-L2 Workforce QA worker experience launcher.
 *
 * THREE CALLS, MIRRORING THE THREE ROUTES THE SERVER MOUNTS, and no fourth. There is deliberately
 * no function here that changes a worker's classification, consumes an entry token, establishes a
 * session, resumes an earlier invocation, or deletes anything: the server mounts no such route, and
 * a client function for one would be a request waiting for a surface to appear.
 *
 * THE THIRD IS THE RATIFIED SESSION-ONLY RE-ENTRY, and it is a separate function rather than a flag
 * on the launch because it is a different act with a different contract: it sends no scope and gets
 * back no invocation. Re-entry is NOT a resume - it names no invocation, so it has nothing to reach
 * - it re-authenticates a TEST worker whose QA session expired and lets the delivered runtime
 * decide what work he has.
 *
 * THE STAFF TRANSPORT IS THE DELIVERED ONE. `onboardingAdminFetch` already carries the staff
 * credential, unwraps the framework envelope, clears a rejected session on 401 and raises the
 * refusal contract the workspace classifies; a second staff transport here would be a second place
 * for all four to drift. That it is spelled `onboardingAdmin*` is a name, not a scope - the
 * delivered module clients reach for the same function for their staff reads.
 *
 * THE ONLY THING A CALLER MAY CHOOSE IS THE GOVERNED SCOPE, and the set of scopes is CLOSED at the
 * two the server authorizes (owner ruling QA-L5-R1). There is no module parameter, no module array
 * and no module list in this file: the complete packet's composition is the production registry's
 * answer, so a list here would be a second inventory that could disagree with it (QA-L5-R2).
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
 * The launch scopes the server authorizes, mirrored from its closed set.
 *
 * A CLOSED UNION AND NOT A STRING, so a surface cannot offer a scope the server will refuse and a
 * caller cannot compose one. The server's `IsIn` check is the authorization; this type is what stops
 * a mistake reaching it. Exactly two members, per owner ruling QA-L5-R1:
 *
 *  - `PAYROLL_PAYMENT` - the isolated/surgical single-module path.
 *  - `COMPLETE_PACKET` - the whole onboarding packet, whose modules are the production registry's
 *    answer. There is deliberately no module list anywhere in this browser code that composes it.
 */
export const QA_WORKER_EXPERIENCE_SCOPES = [
  "PAYROLL_PAYMENT",
  "COMPLETE_PACKET",
] as const;

export type QaWorkerExperienceScope = (typeof QA_WORKER_EXPERIENCE_SCOPES)[number];

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
  /**
   * The authorized scope the server composed the invocation for.
   *
   * `scope` AND NOT `moduleScope` (owner judgment call JC-2): one of the two scopes names no module
   * at all. It arrives back as a FACT the server states, and the client keeps no second name for it.
   */
  scope: QaWorkerExperienceScope;
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
 * Open a NEW QA worker experience for one TEST-classified worker, in one authorized scope.
 *
 * TWO ARGUMENTS, AND THE SECOND IS A CLOSED UNION. There is no module, packet, invocation, step,
 * qualifier or reason parameter, so a caller cannot curate a module set, cannot reach an earlier
 * invocation, and cannot ask for anything but a new run. `scope` IS REQUIRED AND HAS NO DEFAULT
 * HERE EITHER (owner judgment call JC-1): a default in this client would make every request
 * semantically defaulted no matter how carefully the screen above it asked.
 */
export async function launchQaWorkerExperience(
  candidateId: string,
  scope: QaWorkerExperienceScope,
): Promise<QaWorkerExperienceLaunch> {
  return onboardingAdminFetch<QaWorkerExperienceLaunch>(`${BASE}/launch`, {
    method: "POST",
    body: { candidateId, scope },
  });
}

/**
 * What a successful session-only RE-ENTRY returns.
 *
 * A MIRROR OF THE SERVER'S CONTRACT, WHICH MEANS THIS TYPE IS A LIST OF ABSENCES. There is no
 * `invocationId`, no `packetId`, no `packetVersion` and no `scope` on it, because a re-entry
 * composes none of them - and because a type that cannot express an invocation cannot be used to
 * build an invocation-specific URL. The browser therefore has no way to decide where this worker
 * should land, which is correct: the delivered runtime owns that.
 *
 * `workerEntryToken` IS A SINGLE-USE SECRET FOR IMMEDIATE CONSUMPTION ONLY, on exactly the terms
 * the launch type states. It exists here because the server returns it and it exists nowhere else
 * in the browser: see `qaWorkerHandoff.ts`.
 */
export type QaWorkerExperienceReEntry = {
  candidateId: string;
  workerEntryToken: string;
  expiresAt: string;
};

/**
 * Re-authenticate an existing TEST worker, creating NO new onboarding work.
 *
 * ONE ARGUMENT, AND EVERY ABSENCE IS DELIBERATE. There is no scope parameter, because nothing is
 * composed; no invocation, packet or step parameter, because nothing is resumed; and no override of
 * any kind. The request body carries the candidate identifier alone, so this function cannot be
 * made to compose a packet by a caller - the server's DTO would strip anything else regardless, but
 * there is nothing here to send in the first place.
 *
 * IT CALLS ITS OWN ROUTE AND NEVER THE LAUNCH. Routing this through `/launch` with some flag would
 * compose a real packet version, which is exactly the outcome the capability exists to avoid.
 */
export async function reEnterQaWorkerExperience(
  candidateId: string,
): Promise<QaWorkerExperienceReEntry> {
  return onboardingAdminFetch<QaWorkerExperienceReEntry>(`${BASE}/re-enter`, {
    method: "POST",
    body: { candidateId },
  });
}
