"use client";

/**
 * Administrative packet LIFECYCLE and queue-status presentation.
 *
 * Phase 2 shipped this file minimal by instruction, noting that Phase 3 owns one status
 * layer for both worker-facing and staff-facing surfaces and that these renderers would be
 * replaced by it. Phase 3 has landed and that replacement has happened: module status and
 * derived progress are now rendered by the Phase 3 components in
 * `components/workforce/onboarding/status`, from the words the single read authority
 * supplies. Keeping a second module-status vocabulary here would have let the workspace
 * describe a record differently from the way the worker's own runtime describes it.
 *
 * What remains is what Phase 3 does not own: the packet's LIFECYCLE state, which is where a
 * packet sits in its life rather than how much of it is complete, and a queue status, whose
 * vocabulary belongs to the contributing module and not to onboarding.
 */

import type {
  OnboardingAdminPacketState,
  OnboardingAdminProgress,
} from "@/lib/workforce/onboardingAdminApi";
import OnboardingPacketProgress from "@/components/workforce/onboarding/status/OnboardingPacketProgress";

const PACKET_STATE_LABELS: Record<OnboardingAdminPacketState, string> = {
  ASSEMBLING: "Assembling",
  IN_PROGRESS: "In progress",
  READY_FOR_EXECUTION: "Ready for execution",
  EXECUTED: "Executed",
  ADMINISTRATIVELY_FINALIZED: "Administratively finalized",
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

/**
 * A module-declared queue status. Vocabulary belongs to the contributing module.
 *
 * Deliberately NOT the Phase 3 onboarding status chip, and deliberately not typed to the
 * Phase 3 vocabulary. These are two governed facts, not two renderings of one: this column
 * says where a module's own administrative workflow has got to - "awaiting verification",
 * "returned" - which the contributing module declares under Section 10 and owns. Onboarding
 * completion is derived from completion records and owned by the status authority.
 *
 * Substituting a completion chip here would put "Complete" in a column that means "awaiting
 * verification" and would misstate both facts at once. Where a queue genuinely means to show
 * onboarding completion, it renders the Phase 3 components against the Phase 3 projection,
 * which is a different column with a different heading.
 */
export function OnboardingAdminQueueStatusBadge({ status }: { status: string }) {
  return <span className="oba-badge oba-badge-queue">{status.replace(/_/g, " ")}</span>;
}

/**
 * Derived packet progress, rendered by the Phase 3 component.
 *
 * Kept under its Phase 2 name so the four workspace surfaces that call it did not have to
 * be edited to consume Phase 3 - the point of a status layer is that surfaces stop caring
 * where status comes from. What matters is that there is now ONE implementation: the
 * workspace and the worker runtime draw the same bar, worded the same way, from the same
 * derived numerator and denominator.
 */
export function OnboardingAdminProgressBar({
  progress,
}: {
  progress: OnboardingAdminProgress;
}) {
  return <OnboardingPacketProgress progress={progress} noun="modules" />;
}
