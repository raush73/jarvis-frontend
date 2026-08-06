"use client";

/**
 * Phase 1 - MINIMAL status visualization, and a deliberate placeholder.
 *
 * Status visualization is owned by Phase 3 and consumed by both runtimes, so no phase
 * renders completion state from its own local inference. Phase 1 and Phase 3 are executed
 * in sequence, so Phase 1 ships the smallest renderer that satisfies the runtime and FIXES
 * THE PROPS Phase 3 will fill. When Phase 3 lands, this file's implementation is replaced;
 * its props are not.
 *
 * Everything rendered here is server-recorded status. Nothing is inferred from position,
 * ordering, or local counting.
 */

import type { OnboardingModuleStatus } from "@/lib/workforce/onboardingApi";
import type { OnboardingPacketState } from "@/lib/workforce/onboardingApi";

/** Props Phase 3 inherits. */
export type OnboardingStatusBadgeProps = {
  status: OnboardingModuleStatus;
  /**
   * A module's plain-language recorded outcome, where it has one - a decline, a
   * not-required determination, or a no-change confirmation. Supplied by the owning module
   * phase so the worker sees a real outcome rather than a blank or skipped step. No module
   * produces one in Phase 1.
   */
  recordedOutcome?: string | null;
};

const MODULE_STATUS_TEXT: Record<OnboardingModuleStatus, string> = {
  PENDING: "Not started",
  BLOCKED: "Waiting on another section",
  COMPLETE: "Complete",
  // A prior record already satisfies this module, so the worker is not asked again.
  ALREADY_COMPLETE: "Already on file",
};

const MODULE_STATUS_TONE: Record<OnboardingModuleStatus, string> = {
  PENDING: "is-pending",
  BLOCKED: "is-blocked",
  COMPLETE: "is-complete",
  ALREADY_COMPLETE: "is-complete",
};

export function OnboardingStatusBadge({
  status,
  recordedOutcome = null,
}: OnboardingStatusBadgeProps) {
  return (
    <span className={`ob-badge ${MODULE_STATUS_TONE[status]}`} data-status={status}>
      {recordedOutcome ?? MODULE_STATUS_TEXT[status]}
    </span>
  );
}

export type OnboardingPacketStatusProps = {
  packetState: OnboardingPacketState;
  /** The server's derived completion for this packet. Never re-derived from the state. */
  complete: boolean;
};

const PACKET_STATE_TEXT: Record<OnboardingPacketState, string> = {
  ASSEMBLING: "Getting ready",
  IN_PROGRESS: "In progress",
  DERIVED_COMPLETE: "Complete",
  EXECUTED: "Submitted",
  ADMINISTRATIVELY_FINALIZED: "Finalised",
};

export function OnboardingPacketStatusBadge({
  packetState,
  complete,
}: OnboardingPacketStatusProps) {
  // `complete` is the server's derived answer, taken as given. Recomputing it from the
  // state here would be a second derivation of completion in the client, which is exactly
  // what the architecture reserves to the framework.
  return (
    <span
      className={`ob-badge ${complete ? "is-complete" : "is-pending"}`}
      data-packet-state={packetState}
    >
      {PACKET_STATE_TEXT[packetState]}
    </span>
  );
}

export default OnboardingStatusBadge;
