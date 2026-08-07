/**
 * Phase 2 - administrative workspace test fixtures.
 *
 * FIXTURE MODULES ONLY. Every module, queue, action, and permission below is invented for this
 * suite. If a real onboarding module ever appears in this file, the workspace has stopped being
 * module-independent, and these fixtures are the check on that: they exercise the whole workspace
 * without any governed module existing.
 */

import type {
  OnboardingAdminAction,
  OnboardingAdminAudit,
  OnboardingAdminDashboard,
  OnboardingAdminInvestigation,
  OnboardingAdminModule,
  OnboardingAdminModuleHistory,
  OnboardingAdminPacket,
  OnboardingAdminQueue,
  OnboardingAdminQueueDescriptor,
  OnboardingAdminWorker,
  OnboardingAdminWorkerProjection,
} from "@/lib/workforce/onboardingAdminApi";
import type { SessionInfo } from "@/lib/auth/useSession";

export const CANDIDATE_ID = "cand_fixture_1";
export const PACKET_ID = "pkt_fixture_1";
export const QUEUE_KEY = "FIXTURE_ALPHA_REVIEW";
export const ACTION_KEY = "FIXTURE_ALPHA_CERTIFY";
export const FIXTURE_QUEUE_PERMISSION = "fixture.alpha.queue.read";
export const FIXTURE_ACTION_PERMISSION = "fixture.alpha.certify";

/** Every grant the workspace itself knows about. Used where authorization is not the subject. */
export const ONBOARDING_ADMIN_ALL_GRANTS = [
  "workforce.onboarding.admin.access",
  "workforce.onboarding.admin.worker.read",
  "workforce.onboarding.admin.audit.read",
  "workforce.ssn.reveal",
] as const;

export function fixtureWorker(
  overrides: Partial<OnboardingAdminWorker> = {},
): OnboardingAdminWorker {
  return {
    candidateId: CANDIDATE_ID,
    displayName: "Rivers, Dana",
    maskedSsn: "***-**-4321",
    hasSecureIdentity: true,
    city: "Tulsa",
    state: "OK",
    ...overrides,
  };
}

export function fixtureModule(
  overrides: Partial<OnboardingAdminModule> = {},
): OnboardingAdminModule {
  return {
    moduleKey: "FIXTURE_ALPHA",
    moduleNumber: "F1",
    title: "Fixture Alpha",
    governanceSection: "FIXTURE.md Section 1",
    status: "PENDING",
    requirementReason: "ALWAYS_REQUIRED",
    requiredQualifier: null,
    completionGranularity: "SINGLE",
    position: 1,
    completionId: null,
    completedAt: null,
    hasWorkerPhase: true,
    mw4hPhaseNature: null,
    mw4hPhaseGatesCompletion: false,
    mw4hPhaseRecorded: false,
    mw4hPhaseRecordedAt: null,
    outstanding: true,
    producesGeneratedArtifact: false,
    ...overrides,
  };
}

export function fixturePacket(
  overrides: Partial<OnboardingAdminPacket> = {},
): OnboardingAdminPacket {
  const modules = overrides.modules ?? [
    fixtureModule(),
    fixtureModule({
      moduleKey: "FIXTURE_BETA",
      moduleNumber: "F2",
      title: "Fixture Beta",
      governanceSection: "FIXTURE.md Section 2",
      status: "COMPLETE",
      position: 2,
      completionId: "cmp_beta",
      completedAt: "2026-02-02T10:00:00.000Z",
      outstanding: false,
      mw4hPhaseNature: "VERIFICATION",
      mw4hPhaseGatesCompletion: true,
      mw4hPhaseRecorded: false,
    }),
  ];
  const completeCount = modules.filter((module) => !module.outstanding).length;

  return {
    packetId: PACKET_ID,
    candidateId: CANDIDATE_ID,
    packetVersion: 1,
    packetState: "IN_PROGRESS",
    createdAt: "2026-02-01T09:00:00.000Z",
    updatedAt: "2026-02-02T10:00:00.000Z",
    progress: {
      complete: completeCount === modules.length,
      requiredCount: modules.length,
      completeCount,
      derived: true,
    },
    modules,
    outstandingModuleKeys: modules
      .filter((module) => module.outstanding)
      .map((module) => module.moduleKey),
    executed: false,
    administrativelyFinalized: false,
    openToWorker: true,
    invocation: {
      invocationId: "inv_fixture_1",
      kind: "FIXTURE",
      workflowKey: null,
      callerWorkflow: "FIXTURE_WORKFLOW",
      invocationReason: "FIXTURE_REASON",
      createdAt: "2026-02-01T09:00:00.000Z",
    },
    ...overrides,
  };
}

export function fixtureAction(
  overrides: Partial<OnboardingAdminAction> = {},
): OnboardingAdminAction {
  return {
    actionKey: ACTION_KEY,
    title: "Certify fixture alpha",
    moduleKey: "FIXTURE_ALPHA",
    moduleNumber: "F1",
    moduleTitle: "Fixture Alpha",
    requiresReason: false,
    outcomes: ["CERTIFIED", "RETURNED"],
    governanceSection: "FIXTURE.md Section 1",
    ...overrides,
  };
}

export function fixtureQueueDescriptor(
  overrides: Partial<OnboardingAdminQueueDescriptor> = {},
): OnboardingAdminQueueDescriptor {
  return {
    queueKey: QUEUE_KEY,
    title: "Fixture alpha review",
    description: "Fixture work awaiting administrative review.",
    orientation: "MODULE",
    claimable: false,
    moduleKey: "FIXTURE_ALPHA",
    moduleNumber: "F1",
    moduleTitle: "Fixture Alpha",
    governanceSection: "FIXTURE.md Section 1",
    ...overrides,
  };
}

export function fixtureQueue(overrides: Partial<OnboardingAdminQueue> = {}): OnboardingAdminQueue {
  return {
    total: 2,
    page: 1,
    pageSize: 25,
    queue: fixtureQueueDescriptor(),
    availableStatuses: ["AWAITING_REVIEW", "RETURNED"],
    actions: [fixtureAction()],
    items: [
      {
        candidateId: CANDIDATE_ID,
        worker: fixtureWorker(),
        packetId: PACKET_ID,
        moduleKey: "FIXTURE_ALPHA",
        status: "AWAITING_REVIEW",
        waitingSince: "2026-02-01T09:00:00.000Z",
        waitingDays: 6,
        detail: "Fixture detail",
      },
      {
        candidateId: "cand_fixture_2",
        worker: fixtureWorker({
          candidateId: "cand_fixture_2",
          displayName: "Odom, Casey",
          maskedSsn: "***-**-9876",
        }),
        packetId: "pkt_fixture_2",
        moduleKey: "FIXTURE_ALPHA",
        status: "RETURNED",
        waitingSince: "2026-02-04T09:00:00.000Z",
        waitingDays: 3,
        detail: null,
      },
    ],
    ...overrides,
  };
}

export function fixtureDashboard(
  overrides: Partial<OnboardingAdminDashboard> = {},
): OnboardingAdminDashboard {
  return {
    outstandingCount: 2,
    noRegisteredWork: false,
    noAuthorizedWork: false,
    categories: [
      {
        moduleKey: "FIXTURE_ALPHA",
        moduleNumber: "F1",
        moduleTitle: "Fixture Alpha",
        outstandingCount: 2,
        queues: [{ ...fixtureQueueDescriptor(), outstandingCount: 2 }],
      },
    ],
    ...overrides,
  };
}

export function fixtureAudit(overrides: Partial<OnboardingAdminAudit> = {}): OnboardingAdminAudit {
  return {
    total: 2,
    page: 1,
    pageSize: 25,
    availableActions: ["MODULE_DRAFT_SAVED", "MODULE_COMPLETION_RECORDED"],
    events: [
      {
        action: "MODULE_DRAFT_SAVED",
        outcome: "SUCCEEDED",
        actorType: "WORKER",
        actorId: CANDIDATE_ID,
        candidateId: CANDIDATE_ID,
        packetId: PACKET_ID,
        moduleKey: "FIXTURE_ALPHA",
        detail: null,
        occurredAt: "2026-02-01T10:00:00.000Z",
      },
      {
        action: "MODULE_COMPLETION_RECORDED",
        outcome: "SUCCEEDED",
        actorType: "WORKER",
        actorId: CANDIDATE_ID,
        candidateId: CANDIDATE_ID,
        packetId: PACKET_ID,
        moduleKey: "FIXTURE_BETA",
        detail: null,
        occurredAt: "2026-02-02T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

export function fixtureModuleHistory(
  overrides: Partial<OnboardingAdminModuleHistory> = {},
): OnboardingAdminModuleHistory {
  return {
    moduleKey: "FIXTURE_BETA",
    moduleNumber: "F2",
    title: "Fixture Beta",
    governanceSection: "FIXTURE.md Section 2",
    registered: true,
    currentlyEffectiveCount: 1,
    versions: [
      {
        completionId: "cmp_beta_v2",
        qualifier: "DEFAULT",
        packetId: PACKET_ID,
        effectiveFrom: "2026-02-02T10:00:00.000Z",
        supersededAt: null,
        supersedesId: "cmp_beta_v1",
        recordedByType: "WORKER",
        recordedById: CANDIDATE_ID,
        currentlyEffective: true,
      },
      {
        completionId: "cmp_beta_v1",
        qualifier: "DEFAULT",
        packetId: "pkt_fixture_0",
        effectiveFrom: "2025-06-01T10:00:00.000Z",
        supersededAt: "2026-02-02T10:00:00.000Z",
        supersedesId: null,
        recordedByType: "WORKER",
        recordedById: CANDIDATE_ID,
        currentlyEffective: false,
      },
    ],
    ...overrides,
  };
}

export function fixtureProjection(
  overrides: Partial<OnboardingAdminWorkerProjection> = {},
): OnboardingAdminWorkerProjection {
  return {
    worker: fixtureWorker(),
    packets: [fixturePacket()],
    effectiveCompletion: [
      {
        moduleKey: "FIXTURE_BETA",
        moduleNumber: "F2",
        title: "Fixture Beta",
        qualifier: "DEFAULT",
        effectiveFrom: "2026-02-02T10:00:00.000Z",
      },
    ],
    outstandingModuleKeys: ["FIXTURE_ALPHA"],
    actions: [fixtureAction()],
    ...overrides,
  };
}

export function fixtureInvestigation(
  overrides: Partial<OnboardingAdminInvestigation> = {},
): OnboardingAdminInvestigation {
  return {
    worker: fixtureWorker(),
    packets: [fixturePacket()],
    timeline: [fixtureModuleHistory()],
    audit: fixtureAudit(),
    readOnly: true,
    ...overrides,
  };
}

/**
 * A staff session with exactly the grants named and nothing else.
 *
 * `hasPermission` does NOT bypass on a role here, which mirrors the checks that matter: the
 * workspace decides what to render from effective grants, and the server refuses on the same
 * basis for the sensitive path.
 */
export function fixtureSession(
  permissions: readonly string[],
  overrides: Partial<SessionInfo> = {},
): SessionInfo {
  const granted = [...permissions];
  return {
    ready: true,
    authenticated: true,
    userId: "usr_fixture_operator",
    email: "operator@example.test",
    fullName: "Fixture Operator",
    roles: [],
    permissions: granted,
    scopes: {},
    hasRole: () => false,
    hasPermission: (permission: string) => granted.includes(permission),
    getScope: () => "NONE",
    canAccessModule: () => true,
    isAdmin: false,
    isSalesOnly: false,
    ...overrides,
  };
}
