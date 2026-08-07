"use client";

/**
 * Phase 3 - the one status chip.
 *
 * It renders the SERVER'S words. There is no label map in this file, and there is no
 * mapping from state to text anywhere on the client, because a client that owned its own
 * wording could show a worker and an operator different sentences about the same record -
 * which is precisely what "worker-facing and staff-facing surfaces render identical status
 * from identical projections" forbids.
 *
 * `state` reaches the DOM as `data-state` so that styling and tests can key on the
 * vocabulary without any component re-deriving what the vocabulary means.
 */

import type { OnboardingStatus } from "@/lib/workforce/onboardingStatusApi";

export function OnboardingStatusChip({
  status,
  className,
}: {
  status: OnboardingStatus;
  className?: string;
}) {
  return (
    <span
      className={className ? `obs-chip ${className}` : "obs-chip"}
      data-state={status.state}
      data-outstanding={status.outstanding ? "true" : "false"}
    >
      {status.label}
    </span>
  );
}

export default OnboardingStatusChip;
