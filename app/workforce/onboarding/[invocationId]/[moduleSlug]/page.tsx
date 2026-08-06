"use client";

/**
 * Phase 1 - entering a module without naming a step.
 *
 * Sends the worker to the step the SERVER resolved for this module, which is how a link to
 * a module lands mid-module for a worker who was part-way through it. The step is never
 * chosen here: choosing one locally would be the runtime deciding a position, and the
 * position it chose would eventually disagree with the recorded answers.
 */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ONBOARDING_HOME,
  modulePath,
} from "@/lib/workforce/onboardingRuntimeApi";
import { useOnboardingRuntime } from "@/components/workforce/onboarding/runtime/OnboardingRuntimeContext";
import OnboardingErrorNotice from "@/components/workforce/onboarding/runtime/OnboardingErrorNotice";

export default function WorkforceOnboardingModuleEntryPage() {
  const params = useParams<{ invocationId: string; moduleSlug: string }>();
  const invocationId = params?.invocationId ?? "";
  const moduleSlug = params?.moduleSlug ?? "";
  const router = useRouter();
  const { runtime, loading, error, reload, findModule } = useOnboardingRuntime();

  const assignedModule = findModule(invocationId, moduleSlug);
  const target = assignedModule?.resumeStepSlug ?? null;

  useEffect(() => {
    if (!assignedModule) return;
    router.replace(modulePath(invocationId, moduleSlug, target));
  }, [assignedModule, invocationId, moduleSlug, router, target]);

  if (loading && !runtime) {
    return <p className="wf-loading">Loading your onboarding.</p>;
  }

  if (error && !runtime) {
    return <OnboardingErrorNotice error={error} onRetry={() => void reload()} />;
  }

  if (runtime && !assignedModule) {
    return (
      <div className="wf-error" role="alert" data-error-kind="NOT_ROUTABLE">
        <p className="wf-error-title">We could not find that part of your onboarding.</p>
        <p>
          It may already be complete, or it may not be part of what was assigned to you.
        </p>
        <div className="wf-btn-row" style={{ marginTop: 16 }}>
          <Link className="wf-btn wf-btn-primary" href={ONBOARDING_HOME}>
            Go to my onboarding
          </Link>
        </div>
      </div>
    );
  }

  return <p className="wf-loading">Opening this section.</p>;
}
