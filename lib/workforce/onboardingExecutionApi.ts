/**
 * Workforce Onboarding electronic execution - browser API client.
 *
 * The Phase 5 counterpart to `onboardingDocumentApi.ts`. It adds no transport of its own: the
 * same worker session, the same refusal codes, and the same error class are reused, because a
 * second copy of session handling is a second place for expiry and renewal to drift.
 *
 * The types mirror the backend's `execution/onboarding-execution.view.ts` exactly.
 *
 * ONE PROPERTY MATTERS MORE THAN THE REST. `revision`, `contentHash`, and `ruleRevision` arrive
 * on a subject and go back UNCHANGED on submission. They are the proof of what the worker was
 * actually shown, and the backend re-resolves the governed content independently and refuses
 * the act if they no longer match. This file therefore computes nothing: there is no hashing
 * here, no revision arithmetic, and no "freshening" of a stale value, because every one of
 * those would turn a claim about what was displayed into a claim the display never made.
 */

import { onboardingWorkerFetch } from "./onboardingApi";

/* -------------------------------------------------------------------------- */
/*  Contract types (mirror of the backend wire contract)                       */
/* -------------------------------------------------------------------------- */

/**
 * The governed vocabulary of execution acts, ratified by architecture 4.6.9.
 *
 * Four, and only four. The required act is a property of the governed subject: it is never a
 * global setting, never inferred from what the worker did, and never chosen in this client.
 */
export const ONBOARDING_EXECUTION_FORMS = [
  "READ_ACKNOWLEDGEMENT",
  "CHECKBOX_ACKNOWLEDGEMENT",
  "INITIALS",
  "ELECTRONIC_SIGNATURE",
] as const;
export type OnboardingExecutionForm = (typeof ONBOARDING_EXECUTION_FORMS)[number];

/** True when the value is one of the four governed forms. Unknown forms fail closed. */
export function isOnboardingExecutionForm(
  value: unknown,
): value is OnboardingExecutionForm {
  return (ONBOARDING_EXECUTION_FORMS as readonly string[]).includes(value as string);
}

/** The two forms whose evidence is a drawing rather than an attestation. */
export type OnboardingExecutionNativeForm = "INITIALS" | "ELECTRONIC_SIGNATURE";

const NATIVE_CAPTURE_FORMS: readonly string[] = ["INITIALS", "ELECTRONIC_SIGNATURE"];

/**
 * Whether a form is performed by drawing. Derived from the form, never chosen.
 *
 * A type predicate, so the two branches of the surface are checked rather than trusted: a
 * component that renders a drawing pad cannot be handed an acknowledgement form by mistake.
 */
export function requiresNativeCapture(
  form: OnboardingExecutionForm,
): form is OnboardingExecutionNativeForm {
  return NATIVE_CAPTURE_FORMS.includes(form);
}

export type OnboardingExecutionContentKind = "GOVERNED_FORM" | "GOVERNED_TEXT";
export type OnboardingExecutionEvidenceKind = "ATTESTATION" | "NATIVE_CAPTURE";

/** One deterministic presentation line of the governed content. */
export type OnboardingExecutionContentLine = {
  label: string;
  field: string | null;
};

/** The governed content currently in force for a subject. */
export type OnboardingExecutionContent = {
  kind: OnboardingExecutionContentKind;
  ref: string;
  revision: string;
  ruleRevision: string;
  title: string;
  contentHash: string;
  lines: OnboardingExecutionContentLine[];
};

/**
 * A completed act, as the worker's own record of it.
 *
 * `executedContent` is what that record says was executed, never what is governed now: a
 * superseded act keeps reporting its older revision, because that is what happened.
 */
export type OnboardingExecution = {
  executionId: string;
  moduleKey: string;
  subjectKey: string;
  executionForm: OnboardingExecutionForm;
  executedContent: {
    kind: OnboardingExecutionContentKind;
    ref: string;
    revision: string;
    ruleRevision: string;
    contentHash: string;
  };
  evidenceKind: OnboardingExecutionEvidenceKind;
  /**
   * The non-revealing descriptor of a protected capture. Carried by the contract for an
   * auditor; NOT worker-facing, and deliberately not rendered anywhere in this phase.
   */
  evidence: {
    strokeCount: number;
    captureDurationMs: number;
    createdAt: string;
  } | null;
  executedAt: string;
  supersededAt: string | null;
  supersedesId: string | null;
};

/** One subject in the worker's packet, what it requires, and what he has done about it. */
export type OnboardingExecutionSubject = {
  moduleKey: string;
  subjectKey: string;
  title: string;
  /** The act this subject requires. The subject's own, never negotiable by a client. */
  requiredForm: OnboardingExecutionForm;
  content: OnboardingExecutionContent;
  current: OnboardingExecution | null;
  history: OnboardingExecution[];
  /** Advisory display state from the server. It authorizes nothing. */
  requiresExecution: boolean;
};

/** The exact governed content identity the client claims it displayed. */
export type PresentedOnboardingExecutionContent = {
  revision: string;
  contentHash: string;
  ruleRevision: string;
};

/** One point of a drawn mark. Geometry only, in the capture surface's own coordinate space. */
export type OnboardingExecutionCapturePoint = { x: number; y: number };

/** One continuous mark. */
export type OnboardingExecutionCaptureStroke = {
  points: OnboardingExecutionCapturePoint[];
};

/** A native capture, as it crosses the wire. No name, no typed string, no image. */
export type OnboardingExecutionCapture = {
  strokes: OnboardingExecutionCaptureStroke[];
  capturedDurationMs: number;
};

/**
 * One act, as this client submits it.
 *
 * Note what is absent, matching the backend DTO: no candidate, worker, actor, actor type, or
 * packet identifier, and no executed-at. Every one of those is derived from the authenticated
 * session server-side. A field that does not exist here cannot be smuggled through it.
 */
export type SubmitOnboardingExecutionInput = {
  moduleKey: string;
  subjectKey: string;
  performedForm: OnboardingExecutionForm;
  presented: PresentedOnboardingExecutionContent;
  acknowledged?: boolean;
  capture?: OnboardingExecutionCapture | null;
};

/* -------------------------------------------------------------------------- */
/*  Transport ceilings (mirror of the backend DTO)                             */
/* -------------------------------------------------------------------------- */

export const EXECUTION_CAPTURE_MAX_STROKES = 256;
export const EXECUTION_CAPTURE_MAX_POINTS_PER_STROKE = 2_000;
export const EXECUTION_CAPTURE_MAX_TOTAL_POINTS = 4_000;
export const EXECUTION_CAPTURE_MAX_DURATION_MS = 10 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/*  Refusal codes the surface distinguishes                                    */
/* -------------------------------------------------------------------------- */

/** The governed content moved between presentation and submission. */
export const EXECUTION_CONTENT_STALE_CODE = "EXECUTION_CONTENT_STALE";
/** The act in force already satisfies this subject at this revision. */
export const EXECUTION_ALREADY_RECORDED_CODE = "EXECUTION_ALREADY_RECORDED";
/** The drawing was inadmissible, or the act did not match the required form. */
export const EXECUTION_EVIDENCE_INVALID_CODE = "EXECUTION_EVIDENCE_INVALID";
/** The subject is no longer offerable in this packet. */
export const EXECUTION_SUBJECT_GONE_CODES: readonly string[] = [
  "EXECUTION_SUBJECT_NOT_FOUND",
  "EXECUTION_SUBJECT_NOT_IN_PACKET",
  "EXECUTION_CONTENT_UNAVAILABLE",
  "MODULE_NOT_IN_PACKET",
];

/* -------------------------------------------------------------------------- */
/*  Surface                                                                    */
/* -------------------------------------------------------------------------- */

function base(invocationId: string): string {
  return `/workforce/onboarding/runtime/packets/${encodeURIComponent(
    invocationId,
  )}/executions`;
}

/** Every execution subject required in this packet, with what currently satisfies it. */
export async function getOnboardingExecutionSubjects(
  invocationId: string,
): Promise<OnboardingExecutionSubject[]> {
  return onboardingWorkerFetch<OnboardingExecutionSubject[]>(
    `${base(invocationId)}/subjects`,
  );
}

/** This worker's own acts in this packet, superseded ones included. */
export async function getOnboardingExecutions(
  invocationId: string,
): Promise<OnboardingExecution[]> {
  return onboardingWorkerFetch<OnboardingExecution[]>(base(invocationId));
}

/**
 * Perform one act of execution.
 *
 * `presented` is forwarded exactly as the subject response delivered it. `acknowledged` is
 * OMITTED rather than sent as `undefined` for a drawn act, because the backend refuses a
 * native capture that carries an acknowledgement flag at all - in either direction, a
 * checkbox does not stand in for a signature.
 */
export async function submitOnboardingExecution(
  invocationId: string,
  input: SubmitOnboardingExecutionInput,
): Promise<OnboardingExecution> {
  const body: Record<string, unknown> = {
    moduleKey: input.moduleKey,
    subjectKey: input.subjectKey,
    performedForm: input.performedForm,
    presented: {
      revision: input.presented.revision,
      contentHash: input.presented.contentHash,
      ruleRevision: input.presented.ruleRevision,
    },
  };
  if (input.acknowledged !== undefined) body.acknowledged = input.acknowledged;
  if (input.capture) body.capture = input.capture;

  return onboardingWorkerFetch<OnboardingExecution>(base(invocationId), {
    method: "POST",
    body,
  });
}
