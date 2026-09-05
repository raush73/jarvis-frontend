/**
 * Phase 3 - the onboarding status read client.
 *
 * Mirrors the server's audience projections and nothing else. There is no write function
 * here, in any audience, because there is no status write endpoint to call: publication
 * derives from the executed packet and is never asserted by a caller.
 *
 * Two transports, deliberately, because there are two authentications. The worker read
 * goes through `onboardingWorkerFetch`; the staff and consuming-workflow reads go through
 * `onboardingAdminFetch`. Both are the DELIVERED clients, reused rather than reimplemented,
 * so a session refusal on a status read behaves exactly as it does everywhere else.
 *
 * These types are the wire, not a model. Nothing in this file derives a status, words a
 * status, or decides what an audience may see: the server has already done all three, and a
 * client that repeated any of them could disagree with it.
 */

import { onboardingWorkerFetch } from "./onboardingApi";
import { onboardingAdminFetch } from "./onboardingAdminApi";

// --------------------------------------------------------------------------
// Vocabulary
// --------------------------------------------------------------------------

export type OnboardingStatusState =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "WORKER_PHASE_COMPLETE_AWAITING_ADMINISTRATIVE_ACTION"
  | "EXCEPTION_OUTSTANDING"
  | "COMPLETE"
  | "SUPERSEDED";

export type OnboardingRecordedOutcomeKind =
  | "DECLINED"
  | "NOT_REQUIRED"
  | "FEDERALLY_DERIVED"
  | "NO_CHANGE_CONFIRMED";

/**
 * The published onboarding completion state.
 *
 * `NOT_YET_PUBLISHED` is the ABSENCE of a published determination and is not a negative
 * one. It is an enum rather than a boolean for exactly that reason: a `false` could not
 * have carried the difference between "onboarding has published nothing" and "this worker
 * is not complete".
 */
export type OnboardingPublicationState = "NOT_YET_PUBLISHED" | "PUBLISHED_COMPLETE";

/** Whether onboarding work is outstanding. A separate question from publication. */
export type OnboardingConsumerWorkState =
  | "NONE_ON_FILE"
  | "OUTSTANDING"
  | "IN_PROGRESS"
  | "ALL_MODULES_COMPLETE";

/**
 * The PRE_DISPATCH readiness verdict, mirroring the server's vocabulary exactly.
 *
 * `NO_ONBOARDING_ON_FILE` is deliberately NOT a kind of not-ready-yet: a worker with no
 * packet has no applicable composition to satisfy, which is a different situation from one
 * whose requirements are known and outstanding. The two outstanding verdicts stay separate
 * for the same reason - a worker who still owes work has to be given the work, while a
 * worker whose only gap is an expired record has to be asked to affirm or replace it.
 *
 * `READY` means "onboarding is not holding anything up", never "dispatch him". These are
 * four states and there is no fifth: the server decides the verdict, and a client that
 * invented a state would be a client deciding something it does not answer for.
 */
export type OnboardingPreDispatchReadinessState =
  | "NO_ONBOARDING_ON_FILE"
  | "WORKER_OBLIGATIONS_OUTSTANDING"
  | "VERIFICATION_OUTSTANDING"
  | "READY";

// --------------------------------------------------------------------------
// Shared shapes
// --------------------------------------------------------------------------

/** A status and the words for it. The words come from the server, for every audience. */
export type OnboardingStatus = {
  state: OnboardingStatusState;
  label: string;
  outstanding: boolean;
};

/** A governed outcome that IS a completion, with the text that keeps it from reading blank. */
export type OnboardingRecordedOutcome = {
  outcome: OnboardingRecordedOutcomeKind;
  label: string;
  detail: string;
};

/** One module's status, as the first-party surfaces embed it on their own responses. */
export type OnboardingModuleStatusFacts = {
  state: OnboardingStatusState;
  label: string;
  outstanding: boolean;
  recordedOutcome: OnboardingRecordedOutcome | null;
  workerActionable: boolean;
  awaitingAdministrativeAction: boolean;
};

export type OnboardingPublishedCompletion = {
  state: OnboardingPublicationState;
  publishedAt: string | null;
  packetId: string | null;
  packetVersion: number | null;
  /** Server-supplied wording, so no surface has to decide how to word an absence. */
  label: string;
};

export type OnboardingStatusProgress = {
  complete: boolean;
  requiredCount: number;
  completeCount: number;
  /** Always true: packet completion is derived on every read, never stored as a flag. */
  derived: true;
};

// --------------------------------------------------------------------------
// Worker projection
// --------------------------------------------------------------------------

export type OnboardingWorkerModuleStatus = {
  moduleKey: string;
  moduleNumber: string;
  title: string;
  position: number;
  status: OnboardingStatus;
  recordedOutcome: OnboardingRecordedOutcome | null;
  stepsDeclared: number;
  stepsSatisfied: number;
  workerActionable: boolean;
  awaitingAdministrativeAction: boolean;
};

export type OnboardingWorkerPacketStatus = {
  packetId: string;
  invocationId: string | null;
  packetVersion: number;
  packetState: string;
  progress: OnboardingStatusProgress;
  outstandingModuleKeys: string[];
  active: boolean;
  modules: OnboardingWorkerModuleStatus[];
};

export type OnboardingWorkerStatus = {
  candidateId: string;
  audience: "WORKER";
  packets: OnboardingWorkerPacketStatus[];
  awaitingAdministrativeAction: string[];
  generatedAt: string;
};

// --------------------------------------------------------------------------
// Administrative projection
// --------------------------------------------------------------------------

export type OnboardingAdministrativeModuleStatus = {
  moduleKey: string;
  moduleNumber: string;
  title: string;
  governanceSection: string | null;
  position: number;
  status: OnboardingStatus;
  recordedOutcome: OnboardingRecordedOutcome | null;
  recordStatus: string;
  requirementReason: string;
  requiredQualifier: string | null;
  completionGranularity: string;
  completionId: string | null;
  completedAt: string | null;
  hasWorkerPhase: boolean;
  mw4hPhaseNature: string | null;
  mw4hPhaseGatesCompletion: boolean;
  mw4hPhaseRecorded: boolean;
  mw4hPhaseRecordedAt: string | null;
  producesGeneratedArtifact: boolean;
  /** A pointer into the Phase 2 investigation navigation, not a second history. */
  historyModuleKey: string;
};

export type OnboardingAdministrativePacketStatus = {
  packetId: string;
  invocationId: string | null;
  packetVersion: number;
  packetState: string;
  progress: OnboardingStatusProgress;
  outstandingModuleKeys: string[];
  active: boolean;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  modules: OnboardingAdministrativeModuleStatus[];
};

export type OnboardingAdministrativeStatus = {
  candidateId: string;
  audience: "ADMINISTRATIVE";
  packets: OnboardingAdministrativePacketStatus[];
  published: OnboardingPublishedCompletion;
  generatedAt: string;
};

// --------------------------------------------------------------------------
// Consuming-workflow projections
// --------------------------------------------------------------------------

export type OnboardingConsumerStatus = {
  candidateId: string;
  audience: "RECRUITING" | "VETTING" | "PRE_DISPATCH";
  published: OnboardingPublishedCompletion;
  work: OnboardingConsumerWorkState;
  workLabel: string;
  generatedAt: string;
};

/** A module that DECLARED itself evaluable. Reporting a declaration, not an instruction. */
export type OnboardingEvaluableModule = {
  moduleKey: string;
  moduleNumber: string;
  title: string;
  status: OnboardingStatus;
};

export type OnboardingPreDispatchStatus = OnboardingConsumerStatus & {
  audience: "PRE_DISPATCH";
  modulesDeclaringPreDispatchEvaluation: OnboardingEvaluableModule[];
  /**
   * The authoritative readiness verdict, carried verbatim from the server's readiness
   * authority. Never recomputed here, and never second-guessed from the fields below: a
   * client that derived its own verdict could disagree with the one the server audited.
   */
  readinessState: OnboardingPreDispatchReadinessState;
  /** Whether applicable requirements the WORKER still owes are outstanding. */
  workerObligationsOutstanding: boolean;
  /**
   * Whether an applicable requirement whose governed record already exists is reported by
   * its owning module as expired or missing.
   *
   * A SEPARATE FACT from the one above, because they call for different interactions. It is
   * never overstated by the server: where the verdict cannot distinguish a withheld
   * confidential verification from a withheld confidential obligation, this reports `false`
   * and the field above carries the blockage instead. Nothing here differences the two.
   */
  verificationOutstanding: boolean;
  /**
   * How many outstanding applicable requirements are withheld because the owning module
   * declared its participation confidential.
   *
   * A COUNT AND NOT A NAME, carried through unchanged and unsplit. Naming the module would
   * tell this audience that a module it may not know about exists; omitting the count
   * silently would make `readinessState` a lie.
   */
  withheldConfidentialCount: number;
};

export type OnboardingCompletionFact = {
  moduleKey: string;
  moduleNumber: string;
  title: string;
  status: OnboardingStatus;
  recordedOutcome: OnboardingRecordedOutcome | null;
  completedAt: string | null;
};

export type OnboardingCompletionDetail = {
  candidateId: string;
  audience: string;
  published: OnboardingPublishedCompletion;
  modules: OnboardingCompletionFact[];
  generatedAt: string;
};

// --------------------------------------------------------------------------
// Reads
// --------------------------------------------------------------------------

const WORKER_STATUS = "/workforce/onboarding/status";
const INTERNAL = "/workforce/onboarding/status/internal";

/**
 * The authenticated worker's own status.
 *
 * Takes no argument, because the endpoint takes no parameter. There is nothing a caller
 * could pass to reach another worker's status or to widen its own.
 */
export async function getOnboardingWorkerStatus(): Promise<OnboardingWorkerStatus> {
  return onboardingWorkerFetch<OnboardingWorkerStatus>(WORKER_STATUS);
}

/**
 * The authenticated worker's own completion drill-down.
 *
 * The same projection SHAPE the staff drill-down returns, so one component renders both -
 * and a separate ROUTE, reached with the worker's own session rather than a staff grant.
 * Sharing the presentation is not sharing the authorization: a worker never calls the
 * internal detail endpoint, and this one takes no identifier that could point elsewhere.
 */
export async function getOnboardingWorkerCompletionDetail(): Promise<OnboardingCompletionDetail> {
  return onboardingWorkerFetch<OnboardingCompletionDetail>(`${WORKER_STATUS}/detail`);
}

/** The governed administrative projection for one worker. Audited server-side. */
export async function getOnboardingAdministrativeStatus(
  candidateId: string,
): Promise<OnboardingAdministrativeStatus> {
  return onboardingAdminFetch<OnboardingAdministrativeStatus>(
    `${INTERNAL}/administrative/${encodeURIComponent(candidateId)}`,
  );
}

/**
 * The recruiting projection.
 *
 * A separate function per audience rather than one function taking an audience, mirroring
 * the server: the audience is fixed by what you call, so there is no argument through
 * which a caller could ask for a wider one.
 */
export async function getOnboardingRecruitingStatus(
  candidateId: string,
): Promise<OnboardingConsumerStatus> {
  return onboardingAdminFetch<OnboardingConsumerStatus>(
    `${INTERNAL}/recruiting/${encodeURIComponent(candidateId)}`,
  );
}

/** The vetting projection. The same minimal completion facts as recruiting. */
export async function getOnboardingVettingStatus(
  candidateId: string,
): Promise<OnboardingConsumerStatus> {
  return onboardingAdminFetch<OnboardingConsumerStatus>(
    `${INTERNAL}/vetting/${encodeURIComponent(candidateId)}`,
  );
}

/**
 * The PRE_DISPATCH projection: the minimal facts, the modules that declared themselves
 * evaluable at assignment readiness, and the server's readiness verdict. The caller decides
 * what, if anything, to do with any of it - the projection reports facts and issues no
 * instruction, so `READY` is a fact about onboarding and not a direction to dispatch.
 *
 * The request is unchanged by the readiness fields: same route, same read, same staff
 * credential, and no parameter through which a caller could ask for more.
 */
export async function getOnboardingPreDispatchStatus(
  candidateId: string,
): Promise<OnboardingPreDispatchStatus> {
  return onboardingAdminFetch<OnboardingPreDispatchStatus>(
    `${INTERNAL}/pre-dispatch/${encodeURIComponent(candidateId)}`,
  );
}

/** The authorized drill-down. Behind a grant the indicator does not supply. */
export async function getOnboardingCompletionDetail(
  candidateId: string,
): Promise<OnboardingCompletionDetail> {
  return onboardingAdminFetch<OnboardingCompletionDetail>(
    `${INTERNAL}/detail/${encodeURIComponent(candidateId)}`,
  );
}

/**
 * The reserved published-completion read.
 *
 * Returns `NOT_YET_PUBLISHED` for every worker throughout Phase 3. There is deliberately no
 * companion write: Phase 15 populates this by publishing from the executed packet, and no
 * caller ever asserts it.
 */
export async function getOnboardingPublishedCompletion(
  candidateId: string,
): Promise<OnboardingPublishedCompletion> {
  return onboardingAdminFetch<OnboardingPublishedCompletion>(
    `${INTERNAL}/published/${encodeURIComponent(candidateId)}`,
  );
}
