/**
 * TEST SUPPORT ONLY - Phase 3 status projections.
 *
 * Every label and every sentence below is COPIED from what the server sends, never computed
 * from the state beside it. That is the point of the fixtures: a fixture that derived
 * "Complete" from `COMPLETE` would let a component pass these tests while wording status for
 * itself, which is the one thing Phase 3 forbids the client to do.
 *
 * No fixture names a real onboarding module. The status layer is proven against modules that
 * do not exist, because it must know nothing about the ones that will.
 */

import type {
  OnboardingCompletionFact,
  OnboardingConsumerStatus,
  OnboardingConsumerWorkState,
  OnboardingModuleStatusFacts,
  OnboardingPublishedCompletion,
  OnboardingRecordedOutcome,
  OnboardingRecordedOutcomeKind,
  OnboardingStatus,
  OnboardingStatusProgress,
  OnboardingStatusState,
} from "@/lib/workforce/onboardingStatusApi";

export const CANDIDATE_ID = "cand_status_fixture";

/** The server's words for each state, as `onboardingStatusLabel` produces them. */
export const SERVER_STATUS_LABELS: Record<OnboardingStatusState, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  BLOCKED: "Waiting on another step",
  WORKER_PHASE_COMPLETE_AWAITING_ADMINISTRATIVE_ACTION:
    "Your part is done - waiting on our team",
  EXCEPTION_OUTSTANDING: "Needs attention",
  COMPLETE: "Complete",
  SUPERSEDED: "Replaced by a newer record",
};

export const ALL_STATUS_STATES = Object.keys(
  SERVER_STATUS_LABELS,
) as OnboardingStatusState[];

/** The server's words for each governed outcome, label and the sentence beneath it. */
export const SERVER_OUTCOMES: Record<
  OnboardingRecordedOutcomeKind,
  { label: string; detail: string }
> = {
  DECLINED: {
    label: "Declined",
    detail:
      "You chose not to take part. That decision is recorded and this step is done.",
  },
  NOT_REQUIRED: {
    label: "Not required",
    detail:
      "Nothing was required of you here. That determination is recorded and this step is done.",
  },
  FEDERALLY_DERIVED: {
    label: "Based on your federal elections",
    detail:
      "Your federal elections already answer this, so no separate answer was needed.",
  },
  NO_CHANGE_CONFIRMED: {
    label: "Confirmed - no change",
    detail: "You confirmed that what we hold is still correct. Nothing was changed.",
  },
};

export const ALL_RECORDED_OUTCOMES = Object.keys(
  SERVER_OUTCOMES,
) as OnboardingRecordedOutcomeKind[];

export const SERVER_WORK_LABELS: Record<OnboardingConsumerWorkState, string> = {
  NONE_ON_FILE: "No onboarding on file",
  OUTSTANDING: "Onboarding outstanding",
  IN_PROGRESS: "Onboarding in progress",
  ALL_MODULES_COMPLETE: "All onboarding steps recorded complete",
};

export function fixtureOutcome(
  outcome: OnboardingRecordedOutcomeKind,
): OnboardingRecordedOutcome {
  return { outcome, ...SERVER_OUTCOMES[outcome] };
}

export function fixtureStatus(
  state: OnboardingStatusState,
  outstanding = state !== "COMPLETE",
): OnboardingStatus {
  return { state, label: SERVER_STATUS_LABELS[state], outstanding };
}

export function fixtureModuleStatus(
  overrides: Partial<OnboardingModuleStatusFacts> = {},
): OnboardingModuleStatusFacts {
  const state = overrides.state ?? "NOT_STARTED";
  return {
    state,
    label: SERVER_STATUS_LABELS[state],
    outstanding: state !== "COMPLETE",
    recordedOutcome: null,
    workerActionable: state !== "COMPLETE",
    awaitingAdministrativeAction:
      state === "WORKER_PHASE_COMPLETE_AWAITING_ADMINISTRATIVE_ACTION",
    ...overrides,
  };
}

/** The only publication state Phase 3 can produce, in the server's own words. */
export const NOT_YET_PUBLISHED: OnboardingPublishedCompletion = {
  state: "NOT_YET_PUBLISHED",
  publishedAt: null,
  packetId: null,
  packetVersion: null,
  label: "Onboarding has not published a completion",
};

/**
 * What Phase 15 will eventually send. Present ONLY so the components can be shown to render
 * whatever the server states rather than assuming an absence. Nothing in Phase 3 produces it.
 */
export const PUBLISHED_COMPLETE: OnboardingPublishedCompletion = {
  state: "PUBLISHED_COMPLETE",
  publishedAt: "2026-03-01T12:00:00.000Z",
  packetId: "pkt_status_fixture",
  packetVersion: 1,
  label: "Onboarding complete",
};

export function fixtureProgress(
  completeCount: number,
  requiredCount: number,
): OnboardingStatusProgress {
  return {
    complete: requiredCount > 0 && completeCount === requiredCount,
    requiredCount,
    completeCount,
    derived: true,
  };
}

export function fixtureConsumerStatus(
  overrides: Partial<OnboardingConsumerStatus> = {},
): OnboardingConsumerStatus {
  const work = overrides.work ?? "IN_PROGRESS";
  return {
    candidateId: CANDIDATE_ID,
    audience: "RECRUITING",
    published: NOT_YET_PUBLISHED,
    work,
    workLabel: SERVER_WORK_LABELS[work],
    generatedAt: "2026-03-01T12:00:00.000Z",
    ...overrides,
  };
}

export function fixtureCompletionFact(
  overrides: Partial<OnboardingCompletionFact> = {},
): OnboardingCompletionFact {
  return {
    moduleKey: "FIXTURE_ALPHA",
    moduleNumber: "F1",
    title: "Fixture Alpha",
    status: fixtureStatus("COMPLETE"),
    recordedOutcome: null,
    completedAt: "2026-03-01T11:00:00.000Z",
    ...overrides,
  };
}
