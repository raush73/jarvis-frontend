/**
 * Gate JO-2C - the STAFF client for the Job Offer lifecycle.
 *
 * Governance: VETTING_SYSTEM.md, MW4H SELECTION, JOB OFFER AND ACTUAL DISPATCH, as corrected by the
 * JO-2C lifecycle ruling.
 *
 * A SEPARATE FILE FROM `jobOfferApi.ts`, AND THE SEPARATION IS A SECURITY PROPERTY. That file is the
 * WORKER's client: it deliberately sends no Authorization header, because a worker holding a secure
 * link has no Jarvis staff account and a worker surface that borrowed the staff credential would be a
 * worker surface that could act as staff. This file is the exact opposite - every call here uses
 * `apiFetch`, which attaches the staff bearer token and refuses to run without one. Putting a staff
 * mutation in the worker's client, or a worker read in this one, is how those two boundaries would
 * eventually be confused.
 *
 * READ AND WRITE ARE DIFFERENT SERVER PERMISSIONS, AND THAT IS ENFORCED THERE, NOT HERE. The history
 * read is `RECRUITING_READ`; rescission and extension are `RECRUITING_WRITE`. This client cannot grant
 * itself either one - it is a transport, and the guard is on the route.
 */

import { apiFetch } from '@/lib/api';

/** The five durable outcomes of one Job Offer cycle. */
export type JobOfferCycleState =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'LAPSED'
  | 'RESCINDED';

/**
 * One Job Offer cycle, as the internal board sees it.
 *
 * NO INTERNAL REASONING AND NO ACTOR NAME. The server deliberately does not select `rescindedReason`
 * even for staff, so there is no field for it here and no way for it to arrive.
 */
export type JobOfferCycle = {
  jobOfferId: string;
  cycleSequence: number;
  /** The EFFECTIVE state: a cycle past its deadline reads LAPSED whether or not it was written yet. */
  state: JobOfferCycleState;
  respondByAt: string | null;
  respondedAt: string | null;
  rescindedAt: string | null;
  offeredAt: string;
};

/**
 * A candidacy's Job Offer history.
 *
 * TWO FACTS, BECAUSE STAFF ASK TWO QUESTIONS. `current` is "is an offer out with this worker right
 * now"; `latestTerminal` is "what happened last time we offered". A candidacy can hold both - a lapsed
 * cycle 1 and an open cycle 2 - so they are separate fields rather than one collapsed status.
 */
export type JobOfferHistory = {
  totalCycles: number;
  current: JobOfferCycle | null;
  latestTerminal: JobOfferCycle | null;
};

/**
 * Read one candidacy's Job Offer history.
 *
 * A GET, AND READING NEVER ADVANCES A LIFECYCLE. The server derives effective state and deliberately
 * persists nothing on this path, so a board refresh cannot lapse, decide or end an offer. That is why
 * it is safe to call on every deliberate load - and why there is still no polling or timer here.
 */
export async function getJobOfferHistory(orderCandidateId: string): Promise<JobOfferHistory> {
  return apiFetch<JobOfferHistory>(
    `/recruiting/order-candidate/${encodeURIComponent(orderCandidateId)}/job-offer-history`,
  );
}

/**
 * Withdraw a still-open Job Offer.
 *
 * THE REASON IS INTERNAL AND STAYS INTERNAL. It is stored for MW4H, and no worker-facing projection
 * selects the column it lands in - the worker is told only that the offer is no longer available.
 */
export async function rescindJobOffer(input: {
  jobOfferId: string;
  reason?: string;
}): Promise<{ ok: true; jobOfferId: string; state: JobOfferCycleState; rescindedAt: string }> {
  return apiFetch(`/recruiting/job-offer/rescind`, {
    method: 'POST',
    body: JSON.stringify({ jobOfferId: input.jobOfferId, reason: input.reason }),
  });
}

/**
 * Give the worker LONGER to respond.
 *
 * EXTENSION ONLY. The server refuses anything that is not strictly later than the deadline in force,
 * and it compares against the DATABASE value rather than anything sent from here - so a board showing a
 * stale deadline cannot talk the server into a shortening.
 */
export async function extendJobOfferDeadline(input: {
  jobOfferId: string;
  respondByAt: string;
}): Promise<{ ok: true; jobOfferId: string; respondByAt: string; previousRespondByAt: string }> {
  return apiFetch(`/recruiting/job-offer/extend-deadline`, {
    method: 'POST',
    body: JSON.stringify({ jobOfferId: input.jobOfferId, respondByAt: input.respondByAt }),
  });
}
