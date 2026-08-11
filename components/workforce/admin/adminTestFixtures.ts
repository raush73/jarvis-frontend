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
  OnboardingAdminDocument,
  OnboardingAdminExecution,
  OnboardingAdminInvestigation,
  OnboardingAdminModule,
  OnboardingAdminModuleHistory,
  OnboardingAdminPacket,
  OnboardingAdminQueue,
  OnboardingAdminQueueDescriptor,
  OnboardingAdminWorker,
  OnboardingAdminWorkerProjection,
} from "@/lib/workforce/onboardingAdminApi";
import type {
  OnboardingAdministrativeStatus,
  OnboardingModuleStatusFacts,
} from "@/lib/workforce/onboardingStatusApi";
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
  "workforce.onboarding.document.read",
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
    derivedStatus: fixtureStatus(),
    ...overrides,
  };
}

/**
 * The Phase 3 status a module carries when a fixture does not state one.
 *
 * A fixture VALUE, not a derivation: the words are the server's, so a fixture that computed
 * a label from a state would be exactly the local derivation this phase forbids.
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
      derivedStatus: fixtureStatus({
        state: "COMPLETE",
        label: "Complete",
        outstanding: false,
        workerActionable: false,
      }),
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

/**
 * The Phase 3 administrative projection, as the status authority would return it for the
 * fixture packet.
 *
 * Built from `fixturePacket` so the two agree by construction rather than by coincidence:
 * the panel and the packet workspace are looking at the same worker, and a fixture in which
 * they disagreed would hide the very inconsistency the phase exists to prevent.
 */
export function fixtureAdministrativeStatus(
  overrides: Partial<OnboardingAdministrativeStatus> = {},
): OnboardingAdministrativeStatus {
  const packet = fixturePacket();

  return {
    candidateId: CANDIDATE_ID,
    audience: "ADMINISTRATIVE",
    published: {
      state: "NOT_YET_PUBLISHED",
      publishedAt: null,
      packetId: null,
      packetVersion: null,
      label: "Onboarding has not published a completion",
    },
    packets: [
      {
        packetId: packet.packetId,
        invocationId: packet.invocation?.invocationId ?? null,
        packetVersion: packet.packetVersion,
        packetState: packet.packetState,
        progress: packet.progress,
        outstandingModuleKeys: packet.outstandingModuleKeys,
        active: true,
        closed: false,
        createdAt: packet.createdAt,
        updatedAt: packet.updatedAt,
        modules: packet.modules.map((module) => ({
          moduleKey: module.moduleKey,
          moduleNumber: module.moduleNumber,
          title: module.title,
          governanceSection: module.governanceSection,
          position: module.position,
          status: {
            state: module.derivedStatus.state,
            label: module.derivedStatus.label,
            outstanding: module.derivedStatus.outstanding,
          },
          recordedOutcome: module.derivedStatus.recordedOutcome,
          recordStatus: module.status,
          requirementReason: module.requirementReason,
          requiredQualifier: module.requiredQualifier,
          completionGranularity: module.completionGranularity,
          completionId: module.completionId,
          completedAt: module.completedAt,
          hasWorkerPhase: module.hasWorkerPhase,
          mw4hPhaseNature: module.mw4hPhaseNature,
          mw4hPhaseGatesCompletion: module.mw4hPhaseGatesCompletion,
          mw4hPhaseRecorded: module.mw4hPhaseRecorded,
          mw4hPhaseRecordedAt: module.mw4hPhaseRecordedAt,
          producesGeneratedArtifact: module.producesGeneratedArtifact,
          historyModuleKey: module.moduleKey,
        })),
      },
    ],
    generatedAt: "2026-02-02T10:05:00.000Z",
    ...overrides,
  };
}

/**
 * Phase 4. A governed artifact on a FIXTURE slot of a FIXTURE module.
 *
 * Uploaded by default; pass a `generation` for a produced one. No real document type appears
 * here, for the same reason no real module does: the panel must work without one existing.
 */
export function fixtureDocument(
  overrides: Partial<OnboardingAdminDocument> = {},
): OnboardingAdminDocument {
  return {
    onboardingDocumentId: "obdoc_fixture_1",
    moduleKey: "FIXTURE_ALPHA",
    slotKey: "FIXTURE_EVIDENCE",
    origin: "UPLOADED",
    fileName: "fixture-evidence.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    capturedAt: "2026-02-02T10:00:00.000Z",
    supersededAt: null,
    supersedesId: null,
    generation: null,
    createdAt: "2026-02-02T09:59:00.000Z",
    ...overrides,
  };
}

export function fixtureGeneratedDocument(
  overrides: Partial<OnboardingAdminDocument> = {},
): OnboardingAdminDocument {
  return fixtureDocument({
    onboardingDocumentId: "obdoc_fixture_generated",
    slotKey: "FIXTURE_GENERATED",
    origin: "GENERATED",
    fileName: "fixture-acknowledgement.pdf",
    generation: {
      formKey: "FIXTURE_ACKNOWLEDGEMENT",
      formRevision: "2026.1",
      ruleRevision: "R2026.1",
      sourceKind: "FIXTURE_MODULE_COMPLETION",
      sourceRef: "cmp_beta",
      sourceHash: "9f2c4a1b7e30d5ac6b8f",
      generatedAt: "2026-02-02T10:01:00.000Z",
    },
    ...overrides,
  });
}

/**
 * Phase 5. One act of execution against a FIXTURE subject of a FIXTURE module.
 *
 * An attestation by default, retaining nothing: the simplest act there is, so a test that
 * wants a drawing or an artifact asks for one explicitly. No governed subject appears here,
 * for the same reason no real module does - the panel must work before one exists.
 */
export function fixtureExecution(
  overrides: Partial<OnboardingAdminExecution> = {},
): OnboardingAdminExecution {
  return {
    executionId: "exe_fixture_1",
    moduleKey: "FIXTURE_ALPHA",
    subjectKey: "FIXTURE_NOTICE",
    subjectTitle: "Fixture Reading Attestation",
    executionForm: "READ_ACKNOWLEDGEMENT",
    executedAt: "2026-02-02T10:00:00.000Z",
    candidateId: CANDIDATE_ID,
    packetId: PACKET_ID,
    invocationId: "inv_fixture_1",
    executedContent: {
      kind: "GOVERNED_TEXT",
      ref: "FIXTURE_NOTICE",
      revision: "2026.1",
      ruleRevision: "2026.1",
      contentHash: "aaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999",
    },
    evidenceKind: "ATTESTATION",
    evidenceHash: null,
    evidence: null,
    onboardingDocumentId: null,
    artifactRetained: false,
    supersedesId: null,
    supersededAt: null,
    current: true,
    actorType: "WORKER",
    actorId: CANDIDATE_ID,
    createdAt: "2026-02-02T10:00:00.000Z",
    ...overrides,
  };
}

/** A natively captured act over a governed form that DID retain an executed artifact. */
export function fixtureSignedExecution(
  overrides: Partial<OnboardingAdminExecution> = {},
): OnboardingAdminExecution {
  return fixtureExecution({
    executionId: "exe_fixture_signed",
    subjectKey: "FIXTURE_SIGNED_FORM",
    subjectTitle: "Fixture Signed Form",
    executionForm: "ELECTRONIC_SIGNATURE",
    executedContent: {
      kind: "GOVERNED_FORM",
      ref: "FIXTURE_ACKNOWLEDGEMENT",
      revision: "2026.1",
      ruleRevision: "R2026.1",
      contentHash: "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
    },
    evidenceKind: "NATIVE_CAPTURE",
    evidenceHash: "ffffeeeeddddccccbbbbaaaa00009999888877776666555544443333222211110",
    evidence: {
      strokeCount: 2,
      captureDurationMs: 1234,
      createdAt: "2026-02-02T10:00:00.000Z",
    },
    onboardingDocumentId: "obdoc_fixture_generated",
    artifactRetained: true,
    ...overrides,
  });
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
    // Phase 3. The server's status-authority summary, supplied like any other server field:
    // a fixture that omitted it would let a component invent one.
    onboardingStatus: {
      workersInScope: 2,
      workersWithOnboardingOutstanding: 1,
      workersWithOnboardingComplete: 1,
      derived: true,
    },
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
