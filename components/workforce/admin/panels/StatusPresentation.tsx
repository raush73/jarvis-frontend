"use client";

/**
 * Phase 2 - administrative status and progress presentation.
 *
 * MINIMAL BY INSTRUCTION. Implementation plan Section 11 states that Phase 3 owns one status
 * read-and-projection layer for both worker-facing and staff-facing surfaces, and that the
 * renderers built here are replaced by it. So these render exactly what the server sent, hold
 * no status vocabulary of their own beyond labelling, and derive nothing - which is what makes
 * them replaceable without touching any surface that uses them.
 *
 * In particular the progress bar takes the server's numerator and denominator and does not
 * compute a completion state from them: packet completion is derived by the Phase 0 completion
 * service and arrives already decided.
 */

import type {
  OnboardingAdminModuleStatus,
  OnboardingAdminPacketState,
  OnboardingAdminProgress,
} from "@/lib/workforce/onboardingAdminApi";

const PACKET_STATE_LABELS: Record<OnboardingAdminPacketState, string> = {
  ASSEMBLING: "Assembling",
  IN_PROGRESS: "In progress",
  READY_FOR_EXECUTION: "Ready for execution",
  EXECUTED: "Executed",
  ADMINISTRATIVELY_FINALIZED: "Administratively finalized",
};

const MODULE_STATUS_LABELS: Record<OnboardingAdminModuleStatus, string> = {
  PENDING: "Outstanding",
  BLOCKED: "Blocked",
  IN_PROGRESS: "In progress",
  COMPLETE: "Complete",
  ALREADY_COMPLETE: "Already complete",
};

export function OnboardingAdminPacketStateBadge({
  state,
}: {
  state: OnboardingAdminPacketState;
}) {
  return (
    <span className={`oba-badge oba-badge-${state.toLowerCase().replace(/_/g, "-")}`}>
      {PACKET_STATE_LABELS[state] ?? state}
    </span>
  );
}

export function OnboardingAdminModuleStatusBadge({
  status,
}: {
  status: OnboardingAdminModuleStatus;
}) {
  return (
    <span className={`oba-badge oba-badge-${status.toLowerCase().replace(/_/g, "-")}`}>
      {MODULE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** A module-declared queue status. Vocabulary belongs to the contributing module. */
export function OnboardingAdminQueueStatusBadge({ status }: { status: string }) {
  return <span className="oba-badge oba-badge-queue">{status.replace(/_/g, " ")}</span>;
}

/** Derived progress, labelled as derived so no operator reads it as an editable decision. */
export function OnboardingAdminProgressBar({
  progress,
}: {
  progress: OnboardingAdminProgress;
}) {
  const percent =
    progress.requiredCount === 0
      ? 0
      : Math.round((progress.completeCount / progress.requiredCount) * 100);

  return (
    <div className="oba-progress">
      <div
        className="oba-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.requiredCount}
        aria-valuenow={progress.completeCount}
        aria-label="Modules complete"
      >
        <div className="oba-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="oba-progress-label">
        {progress.completeCount} of {progress.requiredCount} modules complete
        {progress.complete ? " — packet complete" : ""}
        <span className="oba-progress-derived"> (derived from recorded completion)</span>
      </p>
    </div>
  );
}
