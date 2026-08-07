"use client";

/**
 * Phase 3 - the embeddable onboarding completion indicator.
 *
 * Built for the surfaces that will later read onboarding from within their own authorized
 * capsules. It is deliberately not mounted into any of them during this phase: the contract
 * and the component exist and are tested; the mounting is theirs to do.
 *
 * Two facts, kept apart on screen because they are kept apart on the wire:
 *
 *  - PUBLICATION, which throughout Phase 3 is the absence of a published determination. The
 *    wording comes from the server, so a consumer cannot render "not yet published" as "not
 *    complete" by choosing its own words for it.
 *  - Whether onboarding WORK is outstanding, which is a different question with a different
 *    vocabulary. Optional, because a consumer authorized only for the indicator does not
 *    receive it.
 *
 * The component renders facts and no instruction. It offers no control, makes no
 * recommendation, and says nothing about what the consuming workflow should do next.
 */

import type {
  OnboardingConsumerWorkState,
  OnboardingPublishedCompletion,
} from "@/lib/workforce/onboardingStatusApi";

export function OnboardingCompletionIndicator({
  published,
  work,
  workLabel,
}: {
  published: OnboardingPublishedCompletion;
  work?: OnboardingConsumerWorkState;
  workLabel?: string;
}) {
  return (
    <span
      className="obs-indicator"
      data-state={published.state}
      data-work={work ?? undefined}
    >
      <span className="obs-indicator-label">{published.label}</span>
      {workLabel ? <span className="obs-indicator-work">{workLabel}</span> : null}
    </span>
  );
}

export default OnboardingCompletionIndicator;
