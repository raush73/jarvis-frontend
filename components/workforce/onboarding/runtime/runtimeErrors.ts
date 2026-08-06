/**
 * Phase 1 - the runtime error contract.
 *
 * ONE classification for every way a runtime request can fail, so each failure has a named
 * kind, a plain-language explanation, and a next action. Two rules hold for every kind:
 *
 *  - No error path loses entered data. Classification never clears a draft, and the
 *    surfaces that render these keep the worker's answers on screen.
 *  - No error path leaves the worker without something to do next. Every kind carries an
 *    action, even if that action is only "try again".
 *
 * Messages explain what happened in the worker's terms. They never restate a server
 * refusal code at him, and they never contain a value he supplied.
 */

import {
  OnboardingApiError,
  ONBOARDING_NO_ACTIVE_INVOCATION_CODE,
  ONBOARDING_WORKER_NOT_LINKED_CODE,
} from "@/lib/workforce/onboardingApi";
import {
  WorkerSessionExpiredError,
  WorkforceApiError,
} from "@/lib/workforce/workforceApi";

export type OnboardingErrorKind =
  /** The worker has no onboarding assigned. A normal state, not a failure. */
  | "NOTHING_ASSIGNED"
  /** The secure session timed out. Recoverable in place. */
  | "SESSION_EXPIRED"
  /** The session is no longer one we accept. Requires a fresh entry link. */
  | "SESSION_INVALID"
  /** The worker asked for something that is not his, or not his to do. */
  | "NOT_AUTHORIZED"
  /** The module or step named does not exist in this worker's packet. */
  | "NOT_ROUTABLE"
  /** The module's own validator refused. Field-level, rendered in place. */
  | "VALIDATION_REFUSED"
  /** A save did not reach the server. The answers are still here. */
  | "SAVE_FAILED"
  /** What the runtime is showing is older than what the server now holds. */
  | "STALE"
  /** Anything else. */
  | "UNEXPECTED";

export type ClassifiedOnboardingError = {
  kind: OnboardingErrorKind;
  title: string;
  detail: string;
  /** Field-level codes the module's validator returned, rendered in place. */
  fieldErrors: string[];
  /** Label for the recovery action, or null when the surface offers its own. */
  actionLabel: string | null;
  /** True when retrying the same request is a sensible next step. */
  retryable: boolean;
};

/** Refusal codes that mean "not yours", as opposed to "does not exist". */
const NOT_AUTHORIZED_CODES = new Set([
  "INVOCATION_NOT_OWNED_BY_WORKER",
  "MODULE_HAS_NO_WORKER_PHASE",
]);

/** Refusal codes that mean the runtime asked for something outside this worker's packet. */
const NOT_ROUTABLE_CODES = new Set([
  "MODULE_NOT_IN_PACKET",
  "UNKNOWN_MODULE_STEP",
  "UNKNOWN_MODULE",
  "PACKET_NOT_FOUND",
]);

/** Refusal codes that mean the module cannot be worked on yet. */
const STALE_CODES = new Set(["MODULE_BLOCKED_BY_DEPENDENCY"]);

/**
 * Refusal codes that mean the packet this screen was working in can no longer be changed:
 * it is finished, it has moved on to processing, or the worker's session is now bound to a
 * different one. The worker did nothing wrong and has lost nothing - what he was shown is
 * simply older than what the server now holds.
 */
const NOT_ACTIONABLE_CODES = new Set(["INVOCATION_NOT_BOUND", "PACKET_NOT_ACTIONABLE"]);

export function classifyOnboardingError(
  error: unknown,
  context: { saving?: boolean } = {},
): ClassifiedOnboardingError {
  if (error instanceof WorkerSessionExpiredError) {
    return error.expired
      ? {
          kind: "SESSION_EXPIRED",
          title: "Your secure session timed out.",
          detail:
            "Everything you had already saved is safely on our servers. Sign in again through your onboarding link and you will return to exactly this point.",
          fieldErrors: [],
          actionLabel: "Sign in again",
          retryable: false,
        }
      : {
          kind: "SESSION_INVALID",
          title: "This browser is no longer holding a session we can accept.",
          detail:
            "Everything you had already saved is safely on our servers. Open your onboarding link again to continue where you left off.",
          fieldErrors: [],
          actionLabel: "Sign in again",
          retryable: false,
        };
  }

  if (error instanceof OnboardingApiError) {
    const code = error.code;

    if (
      code === ONBOARDING_NO_ACTIVE_INVOCATION_CODE ||
      code === ONBOARDING_WORKER_NOT_LINKED_CODE
    ) {
      return {
        kind: "NOTHING_ASSIGNED",
        title: "You have no onboarding to complete right now.",
        detail:
          "Nothing has been assigned to you yet. If you were told to expect onboarding, it will appear here once it is ready.",
        fieldErrors: [],
        actionLabel: null,
        retryable: true,
      };
    }

    if (code && NOT_AUTHORIZED_CODES.has(code)) {
      return {
        kind: "NOT_AUTHORIZED",
        title: "This is not available to you.",
        detail:
          "You can only open onboarding that has been assigned to you. Return to your onboarding home to see what is outstanding.",
        fieldErrors: [],
        actionLabel: "Go to my onboarding",
        retryable: false,
      };
    }

    if (code && NOT_ROUTABLE_CODES.has(code)) {
      return {
        kind: "NOT_ROUTABLE",
        title: "We could not find that part of your onboarding.",
        detail:
          "It may have been completed, or it may not be part of what was assigned to you. Your onboarding home shows what is outstanding.",
        fieldErrors: [],
        actionLabel: "Go to my onboarding",
        retryable: false,
      };
    }

    if (code && NOT_ACTIONABLE_CODES.has(code)) {
      return {
        kind: "STALE",
        title: "This part of your onboarding is no longer open for changes.",
        detail:
          "Everything you saved is safe. This section has either been completed or moved on to the next stage, so it can no longer be edited here. Your onboarding home shows anything still outstanding.",
        fieldErrors: [],
        actionLabel: "Go to my onboarding",
        retryable: false,
      };
    }

    if (code && STALE_CODES.has(code)) {
      return {
        kind: "STALE",
        title: "Something else has to be finished first.",
        detail:
          "This part of your onboarding is waiting on another section. We have refreshed what is outstanding.",
        fieldErrors: [],
        actionLabel: "Go to my onboarding",
        retryable: false,
      };
    }

    // A refusal carrying field-level codes is the module's own validator answering. It is
    // a correction the worker can make, not a failure of the runtime.
    return {
      kind: context.saving ? "SAVE_FAILED" : "VALIDATION_REFUSED",
      title: error.message || "Please check your answers.",
      detail: context.saving
        ? "Your answers are still here and nothing has been lost. Try saving again."
        : "Correct the items below and continue.",
      fieldErrors: error.fieldErrors,
      actionLabel: context.saving ? "Try again" : null,
      retryable: true,
    };
  }

  if (error instanceof WorkforceApiError) {
    return {
      kind: context.saving ? "SAVE_FAILED" : "UNEXPECTED",
      title: error.message || "Something went wrong.",
      detail:
        "Your answers are still here and nothing has been lost. Please try again.",
      fieldErrors: error.fieldErrors,
      actionLabel: "Try again",
      retryable: true,
    };
  }

  return {
    kind: context.saving ? "SAVE_FAILED" : "UNEXPECTED",
    title: context.saving
      ? "We could not save your answers."
      : "Something went wrong.",
    detail:
      "Your answers are still here and nothing has been lost. Please try again.",
    fieldErrors: [],
    actionLabel: "Try again",
    retryable: true,
  };
}

/** True when the failure means the worker must re-enter through his onboarding link. */
export function isSessionFailure(kind: OnboardingErrorKind): boolean {
  return kind === "SESSION_EXPIRED" || kind === "SESSION_INVALID";
}
