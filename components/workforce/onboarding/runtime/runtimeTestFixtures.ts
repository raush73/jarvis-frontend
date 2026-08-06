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
    lastActivityAt: null,
    restart: RESTART_OUTSTANDING,
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
    invocationReason: "Fixture onboarding for testing",
    modules,
    completion: {
      complete: completeCount === modules.length,
      requiredCount: modules.length,
      completeCount,
    },
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
