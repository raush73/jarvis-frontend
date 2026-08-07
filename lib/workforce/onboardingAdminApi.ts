/**
 * Workforce Onboarding administrative workspace - browser API client.
 *
 * The STAFF counterpart to `onboardingApi.ts`. The two are deliberately separate clients
 * because they are separate identities: this one carries the staff access token and nothing
 * else, so a worker session can never reach an administrative endpoint and a staff token can
 * never reach a worker one (`STAFF_IDENTITY_BOUNDARY.md`).
 *
 * It adds no second notion of the staff session: the token, the API base, and the 401
 * behaviour all come from the delivered `lib/api` helpers. What it adds is the onboarding
 * refusal contract - every framework refusal carries a stable `code`, and an administrative
 * surface needs that code to say which authorization was missing rather than printing an HTTP
 * status.
 *
 * The types below mirror the backend's `admin/onboarding-admin.view.ts` exactly. Note what
 * the SERVER supplies and this client therefore never computes: masking, derived packet
 * progress, waiting days, which queues and actions this operator may see, and the audit
 * trail. A client that derived any of those would become a second answer to a question the
 * server is answerable for.
 */

import { API_BASE, clearAccessToken, getAccessToken } from "@/lib/api";
import type { OnboardingModuleStatusFacts } from "./onboardingStatusApi";

/* -------------------------------------------------------------------------- */
/*  Contract types (mirror of the backend wire contract)                       */
/* -------------------------------------------------------------------------- */

export type OnboardingAdminPacketState =
  | "ASSEMBLING"
  | "IN_PROGRESS"
  | "READY_FOR_EXECUTION"
  | "EXECUTED"
  | "ADMINISTRATIVELY_FINALIZED";

export type OnboardingAdminModuleStatus =
  | "PENDING"
  | "BLOCKED"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "ALREADY_COMPLETE";

export type OnboardingAdminActorType = "WORKER" | "MW4H" | "SYSTEM";

/**
 * Phase 4. One governed artifact, as the workspace sees it.
 *
 * Mirrors the backend's `OnboardingDocumentResponse`. `generation` is what makes a produced
 * document auditable: which form, at which revision, under which rules, from which
 * authoritative source, bound by hash. It is null for anything a worker uploaded.
 */
export type OnboardingAdminDocument = {
  onboardingDocumentId: string;
  moduleKey: string;
  slotKey: string;
  origin: "UPLOADED" | "GENERATED";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Null until storage proved the object exists. */
  capturedAt: string | null;
  supersededAt: string | null;
  supersedesId: string | null;
  generation: {
    formKey: string;
    formRevision: string;
    ruleRevision: string;
    sourceKind: string;
    sourceRef: string;
    sourceHash: string;
    generatedAt: string | null;
  } | null;
  createdAt: string;
};

export type OnboardingAdminDocumentDownload = {
  onboardingDocumentId: string;
  fileName: string;
  mimeType: string;
  url: string;
  expiresIn: number;
};

/** A worker as every administrative surface shows him: masked. */
export type OnboardingAdminWorker = {
  candidateId: string;
  displayName: string;
  /** e.g. "***-**-1234", or null when no secure identity is on file. */
  maskedSsn: string | null;
  /** Whether a full value EXISTS to be revealed. */
  hasSecureIdentity: boolean;
  city: string | null;
  state: string | null;
};

export type OnboardingAdminWorkerSearchResult = OnboardingAdminWorker & {
  packetCount: number;
  latestPacketState: OnboardingAdminPacketState | null;
  latestPacketId: string | null;
  outstandingModuleCount: number;
};

export type OnboardingAdminPage<T> = {
  total: number;
  page: number;
  pageSize: number;
} & T;

export type OnboardingAdminWorkerSearch = OnboardingAdminPage<{
  results: OnboardingAdminWorkerSearchResult[];
}>;

export type OnboardingAdminModule = {
  moduleKey: string;
  moduleNumber: string;
  title: string;
  governanceSection: string | null;
  status: OnboardingAdminModuleStatus;
  requirementReason: string;
  requiredQualifier: string | null;
  completionGranularity: string;
  position: number;
  completionId: string | null;
  completedAt: string | null;
  hasWorkerPhase: boolean;
  mw4hPhaseNature: string | null;
  mw4hPhaseGatesCompletion: boolean;
  mw4hPhaseRecorded: boolean;
  mw4hPhaseRecordedAt: string | null;
  outstanding: boolean;
  producesGeneratedArtifact: boolean;
  /**
   * Phase 3 status, supplied by the server's single read authority.
   *
   * The workspace does not derive this and does not word it. It is here so an operator and
   * the worker see the same status for the same record.
   */
  derivedStatus: OnboardingModuleStatusFacts;
};

/** Derived packet progress. `requiredCount` is the only legitimate denominator. */
export type OnboardingAdminProgress = {
  complete: boolean;
  requiredCount: number;
  completeCount: number;
  /** Always true: packet completion is derived, never an editable flag. */
  derived: true;
};

export type OnboardingAdminInvocation = {
  invocationId: string;
  kind: string;
  workflowKey: string | null;
  callerWorkflow: string;
  invocationReason: string;
  createdAt: string;
};

export type OnboardingAdminPacket = {
  packetId: string;
  candidateId: string;
  packetVersion: number;
  packetState: OnboardingAdminPacketState;
  createdAt: string;
  updatedAt: string;
  progress: OnboardingAdminProgress;
  modules: OnboardingAdminModule[];
  outstandingModuleKeys: string[];
  executed: boolean;
  administrativelyFinalized: boolean;
  openToWorker: boolean;
  invocation: OnboardingAdminInvocation | null;
};

export type OnboardingAdminPacketSearch = OnboardingAdminPage<{
  results: Array<{
    worker: OnboardingAdminWorker;
    packet: OnboardingAdminPacket;
  }>;
}>;

export type OnboardingAdminQueueDescriptor = {
  queueKey: string;
  title: string;
  description: string;
  orientation: "MODULE" | "PACKET";
  /**
   * Declared by the contributing module. The workspace reports the declaration; it performs
   * no claim, because no claim, assignment, or release exists in this phase.
   */
  claimable: boolean;
  moduleKey: string;
  moduleNumber: string;
  moduleTitle: string;
  governanceSection: string;
};

export type OnboardingAdminQueueItem = {
  candidateId: string;
  worker: OnboardingAdminWorker;
  packetId: string | null;
  moduleKey: string;
  status: string;
  waitingSince: string;
  /** Whole days this work has waited, computed server-side. */
  waitingDays: number;
  detail: string | null;
};

export type OnboardingAdminAction = {
  actionKey: string;
  title: string;
  moduleKey: string;
  moduleNumber: string;
  moduleTitle: string;
  requiresReason: boolean;
  outcomes: string[];
  governanceSection: string;
};

export type OnboardingAdminQueue = OnboardingAdminPage<{
  queue: OnboardingAdminQueueDescriptor;
  items: OnboardingAdminQueueItem[];
  availableStatuses: string[];
  actions: OnboardingAdminAction[];
}>;

export type OnboardingAdminDashboardCategory = {
  moduleKey: string;
  moduleNumber: string;
  moduleTitle: string;
  outstandingCount: number;
  queues: Array<OnboardingAdminQueueDescriptor & { outstandingCount: number }>;
};

/**
 * Where the workers behind this operator's queues stand, per the Phase 3 status authority.
 *
 * Not the same fact as `outstandingCount`, which counts administrative queue items. This
 * counts workers whose ONBOARDING still owes something, which only the status authority
 * answers. The server derives it; nothing here recomputes it.
 */
export type OnboardingAdminDashboardStatusSummary = {
  workersInScope: number;
  workersWithOnboardingOutstanding: number;
  workersWithOnboardingComplete: number;
  /** Always true: onboarding completion is derived, never a stored flag. */
  derived: true;
};

export type OnboardingAdminDashboard = {
  outstandingCount: number;
  categories: OnboardingAdminDashboardCategory[];
  /** No module has contributed administrative work yet. */
  noRegisteredWork: boolean;
  /** Work exists, but none of it belongs to this operator's functions. */
  noAuthorizedWork: boolean;
  onboardingStatus: OnboardingAdminDashboardStatusSummary;
};

export type OnboardingAdminActionResult = {
  actionKey: string;
  moduleKey: string;
  candidateId: string;
  packetId: string;
  outcome: string;
  detail: string | null;
  executedAt: string;
};

export type OnboardingAdminAuditEvent = {
  action: string;
  outcome: string;
  actorType: OnboardingAdminActorType;
  actorId: string | null;
  candidateId: string | null;
  packetId: string | null;
  moduleKey: string | null;
  detail: string | null;
  occurredAt: string;
};

export type OnboardingAdminAudit = OnboardingAdminPage<{
  events: OnboardingAdminAuditEvent[];
  availableActions: string[];
}>;

export type OnboardingAdminCompletionVersion = {
  completionId: string;
  qualifier: string;
  packetId: string;
  effectiveFrom: string;
  /** Null while currently effective. Preserved, never overwritten. */
  supersededAt: string | null;
  supersedesId: string | null;
  recordedByType: OnboardingAdminActorType;
  recordedById: string | null;
  currentlyEffective: boolean;
};

export type OnboardingAdminModuleHistory = {
  moduleKey: string;
  moduleNumber: string;
  title: string;
  governanceSection: string | null;
  registered: boolean;
  versions: OnboardingAdminCompletionVersion[];
  currentlyEffectiveCount: number;
};

export type OnboardingAdminInvestigation = {
  worker: OnboardingAdminWorker;
  packets: OnboardingAdminPacket[];
  timeline: OnboardingAdminModuleHistory[];
  audit: OnboardingAdminAudit;
  /** Always true. Investigation alters nothing. */
  readOnly: true;
};

export type OnboardingAdminWorkerProjection = {
  worker: OnboardingAdminWorker;
  packets: OnboardingAdminPacket[];
  effectiveCompletion: Array<{
    moduleKey: string;
    moduleNumber: string;
    title: string;
    qualifier: string;
    effectiveFrom: string;
  }>;
  outstandingModuleKeys: string[];
  actions: OnboardingAdminAction[];
};

export type OnboardingAdminReveal = {
  candidateId: string;
  /** The full value. Held only for the operator who asked, never cached. */
  value: string;
  revealedAt: string;
};

/* -------------------------------------------------------------------------- */
/*  Transport                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A refused administrative request.
 *
 * Carries the framework's stable refusal code so a surface can say which authorization was
 * missing - "this administrative function requires a grant you do not hold" - rather than
 * printing a status number at an operator.
 */
export class OnboardingAdminApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: Record<string, unknown> | null;

  constructor(input: {
    status: number;
    code?: string | null;
    message: string;
    details?: Record<string, unknown> | null;
  }) {
    super(input.message);
    this.name = "OnboardingAdminApiError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.details = input.details ?? null;
  }
}

/** The staff session is absent. Distinct from a refusal: nothing was attempted. */
export class StaffSessionMissingError extends Error {
  constructor() {
    super("Sign in to open the Workforce Onboarding administrative workspace.");
    this.name = "StaffSessionMissingError";
  }
}

type Envelope<T> = { ok: true; value: T };

const BASE = "/workforce/onboarding/admin";

/**
 * One administrative request.
 *
 * The staff token, the API base, and the 401 behaviour are the delivered ones; only the
 * refusal contract is onboarding's own.
 */
export async function onboardingAdminFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getAccessToken();
  if (!token) throw new StaffSessionMissingError();

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (init.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // An expired or rejected staff credential is a session problem, not a refusal: clearing
    // it is what the delivered client does, so the whole application agrees the user is out.
    if (response.status === 401) clearAccessToken();
    const body = (payload ?? {}) as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    throw new OnboardingAdminApiError({
      status: response.status,
      code: typeof body.code === "string" ? body.code : null,
      message:
        typeof body.message === "string"
          ? body.message
          : `Request failed with status ${response.status}`,
      details:
        body.details && typeof body.details === "object"
          ? (body.details as Record<string, unknown>)
          : null,
    });
  }

  return (payload as Envelope<T>).value;
}

function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

/* -------------------------------------------------------------------------- */
/*  Administrative surface                                                     */
/* -------------------------------------------------------------------------- */

export type OnboardingAdminPageRequest = {
  page?: number;
  pageSize?: number;
};

export type OnboardingAdminQueueRequest = OnboardingAdminPageRequest & {
  status?: string | null;
  moduleKey?: string | null;
  waitingAtLeastDays?: number | null;
  sort?: "WAITING_SINCE" | "WORKER" | "STATUS" | "MODULE" | null;
  direction?: "ASC" | "DESC" | null;
};

export type OnboardingAdminAuditRequest = OnboardingAdminPageRequest & {
  action?: string | null;
  outcome?: string | null;
  moduleKey?: string | null;
};

/** Outstanding administrative work, by category, for this operator's functions only. */
export async function getOnboardingAdminDashboard(): Promise<OnboardingAdminDashboard> {
  return onboardingAdminFetch<OnboardingAdminDashboard>(`${BASE}/dashboard`);
}

/** The registered queues this operator is authorized to open. */
export async function listOnboardingAdminQueues(): Promise<
  OnboardingAdminQueueDescriptor[]
> {
  return onboardingAdminFetch<OnboardingAdminQueueDescriptor[]>(`${BASE}/queues`);
}

/** One page of one registered queue. */
export async function getOnboardingAdminQueue(
  queueKey: string,
  request: OnboardingAdminQueueRequest = {},
): Promise<OnboardingAdminQueue> {
  return onboardingAdminFetch<OnboardingAdminQueue>(
    `${BASE}/queues/${encodeURIComponent(queueKey)}${query({ ...request })}`,
  );
}

/** Worker lookup. Masked summaries only, and never an unbounded listing. */
export async function searchOnboardingAdminWorkers(
  term: string,
  request: OnboardingAdminPageRequest = {},
): Promise<OnboardingAdminWorkerSearch> {
  return onboardingAdminFetch<OnboardingAdminWorkerSearch>(
    `${BASE}/workers${query({ term, ...request })}`,
  );
}

/** Packet lookup: by packet identifier, or by the workers a term matches. */
export async function lookupOnboardingAdminPackets(
  term: string,
  request: OnboardingAdminPageRequest = {},
): Promise<OnboardingAdminPacketSearch> {
  return onboardingAdminFetch<OnboardingAdminPacketSearch>(
    `${BASE}/packets${query({ term, ...request })}`,
  );
}

/** A worker's administrative projection: the canonical worker context surface. */
export async function getOnboardingAdminWorker(
  candidateId: string,
): Promise<OnboardingAdminWorkerProjection> {
  return onboardingAdminFetch<OnboardingAdminWorkerProjection>(
    `${BASE}/workers/${encodeURIComponent(candidateId)}`,
  );
}

/** The read-only investigation reconstruction. */
export async function getOnboardingAdminInvestigation(
  candidateId: string,
  request: OnboardingAdminAuditRequest = {},
): Promise<OnboardingAdminInvestigation> {
  return onboardingAdminFetch<OnboardingAdminInvestigation>(
    `${BASE}/workers/${encodeURIComponent(candidateId)}/investigation${query({
      ...request,
    })}`,
  );
}

/** A worker's audit trail across every packet. */
export async function getOnboardingAdminWorkerAudit(
  candidateId: string,
  request: OnboardingAdminAuditRequest = {},
): Promise<OnboardingAdminAudit> {
  return onboardingAdminFetch<OnboardingAdminAudit>(
    `${BASE}/workers/${encodeURIComponent(candidateId)}/audit${query({ ...request })}`,
  );
}

/** One packet: required module set, per-module status, outstanding items, execution state. */
export async function getOnboardingAdminPacket(
  packetId: string,
): Promise<OnboardingAdminPacket> {
  return onboardingAdminFetch<OnboardingAdminPacket>(
    `${BASE}/packets/${encodeURIComponent(packetId)}`,
  );
}

/** One packet's audit trail, in emission order. */
export async function getOnboardingAdminPacketAudit(
  packetId: string,
  request: OnboardingAdminAuditRequest = {},
): Promise<OnboardingAdminAudit> {
  return onboardingAdminFetch<OnboardingAdminAudit>(
    `${BASE}/packets/${encodeURIComponent(packetId)}/audit${query({ ...request })}`,
  );
}

/** Execute a registered processing action. Audited server-side, always. */
export async function executeOnboardingAdminAction(
  actionKey: string,
  input: { candidateId: string; packetId: string; reason?: string | null },
): Promise<OnboardingAdminActionResult> {
  return onboardingAdminFetch<OnboardingAdminActionResult>(
    `${BASE}/actions/${encodeURIComponent(actionKey)}`,
    {
      method: "POST",
      body: {
        candidateId: input.candidateId,
        packetId: input.packetId,
        reason: input.reason?.trim() ? input.reason.trim() : undefined,
      },
    },
  );
}

/**
 * Reveal a worker's full Social Security Number.
 *
 * The one call in this client that returns an unmasked value. It requires a stated business
 * purpose, is authorized against an explicit grant server-side with no admin bypass, and is
 * audited on both sides of the seam.
 */
export async function revealOnboardingAdminSsn(
  candidateId: string,
  purpose: string,
): Promise<OnboardingAdminReveal> {
  return onboardingAdminFetch<OnboardingAdminReveal>(
    `${BASE}/workers/${encodeURIComponent(candidateId)}/reveal-ssn`,
    { method: "POST", body: { purpose } },
  );
}

/* -------------------------------------------------------------------------- */
/*  Phase 4 - governed document review                                         */
/* -------------------------------------------------------------------------- */

/**
 * A worker's governed onboarding artifacts.
 *
 * A LISTING. It carries no bucket, no storage key, and no retrieval capability: seeing that
 * an artifact exists is a different thing from opening it, and the server treats them as
 * different authorizations too.
 */
export async function getOnboardingAdminWorkerDocuments(
  candidateId: string,
): Promise<OnboardingAdminDocument[]> {
  return onboardingAdminFetch<OnboardingAdminDocument[]>(
    `${BASE}/workers/${encodeURIComponent(candidateId)}/documents`,
  );
}

/**
 * A short-lived, authorized retrieval of one artifact.
 *
 * Fetched at the moment of viewing rather than held on the page, so a URL cannot outlive its
 * expiry in a rendered document. The bytes are served by private storage directly to the
 * browser; they do not pass through Jarvis. Every call is audited server-side against the
 * worker the artifact belongs to.
 */
export async function getOnboardingAdminDocumentDownload(
  onboardingDocumentId: string,
): Promise<OnboardingAdminDocumentDownload> {
  return onboardingAdminFetch<OnboardingAdminDocumentDownload>(
    `${BASE}/documents/${encodeURIComponent(onboardingDocumentId)}/download`,
  );
}

/* -------------------------------------------------------------------------- */
/*  Route helpers                                                              */
/* -------------------------------------------------------------------------- */

export const ONBOARDING_ADMIN_HOME = "/onboarding";

export function onboardingAdminQueuePath(queueKey: string): string {
  return `${ONBOARDING_ADMIN_HOME}/queues/${encodeURIComponent(queueKey)}`;
}

export function onboardingAdminWorkerPath(candidateId: string): string {
  return `${ONBOARDING_ADMIN_HOME}/workers/${encodeURIComponent(candidateId)}`;
}

export function onboardingAdminInvestigationPath(candidateId: string): string {
  return `${onboardingAdminWorkerPath(candidateId)}/investigation`;
}

export function onboardingAdminPacketPath(packetId: string): string {
  return `${ONBOARDING_ADMIN_HOME}/packets/${encodeURIComponent(packetId)}`;
}
