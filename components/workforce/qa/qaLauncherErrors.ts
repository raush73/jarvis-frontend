/**
 * QA-L3 - how the launcher reports a refusal.
 *
 * ONE CLASSIFICATION FOR EVERY WAY A QA LAUNCH CAN BE REFUSED, so each outcome has an explanation
 * in an operator's terms and a next action. The QA launcher does not reuse the onboarding
 * workspace's classifier for one specific reason: QA-L2 answers 403 for THREE different cumulative
 * controls - the environment flag, the sensitive grant, and the target's classification - and a
 * classifier that reads every 403 as "this administrative function is not yours" would send an
 * operator to ask for a grant he already holds while the facility is simply switched off.
 *
 * THE SERVER'S OWN SENTENCE IS SHOWN FOR ITS DELIBERATE REFUSALS - 403, 404 and 503 - because
 * QA-L2 authored those sentences to be read by this operator and they name a facility rather than a
 * variable, a worker record or a value. Everything else gets fixed local wording: an unexpected
 * fault may carry request detail, and a QA screen is not a place to print it.
 *
 * NOTHING CLASSIFIED HERE CAN CONTAIN THE ENTRY TOKEN. The token never reaches an error: the
 * handoff never puts it in one, and `QaWorkerHandoffError` has no field that could hold it.
 */

import {
  OnboardingAdminApiError,
  StaffSessionMissingError,
} from "@/lib/workforce/onboardingAdminApi";
import { QaWorkerHandoffError } from "@/lib/workforce/qaWorkerHandoff";

export type QaLauncherNotice = {
  title: string;
  detail: string;
  /** The framework refusal code, for an operator to quote. Null when the server sent none. */
  code: string | null;
  retryable: boolean;
  signInRequired: boolean;
};

/** The framework's own wording for a guard that simply said no. Never shown to an operator. */
const OPAQUE_MESSAGES = new Set([
  "Forbidden resource",
  "Internal server error",
  "Unauthorized",
]);

/** The server's sentence, when it authored one for this operator. */
function serverSentence(error: OnboardingAdminApiError): string | null {
  const message = error.message?.trim();
  if (!message) return null;
  if (OPAQUE_MESSAGES.has(message)) return null;
  if (/^Request failed with status/.test(message)) return null;
  return message;
}

export function classifyQaLauncherError(error: unknown): QaLauncherNotice {
  if (error instanceof StaffSessionMissingError) {
    return {
      title: "Sign in to continue.",
      detail:
        "The QA worker experience launcher is a staff facility and is available only to signed-in staff.",
      code: null,
      retryable: false,
      signInRequired: true,
    };
  }

  if (error instanceof QaWorkerHandoffError) {
    // BOTH OF THESE HAPPEN AFTER THE RUN EXISTS, which is the part the operator needs told: the
    // invocation stands, nothing was undone, and the recovery is another launch.
    if (error.stage === "ENTRY_NOT_ACCEPTED") {
      return {
        title: "The worker entry link was not accepted.",
        detail:
          "The QA run was created and is still in this worker's history - nothing was removed. Entry links are single use and short lived, so launch again to get a fresh one.",
        code: error.reason,
        retryable: false,
        signInRequired: false,
      };
    }
    return {
      title: "No worker session was established in this browser.",
      detail:
        "The QA run was created and is still in this worker's history - nothing was removed. Your staff session is untouched. Launch again to try the handoff once more.",
      code: null,
      retryable: false,
      signInRequired: false,
    };
  }

  if (error instanceof OnboardingAdminApiError) {
    if (error.status === 401) {
      return {
        title: "Your session has ended.",
        detail: "Sign in again to return to the QA worker experience launcher.",
        code: error.code,
        retryable: false,
        signInRequired: true,
      };
    }

    if (error.status === 403) {
      return {
        title: "This QA launch was refused.",
        detail:
          serverSentence(error) ??
          "The QA worker experience launcher requires an explicit grant, an enabled environment, and a formally test-classified worker. All three are decided by the server, and it refused one of them.",
        code: error.code,
        retryable: false,
        signInRequired: false,
      };
    }

    if (error.status === 404) {
      return {
        title: "That worker does not exist.",
        detail:
          serverSentence(error) ??
          "Nothing was found for the identifier given. Reload the QA persona directory and choose again.",
        code: error.code,
        retryable: true,
        signInRequired: false,
      };
    }

    if (error.status === 503) {
      return {
        title: "The QA run could not be opened.",
        detail: `${
          serverSentence(error) ??
          "The QA worker experience is not available in this environment."
        } Anything already created stays in this worker's history - nothing was removed - and launching again creates a new run.`,
        code: error.code,
        retryable: true,
        signInRequired: false,
      };
    }

    return {
      title: "That QA launch was refused.",
      detail:
        "Nothing was removed from this worker's history. Correct the request and try again.",
      code: error.code,
      retryable: true,
      signInRequired: false,
    };
  }

  return {
    title: "Something went wrong.",
    detail:
      "Nothing was removed from this worker's history. Please try the launch again.",
    code: null,
    retryable: true,
    signInRequired: false,
  };
}
