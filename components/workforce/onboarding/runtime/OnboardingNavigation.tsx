"use client";

/**
 * Phase 1 - runtime navigation.
 *
 * Forward, backward, and save-and-exit within a module. The permitted transitions come
 * from the module's OWN declared steps as the server published them, so navigation can
 * never offer a move the server would refuse.
 *
 * Every transition saves first. Leaving a screen is never how a worker loses an answer.
 *
 * A module holding state the draft cycle does not carry may register a leave guard, and every
 * transition below is offered to it first. What the guard then does is the module's business:
 * this file asks permission and holds the continuation, and knows nothing else about it.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ONBOARDING_HOME,
  modulePath,
  packetPath,
  type OnboardingRuntimeModule,
} from "@/lib/workforce/onboardingRuntimeApi";
import { useOnboardingRuntime } from "./OnboardingRuntimeContext";

type Props = {
  invocationId: string;
  module: OnboardingRuntimeModule;
  currentStepSlug: string;
  /** Persist before moving. Throws to keep the worker where he is. */
  onSave: () => Promise<void>;
  /** True while the container has a save or completion in flight. */
  busy?: boolean;
};

export function OnboardingNavigation({
  invocationId,
  module,
  currentStepSlug,
  onSave,
  busy = false,
}: Props) {
  const router = useRouter();
  const { requestLeave } = useOnboardingRuntime();
  const [moving, setMoving] = useState(false);

  const index = module.steps.findIndex((step) => step.slug === currentStepSlug);
  const previous = index > 0 ? module.steps[index - 1] : null;
  const next = index >= 0 && index < module.steps.length - 1 ? module.steps[index + 1] : null;

  const transition = useCallback(
    async (href: string) => {
      setMoving(true);
      try {
        await onSave();
        router.push(href);
      } catch {
        // The save surfaced its own failure through the container, and the worker's
        // answers are still on screen. Staying put is the correct outcome.
      } finally {
        setMoving(false);
      }
    },
    [onSave, router],
  );

  /**
   * Every leaving affordance goes through here.
   *
   * With no guard registered `requestLeave` runs the continuation synchronously, so this is
   * the same call it always was. With one, the module decides when - or whether - it runs.
   */
  const go = useCallback(
    (href: string) => {
      requestLeave(() => {
        void transition(href);
      });
    },
    [requestLeave, transition],
  );

  const disabled = busy || moving;

  return (
    <div className="wf-actions">
      <button
        type="button"
        className="wf-btn wf-btn-ghost"
        disabled={!previous || disabled}
        onClick={() =>
          previous && go(modulePath(invocationId, module.moduleSlug, previous.slug))
        }
      >
        Back
      </button>

      {/*
        HOME BASE, from inside every module screen.

        The packet is where the worker sees what is done, what remains and what is waiting on
        our staff, so there is always one control that takes him back to it - including from a
        module he finished through its own governed act rather than through the generic
        completion call, which is the only way he would otherwise have to find his way back.
        It saves and consults the leave guard exactly as every other transition here does.
      */}
      <button
        type="button"
        className="wf-btn wf-btn-secondary wf-btn-sm"
        data-ob-return-to-packet
        disabled={disabled}
        onClick={() => go(packetPath(invocationId))}
      >
        My sections
      </button>

      <button
        type="button"
        className="wf-btn wf-btn-secondary wf-btn-sm"
        disabled={disabled}
        onClick={() => go(ONBOARDING_HOME)}
      >
        Save &amp; finish later
      </button>

      {/*
        No forward button on the last step, and none supplied on a module's behalf. A
        module owns its own submission and renders it inside its own screen, because only
        the module knows what submitting it means.
      */}
      {next ? (
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          disabled={disabled}
          onClick={() => go(modulePath(invocationId, module.moduleSlug, next.slug))}
        >
          {moving ? "Saving." : "Save & Continue"}
        </button>
      ) : null}
    </div>
  );
}

export default OnboardingNavigation;
