"use client";

/**
 * Phase 3 - the dashboard integration contract.
 *
 * A dashboard tile that presents a worker's onboarding status from a consumer projection.
 * The contract is that a dashboard supplies the projection and nothing else: it does not
 * pass a status, a label, or a colour, because a dashboard free to word onboarding status
 * for itself is a dashboard that will eventually word it differently from onboarding.
 *
 * `href` is optional and is the only affordance offered - navigation to a surface the
 * consumer already owns. No action, no control, no decision.
 */

import Link from "next/link";
import type { OnboardingConsumerStatus } from "@/lib/workforce/onboardingStatusApi";
import { OnboardingCompletionIndicator } from "./OnboardingCompletionIndicator";

export function OnboardingStatusTile({
  status,
  label = "Onboarding",
  href,
}: {
  status: OnboardingConsumerStatus;
  label?: string;
  href?: string;
}) {
  return (
    <div className="obs-tile" data-audience={status.audience} data-work={status.work}>
      <span className="obs-tile-label">{label}</span>
      <OnboardingCompletionIndicator
        published={status.published}
        work={status.work}
        workLabel={status.workLabel}
      />
      {href ? (
        <Link className="obs-tile-link" href={href}>
          Open onboarding
        </Link>
      ) : null}
    </div>
  );
}

export default OnboardingStatusTile;
