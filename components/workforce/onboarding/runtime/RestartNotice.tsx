"use client";

/**
 * Phase 1 - restart rules, surfaced honestly.
 *
 * A worker re-opening something he already finished deserves to know exactly what that
 * does before he does it. The posture and its consequences are SERVER-SUPPLIED; this
 * component only puts them in plain language.
 *
 * The one thing it always says, because the framework always guarantees it: re-entering
 * never erases what was already supplied.
 */

import type { OnboardingRestartInfo } from "@/lib/workforce/onboardingRuntimeApi";

type Props = {
  restart: OnboardingRestartInfo;
  /** What the worker is about to re-enter, for the sentence. */
  subject: string;
};

const CLOSED_REASON_TEXT: Record<string, string> = {
  PACKET_NO_LONGER_OPEN_TO_WORKER:
    "has been submitted and is no longer open for changes here.",
  PACKET_NOT_CURRENTLY_BOUND:
    "is not the one you are working on right now. Finish the current one first.",
  // Finished onboarding is not reopened by the worker. If something has to change, the
  // team that required it asks for it again, and it reappears here as new work.
  PACKET_COMPLETE:
    "is complete. Nothing more is needed from you; if anything has to change, we will ask you for it again.",
  MODULE_HAS_NO_WORKER_PHASE:
    "is completed by our team rather than by you, so there is nothing for you to fill in.",
  MODULE_BLOCKED_BY_DEPENDENCY:
    "is waiting on another section. It will open once that section is finished.",
};

export function RestartNotice({ restart, subject }: Props) {
  if (restart.posture === "RESTARTABLE") return null;

  if (restart.posture === "CLOSED") {
    return (
      <p className="ob-notice" data-restart-posture="CLOSED">
        {subject}{" "}
        {CLOSED_REASON_TEXT[restart.reason] ?? "is not available to change right now."}
      </p>
    );
  }

  // Whether going back through this records a NEW version is the server's statement, not
  // an assumption made here: promising a new version where none is recorded, or staying
  // silent where one is, would both misdescribe what the worker is about to do.
  return (
    <p className="ob-notice" data-restart-posture="RE_ENTERABLE">
      {subject} is already complete. You can go back through it if something has changed.{" "}
      {restart.createsNewVersion
        ? "Doing so records an updated version and "
        : "Going back through it "}
      <strong>does not erase what you supplied before</strong> - the earlier answers stay
      on file as history.
    </p>
  );
}

export default RestartNotice;
