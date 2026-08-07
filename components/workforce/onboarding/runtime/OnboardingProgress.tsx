"use client";

/**
 * Phase 1's progress bar, now drawn by Phase 3.
 *
 * Phase 1 shipped a minimal renderer on the understanding that Phase 3 would replace it once
 * status visualization had an owner. This is that replacement, kept as an adapter so the
 * runtime's three call sites are unchanged: it translates the runtime's completion figures
 * into the Phase 3 progress shape and renders the shared component.
 *
 * "sections" is the worker's word for what is being counted. The operator's surfaces pass
 * "modules" to the same component. Both read one bar, and both read the server's figures.
 */

import type { OnboardingCompletion } from "@/lib/workforce/onboardingApi";
import OnboardingPacketProgress from "../status/OnboardingPacketProgress";

type Props = {
  completion: OnboardingCompletion;
  /** Optional label above the bar. */
  label?: string;
};

export function OnboardingProgress({ completion, label }: Props) {
  return (
    <OnboardingPacketProgress
      progress={{
        complete: completion.complete,
        requiredCount: completion.requiredCount,
        completeCount: completion.completeCount,
        derived: true,
      }}
      label={label}
      noun="sections"
    />
  );
}

export default OnboardingProgress;
