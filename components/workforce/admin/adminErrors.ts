/**
 * Phase 2 - the administrative error contract.
 *
 * ONE classification for every way an administrative request can fail, so each failure has a
 * named kind, an explanation in an operator's terms, and a next action.
 *
 * The kind that matters most is NOT_AUTHORIZED. Administrative authorization is per receiving
 * function, so an operator who can open the workspace can still be refused one queue, one
 * action, or one worker's history - and when that happens the surface must say which grant was
 * missing rather than implying the record is broken or absent. The workspace also never
 * pretends a refusal was a technical fault: an unauthorized operator is told plainly that his
 * grants do not cover this function.
 */

import {
  OnboardingAdminApiError,
  StaffSessionMissingError,
} from "@/lib/workforce/onboardingAdminApi";

export type OnboardingAdminErrorKind =
  /** No staff session, or the server rejected the credential. */
  | "SESSION_REQUIRED"
  /** Authenticated, but this administrative function is not this operator's. */
  | "NOT_AUTHORIZED"
  /** The worker, packet, queue, or action named does not exist. */
  | "NOT_FOUND"
  /** The request itself was inadmissible - a term too short, a reason omitted. */
  | "REFUSED"
  /** Anything else. */
  | "UNEXPECTED";

export type ClassifiedOnboardingAdminError = {
  kind: OnboardingAdminErrorKind;
  title: string;
  detail: string;
  /** The framework refusal code, for an operator to quote to an administrator. */
  code: string | null;
  /** Label for the recovery action, or null when the surface offers its own. */
  actionLabel: string | null;
  retryable: boolean;
};

/** Refusals that mean "you hold no grant for this function". */
const NOT_AUTHORIZED_CODES = new Set(["ADMIN_FUNCTION_NOT_AUTHORIZED"]);

/** Refusals that mean "there is no such record". */
const NOT_FOUND_CODES = new Set([
  "WORKER_NOT_FOUND",
  "PACKET_NOT_FOUND",
  "UNKNOWN_ADMIN_QUEUE",
  "UNKNOWN_ADMIN_ACTION",
  "UNKNOWN_MODULE",
]);

export function classifyOnboardingAdminError(
  error: unknown,
): ClassifiedOnboardingAdminError {
  if (error instanceof StaffSessionMissingError) {
    return {
      kind: "SESSION_REQUIRED",
      title: "Sign in to continue.",
      detail:
        "This workspace holds worker material and is available only to signed-in staff.",
      code: null,
      actionLabel: "Go to sign in",
      retryable: false,
    };
  }

  if (error instanceof OnboardingAdminApiError) {
    if (error.status === 401) {
      return {
        kind: "SESSION_REQUIRED",
        title: "Your session has ended.",
        detail: "Sign in again to return to the administrative workspace.",
        code: error.code,
        actionLabel: "Go to sign in",
        retryable: false,
      };
    }

    if (error.status === 403 || (error.code && NOT_AUTHORIZED_CODES.has(error.code))) {
      const permission =
        typeof error.details?.permission === "string" ? error.details.permission : null;
      return {
        kind: "NOT_AUTHORIZED",
        title: "This administrative function is not yours.",
        detail: permission
          ? `It requires the ${permission} grant. Authorization for one administrative function is not authorization for another, so ask an administrator for this grant specifically.`
          : "Your grants do not cover this administrative function. Authorization for one function is not authorization for another, so ask an administrator for this one specifically.",
        code: error.code,
        actionLabel: null,
        retryable: false,
      };
    }

    if (error.status === 404 || (error.code && NOT_FOUND_CODES.has(error.code))) {
      return {
        kind: "NOT_FOUND",
        title: "That record does not exist.",
        detail:
          error.message ||
          "Nothing was found for the identifier given. Check it and search again.",
        code: error.code,
        actionLabel: null,
        retryable: false,
      };
    }

    return {
      kind: "REFUSED",
      title: error.message || "That request was refused.",
      detail:
        "Nothing was changed. Correct the request and try again; the refusal names exactly what was inadmissible.",
      code: error.code,
      actionLabel: "Try again",
      retryable: true,
    };
  }

  return {
    kind: "UNEXPECTED",
    title: "Something went wrong.",
    detail: "Nothing was changed. Please try again.",
    code: null,
    actionLabel: "Try again",
    retryable: true,
  };
}
