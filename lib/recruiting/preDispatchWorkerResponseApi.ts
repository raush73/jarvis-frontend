/**
 * Phase 17 S3 - browser client for the worker's own PRE_DISPATCH job-interest surface.
 *
 * Governance: VETTING_SYSTEM.md PRE_DISPATCH WORKER COMMUNICATION; VETTING_BUILD_CHECKLIST.md
 * PHASE 17 slice S3.
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
};

export type PreDispatchWorkerResponseOutcome = {
  interestResult: PreDispatchInterestResult;
  respondedAt: string;
  alreadyRecorded: boolean;
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

  return (await res.json()) as PreDispatchWorkerPrompt;
}

/**
 * Submit the worker's answer.
 *
 * The body carries ONLY the decision. No candidacy id, no request id and no list of other jobs:
 * the record being answered is resolved from the link's own binding on the server, and managing
 * the worker's other interests is a separately governed later slice.
 */
export async function submitPreDispatchWorkerResponse(
  token: string,
  decision: PreDispatchWorkerDecision,
): Promise<PreDispatchWorkerResponseOutcome> {
  const res = await fetch(
    `${API_BASE}/public/pre-dispatch-request/respond?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    },
  );

  if (!res.ok) {
    throw new PreDispatchLinkError(classify(res.status, await readMessage(res)));
  }

  return (await res.json()) as PreDispatchWorkerResponseOutcome;
}
