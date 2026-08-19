/**
 * Module 4.2 Federal Tax - browser API client.
 *
 * The client half of the worker capsule and nothing more. It adds no endpoint, no transport and no
 * session handling of its own: the two governed worker routes go through the delivered
 * `onboardingWorkerFetch`, exactly as the Phase 4 document, Phase 5 execution and first two module
 * clients do. A second copy of that transport would be a second place for expiry, renewal and
 * refusal classification to drift.
 *
 * The types mirror `modules/federal-tax/federal-tax.view.ts` and the module's own DTO exactly.
 *
 * WHAT IS DELIBERATELY ABSENT, and none of it may be added here:
 *
 *  - THERE IS NO SOCIAL SECURITY NUMBER, in any shape. No field, no accessor, no parameter. The
 *    identity block carries the masked tail the identity authority produced and there is nowhere on
 *    these types to put a full one.
 *  - There is no candidate, worker or actor parameter on either call. Which worker is asking is the
 *    authenticated session's answer, so no argument here can widen it.
 *  - There is no question-set version parameter. The server stamps the version in force, which is
 *    what makes "what was this worker actually asked" answerable afterwards.
 *  - There is no execution, signature, certification, artifact or completion call, because none of
 *    those is this gate's and a worker cannot reach an act that has no client.
 *  - There is no per-answer update. A Save states the WHOLE answer set, because the server applies
 *    the worker's own branching to the whole picture and clears what no longer applies.
 *  - There is no staff or administrative surface. This module has none at all yet.
 *
 * ON BRANCHING. The applicable questions arrive already decided, in order, each with its guidance
 * and the worker's own answer. This client decides applicability for nothing: a second branching
 * implementation in a browser is exactly how two clients come to disagree about what a worker was
 * asked.
 */

import { onboardingWorkerFetch } from "./onboardingApi";

/* -------------------------------------------------------------------------- */
/*  Governed vocabulary (mirror of federal-tax.constants.ts)                   */
/* -------------------------------------------------------------------------- */

/** The registry key the platform knows this module by. */
export const FEDERAL_TAX_MODULE_KEY = "FEDERAL_TAX";

/** The module's own declared interview steps, in the order it presents them. */
export const FEDERAL_TAX_STEP_SLUGS = ["identity", "withholding", "review"] as const;
export type FederalTaxStepSlug = (typeof FEDERAL_TAX_STEP_SLUGS)[number];

/**
 * The closed set of answer keys the governed question set collects.
 *
 * Mirrored so this client can state an answer set without inventing a key. A key outside this list
 * is discarded by the server rather than stored, so an extra field cannot be smuggled into a
 * restricted draft from here either.
 */
export const FEDERAL_TAX_ANSWER_KEYS = [
  "identityConfirmed",
  "filingStatus",
  "exemptionElected",
  "multipleJobsElected",
  "adjustmentsElected",
  "dependentsCreditAmount",
  "otherIncomeAmount",
  "deductionsAmount",
  "additionalWithholdingAmount",
  "reviewConfirmed",
] as const;
export type FederalTaxAnswerKey = (typeof FEDERAL_TAX_ANSWER_KEYS)[number];

/** How one question is answered, so a screen renders it without deciding anything itself. */
export const FEDERAL_TAX_QUESTION_KINDS = [
  "CONFIRMATION",
  "CHOICE",
  "YES_NO",
  "AMOUNT",
] as const;
export type FederalTaxQuestionKind = (typeof FEDERAL_TAX_QUESTION_KINDS)[number];

/* -------------------------------------------------------------------------- */
/*  The interview, as the worker receives it                                   */
/* -------------------------------------------------------------------------- */

/** One option of a CHOICE question, with the plain-language label the worker reads. */
export type FederalTaxQuestionChoice = {
  value: string;
  label: string;
};

/** The guidance shown with one question: a short heading, and paragraphs beneath it. */
export type FederalTaxGuidance = {
  heading: string;
  paragraphs: string[];
};

/** One question as the worker receives it: what is asked, how to answer, and what he answered. */
export type FederalTaxQuestion = {
  key: FederalTaxAnswerKey;
  step: FederalTaxStepSlug;
  kind: FederalTaxQuestionKind;
  prompt: string;
  choices: FederalTaxQuestionChoice[];
  required: boolean;
  /** His current answer, or null when he has not answered. Never a default standing in for one. */
  answer: string | boolean | null;
  guidance: FederalTaxGuidance;
};

/** One declared step, with whether it truthfully carries recorded answers. */
export type FederalTaxStep = {
  slug: FederalTaxStepSlug;
  title: string;
  recorded: boolean;
};

/** One line of the plain-language review: the question as asked, and the answer as given. */
export type FederalTaxReviewLine = {
  key: FederalTaxAnswerKey;
  prompt: string;
  answer: string;
};

/**
 * WHICH governed question set the worker is answering.
 *
 * `formRevision` is null until the executable governed revision is published, which is not this
 * gate's to do. A client displays what it is given and guesses nothing.
 */
export type FederalTaxQuestionSetIdentity = {
  questionSetVersion: string;
  formKey: string;
  formRevision: string | null;
};

/**
 * The canonical record the worker is asked to confirm, as the server masked it.
 *
 * `maskedIdentifier` is the masked tail the identity authority produced, e.g. "***-**-1234". There
 * is no unmasked counterpart on this type and no call anywhere in this client that could obtain one.
 */
export type FederalTaxIdentity = {
  candidateId: string;
  displayName: string;
  maskedIdentifier: string | null;
  identifierOnFile: boolean;
  city: string | null;
  state: string | null;
};

export type FederalTaxInterview = {
  moduleKey: string;
  questionSet: FederalTaxQuestionSetIdentity;
  /** True when the saved answers were given under an earlier question set than the one in force. */
  questionSetSuperseded: boolean;
  identity: FederalTaxIdentity | null;
  steps: FederalTaxStep[];
  recordedStepSlugs: FederalTaxStepSlug[];
  /** Where an interrupted worker is returned to. Derived by the server from what is answered. */
  resumeStep: FederalTaxStepSlug;
  /** The questions that apply to him, in order, with his answers. */
  questions: FederalTaxQuestion[];
  review: FederalTaxReviewLine[];
  interviewComplete: boolean;
  savedAt: string | null;
  /** Whether an executed election already governs this worker. A fact to display, not a gate. */
  hasOperativeElection: boolean;
};

/**
 * One explicit Save: the whole answer set.
 *
 * Every answer is optional because a partial Save is the point - a worker saves in order to stop.
 * An amount is a STRING because the governed value is an exact decimal, and an absent amount is NO
 * ELECTION rather than an elected zero.
 */
export type SaveFederalTaxInterviewInput = {
  identityConfirmed?: boolean;
  filingStatus?: string;
  exemptionElected?: boolean;
  multipleJobsElected?: boolean;
  adjustmentsElected?: boolean;
  dependentsCreditAmount?: string | null;
  otherIncomeAmount?: string | null;
  deductionsAmount?: string | null;
  additionalWithholdingAmount?: string | null;
  reviewConfirmed?: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Refusals                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The governed refusals a WORKER can receive from this surface.
 *
 * A subset of the module's vocabulary, deliberately: the codes that classify a proposed ELECTION
 * are raised by an act no worker can perform on this surface, and a screen that had words for them
 * would be describing a path that does not exist.
 */
export const FEDERAL_TAX_WORKER_REFUSAL_CODES = [
  "ANSWER_NOT_GOVERNED",
  "IDENTITY_NOT_AVAILABLE",
  "DRAFT_PROTECTION_UNAVAILABLE",
  "DRAFT_PROTECTION_INVALID",
] as const;
export type FederalTaxWorkerRefusalCode =
  (typeof FEDERAL_TAX_WORKER_REFUSAL_CODES)[number];

/** Read the governed refusal code off a failure, or null when it is not one of ours. */
export function federalTaxRefusalCode(
  error: unknown,
): FederalTaxWorkerRefusalCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return (FEDERAL_TAX_WORKER_REFUSAL_CODES as readonly string[]).includes(
    code as string,
  )
    ? (code as FederalTaxWorkerRefusalCode)
    : null;
}

/* -------------------------------------------------------------------------- */
/*  Worker surface - exactly two calls                                         */
/* -------------------------------------------------------------------------- */

function workerBase(invocationId: string): string {
  return `/workforce/onboarding/runtime/packets/${encodeURIComponent(
    invocationId,
  )}/federal-tax`;
}

/**
 * This worker's own interview: the applicable questions, his answers, his guidance, his truthful
 * progress, and the step he resumes at.
 *
 * THIS IS ALSO THE RESUME READ. There is no separate resume call, because resuming is reading: the
 * step to return to is derived by the server from what has actually been answered rather than from
 * a position a client remembered.
 */
export async function getOwnFederalTaxInterview(
  invocationId: string,
): Promise<FederalTaxInterview> {
  return onboardingWorkerFetch<FederalTaxInterview>(workerBase(invocationId));
}

/**
 * EXPLICIT SAVE. Commit the answers the worker deliberately submitted, and read back what the
 * server made of them.
 *
 * The whole answer set travels in one request. Sending one answer states that this worker's
 * interview is now that answer set - it does not patch a field - which is what lets the server
 * apply his branching to the whole picture and erase what he made inapplicable.
 *
 * IT SAVES AND IT DOES NOT SUBMIT. Nothing here creates, changes or executes an election, and
 * nothing here completes the module.
 */
export async function saveOwnFederalTaxInterview(
  invocationId: string,
  answers: SaveFederalTaxInterviewInput,
): Promise<FederalTaxInterview> {
  return onboardingWorkerFetch<FederalTaxInterview>(workerBase(invocationId), {
    method: "POST",
    body: { answers },
  });
}
