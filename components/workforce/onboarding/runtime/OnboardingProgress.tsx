"use client";

/**
 * Phase 1 - progress visualization.
 *
 * The numerator and denominator are SERVER-SUPPLIED. This component performs no arithmetic
 * beyond turning them into a percentage for the bar, which is why a conditionally invoked
 * module changes the displayed denominator correctly with no change here.
 */

import type { OnboardingCompletion } from "@/lib/workforce/onboardingApi";

type Props = {
  completion: OnboardingCompletion;
  /** Optional label above the bar. */
  label?: string;
};

export function OnboardingProgress({ completion, label }: Props) {
  const { completeCount, requiredCount, complete } = completion;
  const percent =
    requiredCount > 0 ? Math.round((completeCount / requiredCount) * 100) : 0;

  return (
    <div className="ob-progress">
      {label ? <p className="wf-eyebrow">{label}</p> : null}
      <p className="wf-progress-text">
        {complete
          ? `All ${requiredCount} ${requiredCount === 1 ? "section" : "sections"} complete`
          : `${completeCount} of ${requiredCount} ${
              requiredCount === 1 ? "section" : "sections"
            } complete`}
      </p>
      <div
        className="wf-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={requiredCount}
        aria-valuenow={completeCount}
        aria-valuetext={`${completeCount} of ${requiredCount} sections complete`}
      >
        <div className="wf-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default OnboardingProgress;
