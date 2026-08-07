"use client";

/**
 * Phase 3 - the worker's own completion drill-down.
 *
 * The worker half of the shared detail panel that implementation plan Section 11 requires to
 * be "used identically by the worker runtime and the administrative workspace". Identical
 * means the same COMPONENT renders both, which is what makes it impossible for the two
 * surfaces to describe the same record differently; it does not mean the same read. This one
 * goes to the worker's own route with his own session, and there is no argument on it that
 * could point at anybody else.
 *
 * A collapsed section by default. His packet cards already tell him what to do next; this is
 * the "so where do I actually stand" answer underneath them, and opening it is his choice.
 *
 * A failed read renders nothing. The dashboard above it is already honest without this, and a
 * status outage must not turn his onboarding home into an error page.
 */

import { useEffect, useState } from "react";
import {
  getOnboardingWorkerCompletionDetail,
  type OnboardingCompletionDetail,
} from "@/lib/workforce/onboardingStatusApi";
import OnboardingCompletionDetailList from "./OnboardingCompletionDetailList";

export function OnboardingWorkerCompletionDetail() {
  const [detail, setDetail] = useState<OnboardingCompletionDetail | null>(null);

  useEffect(() => {
    let live = true;
    void getOnboardingWorkerCompletionDetail()
      .then((next) => {
        if (live) setDetail(next);
      })
      .catch(() => {
        if (live) setDetail(null);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!detail || detail.modules.length === 0) return null;

  return (
    <details className="obs-detail-panel" data-testid="worker-completion-detail">
      <summary className="wf-section-title">Everything on your record</summary>
      <p className="wf-intro">
        Every section of your onboarding and where each one stands. This is the same record
        our team sees.
      </p>
      <OnboardingCompletionDetailList
        modules={detail.modules}
        emptyMessage="Nothing has been recorded against your onboarding yet."
      />
    </details>
  );
}

export default OnboardingWorkerCompletionDetail;
