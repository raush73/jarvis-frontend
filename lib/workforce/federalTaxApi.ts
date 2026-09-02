/**
 * Module 4.2 Federal Tax - browser API client.
 *
 * The client half of the capsule and nothing more. It adds no endpoint, no transport and no session
 * handling of its own: the five governed worker routes go through the delivered
 * `onboardingWorkerFetch` and the one authorized staff read goes through the delivered
 * `onboardingAdminFetch`, exactly as the Phase 4 document, Phase 5 execution and first two module
 * clients do. A second copy of either transport would be a second place for expiry, renewal and
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
 *  - There is no artifact, download or completion call. The retained artifact reaches the worker
 *    through the DELIVERED document client, and completion is DERIVED server-side from this
 *    module's own validator rather than claimed by a browser.
 *  - THERE IS NO ELECTION CONTENT ON THE CERTIFICATION PAYLOAD. No filing status, no amount, no
 *    exemption election, no revision, no origin, no executed-at. What the worker certifies is the
 *    answer set the server already holds, read server-side at the moment he certifies, so a client
 *    cannot certify one election while having shown him another.
 *  - THERE IS NO ELECTION-EDITING CALL, ON EITHER SURFACE. A correction and a subsequent election
 *    each produce a NEW election through the same governed sequence a first one travels; neither
 *    revises a recorded election, and the staff read is a projection with no input shape at all.
 *  - There is no future-year replacement call, no post-hire self-service call, no worker access-link
 *    call and no one-time-code call. All of those remain deferred work with no client here.
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

import { onboardingAdminFetch } from "./onboardingAdminApi";
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
  /**
   * The word for where THIS step stands, supplied by the module rather than chosen here.
   *
   * The three steps are three different acts - confirming a record is his, answering
   * questions, confirming he has read them back - so one word cannot describe all three, and
   * a screen picking between two of its own would be wording a governed interview.
   */
  stateWord: string;
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

/**
 * Why the certification stage is not open to this worker, where it is not.
 *
 * THE LAST TWO ARE OPPOSITES AND BOTH ARE NEEDED. `ELECTION_ALREADY_EXECUTED` blocks a FIRST
 * election and is exactly the condition that opens the governed later one; `NO_OPERATIVE_ELECTION`
 * blocks a LATER election because there is nothing to correct or supersede. A screen handed the
 * wrong one of the two would tell the worker the opposite of what is true.
 */
export const FEDERAL_TAX_CERTIFICATION_BLOCKERS = [
  "INTERVIEW_NOT_COMPLETE",
  "QUESTION_SET_SUPERSEDED",
  "ELECTION_ALREADY_EXECUTED",
  "NO_OPERATIVE_ELECTION",
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
  /**
   * When a later election superseded this one, or null while it is the one in force.
   *
   * HISTORY RATHER THAN STATE. A superseded election governed the worker's withholding while it
   * governed it, and this field is what lets a screen say so instead of quietly dropping it.
   */
  supersededAt: string | null;
  current: boolean;
  /** WHY this election exists, and the governed reason where it corrects an earlier one. */
  electionOrigin: string;
  correctionReason: string | null;
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
 * ONE GOVERNED REASON A WORKER MAY ELECT AGAIN, in the words the server chose for him.
 *
 * THE WORDING IS THE DISTINCTION AND IT IS THE SERVER'S. A worker never has to know what
 * "supersede" means; what he chooses between is "something I told you was wrong" and "my situation
 * has changed". Nothing in this client authors, reorders or reworded either sentence, and `origin`
 * travels back verbatim rather than being re-derived from which control he clicked.
 *
 * `requiresReason` IS THE GOVERNED PAIR RULE, SURFACED - true for the correction alone, so a screen
 * collects a reason exactly where one is admissible and nowhere else.
 */
export type FederalTaxNewElectionOption = {
  origin: string;
  title: string;
  description: string;
  requiresReason: boolean;
};

/**
 * Whether this worker may elect again, and how.
 *
 * ADVISORY IN BOTH DIRECTIONS, exactly like `available` beside it: the governed later-election path
 * re-decides every one of these conditions server-side when the act arrives.
 */
export type FederalTaxNewElection = {
  available: boolean;
  blockers: FederalTaxCertificationBlocker[];
  /** The governed origins, or none where electing again is not open to him. */
  options: FederalTaxNewElectionOption[];
  /**
   * THE SAME AUTHORITATIVE CERTIFICATION, PROJECTED AGAINST THE ACT HE HAS NOT YET PERFORMED.
   *
   * A LATER ELECTION IS A DIFFERENT ACT AGAINST THE SAME GOVERNED WORDING, and the server says so
   * here rather than leaving a screen to work it out: the certification on the stage reports the act
   * that put his CURRENT election in force and reports it satisfied, which it is. This one reports
   * that nothing has been performed toward the new election, which is also true, and it carries the
   * identical governed content - so the three values sent back are the delivered subject's own.
   */
  certification: OnboardingExecutionSubject;
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
  /**
   * Whether he may make a governed LATER election, and which reasons he may state.
   *
   * THE MIRROR IMAGE OF `available`, and the two are never both open: a worker with no election may
   * certify a first one; a worker with one in force may elect again and is refused at the initial
   * route.
   */
  newElection: FederalTaxNewElection;
  /**
   * HIS WHOLE ELECTION HISTORY, newest first, superseded elections INCLUDED.
   *
   * Each entry reports what it actually was - its own revision, its own origin, its own reason where
   * it stated one, and its own artifact - so the copy he opens for a superseded election is the
   * document that election produced rather than a re-rendering of it.
   */
  history: FederalTaxExecutedElection[];
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

/**
 * ONE ACT OF LATER CERTIFICATION: the same act, plus WHY he is electing again.
 *
 * IT EXTENDS THE FIRST-ELECTION PAYLOAD AND ADDS EXACTLY TWO FIELDS, and it still carries no
 * election content of any kind - no filing status, no amount, no exemption, no effective date, no
 * set version and no supersedes reference. What is elected is the answer set the server already
 * holds; what this payload adds is the one fact the server cannot derive, because two elections in
 * a row do not reveal whether the earlier was WRONG or merely EARLIER.
 *
 * `origin` IS COPIED FROM THE OPTION THE WORKER CHOSE and never composed here. `correctionReason`
 * is sent only where that option requires one: the pair rule is the server's, and a reason on an
 * election that corrects nothing is REFUSED rather than quietly dropped.
 */
export type CertifyFederalTaxNewElectionInput =
  CertifyFederalTaxElectionInput & {
    origin: string;
    correctionReason?: string | null;
  };

/* -------------------------------------------------------------------------- */
/*  Refusals                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The governed refusals a WORKER can receive from this surface.
 *
 * A SUBSET OF THE MODULE'S VOCABULARY, DELIBERATELY, and the subset grew again at Gate 8D because
 * the worker can now perform the LATER election those codes classify. The codes still absent are the
 * ones raised only by acts no worker can perform here - an election assembled by something other
 * than his own interview - and a screen with words for them would be describing a path that does not
 * exist.
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
  /** A later election was attempted with no election in force to correct or supersede (8D-R4). */
  "NO_OPERATIVE_ELECTION",
  /** A later election stated an origin outside the governed pair (8D-R4). */
  "VALUE_NOT_GOVERNED",
  /** A correction was submitted without stating what was wrong (8-R7). */
  "CORRECTION_REASON_REQUIRED",
  /** A reason was stated on an election that corrects nothing, and is refused rather than dropped. */
  "CORRECTION_REASON_NOT_PERMITTED",
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
/*  Worker surface - exactly five calls                                        */
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
  return onboardingWorkerFetch<FederalTaxCertification>(
    `${workerBase(invocationId)}/certification`,
    { method: "POST", body: certificationBody(input) },
  );
}

/**
 * CERTIFY A LATER ELECTION: correct an earlier one, or elect differently from now on.
 *
 * A SEPARATE ROUTE RATHER THAN A RELAXATION OF THE ONE ABOVE, and the separation is the governed
 * boundary (8D-R4). The initial route continues to refuse a worker who already has an election with
 * `ELECTION_ALREADY_EXECUTED`; this one continues to refuse a worker who has none with
 * `NO_OPERATIVE_ELECTION`. There is no request this client can compose that reaches the first route
 * with an origin, or this route with a first election.
 *
 * IT APPENDS AND IT NEVER EDITS. The server records a NEW election, a NEW act and a NEW artifact and
 * supersedes what preceded each; the earlier election, act and artifact are retained exactly as they
 * were. Nothing here names a version to change, and there is no field on the payload through which
 * one could be named.
 */
export async function certifyOwnFederalTaxNewElection(
  invocationId: string,
  input: CertifyFederalTaxNewElectionInput,
): Promise<FederalTaxCertification> {
  const body = certificationBody(input);
  body.origin = input.origin;
  // SENT ONLY WHEN STATED. An empty string is the ABSENCE of a reason rather than a reason that says
  // nothing, so it is omitted - which is what lets the server apply the governed pair rule to what
  // the worker actually did instead of to a blank this client invented.
  const stated = input.correctionReason?.trim() ?? "";
  if (stated.length > 0) body.correctionReason = stated;

  return onboardingWorkerFetch<FederalTaxCertification>(
    `${workerBase(invocationId)}/certification/new-election`,
    { method: "POST", body },
  );
}

/** The act, as both certification routes carry it. One shape, so the two cannot drift apart. */
function certificationBody(
  input: CertifyFederalTaxElectionInput,
): Record<string, unknown> {
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
  return body;
}

/* -------------------------------------------------------------------------- */
/*  Authorized staff surface - exactly one read                                */
/* -------------------------------------------------------------------------- */

/**
 * ONE GOVERNED ELECTION, as an authorized reader sees it. Mirrors `federal-tax.staff.view.ts`.
 *
 * READ-ONLY BY CONSTRUCTION AND BY INTENT. There is no input counterpart to this type anywhere in
 * this client: no patch shape, no partial election, no field a staff screen could send back. A
 * withholding election is the employee's, and MW4H may read it, review it and process it
 * administratively - never author, repair, substitute or complete it.
 *
 * AN AMOUNT OF `null` IS NO ELECTION AND IS NOT AN ELECTED ZERO. The distinction survives to the
 * screen rather than being flattened for display, because rendering a blank as "0.00" would report
 * an election the worker never made.
 */
export type FederalTaxStaffElection = {
  setVersion: number;
  /** The revision THIS election was executed under - never today's (8-R1). */
  formKey: string;
  formRevision: string;
  electionOrigin: string;
  correctionReason: string | null;
  filingStatus: string;
  multipleJobsElected: boolean;
  dependentsCreditAmount: string | null;
  otherIncomeAmount: string | null;
  deductionsAmount: string | null;
  additionalWithholdingAmount: string | null;
  exemptionClaimed: boolean;
  executedAt: string;
  effectiveFrom: string;
  supersededAt: string | null;
  current: boolean;
  receipt: { receivedAt: string; basis: string };
  executionRecordId: string | null;
  artifactDocumentId: string | null;
  artifactSlotKey: string;
};

/**
 * Whether the election in force can be processed administratively, and why not where it cannot.
 *
 * THE SAME DERIVATION THE ADMINISTRATIVE ACTION USES, READ FOR DISPLAY. Neither block is an opinion
 * about what the worker elected, and there is nowhere here to record one.
 */
export type FederalTaxStaffProcessing = {
  actionable: boolean;
  blocks: string[];
};

/** The whole authorized read: what governs him now, what governed him before, and readiness. */
export type FederalTaxStaffReview = {
  moduleKey: string;
  candidateId: string;
  current: FederalTaxStaffElection | null;
  /** EVERY election, newest first, superseded ones NOT omitted. History is the point of this field. */
  history: FederalTaxStaffElection[];
  processing: FederalTaxStaffProcessing;
};

/**
 * The authorized staff read of one worker's federal withholding record.
 *
 * SENSITIVE, AND ENFORCED SERVER-SIDE. `workforce.onboarding.federal-tax.read` is a sensitive grant:
 * broad administrative visibility does not imply it, recruiting does not hold it, and the route
 * refuses and audits an unauthorized reader whatever a browser believes about itself. A screen that
 * hides a control is a courtesy; the refusal is the boundary.
 *
 * IT IS A READ AND THERE IS NO WRITE BESIDE IT. Administrative processing is taken through the
 * DELIVERED administrative-action surface, whose outcome is derived from governed state rather than
 * chosen by whoever called a URL, and no part of it lives here.
 */
export async function getStaffFederalTax(
  candidateId: string,
): Promise<FederalTaxStaffReview> {
  return onboardingAdminFetch<FederalTaxStaffReview>(
    `/workforce/onboarding/modules/federal-tax/workers/${encodeURIComponent(
      candidateId,
    )}`,
  );
}
