"use client";

/**
 * Phase 1 - the worker's onboarding home.
 *
 * What a returning worker sees: his packets, his progress, what is outstanding, what is
 * complete, and a single obvious next action. This is what makes onboarding resumable
 * rather than a one-sitting form.
 *
 * It handles every arrival case - valid session, nothing assigned, everything already
 * complete, more than one packet - without a separate implementation for any of them,
 * because all four are just different projections of the same server read.
 */

import Link from "next/link";
import { resumePath } from "@/lib/workforce/onboardingRuntimeApi";
import { useOnboardingRuntime } from "./OnboardingRuntimeContext";
import OnboardingErrorNotice from "./OnboardingErrorNotice";
import OnboardingPacketSelection from "./OnboardingPacketSelection";
import PacketCard from "./PacketCard";

export function OnboardingDashboard() {
  const { runtime, loading, error, reload } = useOnboardingRuntime();

  if (loading && !runtime) {
    return <p className="wf-loading">Loading your onboarding.</p>;
  }

  if (error && !runtime) {
    return <OnboardingErrorNotice error={error} onRetry={() => void reload()} />;
  }

  if (!runtime) return null;

  // Nothing assigned. A normal arrival case, not a failure: deciding that a worker needs
  // onboarding belongs to the calling workflow, and the runtime never invents one.
  if (runtime.packets.length === 0) {
    return (
      <div className="wf-card ob-empty-state">
        <h1 className="wf-title">You have no onboarding to complete</h1>
        <p className="wf-intro">
          Nothing has been assigned to you yet. If you have been told to expect onboarding
          paperwork, it will appear here as soon as it is ready, and you will be able to
          work through it a section at a time.
        </p>
      </div>
    );
  }

  const outstanding = runtime.packets.filter((packet) => !packet.completion.complete);
  const finished = runtime.packets.filter((packet) => packet.completion.complete);
  const everythingDone = outstanding.length === 0;

  return (
    <div className="ob-dashboard">
      <header className="wf-head">
        <p className="wf-eyebrow">Onboarding</p>
        <h1 className="wf-title">
          {everythingDone ? "Your onboarding is complete" : "Your onboarding"}
        </h1>
        <p className="wf-intro">
          {everythingDone
            ? "Everything asked of you has been recorded. You can look back over any section below."
            : "Work through this a section at a time. Everything you enter is saved as you go, so you can stop whenever you need to and pick up here later."}
        </p>
      </header>

      {error ? <OnboardingErrorNotice error={error} onRetry={() => void reload()} /> : null}

      {/*
        One obvious next action, pointing exactly where the server said to resume -
        including part-way through a section.
      */}
      {runtime.resume ? (
        <div className="ob-next-action">
          <Link className="wf-btn wf-btn-primary" href={resumePath(runtime.resume)}>
            Continue where I left off
          </Link>
        </div>
      ) : null}

      {/*
        An explicit selection surface only where there is genuinely something to choose
        between. With one packet there is no choice to present, so the worker proceeds.
      */}
      {runtime.requiresPacketSelection ? (
        <OnboardingPacketSelection packets={runtime.packets} />
      ) : null}

      {!runtime.requiresPacketSelection && outstanding.length > 0 ? (
        <section className="wf-section" aria-labelledby="ob-outstanding">
          <h2 className="wf-section-title" id="ob-outstanding">
            Outstanding
          </h2>
          <div className="ob-packet-list">
            {outstanding.map((packet) => (
              <PacketCard key={packet.invocationId} packet={packet} />
            ))}
          </div>
        </section>
      ) : null}

      {!runtime.requiresPacketSelection && finished.length > 0 ? (
        <section className="wf-section" aria-labelledby="ob-complete">
          <h2 className="wf-section-title" id="ob-complete">
            Complete
          </h2>
          <div className="ob-packet-list">
            {finished.map((packet) => (
              <PacketCard key={packet.invocationId} packet={packet} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default OnboardingDashboard;
