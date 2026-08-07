"use client";

/**
 * Phase 3 - one module's status, wherever a module's status is shown.
 *
 * Takes the status FACTS the server already put on the module - the Phase 1 runtime and the
 * Phase 2 workspace each carry them on their own module responses - so the worker runtime
 * and the administrative workspace render the same component from the same authority.
 *
 * `awaitingAdministrativeAction` is shown because a worker is entitled to know where his
 * onboarding actually stands. It is shown as a FACT: this component renders no control, and
 * the server sets `workerActionable` false whenever this is true, so nothing built on it
 * can offer him an act that is MW4H's to perform.
 */

import type { OnboardingModuleStatusFacts } from "@/lib/workforce/onboardingStatusApi";
import { OnboardingStatusChip } from "./OnboardingStatusChip";
import { OnboardingRecordedOutcomeNote } from "./OnboardingRecordedOutcomeNote";

export function OnboardingModuleStatus({
  status,
  showOutcomeDetail = true,
}: {
  status: OnboardingModuleStatusFacts;
  /** Set false where space is tight - a queue cell, a dense table row. */
  showOutcomeDetail?: boolean;
}) {
  return (
    <div className="obs-module" data-module-state={status.state}>
      <span className="obs-module-line">
        <OnboardingStatusChip
          status={{
            state: status.state,
            label: status.label,
            outstanding: status.outstanding,
          }}
        />
        {status.awaitingAdministrativeAction ? (
          <span className="obs-awaiting" data-awaiting="true">
            Nothing further is needed from you on this step.
          </span>
        ) : null}
      </span>
      {showOutcomeDetail ? (
        <OnboardingRecordedOutcomeNote outcome={status.recordedOutcome} />
      ) : null}
    </div>
  );
}

export default OnboardingModuleStatus;
