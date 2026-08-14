/**
 * Worker Portal - browser API client for the worker's own canonical identity.
 *
 * The SMALLEST possible client over the certified worker-scoped `GET /workforce/portal`, created
 * because no frontend client for that projection existed and a module that needs to show a worker
 * who Jarvis thinks he is must not invent a second answer to it.
 *
 * WHY THIS EXISTS RATHER THAN A WIDER MODULE RESPONSE. The projection that already answers "who
 * does Jarvis think you are" is certified, worker-scoped and worker-safe. Duplicating a display
 * name into a business module's own response would create a second identity display authority to
 * keep in agreement, for no gain.
 *
 * WHAT IT DOES NOT DO, deliberately:
 *
 *  - It adds no transport and no session handling: the delivered `onboardingWorkerFetch` is
 *    reused, so expiry, renewal and refusal classification have one implementation.
 *  - It does not write. There is no identity correction here, no discrepancy record, and no way
 *    to rewrite canonical identity from a worker surface, because canonical identity is not a
 *    business module's to hold.
 *  - It projects only what a caller is entitled to display. The bootstrap response carries more
 *    than a name; this client's type states the two fields it reads, so nothing else can be
 *    rendered by accident. NO date of birth and NO Social Security Number is read or exposed.
 */

import { onboardingWorkerFetch } from "./onboardingApi";

/** The worker's canonical identity, as his own portal is entitled to show it. */
export type WorkerPortalIdentity = {
  candidateId: string;
  /** Produced server-side by the canonical presentation mapper. Null when no name exists. */
  displayName: string | null;
};

/**
 * The fields of the portal bootstrap this client reads.
 *
 * Narrower than the certified response on purpose. The response also carries navigation, intent
 * and dashboard content, none of which is any business module's concern.
 */
export type WorkerPortalIdentityView = {
  identity: WorkerPortalIdentity;
};

/** This worker's own canonical identity, as the certified worker portal projects it. */
export async function getWorkerPortalIdentity(): Promise<WorkerPortalIdentity> {
  const bootstrap =
    await onboardingWorkerFetch<WorkerPortalIdentityView>("/workforce/portal");
  return {
    candidateId: bootstrap.identity.candidateId,
    displayName: bootstrap.identity.displayName,
  };
}
