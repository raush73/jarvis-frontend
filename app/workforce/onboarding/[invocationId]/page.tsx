"use client";

/**
 * Phase 1 - one packet's overview.
 *
 * The worker's whole obligation for a single packet. Reached from the dashboard or from
 * packet selection, and the destination of "see all sections".
 */

import { useParams } from "next/navigation";
import OnboardingPacketView from "@/components/workforce/onboarding/runtime/OnboardingPacketView";

export default function WorkforceOnboardingPacketPage() {
  const params = useParams<{ invocationId: string }>();
  const invocationId = params?.invocationId ?? "";

  return <OnboardingPacketView invocationId={invocationId} />;
}
