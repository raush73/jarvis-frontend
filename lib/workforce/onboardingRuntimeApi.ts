/**
 * Workforce Onboarding runtime - browser API client.
 *
 * The Phase 1 counterpart to `onboardingApi.ts`, carrying the runtime projection the
 * worker-facing runtime renders. It adds no transport of its own: the same worker session
 * handling, the same refusal codes, and the same error class are reused, so there is one
 * way a worker request can fail rather than two.
 *
 * The types below mirror the backend's `runtime/onboarding-runtime.view.ts` exactly.
 *
 * Note what the SERVER supplies and this client therefore never computes: the packets, the
 * module set, its order, each module's status, each module's declared steps, which steps
 * are satisfied, where to resume, what re-entry would do, and the progress numerator and
 * denominator. A runtime that derived any of those locally would become a second
 * sequencing authority, which is exactly the defect this runtime exists to avoid.
 */

import {
  onboardingWorkerFetch,
  type OnboardingCompletion,
  type OnboardingModule,
  type OnboardingPacketState,
  type OnboardingInvocationKind,
} from "./onboardingApi";
import type { OnboardingModuleStatusFacts } from "./onboardingStatusApi";

/* -------------------------------------------------------------------------- */
/*  Contract types (mirror of the backend wire contract)                       */
/* -------------------------------------------------------------------------- */

/**
 * What re-entering a packet or module would do.
 *
 * There is deliberately no posture that erases anything: the framework's history is
 * non-destructive, so "restart" never means "discard what you supplied". The runtime says
 * so in plain language rather than leaving the worker to fear the worst.
 */
export type OnboardingRestartPosture = "RESTARTABLE" | "RE_ENTERABLE" | "CLOSED";

export type OnboardingRestartInfo = {
  posture: OnboardingRestartPosture;
  createsNewVersion: boolean;
  destroysCapturedData: false;
  reason: string;
};

/**
 * The ONE action the worker may take on a module now, as the SERVER decided it.
 *
 * A module's status says where it stands; this says what he may do about it. They are
 * different questions and the runtime renders them as different things, because a status
 * pressed as a button tells a worker that "Complete" is something to do.
 *
 * The client neither derives this nor overrides it, and in particular never infers from a
 * module KEY whether a completed module may be edited: whether re-entry is permitted is a
 * governed property of the record and its packet, and the server is the only holder of it.
 */
export type OnboardingWorkerAction =
  | "ENTER"
  | "CONTINUE"
  | "EDIT"
  | "VIEW"
  | "NONE";

/** One declared interview step of a module, with its server-derived satisfaction. */
export type OnboardingRuntimeStep = {
  slug: string;
  title: string;
  satisfied: boolean;
};

/** One module as the runtime renders it. */
export type OnboardingRuntimeModule = OnboardingModule & {
  moduleSlug: string;
  steps: OnboardingRuntimeStep[];
  resumeStepSlug: string | null;
  actionable: boolean;
  /** What the worker may do about this module now. Server-decided; never inferred here. */
  workerAction: OnboardingWorkerAction;
  lastActivityAt: string | null;
  restart: OnboardingRestartInfo;
  /**
   * Phase 3 status, supplied by the server's single read authority.
   *
   * The runtime does not derive this and the client does not word it. It is here so the
   * worker sees the same status, in the same words, that an operator sees for the same
   * record.
   */
  derivedStatus: OnboardingModuleStatusFacts;
};

export type OnboardingResumeTarget = {
  invocationId: string;
  moduleKey: string;
  moduleSlug: string;
  stepSlug: string | null;
};

export type OnboardingRuntimePacket = {
  invocationId: string;
  packetId: string;
  packetVersion: number;
  packetState: OnboardingPacketState;
  kind: OnboardingInvocationKind;
  workflowKey: string | null;
  callerWorkflow: string;
  modules: OnboardingRuntimeModule[];
  completion: OnboardingCompletion;
  /**
   * How many sections this worker still has something to do about.
   *
   * NOT the same number as `requiredCount - completeCount`, and the difference is the whole
   * reason the server sends it. A section can be incomplete because MW4H has not reviewed it
   * yet - real, tracked, and not his work. Subtracting completions counts that against him and
   * tells a worker who has finished everything asked of him that he has tasks left.
   *
   * Server-derived from the same status authority the section rows are derived from, so this
   * count and the words on those rows cannot disagree.
   */
  workerOutstandingCount: number;
  /** How many sections are finished by him and waiting on our team. */
  awaitingAdministrativeActionCount: number;
  nextModuleKey: string | null;
  active: boolean;
  /** The one packet the session is bound to. Only this packet carries actions. */
  bound: boolean;
  lastActivityAt: string | null;
  resume: OnboardingResumeTarget | null;
  restart: OnboardingRestartInfo;
};

export type OnboardingRuntime = {
  candidateId: string;
  packets: OnboardingRuntimePacket[];
  resume: OnboardingResumeTarget | null;
  requiresPacketSelection: boolean;
  generatedAt: string;
};

/**
 * The state of the onboarding session.
 *
 * A successful response proves the session is neither expired nor revoked, because the
 * server refuses both before this handler runs and each carries its own code. `status`
 * answers the remaining question - whether there is still an invocation to return to -
 * which is what lets the runtime tell the worker which of the three things happened.
 */
export type OnboardingRuntimeSession = {
  candidateId: string;
  status: "ACTIVE" | "NO_ACTIVE_INVOCATION";
  boundInvocationId: string | null;
  resume: OnboardingResumeTarget | null;
  checkedAt: string;
};

/* -------------------------------------------------------------------------- */
/*  Runtime surface                                                            */
/* -------------------------------------------------------------------------- */

const BASE = "/workforce/onboarding/runtime";

/** Everything the worker is obliged to do, across every packet bound to him. */
export async function getOnboardingRuntime(): Promise<OnboardingRuntime> {
  return onboardingWorkerFetch<OnboardingRuntime>(BASE);
}

/** Whether the session still has an invocation to return to. */
export async function getOnboardingSession(): Promise<OnboardingRuntimeSession> {
  return onboardingWorkerFetch<OnboardingRuntimeSession>(`${BASE}/session`);
}

/** Where the worker should re-enter, optionally within one named packet. */
export async function getOnboardingResume(
  invocationId?: string,
): Promise<OnboardingResumeTarget | null> {
  const query = invocationId
    ? `?invocationId=${encodeURIComponent(invocationId)}`
    : "";
  return onboardingWorkerFetch<OnboardingResumeTarget | null>(
    `${BASE}/resume${query}`,
  );
}

/** One packet the worker owns, with its module set and statuses. */
export async function getOnboardingPacket(
  invocationId: string,
): Promise<OnboardingRuntimePacket> {
  return onboardingWorkerFetch<OnboardingRuntimePacket>(
    `${BASE}/packets/${encodeURIComponent(invocationId)}`,
  );
}

/** A module's captured input, addressed by the packet the runtime is rendering. */
export async function getRuntimeModuleDraft(
  invocationId: string,
  moduleSlug: string,
): Promise<{
  packetId: string;
  moduleKey: string;
  data: Record<string, unknown>;
  updatedAt: string | null;
}> {
  return onboardingWorkerFetch(
    `${BASE}/packets/${encodeURIComponent(invocationId)}/modules/${encodeURIComponent(
      moduleSlug,
    )}/draft`,
  );
}

/** Save a module's captured input. Stored verbatim; the module owns its meaning. */
export async function saveRuntimeModuleDraft(
  invocationId: string,
  moduleSlug: string,
  data: Record<string, unknown>,
): Promise<{
  packetId: string;
  moduleKey: string;
  data: Record<string, unknown>;
  updatedAt: string | null;
}> {
  return onboardingWorkerFetch(
    `${BASE}/packets/${encodeURIComponent(invocationId)}/modules/${encodeURIComponent(
      moduleSlug,
    )}/draft`,
    { method: "PUT", body: { data } },
  );
}

/* -------------------------------------------------------------------------- */
/*  Route helpers                                                              */
/* -------------------------------------------------------------------------- */

export const ONBOARDING_HOME = "/workforce/onboarding";

/**
 * The URL for a module step.
 *
 * Built from values the SERVER supplied - the invocation, the module slug it published,
 * and a step that module declared. The runtime holds no map of modules to paths, because
 * such a map would be the compile-time module list this runtime may not contain.
 */
export function modulePath(
  invocationId: string,
  moduleSlug: string,
  stepSlug: string | null,
): string {
  const base = `${ONBOARDING_HOME}/${encodeURIComponent(
    invocationId,
  )}/${encodeURIComponent(moduleSlug)}`;
  return stepSlug ? `${base}/${encodeURIComponent(stepSlug)}` : base;
}

/** The URL of a resume target, or the dashboard when there is nothing to resume. */
export function resumePath(target: OnboardingResumeTarget | null): string {
  if (!target) return ONBOARDING_HOME;
  return modulePath(target.invocationId, target.moduleSlug, target.stepSlug);
}

/** The URL of a packet's own overview. */
export function packetPath(invocationId: string): string {
  return `${ONBOARDING_HOME}/${encodeURIComponent(invocationId)}`;
}
