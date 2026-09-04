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
 *
 * IT CLASSIFIES BOTH ACTS, AND THE ACT CHANGES WHAT IS TRUE RATHER THAN WHAT IS POLITE. A launch
 * can fail AFTER composing a real invocation, so most of its notices must tell the operator that a
 * run stands in the worker's history. A re-entry composes nothing at any point, so the same
 * failures mean the worker's onboarding is exactly as he left it - and reporting a standing run
 * there would contradict the guarantee the capability rests on and send him looking for a packet
 * that was never created. `act` defaults to `LAUNCH`, so every existing caller is unchanged.
 */

import {
  OnboardingAdminApiError,
  StaffSessionMissingError,
} from "@/lib/workforce/onboardingAdminApi";
import { QaWorkerHandoffError } from "@/lib/workforce/qaWorkerHandoff";

/**
 * Which act was refused.
 *
 * THIS EXISTS BECAUSE THE TRUE SENTENCE DIFFERS, not because the wording could be nicer. Almost
 * every notice below tells the operator what happened to the worker's history, and for a LAUNCH the
 * honest answer is often "the run was created and stands" while for a RE_ENTRY it is ALWAYS
 * "nothing was created". Telling a re-entry operator that a run stands would contradict the one
 * guarantee the capability makes, and would send him looking for a packet that does not exist.
 *
 * DEFAULTED TO `LAUNCH`, so every existing caller keeps the exact notices it already produced.
 */
export type QaLauncherAct = "LAUNCH" | "RE_ENTRY";

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

export function classifyQaLauncherError(
  error: unknown,
  act: QaLauncherAct = "LAUNCH",
): QaLauncherNotice {
  const reEntry = act === "RE_ENTRY";

  /**
   * What happened to the worker's onboarding, stated truthfully for the act that was refused.
   *
   * FOR A RE-ENTRY THIS IS ALWAYS THE SAME SENTENCE, because a re-entry composes nothing at any
   * point: there is no step of it after which something would stand.
   */
  const historyNote = reEntry
    ? "No onboarding run and no packet were created, and this worker's existing onboarding is untouched."
    : "The QA run was created and is still in this worker's history - nothing was removed.";
  const retryNote = reEntry
    ? "Re-enter again to get a fresh one."
    : "Launch again to get a fresh one.";

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
    // FOR A LAUNCH, BOTH OF THESE HAPPEN AFTER THE RUN EXISTS, which is the part the operator needs
    // told: the invocation stands, nothing was undone, and the recovery is another launch. FOR A
    // RE-ENTRY there was never a run to stand, so the same two stages mean the worker's onboarding
    // is exactly as he left it.
    if (error.stage === "ENTRY_NOT_ACCEPTED") {
      return {
        title: "The worker entry link was not accepted.",
        detail: `${historyNote} Entry links are single use and short lived, so ${retryNote.toLowerCase()}`,
        code: error.reason,
        retryable: false,
        signInRequired: false,
      };
    }
    return {
      title: "No worker session was established in this browser.",
      detail: `${historyNote} Your staff session is untouched. ${
        reEntry ? "Re-enter" : "Launch"
      } again to try the handoff once more.`,
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
        title: reEntry ? "This QA re-entry was refused." : "This QA launch was refused.",
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
      // THE RE-ENTRY CASE IS THE SERVER'S `REENTRY_LINK_NOT_CREATED` REFUSAL, and it is reported
      // differently from the launch's `WORKER_ENTRY_LINK_NOT_CREATED` for the reason the server
      // separates the two codes: a failed launch can leave a real invocation standing that the
      // operator must know about, and a failed re-entry leaves nothing at all. Telling him a run
      // stands here would send him hunting for a packet that was never composed.
      return {
        title: reEntry
          ? "The QA re-entry could not be completed."
          : "The QA run could not be opened.",
        detail: reEntry
          ? `${
              serverSentence(error) ??
              "The QA worker experience is not available in this environment."
            } ${historyNote} Try re-entering again.`
          : `${
              serverSentence(error) ??
              "The QA worker experience is not available in this environment."
            } Anything already created stays in this worker's history - nothing was removed - and launching again creates a new run.`,
        code: error.code,
        retryable: true,
        signInRequired: false,
      };
    }

    return {
      title: reEntry ? "That QA re-entry was refused." : "That QA launch was refused.",
      detail:
        "Nothing was removed from this worker's history. Correct the request and try again.",
      code: error.code,
      retryable: true,
      signInRequired: false,
    };
  }

  return {
    title: "Something went wrong.",
    detail: `Nothing was removed from this worker's history. Please try the ${
      reEntry ? "re-entry" : "launch"
    } again.`,
    code: null,
    retryable: true,
    signInRequired: false,
  };
}
