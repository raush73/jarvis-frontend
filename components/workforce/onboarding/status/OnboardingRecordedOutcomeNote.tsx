"use client";

/**
 * Phase 3 - a governed recorded outcome, presented as an outcome.
 *
 * The reason this component exists at all: a decline, a not-required determination, a
 * federally-derived answer, and a no-change confirmation are REAL recorded determinations,
 * and a surface that showed them as an empty field would be telling the reader that
 * something is missing when nothing is. Both the heading and the sentence beneath it come
 * from the server, so every surface says the same thing about the same record.
 */

import type { OnboardingRecordedOutcome } from "@/lib/workforce/onboardingStatusApi";

export function OnboardingRecordedOutcomeNote({
  outcome,
}: {
  outcome: OnboardingRecordedOutcome | null;
}) {
  if (!outcome) return null;

  return (
    <div className="obs-outcome" data-outcome={outcome.outcome}>
      <span className="obs-outcome-label">{outcome.label}</span>
      <span className="obs-outcome-detail">{outcome.detail}</span>
    </div>
  );
}

export default OnboardingRecordedOutcomeNote;
