"use client";

/**
 * Phase 3 - the authorized completion drill-down.
 *
 * Renders exactly the rows the server sent. It does not filter, does not sort, and does not
 * hide anything: a module a caller may not know about is already ABSENT from the projection
 * before it reaches this component, because minimization is the server's job and a client
 * that hid things would be protecting information with markup.
 *
 * Every row is completion FACTS - what, where it stands, and when. Module content never
 * appears here, because it never appears in the projection.
 */

import type { OnboardingCompletionFact } from "@/lib/workforce/onboardingStatusApi";
import { OnboardingStatusChip } from "./OnboardingStatusChip";
import { OnboardingRecordedOutcomeNote } from "./OnboardingRecordedOutcomeNote";

export function OnboardingCompletionDetailList({
  modules,
  emptyMessage = "No onboarding steps are recorded for this worker.",
}: {
  modules: OnboardingCompletionFact[];
  /**
   * The wording for "nothing here". The only thing either surface varies, because a worker
   * reading his own drill-down is not told about "this worker". Every FACT below comes from
   * the projection; this is the sentence shown when there are no facts at all.
   */
  emptyMessage?: string;
}) {
  if (modules.length === 0) {
    return <p className="obs-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="obs-detail-list">
      {modules.map((module) => (
        <li
          className="obs-detail-row"
          key={module.moduleKey}
          data-module-key={module.moduleKey}
          data-outstanding={module.status.outstanding ? "true" : "false"}
        >
          <span className="obs-detail-head">
            <span className="obs-detail-title">
              {module.moduleNumber} {module.title}
            </span>
            <OnboardingStatusChip status={module.status} />
          </span>
          <OnboardingRecordedOutcomeNote outcome={module.recordedOutcome} />
          {module.completedAt ? (
            <span className="obs-detail-when">
              Recorded {new Date(module.completedAt).toLocaleDateString()}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default OnboardingCompletionDetailList;
