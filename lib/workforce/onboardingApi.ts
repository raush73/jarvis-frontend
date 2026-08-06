/**
 * Workforce Onboarding - browser API client.
 *
 * The typed client every later onboarding phase consumes, sitting alongside
 * `workforceApi.ts` and reusing the same worker session handling. Phase 0 delivers the
 * client and its contract types only: there is no shell, no dashboard, no routing, and no
 * module screen here. Phase 1 owns the runtime and builds against these fixed shapes.
 *
 * The types below mirror the backend's `api/onboarding.view.ts` exactly. Note what the
 * server supplies and the client therefore never computes: the module set, its order,
 * each module's status, which module comes next, and the progress denominator. A client
 * that derived any of those from a local list would be inventing a second, competing
 * answer to what onboarding requires.
 */

import { API_BASE } from "@/lib/api";
import {
  clearWorkerAuth,
  getWorkerToken,
  renewWorkerSessionToken,
} from "./workerSession";
import {
  WORKER_SESSION_EXPIRED_CODE,
  WORKER_SESSION_INVALID_CODE,
  WorkerSessionExpiredError,
  WorkforceApiError,
} from "./workforceApi";

/* -------------------------------------------------------------------------- */
/*  Contract types (mirror of the backend wire contract)                       */
/* -------------------------------------------------------------------------- */

export type OnboardingPacketState =
  | "ASSEMBLING"
  | "IN_PROGRESS"
  | "DERIVED_COMPLETE"
  | "EXECUTED"
  | "ADMINISTRATIVELY_FINALIZED";

export type OnboardingInvocationKind =
  | "COMPLETE_PACKET"
  | "NAMED_MODULES"
  | "NAMED_WORKFLOW";

export type OnboardingRequirementReason =
  | "INITIAL"
  | "VERIFICATION"
  | "RENEWAL"
  | "UPDATE";

/**
 * `ALREADY_COMPLETE` means a prior completion record satisfies the module, so it must be
 * shown as done rather than presented again. `BLOCKED` means a governed dependency is not
 * yet satisfied; it is not an error state.
 */
export type OnboardingModuleStatus =
  | "PENDING"
  | "BLOCKED"
  | "COMPLETE"
  | "ALREADY_COMPLETE";

export type OnboardingCompletionGranularity =
  | "MODULE"
  | "JURISDICTION_AND_VERSION"
  | "DOCUMENT_AND_VERSION"
  | "CAMPAIGN_AND_VERSION"
  | "EFFECTIVE_RECORD";

export type OnboardingModule = {
  moduleKey: string;
  moduleNumber: string;
  title: string;
  requirementReason: OnboardingRequirementReason;
  requiredQualifier: string | null;
  position: number;
  status: OnboardingModuleStatus;
  hasWorkerPhase: boolean;
  completionGranularity: OnboardingCompletionGranularity;
  producesGeneratedArtifact: boolean;
  dependsOn: string[];
  mw4hPhaseRecorded: boolean;
};

/** Server-derived progress. `requiredCount` is the only legitimate denominator. */
export type OnboardingCompletion = {
  complete: boolean;
  requiredCount: number;
  completeCount: number;
};

export type OnboardingInvocation = {
  invocationId: string;
  packetId: string;
  packetVersion: number;
  packetState: OnboardingPacketState;
  candidateId: string;
  kind: OnboardingInvocationKind;
  workflowKey: string | null;
  callerWorkflow: string;
  invocationReason: string;
  replayed: boolean;
  modules: OnboardingModule[];
  /** Resolved server-side from the required set and its dependencies, not from an index. */
  nextModuleKey: string | null;
  completion: OnboardingCompletion;
};

export type OnboardingModuleDraft = {
  packetId: string;
  moduleKey: string;
  /** The module's own captured input. Opaque to the framework and to this client. */
  data: Record<string, unknown>;
  updatedAt: string | null;
};

export type OnboardingModuleCompletionResult = {
  moduleKey: string;
  completionId: string;
  effectiveFrom: string;
  /** False when a no-change confirmation left the existing record in place. */
  versionCreated: boolean;
  alreadyComplete: boolean;
  completion: OnboardingCompletion;
  nextModuleKey: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Transport                                                                  */
/* -------------------------------------------------------------------------- */

const RENEWED_TOKEN_HEADER = "X-Worker-Session-Token";
const RENEWED_EXPIRES_HEADER = "X-Worker-Session-Expires-At";

type Envelope<T> = { ok: true; value: T };

/** Stable, non-sensitive refusal codes the onboarding framework returns. */
export const ONBOARDING_NO_ACTIVE_INVOCATION_CODE = "NO_ACTIVE_INVOCATION";
export const ONBOARDING_WORKER_NOT_LINKED_CODE = "WORKER_NOT_LINKED_TO_CANDIDATE";

/**
 * A refusal from the onboarding framework, carrying the code that names exactly what was
 * refused. The runtime needs the distinction: "you have no onboarding right now" is a
 * normal state to render, while an invalid completion is a correction the worker must make.
 */
export class OnboardingApiError extends WorkforceApiError {
  readonly code: string | null;

  constructor(
    message: string,
    status: number,
    code: string | null,
    fieldErrors: string[] = [],
  ) {
    super(message, status, fieldErrors);
    this.name = "OnboardingApiError";
    this.code = code;
  }

  /** True when the worker simply has no onboarding work assigned to them. */
  get noActiveInvocation(): boolean {
    return (
      this.code === ONBOARDING_NO_ACTIVE_INVOCATION_CODE ||
      this.code === ONBOARDING_WORKER_NOT_LINKED_CODE
    );
  }
}

function extractCode(body: unknown): string | null {
  if (body && typeof body === "object") {
    const code = (body as Record<string, unknown>).code;
    if (typeof code === "string" && code) return code;
  }
  return null;
}

function isWorkerSessionCode(code: string | null): boolean {
  return code === WORKER_SESSION_EXPIRED_CODE || code === WORKER_SESSION_INVALID_CODE;
}

function absorbRenewedSession(res: Response): void {
  const token = res.headers.get(RENEWED_TOKEN_HEADER);
  const expiresAt = res.headers.get(RENEWED_EXPIRES_HEADER);
  if (token && expiresAt) renewWorkerSessionToken(token, expiresAt);
}

function extractMessage(body: unknown): { message: string; fieldErrors: string[] } {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const raw = record.message;
    if (Array.isArray(raw)) {
      const list = raw.filter((m): m is string => typeof m === "string");
      if (list.length === 1) return { message: list[0], fieldErrors: [] };
      if (list.length > 1) {
        return { message: "Please correct the following.", fieldErrors: list };
      }
      return { message: "Request failed", fieldErrors: [] };
    }
    if (typeof raw === "string") return { message: raw, fieldErrors: [] };
    // A framework refusal carries its validation codes under `details.errors`.
    const details = record.details;
    if (details && typeof details === "object") {
      const errors = (details as Record<string, unknown>).errors;
      if (Array.isArray(errors)) {
        const list = errors.filter((m): m is string => typeof m === "string");
        if (list.length > 0) {
          return { message: "Please correct the following.", fieldErrors: list };
        }
      }
    }
  }
  return { message: "Request failed", fieldErrors: [] };
}

async function workerFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { method = "GET", body } = init;
  const token = getWorkerToken();
  if (!token) throw new WorkerSessionExpiredError();

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  absorbRenewedSession(res);

  const payload = await res.json().catch(() => null);
  const code = extractCode(payload);

  if (res.status === 401 || res.status === 403) {
    // A refusal that is not about the session is an authorization answer, not a broken
    // credential: the token stays valid and the refusal surfaces with its own code.
    if (res.status === 403 && !isWorkerSessionCode(code)) {
      const { message, fieldErrors } = extractMessage(payload);
      throw new OnboardingApiError(message, res.status, code, fieldErrors);
    }
    clearWorkerAuth();
    throw new WorkerSessionExpiredError(code ?? WORKER_SESSION_EXPIRED_CODE);
  }

  if (!res.ok) {
    const { message, fieldErrors } = extractMessage(payload);
    throw new OnboardingApiError(message, res.status, code, fieldErrors);
  }

  return (payload as Envelope<T>).value;
}

/* -------------------------------------------------------------------------- */
/*  Worker onboarding surface                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The worker's current onboarding invocation: the modules required of them, in resolved
 * order, with each module's status and the server's own progress denominator.
 *
 * There is deliberately no client-side way to start onboarding. Requiring onboarding is a
 * decision that belongs to the calling business workflow, which uses the permission-gated
 * internal surface.
 */
export async function getCurrentOnboarding(): Promise<OnboardingInvocation> {
  return workerFetch<OnboardingInvocation>("/workforce/onboarding");
}

/** Read a module's captured input within the worker's own packet. */
export async function getOnboardingModuleDraft(
  moduleKey: string,
): Promise<OnboardingModuleDraft> {
  return workerFetch<OnboardingModuleDraft>(
    `/workforce/onboarding/modules/${encodeURIComponent(moduleKey)}/draft`,
  );
}

/** Save a module's captured input. Stored verbatim; the module owns its meaning. */
export async function saveOnboardingModuleDraft(
  moduleKey: string,
  data: Record<string, unknown>,
): Promise<OnboardingModuleDraft> {
  return workerFetch<OnboardingModuleDraft>(
    `/workforce/onboarding/modules/${encodeURIComponent(moduleKey)}/draft`,
    { method: "PUT", body: { data } },
  );
}

/**
 * Mark a module complete. The module's own server-side validator decides; a refusal
 * arrives as an `OnboardingApiError` carrying that module's validation codes.
 *
 * `confirmNoChange` records that a re-presented record needed no change. It updates
 * nothing: the existing record stays effective and the confirmation is audited.
 */
export async function completeOnboardingModule(
  moduleKey: string,
  options: { confirmNoChange?: boolean } = {},
): Promise<OnboardingModuleCompletionResult> {
  return workerFetch<OnboardingModuleCompletionResult>(
    `/workforce/onboarding/modules/${encodeURIComponent(moduleKey)}/complete`,
    { method: "POST", body: { confirmNoChange: options.confirmNoChange ?? false } },
  );
}
