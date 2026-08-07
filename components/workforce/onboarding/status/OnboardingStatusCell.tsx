"use client";

/**
 * Phase 3 - the queue integration contract.
 *
 * One table cell for a queue or list row. The same chip the worker runtime and the
 * administrative workspace use, at the density a row can carry: the outcome's explanatory
 * sentence is suppressed, its heading is not, so a governed outcome still reads as an
 * outcome rather than disappearing into a narrow column.
 *
 * A queue supplies the projection. It does not word the status, and it does not decide
 * which rows are outstanding - `outstanding` is on the wire for exactly that reason.
 */

import type { OnboardingModuleStatusFacts } from "@/lib/workforce/onboardingStatusApi";
import { OnboardingStatusChip } from "./OnboardingStatusChip";

export function OnboardingStatusCell({
  status,
}: {
  status: OnboardingModuleStatusFacts;
}) {
  return (
    <span className="obs-cell" data-outstanding={status.outstanding ? "true" : "false"}>
      <OnboardingStatusChip
        status={{
          state: status.state,
          label: status.label,
          outstanding: status.outstanding,
        }}
      />
      {status.recordedOutcome ? (
        <span className="obs-outcome-label" data-outcome={status.recordedOutcome.outcome}>
          {status.recordedOutcome.label}
        </span>
      ) : null}
    </span>
  );
}

export default OnboardingStatusCell;
