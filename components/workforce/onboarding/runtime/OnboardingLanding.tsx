"use client";

/**
 * Phase 1 - the governed entry point.
 *
 * Where a worker arrives from his scoped onboarding link. It explains in plain language
 * what onboarding is, what he will be asked for, and what happens next, and it handles
 * every arrival case: a valid session, an expired or invalid link, onboarding already
 * complete, and nothing assigned.
 *
 * It never STARTS onboarding. Deciding that a worker needs onboarding belongs to the
 * calling business workflow, so there is no client-side way to create one here - the
 * landing page reports what already exists and nothing more.
 */

import { hasWorkerSession } from "@/lib/workforce/workerSession";
import { useOnboardingRuntime } from "./OnboardingRuntimeContext";
import OnboardingDashboard from "./OnboardingDashboard";
import { classifyOnboardingError, isSessionFailure } from "./runtimeErrors";

export function OnboardingLanding() {
  const { runtime, loading, error } = useOnboardingRuntime();

  // The first read is what distinguishes the arrival cases from one another. Until it
  // lands there is nothing truthful to say, and an empty dashboard would read as
  // "you have no onboarding".
  if (loading && runtime === null && error === null) return null;

  // Without a worker session there is nothing to read and nothing to save.
  const sessionMissing = !hasWorkerSession();
  const classified = error ? classifyOnboardingError(error) : null;
  const sessionFailed = classified ? isSessionFailure(classified.kind) : false;

  if (sessionMissing || sessionFailed) {
    return (
      <div className="wf-landing">
        <div className="wf-landing-hero">
          <h1 className="wf-landing-title">Your onboarding</h1>
          <p className="wf-landing-lead">
            {sessionFailed
              ? classified?.title
              : "This page needs to be opened from the secure link we sent you."}
          </p>
        </div>
        <div className="wf-card">
          <div className="wf-error" role="alert" data-error-kind="SESSION_MISSING">
            <p className="wf-error-title">Open your onboarding link again</p>
            <p>
              Anything you had already saved is safely on our servers. Opening the link we
              sent you will bring you straight back to where you left off - you will not
              have to start again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // A worker with a live session sees his real onboarding home. The explanation below is
  // for a first arrival, so it sits above the dashboard rather than replacing it.
  const firstVisit = runtime !== null && runtime.packets.every((packet) => !packet.lastActivityAt);

  return (
    <div className="ob-landing">
      {firstVisit && runtime && runtime.packets.length > 0 ? (
        <section className="wf-card ob-explainer">
          <h2 className="wf-section-title">What happens next</h2>
          <ul className="wf-list">
            <li>
              We will ask you a series of plain questions, a section at a time. You will
              never have to read or fill in a government form yourself.
            </li>
            <li>
              Your answers are saved as you go. You can stop at any point and come back to
              this page to pick up exactly where you left off.
            </li>
            <li>
              You can complete the sections in any order, and you can go back and change an
              answer later - nothing you have already given us is lost when you do.
            </li>
          </ul>
        </section>
      ) : null}

      <OnboardingDashboard />
    </div>
  );
}

export default OnboardingLanding;
