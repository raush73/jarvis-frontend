/**
 * TEST SUPPORT ONLY.
 *
 * Fixture projections and fixture module renderers, mirroring the backend's `testing/`
 * fixtures. Nothing here is imported by application code, and no fixture names, describes,
 * or resembles a real onboarding module: the runtime is proven with modules that do not
 * exist, which is the only way to prove it knows nothing about the ones that will.
 */

import type {
  OnboardingRestartInfo,
  OnboardingRuntime,
  OnboardingRuntimeModule,
  OnboardingRuntimePacket,
  OnboardingRuntimeStep,
} from "@/lib/workforce/onboardingRuntimeApi";
import type { OnboardingModuleStatusFacts } from "@/lib/workforce/onboardingStatusApi";

export const INVOCATION_ID = "inv-fixture-1";
export const PACKET_ID = "pkt-fixture-1";

export const RESTART_OUTSTANDING: OnboardingRestartInfo = {
  posture: "RESTARTABLE",
  createsNewVersion: false,
  destroysCapturedData: false,
  reason: "MODULE_OUTSTANDING",
};

export const RESTART_RE_ENTERABLE: OnboardingRestartInfo = {
  posture: "RE_ENTERABLE",
  createsNewVersion: true,
  destroysCapturedData: false,
  reason: "MODULE_COMPLETE",
};

export const RESTART_CLOSED: OnboardingRestartInfo = {
  posture: "CLOSED",
  createsNewVersion: false,
  destroysCapturedData: false,
  reason: "MODULE_BLOCKED_BY_DEPENDENCY",
};

/** Closed because the packet is not the one the worker's session is bound to. */
export const RESTART_CLOSED_NOT_BOUND: OnboardingRestartInfo = {
  posture: "CLOSED",
  createsNewVersion: false,
  destroysCapturedData: false,
  reason: "PACKET_NOT_CURRENTLY_BOUND",
};

/** Closed because the packet's work is finished. History, not work in progress. */
export const RESTART_CLOSED_COMPLETE: OnboardingRestartInfo = {
  posture: "CLOSED",
  createsNewVersion: false,
  destroysCapturedData: false,
  reason: "PACKET_COMPLETE",
};

export function step(
  slug: string,
  title: string,
  satisfied = false,
): OnboardingRuntimeStep {
  return { slug, title, satisfied };
}

/**
 * The Phase 3 status a module carries when a fixture does not state one.
 *
 * The words are the server's, copied here as a fixture VALUE rather than derived, because a
 * fixture that computed a label would be the very local derivation the phase forbids.
 */
export function fixtureStatus(
  overrides: Partial<OnboardingModuleStatusFacts> = {},
): OnboardingModuleStatusFacts {
  return {
    state: "NOT_STARTED",
    label: "Not started",
    outstanding: true,
    recordedOutcome: null,
    workerActionable: true,
    awaitingAdministrativeAction: false,
    ...overrides,
  };
}

export function fixtureModule(
  overrides: Partial<OnboardingRuntimeModule> & { moduleKey: string },
): OnboardingRuntimeModule {
  const moduleKey = overrides.moduleKey;
  return {
    moduleNumber: "4.900",
    title: `${moduleKey} title`,
    requirementReason: "INITIAL",
    requiredQualifier: null,
    position: 1,
    status: "PENDING",
    hasWorkerPhase: true,
    completionGranularity: "MODULE",
    producesGeneratedArtifact: false,
    dependsOn: [],
    mw4hPhaseRecorded: false,
    moduleSlug: moduleKey.toLowerCase().replace(/_/g, "-"),
    steps: [step("one", "First question")],
    resumeStepSlug: "one",
    actionable: true,
    // The SERVER's answer, stated as a fixture value. A fixture that derived this from the
    // fields around it would be a second copy of the rule the server owns, and the suites
    // below would then prove the copy rather than the contract.
    workerAction: "ENTER",
    lastActivityAt: null,
    restart: RESTART_OUTSTANDING,
    derivedStatus: fixtureStatus(),
    ...overrides,
  };
}

export function fixturePacket(
  overrides: Partial<OnboardingRuntimePacket> = {},
): OnboardingRuntimePacket {
  const modules = overrides.modules ?? [
    fixtureModule({ moduleKey: "FIXTURE_ALPHA", position: 1 }),
  ];
  const completeCount = modules.filter(
    (module) => module.status === "COMPLETE" || module.status === "ALREADY_COMPLETE",
  ).length;
  return {
    invocationId: INVOCATION_ID,
    packetId: PACKET_ID,
    packetVersion: 1,
    packetState: "IN_PROGRESS",
    kind: "NAMED_MODULES",
    workflowKey: null,
    callerWorkflow: "TEST_WORKFLOW",
    modules,
    completion: {
      complete: completeCount === modules.length,
      requiredCount: modules.length,
      completeCount,
    },
    workerOutstandingCount: modules.filter(
      (module) => module.derivedStatus.outstanding && module.derivedStatus.workerActionable,
    ).length,
    awaitingAdministrativeActionCount: modules.filter(
      (module) => module.derivedStatus.awaitingAdministrativeAction,
    ).length,
    nextModuleKey: modules.find((module) => module.actionable)?.moduleKey ?? null,
    active: true,
    bound: true,
    lastActivityAt: null,
    resume: null,
    restart: {
      posture: "RESTARTABLE",
      createsNewVersion: false,
      destroysCapturedData: false,
      reason: "PACKET_OUTSTANDING",
    },
    ...overrides,
  };
}

export function fixtureRuntime(
  overrides: Partial<OnboardingRuntime> = {},
): OnboardingRuntime {
  const packets = overrides.packets ?? [fixturePacket()];
  return {
    candidateId: "candidate-fixture-1",
    packets,
    resume: packets.find((packet) => packet.resume)?.resume ?? null,
    // Mirrors the server's contract exactly: only packets still ACTIVE are something to
    // choose between. A fixture that counted history would test a rule the server dropped.
    requiresPacketSelection: packets.filter((packet) => packet.active).length > 1,
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** A packet with two fixture modules, the second of which has two declared steps. */
export function twoModulePacket(
  overrides: Partial<OnboardingRuntimePacket> = {},
): OnboardingRuntimePacket {
  return fixturePacket({
    modules: [
      fixtureModule({
        moduleKey: "FIXTURE_ALPHA",
        title: "Fixture Alpha",
        position: 1,
        steps: [step("one", "Alpha question one")],
        resumeStepSlug: "one",
      }),
      fixtureModule({
        moduleKey: "FIXTURE_BETA",
        title: "Fixture Beta",
        position: 2,
        steps: [step("first", "Beta question one"), step("second", "Beta question two")],
        resumeStepSlug: "first",
      }),
    ],
    ...overrides,
  });
}
