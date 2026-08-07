"use client";

/**
 * Packet LIFECYCLE presentation for the worker runtime.
 *
 * This file shipped in Phase 1 as a deliberate placeholder, carrying a minimal module status
 * badge and fixing the props Phase 3 would fill. Phase 3 has landed, and the module badge is
 * gone: module status is now rendered by `status/OnboardingModuleStatus`, from the words the
 * single read authority supplies. Keeping a second module-status vocabulary here - even a
 * correct one - would have been a second place the same record could be described.
 *
 * What remains is the packet's LIFECYCLE state, which is a different fact from derived
 * status: `EXECUTED` and `ADMINISTRATIVELY_FINALIZED` describe where a packet sits in its
 * life, not how much of it the worker has completed. Phase 3 renders the completion side of
 * a packet through `status/OnboardingPacketProgress`.
 */

import type { OnboardingPacketState } from "@/lib/workforce/onboardingApi";

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

export default OnboardingPacketStatusBadge;
