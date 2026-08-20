/**
 * Module 4.2 Federal Tax - browser API client.
 *
 * The client half of the worker capsule and nothing more. It adds no endpoint, no transport and no
 * session handling of its own: the four governed worker routes go through the delivered
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
 *  - There is no candidate, worker or actor parameter on any call. Which worker is asking is the
 *    authenticated session's answer, so no argument here can widen it.
 *  - There is no question-set version parameter. The server stamps the version in force, which is
 *    what makes "what was this worker actually asked" answerable afterwards.
 *  - There is no per-answer update. A Save states the WHOLE answer set, because the server applies
 *    the worker's own branching to the whole picture and clears what no longer applies.
 *  - There is no staff or administrative surface. This module has none at all yet.
 *  - There is no artifact, download or completion call. The retained artifact reaches the worker
 *    through the DELIVERED document client, and completion is DERIVED server-side from this
 *    module's own validator rather than claimed by a browser.
 *  - THERE IS NO ELECTION CONTENT ON THE CERTIFICATION PAYLOAD. No filing status, no amount, no
 *    exemption election, no revision, no origin, no executed-at. What the worker certifies is the
 *    answer set the server already holds, read server-side at the moment he certifies, so a client
 *    cannot certify one election while having shown him another.
 *  - There is no subsequent election, correction or future-year replacement call. All three are
 *    separately governed work and none of them has a client here.
 *
 * ON BRANCHING. The applicable questions arrive already decided, in order, each with its guidance
 * and the worker's own answer. This client decides applicability for nothing: a second branching
 * implementation in a browser is exactly how two clients come to disagree about what a worker was
 * asked.
 *
 * ON THE CERTIFICATION. The authoritative wording arrives as the DELIVERED execution subject
 * projection and is passed through untouched - this client neither authors it, edits it,
 * paraphrases it, nor computes anything about it. Its `revision`, `contentHash` and `ruleRevision`
 * travel back UNCHANGED with the act, which is what lets the server refuse an act performed
 * against wording that has since moved.
 */

import { onboardingWorkerFetch } from "./onboardingApi";
import type {
  OnboardingExecutionCapture,
  OnboardingExecutionForm,
  OnboardingExecutionSubject,
  PresentedOnboardingExecutionContent,
} from "./onboardingExecutionApi";

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
 * THREE IDENTIFIERS, AND NONE OF THEM SUBSTITUTES FOR ANOTHER. `questionSetVersion` is the version
 * of the questions he was asked; `formKey` and `formRevision` name the published governed revision
 * those questions are bound to. A client displays what it is given and guesses nothing - the
 * nullable revision is the wire contract's, not an invitation to fill one in.
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
/*  The certification stage, as the worker receives it                         */
/* -------------------------------------------------------------------------- */

/** Why the certification stage is not open to this worker, where it is not. */
export const FEDERAL_TAX_CERTIFICATION_BLOCKERS = [
  "INTERVIEW_NOT_COMPLETE",
  "QUESTION_SET_SUPERSEDED",
  "ELECTION_ALREADY_EXECUTED",
] as const;
export type FederalTaxCertificationBlocker =
  (typeof FEDERAL_TAX_CERTIFICATION_BLOCKERS)[number];

/** One governed exemption condition, and whether the worker affirmed it. */
export type FederalTaxExemptionCondition = {
  condition: string;
  affirmed: boolean;
};

/**
 * The worker's executed election, as HE may be told about it.
 *
 * FACTS, IDENTIFIERS AND MASKS. There is no capture here in any encoding, no envelope and no
 * storage location, and no field on this type through which any of them could travel.
 * `artifactDocumentId` is the IDENTITY of the retained artifact - what the DELIVERED document
 * client needs in order to hand him his own copy. It is not a location and cannot be turned into
 * one from a browser.
 */
export type FederalTaxExecutedElection = {
  setVersion: number;
  executedAt: string;
  effectiveFrom: string;
  formKey: string;
  formRevision: string;
  exemptionClaimed: boolean;
  receivedAt: string;
  receiptBasis: string;
  executionRecordId: string | null;
  artifactDocumentId: string | null;
  artifactSlotKey: string;
};

/**
 * The certification stage: what he is putting in force, and what he signs to do it.
 *
 * THE TWO KINDS OF WORDS ARE SEPARATE FIELDS BECAUSE THEY ARE SEPARATE THINGS (ruling OR-3).
 * `certification` is the AUTHORITATIVE governed wording, resolved, hashed and projected by the
 * delivered execution surface; `guidance` is Jarvis explaining it. A screen that rendered them as
 * one block would be putting Jarvis wording inside a federal certification, so nothing in this
 * client merges, reorders or interleaves them.
 */
export type FederalTaxCertification = {
  moduleKey: string;
  /**
   * The authoritative certification, as the DELIVERED execution subject projection.
   *
   * Carried whole and passed through untouched. Its `content.revision`, `content.contentHash` and
   * `content.ruleRevision` are the exact three values that travel back with the act; nothing here
   * recomputes, refreshes or re-derives any of them, because each would turn a claim about what was
   * displayed into a claim the display never made.
   */
  certification: OnboardingExecutionSubject;
  /** Jarvis explanation. Explains the certification; is not part of it and is not hashed with it. */
  guidance: string[];
  applicableTaxYear: string;
  exemptionElected: boolean;
  /** The two governed conditions an exemption requires. Present whether or not one was claimed. */
  exemptionConditions: FederalTaxExemptionCondition[];
  exemptionGuidance: string[];
  review: FederalTaxReviewLine[];
  identity: FederalTaxIdentity | null;
  /** Whether he may certify now. ADVISORY: the server decides again when the act arrives. */
  available: boolean;
  blockers: FederalTaxCertificationBlocker[];
  /** His executed election, once one governs him. Null before that. */
  executed: FederalTaxExecutedElection | null;
};

/**
 * ONE ACT OF CERTIFICATION, as this client submits it.
 *
 * NOTE WHAT IS ABSENT, because that is most of the governance: no candidate, worker, actor or
 * packet identifier, no executed-at, and NO ELECTION CONTENT OF ANY KIND. Every identity is
 * derived from the authenticated session server-side, and what is elected is read from the answers
 * the server already holds. A field that does not exist here cannot be smuggled through it.
 *
 * The two affirmations are SEPARATELY NAMED rather than a list or a count. A list could arrive
 * short, out of order or with the same affirmation twice and still validate; a count could be
 * satisfied by affirming one condition twice. Named individually, each is affirmed or the
 * certification is refused - which is what "both, never one" has to mean on the wire.
 */
export type CertifyFederalTaxElectionInput = {
  /** The exact governed content the client claims it displayed. Forwarded unchanged. */
  presented: PresentedOnboardingExecutionContent;
  /** Copied from the subject's own `requiredForm`, never derived from what the worker did. */
  performedForm: OnboardingExecutionForm;
  /** The worker's mark, as the DELIVERED shared capture carries it. Geometry and a duration. */
  capture?: OnboardingExecutionCapture | null;
  hadNoLiabilityForPriorYear?: boolean;
  expectsNoLiabilityForApplicableYear?: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Refusals                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The governed refusals a WORKER can receive from this surface.
 *
 * A SUBSET OF THE MODULE'S VOCABULARY, DELIBERATELY, and the subset grew at Gate 8C because the
 * worker can now perform the act those codes classify. The codes still absent are the ones raised
 * only by acts no worker can perform here - a correction, a superseding election, a proposed
 * election assembled by something other than his own interview - and a screen with words for them
 * would be describing a path that does not exist.
 */
export const FEDERAL_TAX_WORKER_REFUSAL_CODES = [
  "ANSWER_NOT_GOVERNED",
  "IDENTITY_NOT_AVAILABLE",
  "DRAFT_PROTECTION_UNAVAILABLE",
  "DRAFT_PROTECTION_INVALID",
  /** Certification attempted before the guided interview was finished and reviewed (8-R4). */
  "INTERVIEW_NOT_COMPLETE",
  /** An executed election already governs him. Changing one is separately governed work. */
  "ELECTION_ALREADY_EXECUTED",
  /** An exemption was claimed without affirming both governed conditions, or the reverse (OR-3). */
  "EXEMPTION_CONDITIONS_REQUIRED",
  /** The governed execution and artifact identities could not be bound to the election (OR-2). */
  "ELECTION_BINDING_UNAVAILABLE",
  /** The governed revision the act would be executed under could not be resolved (8-R1). */
  "REVISION_BINDING_REQUIRED",
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
/*  Worker surface - exactly four calls                                        */
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

/**
 * The certification stage: what he is about to put in force, the authoritative certification he
 * signs, Jarvis's explanation of it kept separate, and what he has already done.
 *
 * THIS IS THE PRESENTATION HALF OF THE EXACT-CONTENT ROUND TRIP. The revision, rule revision and
 * canonical hash carried out here are exactly what travels back when he certifies, and the server
 * re-resolves the governed content independently and refuses if they have moved. Nothing is cached
 * between the two - a cache would remove the very race the comparison exists to catch.
 *
 * LOOKING IS NOT SIGNING. This read authorizes nothing: `available` and `blockers` are advisory in
 * both directions, and every one of those conditions is decided again server-side when the act
 * arrives.
 */
export async function getOwnFederalTaxCertification(
  invocationId: string,
): Promise<FederalTaxCertification> {
  return onboardingWorkerFetch<FederalTaxCertification>(
    `${workerBase(invocationId)}/certification`,
  );
}

/**
 * CERTIFY: put the reviewed election in force.
 *
 * ONE CALL FOR THE WHOLE GOVERNED SEQUENCE, and that is the point. This client cannot execute, then
 * generate an artifact, then bind it, then complete the module in four requests of its own
 * ordering: the server owns the sequence behind this single route, so there is no intermediate
 * state a browser could stop at and no order it could rearrange.
 *
 * `presented` is forwarded exactly as the subject delivered it. `performedForm` is copied from the
 * subject's own required act - naming an act here can only fail the certification, never define it.
 * The affirmations are sent as booleans in both directions, because absent is NOT affirmed and the
 * governed rule runs both ways: claiming an exemption requires both, claiming none permits neither.
 */
export async function certifyOwnFederalTaxElection(
  invocationId: string,
  input: CertifyFederalTaxElectionInput,
): Promise<FederalTaxCertification> {
  const body: Record<string, unknown> = {
    presented: {
      revision: input.presented.revision,
      contentHash: input.presented.contentHash,
      ruleRevision: input.presented.ruleRevision,
    },
    performedForm: input.performedForm,
    hadNoLiabilityForPriorYear: input.hadNoLiabilityForPriorYear === true,
    expectsNoLiabilityForApplicableYear:
      input.expectsNoLiabilityForApplicableYear === true,
  };
  if (input.capture) body.capture = input.capture;

  return onboardingWorkerFetch<FederalTaxCertification>(
    `${workerBase(invocationId)}/certification`,
    { method: "POST", body },
  );
}
