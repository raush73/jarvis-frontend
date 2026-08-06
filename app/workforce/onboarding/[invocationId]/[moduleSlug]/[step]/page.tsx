"use client";

/**
 * Phase 1 - module routing.
 *
 * The single route every onboarding module renders through. The module slug resolves
 * through the SERVER-SUPPLIED module set to a registered module renderer; the step resolves
 * through the steps that module declared.
 *
 * There is no compile-time module list here, no switch statement over module names, and no
 * client-side ordering array. Adding a governed module later requires no change to this
 * file.
 */

import { useParams } from "next/navigation";
import OnboardingModuleHost from "@/components/workforce/onboarding/runtime/OnboardingModuleHost";

export default function WorkforceOnboardingModuleStepPage() {
  const params = useParams<{
    invocationId: string;
    moduleSlug: string;
    step: string;
  }>();

  return (
    <OnboardingModuleHost
      invocationId={params?.invocationId ?? ""}
      moduleSlug={params?.moduleSlug ?? ""}
      stepSlug={params?.step ?? ""}
    />
  );
}
