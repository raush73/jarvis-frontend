/**
 * Phase 17 S3/S4 - browser client for the worker's own PRE_DISPATCH job-interest surface.
 *
 * Governance: VETTING_SYSTEM.md PRE_DISPATCH WORKER COMMUNICATION; VETTING_BUILD_CHECKLIST.md
 * PHASE 17 slices S3 and S4.
 *
 * IT DELIBERATELY DOES NOT USE `apiFetch`, AND THAT IS A SECURITY PROPERTY RATHER THAN A STYLE
 * CHOICE. `apiFetch` attaches the STAFF bearer token and refuses to run without one. A worker
 * holding a secure link has no Jarvis staff account, so this client sends NO Authorization header
 * at all and never reads `jp_accessToken`. A worker surface that borrowed the staff credential
 * would be a worker surface that could act as staff.
 *
 * IT DOES NOT USE THE WORKER-SESSION CLIENT EITHER. `onboardingWorkerFetch` carries the Worker
 * Portal session token; this flow has no session, because the secure link's own durable binding
 * is the entire authorization for the one question it asks. Link lifetime and session lifetime
 * therefore cannot be confused here.
 *
 * THE TYPES BELOW MIRROR THE BACKEND SAFE PROJECTION AND ADD NOTHING. There is no field for a
 * customer, company, bill rate, margin or internal note, because the backend never sends one -
 * confidentiality is enforced at the server, and this file must not become a second, weaker
 * place where it is merely not displayed.
 */

import { API_BASE } from "@/lib/api";

/**
 * The job as the WORKER is entitled to see it.
 *
 * Every field is the worker's own role, the governed location granularity, or the WORKER side of
 * money. Note what is absent and must stay absent: customer/company identity, site name, street
 * address, bill rate, margin, markup, billing terms and internal notes.
 */
export type PreDispatchSafeJob = {
  tradeName: string;
  specializationName: string | null;
  city: string | null;
  state: string | null;
  /** The worker's own pay rate, as a decimal string. Never a customer bill rate. */
  payRate: string | null;
  perDiemDailyRate: string | null;
  perDiemDaysPerWeek: string | null;
  anticipatedStartDate: string | null;
  anticipatedEndDate: string | null;
  estimatedDurationWeeks: number | null;
  estimatedRegHoursPerWeek: string | null;
  estimatedOtHoursPerWeek: string | null;
  estimatedWorkDaysPerWeek: number | null;
};

export type PreDispatchInterestResult =
  | "CONTINUED_INTEREST_CONFIRMED"
  | "WITHDRAWAL_REQUESTED";

export type PreDispatchRecordedAnswer = {
  interestResult: PreDispatchInterestResult;
  respondedAt: string;
};

/** Everything the worker's page needs in order to ask the primary question. */
export type PreDispatchWorkerPrompt = {
  workerFirstName: string | null;
  job: PreDispatchSafeJob;
  question: string;
  yesLabel: string;
  noLabel: string;
  linkExpiresAt: string;
  /** The Owner-governed sentence, supplied by the server rather than written here. */
  expirationNotice: string;
  recordedAnswer: PreDispatchRecordedAnswer | null;
  actionable: boolean;
  /** Phase 17 S4. Server-classified, chronological, and empty when there are no other interests. */
  otherInterests: PreDispatchOtherInterest[];
  /** Phase 17 S4. Present even when the list is empty, so there is one source for the wording. */
  otherInterestsCopy: PreDispatchOtherInterestsCopy;
};

/**
 * Phase 17 S4. Which of the two treatments a sibling posting gets, as decided by the SERVER.
 *
 * THE PAGE DOES NOT CLASSIFY, AND MUST NOT START. Ruling A's categories are derived on the server
 * from the candidacy status, the selection state and the offer's own deadline - facts this client
 * cannot see and must not guess. Rendering the category it is handed is the whole of the client's
 * job; recomputing it here would create a second definition that could disagree with the one the
 * write path enforces.
 */
export type PreDispatchOtherInterestCategory =
  /** Ruling A categories A and D. Keep by default, Remove available. */
  | "KEEP_OR_REMOVE"
  /** Ruling A category B. Read-only, with Review Job Offer instead of Keep/Remove. */
  | "PENDING_JOB_OFFER";

/**
 * One OTHER active job posting this worker is still being considered for.
 *
 * NOTE WHAT IS ABSENT: there is no job offer id, no offer state, and no lapse or rescission history.
 * The server does not send them, so no amount of client code here could display them. The Review
 * handoff names the CANDIDACY, which is why no offer identifier is needed on this surface at all.
 */
export type PreDispatchOtherInterest = {
  orderCandidateId: string;
  job: PreDispatchSafeJob;
  category: PreDispatchOtherInterestCategory;
  /** Non-null only for `PENDING_JOB_OFFER`, and it carries the response deadline and nothing else. */
  pendingJobOffer: { respondByAt: string | null } | null;
};

/**
 * Phase 17 S4. The governed wording for the other-interests section, served rather than written here.
 *
 * THE COPY IS THE SERVER'S, because it is Owner-governed wording rather than presentation. A label
 * duplicated in this file would be a second place the governed text could drift.
 */
export type PreDispatchOtherInterestsCopy = {
  heading: string;
  notice: string;
  removeLabel: string;
  undoRemoveLabel: string;
  pendingJobOfferLabel: string;
  pendingJobOfferNotice: string;
  reviewJobOfferLabel: string;
  confirmationHeading: string;
};

/**
 * Phase 17 S4. What the submission actually did to the worker's other interests.
 *
 * THE CONFIRMATION MUST BE BUILT FROM `removedOrderCandidateIds`, NEVER FROM THE PAGE'S OWN
 * SELECTION. The two differ whenever a target stopped being removable between the read and the
 * write, and telling a worker that a posting was closed when it was skipped would be a false
 * statement about their own record.
 */
export type PreDispatchSiblingRemovalOutcome = {
  requested: number;
  removedOrderCandidateIds: string[];
  skipped: number;
};

export type PreDispatchWorkerResponseOutcome = {
  interestResult: PreDispatchInterestResult;
  respondedAt: string;
  alreadyRecorded: boolean;
  /** Phase 17 S4. Always present, with an empty array when nothing was removed. */
  siblingRemoval: PreDispatchSiblingRemovalOutcome;
};

/**
 * Phase 17 S4. A fresh Job Offer credential for an offer the worker already holds.
 *
 * IT IS A HANDOFF, NOT A NEW OFFER. `respondByAt` is the deadline the offer already had: the
 * credential is replaced, the offer is not. A shorter-lived link ending at the same unchanged
 * deadline is the whole of what this returns.
 */
export type PreDispatchJobOfferReviewHandoff = {
  token: string;
  expiresAt: string;
  respondByAt: string | null;
};

export type PreDispatchWorkerDecision = "YES" | "NO";

/**
 * Why a link could not be used, in terms a worker can act on.
 *
 * Mapped from the server's own refusal rather than invented, and deliberately coarse: the page
 * needs to know which of a few honest explanations to show, and nothing more.
 */
export type PreDispatchLinkFailure =
  | "INVALID"
  | "EXPIRED"
  | "ALREADY_USED"
  | "NOT_ACTIONABLE"
  | "FAILED";

/**
 * A refusal, carrying a classification and NO server internals.
 *
 * The raw server message is not retained. It is safe by construction on the backend, but keeping
 * it here would create a route for a future backend change to surface an internal detail in a
 * worker's browser.
 */
export class PreDispatchLinkError extends Error {
  readonly failure: PreDispatchLinkFailure;

  constructor(failure: PreDispatchLinkFailure) {
    super(failure);
    this.name = "PreDispatchLinkError";
    this.failure = failure;
  }
}

/** Classify a refusal from its status and the server's own safe message. */
function classify(status: number, message: string): PreDispatchLinkFailure {
  if (status === 409) return "ALREADY_USED";
  if (status === 403) {
    if (message.includes("expired")) return "EXPIRED";
    if (message.includes("already been used")) return "ALREADY_USED";
    if (message.includes("no longer open")) return "NOT_ACTIONABLE";
    return "INVALID";
  }
  return "FAILED";
}

async function readMessage(res: Response): Promise<string> {
  try {
    const payload = await res.json();
    const message = (payload as { message?: unknown } | null)?.message;
    return typeof message === "string" ? message : "";
  } catch {
    return "";
  }
}

/**
 * Fetch the safe prompt for a secure link.
 *
 * READ-ONLY, AND INERT ON THE SERVER TOO. Calling this repeatedly - a reload, a refocus, a React
 * refetch - does not consume the link, extend it, mint another or send anything.
 */
export async function getPreDispatchWorkerPrompt(
  token: string,
): Promise<PreDispatchWorkerPrompt> {
  const res = await fetch(
    `${API_BASE}/public/pre-dispatch-request?token=${encodeURIComponent(token)}`,
    { method: "GET" },
  );

  if (!res.ok) {
    throw new PreDispatchLinkError(classify(res.status, await readMessage(res)));
  }

  const prompt = (await res.json()) as PreDispatchWorkerPrompt;

  /**
   * S4'S LIST IS DEFAULTED TO EMPTY, BECAUSE THE TYPE IS A PROMISE THE NETWORK CANNOT KEEP.
   *
   * A backend that predates S4 - which is any backend during the window between the two deploys -
   * omits `otherInterests`, and a worker whose page threw on a missing array would see a blank
   * screen on their phone instead of the question they were texted about. Absent is read as "no
   * other interests", which degrades exactly to the S3 experience.
   *
   * THE GOVERNED COPY IS NOT DEFAULTED, DELIBERATELY. Inventing worker-facing wording here would
   * make this file a second source for text the Owner governs. It is not needed either: the copy is
   * only ever read inside the section that renders this list, so an empty list means it is
   * unreachable.
   */
  return { ...prompt, otherInterests: prompt.otherInterests ?? [] };
}

/**
 * Submit the worker's answer, together with any other postings they confirmed leaving.
 *
 * IT IS ONE REQUEST BECAUSE THE CREDENTIAL IS SINGLE-USE. The link is burned by the server inside
 * the same transaction that records the answer, so a second call could not succeed even if this
 * file tried. The primary decision and the confirmed removals therefore travel together or not at
 * all - there is no state in which a worker's withdrawals committed but their answer did not.
 *
 * THE BODY STILL CARRIES NO IDENTITY. No candidate id, no request id and no order id: the record
 * being answered is resolved from the link's own durable binding on the server. The only ids sent
 * are the sibling candidacies the worker chose, and the server treats those as a selection to be
 * intersected with what it independently derives - never as authority.
 *
 * KEEP IS SENT AS NOTHING AT ALL. A posting the worker left alone is simply absent from the array,
 * because Keep is the default and persists no state. An empty array is omitted entirely.
 */
export async function submitPreDispatchWorkerResponse(
  token: string,
  decision: PreDispatchWorkerDecision,
  removeOrderCandidateIds: string[] = [],
): Promise<PreDispatchWorkerResponseOutcome> {
  const res = await fetch(
    `${API_BASE}/public/pre-dispatch-request/respond?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        removeOrderCandidateIds.length > 0
          ? { decision, removeOrderCandidateIds }
          : { decision },
      ),
    },
  );

  if (!res.ok) {
    throw new PreDispatchLinkError(classify(res.status, await readMessage(res)));
  }

  return (await res.json()) as PreDispatchWorkerResponseOutcome;
}

/**
 * Phase 17 S4. Obtain a credential for a Job Offer the worker already holds, in order to review it.
 *
 * IT DOES NOT CONSUME THE PRE_DISPATCH LINK, so a worker can open their pending offer, decide not
 * to act on it, come back and still answer the primary question. The server validates the link
 * without burning it and proves independently that the named candidacy is the worker's own and its
 * offer is still open.
 *
 * IT GRANTS NO NEW AUTHORITY HERE. This client cannot accept or decline anything; it receives a
 * token for the existing Job Offer surface, which is where that authority has always lived.
 *
 * A REFUSAL IS EXPECTED AND NORMAL. The deadline can pass, or staff can rescind, while the page is
 * open - `NOT_ACTIONABLE` is the honest answer in both cases, and the caller should re-read the
 * prompt rather than treat it as a broken link.
 */
export async function requestPreDispatchJobOfferReview(
  token: string,
  orderCandidateId: string,
): Promise<PreDispatchJobOfferReviewHandoff> {
  const res = await fetch(
    `${API_BASE}/public/pre-dispatch-request/job-offer-review?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderCandidateId }),
    },
  );

  if (!res.ok) {
    // A 409 MEANS SOMETHING DIFFERENT ON THIS ROUTE, so it is mapped here rather than in the shared
    // `classify`. On the respond route a 409 is "you already answered"; here it is every way an
    // offer can have closed - lapsed, rescinded, already decided, or on a candidacy that has moved
    // on. All of those are `NOT_ACTIONABLE`, and none of them is a used link. The distinctions
    // between them are deliberately not surfaced: which one it was would tell the holder of a link
    // what staff did, and the worker's next step is the same either way.
    const failure =
      res.status === 409
        ? "NOT_ACTIONABLE"
        : classify(res.status, await readMessage(res));
    throw new PreDispatchLinkError(failure);
  }

  return (await res.json()) as PreDispatchJobOfferReviewHandoff;
}
