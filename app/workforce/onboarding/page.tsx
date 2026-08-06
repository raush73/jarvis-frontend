"use client";

/**
 * Phase 1 - the onboarding entry point and the worker's home.
 *
 * The page a worker reaches from his scoped onboarding link, and the page he returns to
 * every time afterwards. One surface handles first arrival, an interrupted return, and a
 * completed packet, because all three are the same server read rendered differently.
 */

import OnboardingLanding from "@/components/workforce/onboarding/runtime/OnboardingLanding";

export default function WorkforceOnboardingPage() {
  return <OnboardingLanding />;
}
