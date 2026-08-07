"use client";

/**
 * Phase 3 - what the worker's own dashboard says about where he stands.
 *
 * The runtime already shows him each section and its status, because the server puts the
 * status on every module it sends. What the runtime could not show him is the part of his
 * onboarding that is no longer his to do: a section where he has finished and MW4H has not.
 * Only the status authority knows that, and Section 2's honesty requirement means he is told
 * it rather than left looking at a section that appears stalled for no reason he can see.
 *
 * Told, and nothing more. There is no control here and no instruction - the act is MW4H's,
 * and a button offering it to him would be a lie about who may perform it. If nothing is
 * waiting on MW4H, the component renders nothing at all rather than reassuring him about a
 * problem he never had.
 *
 * A refused or failed read renders nothing either. This is a supplement to a dashboard that
 * is already honest without it, so a status outage must not turn his onboarding home into an
 * error page.
 */

import { useEffect, useState } from "react";
import {
  getOnboardingWorkerStatus,
  type OnboardingWorkerStatus,
} from "@/lib/workforce/onboardingStatusApi";

export function OnboardingWorkerStatusSummary() {
  const [status, setStatus] = useState<OnboardingWorkerStatus | null>(null);

  useEffect(() => {
    let live = true;
    void getOnboardingWorkerStatus()
      .then((next) => {
        if (live) setStatus(next);
      })
      .catch(() => {
        if (live) setStatus(null);
      });
    return () => {
      live = false;
    };
  }, []);

  // The server decides WHICH sections are waiting on MW4H; it identifies them by module key,
  // which is an identifier and not something to put in front of a worker. The titles come
  // from the same projection, so resolving one to the other reads a name - it decides nothing.
  const keys = status?.awaitingAdministrativeAction ?? [];
  const titles = new Map(
    (status?.packets ?? []).flatMap((packet) =>
      packet.modules.map((module) => [module.moduleKey, module.title] as const),
    ),
  );
  const awaiting = keys.map((key) => ({ key, title: titles.get(key) ?? null }));

  if (awaiting.length === 0) return null;

  return (
    <section className="obs-awaiting-panel" aria-labelledby="obs-awaiting-heading">
      <h2 className="wf-section-title" id="obs-awaiting-heading">
        With our team
      </h2>
      <p className="wf-intro">
        {awaiting.length === 1
          ? "You have finished one section and it is now with our team. There is nothing further for you to do on it."
          : `You have finished ${awaiting.length} sections and they are now with our team. There is nothing further for you to do on them.`}
      </p>
      <ul className="obs-awaiting-list">
        {awaiting.map((module) => (
          <li className="obs-awaiting-item" key={module.key}>
            {/* A section whose title this projection did not carry is still counted above,
                but it is not named with its key. He is told the truth, in his own words. */}
            {module.title ?? "A section you have completed"}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default OnboardingWorkerStatusSummary;
