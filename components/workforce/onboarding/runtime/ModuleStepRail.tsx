"use client";

/**
 * Phase 1 - module visualization.
 *
 * The steps within one module, the worker's current position, and which steps are already
 * satisfied. Every one of those comes from the MODULE's own definition and the server's
 * derivation of it; the runtime supplies none of them and holds no step list of its own.
 */

import Link from "next/link";
import {
  modulePath,
  type OnboardingRuntimeModule,
} from "@/lib/workforce/onboardingRuntimeApi";

type Props = {
  invocationId: string;
  module: OnboardingRuntimeModule;
  currentStepSlug: string;
};

export function ModuleStepRail({ invocationId, module, currentStepSlug }: Props) {
  if (module.steps.length <= 1) return null;

  const currentIndex = module.steps.findIndex((step) => step.slug === currentStepSlug);

  return (
    <nav className="ob-step-rail" aria-label={`Questions in ${module.title}`}>
      <p className="wf-progress-text">
        Question {currentIndex + 1} of {module.steps.length}
      </p>
      <ol className="wf-rail">
        {module.steps.map((step, index) => {
          const current = step.slug === currentStepSlug;
          // A step already answered can be revisited. A later, unanswered step is not
          // offered as a jump: skipping ahead would present a question out of the order
          // the module defined.
          const reachable = step.satisfied || index <= currentIndex;
          return (
            <li
              key={step.slug}
              className={`wf-rail-item ${
                step.satisfied ? "is-done" : current ? "is-current" : "is-upcoming"
              }`}
              aria-current={current ? "step" : undefined}
              data-step-slug={step.slug}
            >
              {reachable && !current ? (
                <Link href={modulePath(invocationId, module.moduleSlug, step.slug)}>
                  {step.title}
                </Link>
              ) : (
                step.title
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ModuleStepRail;
