/**
 * Gate JO-2 - browser client for the worker's own Job Offer decision surface.
 *
 * Governance: VETTING_SYSTEM.md, MW4H SELECTION, JOB OFFER AND ACTUAL DISPATCH.
 *
 * IT DELIBERATELY DOES NOT USE `apiFetch`, AND THAT IS A SECURITY PROPERTY RATHER THAN A STYLE
 * CHOICE. `apiFetch` attaches the STAFF bearer token and refuses to run without one. A worker
 * holding a secure link has no Jarvis staff account, so this client sends NO Authorization header
 * at all and never reads `jp_accessToken`. A worker surface that borrowed the staff credential
 * would be a worker surface that could act as staff.
 *
 * IT DOES NOT USE THE WORKER-SESSION CLIENT EITHER. This flow has no session, because the secure
 * link's own durable binding is the entire authorization for the one decision it carries.
 *
 * IT IS A SEPARATE CLIENT FROM THE PRE_DISPATCH ONE, DELIBERATELY. That flow asks whether a worker
 * is still interested if MW4H later selects them; this one asks whether they accept an actual job.
 * The two token scopes are not interchangeable on the server, and sharing a client here would be
 * the first step towards treating them as though they were.
 *
 * THE TYPES BELOW MIRROR THE BACKEND SAFE PROJECTION AND ADD NOTHING. There is no field for a
 * customer, company, bill rate, margin or internal note, because the backend never sends one -
 * confidentiality is enforced at the server, and this file must not become a second, weaker place
 * where it is merely not displayed.
 */

import { API_BASE } from "@/lib/api";
import type { PreDispatchSafeJob } from "@/lib/recruiting/preDispatchWorkerResponseApi";

/**
 * The job as the WORKER is entitled to see it.
 *
 * Reuses the PRE_DISPATCH safe-job shape rather than restating it, because it IS the same governed
 * projection: the backend serves both surfaces from one allowlist, and a second local copy of the
 * shape would be a second place for a forbidden field to be added by mistake.
 */
export type JobOfferSafeJob = PreDispatchSafeJob;

/**
 * Gate JO-2C. The five durable outcomes of one Job Offer cycle.
 *
 * `LAPSED` AND `DECLINED` ARE DIFFERENT FACTS AND MUST STAY THAT WAY IN THE UI TOO. Lapsed means the
 * response deadline passed with no answer; declined means the worker chose to decline. Nothing in this
 * client may map one onto the other, and no screen may describe a lapse as a decline.
 *
 * `RESCINDED` IS AN MW4H ACT. It is never presented as worker withdrawal, worker fault or lack of
 * qualification.
 */
export type JobOfferState =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "LAPSED"
  | "RESCINDED";

export type JobOfferDecision = "ACCEPT" | "DECLINE";

/**
 * One other active posting that accepting THIS offer would remove the worker from.
 *
 * DISCLOSURE ONLY. There is no toggle, rank, preference or "keep" field here, because the server
 * serves none and would refuse to act on one. Managing the worker's other interests is a
 * separately governed later slice.
 */
export type JobOfferCompetingPosting = {
  orderCandidateId: string;
  job: JobOfferSafeJob;
};

/** Everything the worker's page needs in order to decide. */
export type JobOfferPrompt = {
  companyIdentity: string;
  workerFirstName: string | null;
  job: JobOfferSafeJob;
  prompt: string;
  acceptLabel: string;
  declineLabel: string;
  /** The governed sentence about what follows acceptance. Never a claim that anything was sent. */
  paperworkNotice: string;
  /** Non-null only when there is genuinely something the worker would lose. */
  consequenceNotice: string | null;
  competingPostings: JobOfferCompetingPosting[];
  /**
   * The offer's EFFECTIVE state, decided by the server.
   *
   * The page does NOT work this out from `respondByAt` and the device clock. A wrong device clock must
   * only ever change what a worker sees, never what the system believes, so the state shown is the
   * server's and the deadline below is presentational.
   */
  decisionState: JobOfferState;
  respondedAt: string | null;
  /**
   * Gate JO-2C. The business deadline by which the worker must answer, or null on a historical offer.
   *
   * FOR DISPLAY, AND FOR DISPLAY ONLY. It is formatted in the worker's own locale and counted down
   * against, because a worker cannot act on a deadline they were never shown. Enforcement is entirely
   * server-side, so a device whose clock is wrong shows a wrong countdown and still cannot answer late.
   */
  respondByAt: string | null;
  /**
   * When the secure link itself stops working.
   *
   * GATE JO-2C: IT FOLLOWS `respondByAt` and is no longer a separate 24-hour allowance. It is still a
   * distinct concept - a credential can be dead while an offer is not, on historical offers and after a
   * rescission - which is why the two are separate fields and separate screens.
   */
  linkExpiresAt: string;
  actionable: boolean;
};

export type JobOfferDecisionOutcome = {
  decisionState: JobOfferState;
  respondedAt: string;
  alreadyRecorded: boolean;
  competingClosedCount: number;
  assignmentId: string | null;
};

/**
 * Why a link could not be used, in terms a worker can act on.
 *
 * Mapped from the server's own refusal rather than invented, and deliberately coarse: the page
 * needs to know which of a few honest explanations to show, and nothing more.
 *
 * GATE JO-2C SPLIT THE OFFER-ENDED CASES OUT OF `ALREADY_USED`. JO-2 had one bucket for "there is no
 * decision left to make", which was adequate when the only way to get there was that somebody had
 * already decided. There are now two more ways, and both would have been actively misdescribed:
 *   - `LAPSED` - the DEADLINE passed. Telling this worker their decision was already recorded would
 *     report a choice they never made, which governance forbids outright.
 *   - `RESCINDED` - MW4H withdrew the offer. Not the worker's doing at all, and no reason is disclosed.
 * `EXPIRED` remains SEPARATE from `LAPSED`, because a dead credential and a closed offer are different
 * situations with different next steps.
 */
export type JobOfferLinkFailure =
  | "INVALID"
  | "EXPIRED"
  | "ALREADY_USED"
  | "NOT_ACTIONABLE"
  | "LAPSED"
  | "RESCINDED"
  | "FAILED";

/**
 * A refusal, carrying a classification and NO server internals.
 *
 * The raw server message is not retained. It is safe by construction on the backend, but keeping it
 * here would create a route for a future backend change to surface an internal detail in a worker's
 * browser.
 */
export class JobOfferLinkError extends Error {
  readonly failure: JobOfferLinkFailure;

  constructor(failure: JobOfferLinkFailure) {
    super(failure);
    this.name = "JobOfferLinkError";
    this.failure = failure;
  }
}

/**
 * Gate JO-2C. The server's stable refusal codes, mapped to the screen each one deserves.
 *
 * CODES ARE THE PRIMARY CLASSIFICATION NOW, AND THAT IS A CORRECTNESS FIX. JO-2 branched on substrings
 * of the server's prose, which meant a wording correction anywhere in the backend could silently
 * re-route a worker to the wrong screen - and JO-2C corrects several strings, so the defect was about
 * to fire. A code is a contract; a sentence is copy.
 */
const FAILURE_BY_CODE: Record<string, JobOfferLinkFailure> = {
  JOB_OFFER_LAPSED: "LAPSED",
  JOB_OFFER_RESCINDED: "RESCINDED",
  JOB_OFFER_ALREADY_DECIDED: "ALREADY_USED",
  JOB_OFFER_CANDIDACY_NOT_OFFERABLE: "NOT_ACTIONABLE",
};

/** The safe fields of a refusal body. Nothing else is read, and nothing else is retained. */
type RefusalBody = { code: string; message: string };

async function readRefusal(res: Response): Promise<RefusalBody> {
  try {
    const payload = (await res.json()) as { code?: unknown; message?: unknown } | null;
    return {
      code: typeof payload?.code === "string" ? payload.code : "",
      message: typeof payload?.message === "string" ? payload.message : "",
    };
  } catch {
    return { code: "", message: "" };
  }
}

/**
 * Classify a refusal, preferring the server's code.
 *
 * MESSAGE MATCHING SURVIVES ONLY AS A DEFENSIVE FALLBACK, for a refusal that carries no code - a
 * transport-level failure, a proxy's own error body, or an older deployment. It is deliberately
 * second, so no coded refusal can be classified by its prose.
 */
function classify(status: number, refusal: RefusalBody): JobOfferLinkFailure {
  const byCode = FAILURE_BY_CODE[refusal.code];
  if (byCode) return byCode;

  const message = refusal.message;

  if (status === 409) {
    // The offer was already decided, or the candidacy has moved on. Both mean there is no decision
    // left for this worker to make, which is a different thing from a broken link.
    if (message.includes("no longer open")) return "NOT_ACTIONABLE";
    return "ALREADY_USED";
  }
  if (status === 403) {
    if (message.includes("expired")) return "EXPIRED";
    if (message.includes("already been used")) return "ALREADY_USED";
    return "INVALID";
  }
  return "FAILED";
}

/**
 * Fetch the safe offer projection for a secure link.
 *
 * READ-ONLY, AND INERT ON THE SERVER TOO. Calling this repeatedly - a reload, a refocus, a React
 * refetch - does not consume the link, extend it, mint another, change the offer, touch the
 * candidacy, create an assignment or close any other posting.
 */
export async function getJobOfferPrompt(token: string): Promise<JobOfferPrompt> {
  const res = await fetch(
    `${API_BASE}/public/job-offer?token=${encodeURIComponent(token)}`,
    { method: "GET" },
  );

  if (!res.ok) {
    throw new JobOfferLinkError(classify(res.status, await readRefusal(res)));
  }

  return (await res.json()) as JobOfferPrompt;
}

/**
 * Submit the worker's accept or decline.
 *
 * The body carries ONLY the decision. No offer id, candidacy id or list of other postings: the
 * record being decided is resolved from the link's own binding on the server, and the other
 * postings are shown to the worker as a consequence, never offered as controls.
 */
export async function submitJobOfferDecision(
  token: string,
  decision: JobOfferDecision,
): Promise<JobOfferDecisionOutcome> {
  const res = await fetch(
    `${API_BASE}/public/job-offer/decision?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    },
  );

  if (!res.ok) {
    throw new JobOfferLinkError(classify(res.status, await readRefusal(res)));
  }

  return (await res.json()) as JobOfferDecisionOutcome;
}
