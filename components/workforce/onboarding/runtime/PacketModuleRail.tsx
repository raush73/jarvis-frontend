"use client";

/**
 * Phase 1 - packet visualization.
 *
 * The whole obligation in one list: every module the packet requires, with its recorded
 * status, so the worker sees what onboarding asks of him rather than only the screen he is
 * on. Rendered from the server-supplied module set, in the order the server resolved.
 *
 * Jumping between sections is leaving the open one, so these links are offered to the leave
 * guard exactly as the navigation buttons are. Where no guard is registered they remain plain
 * links and behave as they always have.
 */

import { useCallback, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  modulePath,
  type OnboardingRuntimeModule,
} from "@/lib/workforce/onboardingRuntimeApi";
import OnboardingStatusCell from "../status/OnboardingStatusCell";
import { useOnboardingRuntime } from "./OnboardingRuntimeContext";

type Props = {
  invocationId: string;
  modules: OnboardingRuntimeModule[];
  /** The module currently open, if any, so the rail can mark the worker's position. */
  currentModuleKey?: string | null;
};

export function PacketModuleRail({
  invocationId,
  modules,
  currentModuleKey = null,
}: Props) {
  const router = useRouter();
  const { leaveGuardActive, requestLeave } = useOnboardingRuntime();

  /**
   * Untouched when nothing is guarding the open module: the click falls through to the link
   * and the router does what it did before this seam existed. Guarded, the default is
   * prevented and the same destination becomes the continuation the module may run.
   */
  const onRailClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!leaveGuardActive) return;
      event.preventDefault();
      requestLeave(() => router.push(href));
    },
    [leaveGuardActive, requestLeave, router],
  );

  return (
    <nav className="ob-rail" aria-label="Sections of your onboarding">
      <ol className="ob-rail-list">
        {modules.map((module) => {
          const complete =
            module.status === "COMPLETE" || module.status === "ALREADY_COMPLETE";
          const current = module.moduleKey === currentModuleKey;
          // Jump-to-module is offered wherever the SERVER named an action on the module -
          // the same answer the packet's own cards offer, so the rail and the cards cannot
          // disagree about what is reachable. A module with no action is shown as context.
          const reachable = module.workerAction !== "NONE";
          const href = modulePath(
            invocationId,
            module.moduleSlug,
            module.resumeStepSlug,
          );

          return (
            <li
              key={module.moduleKey}
              className={`ob-rail-item ${complete ? "is-done" : ""} ${
                current ? "is-current" : ""
              }`}
              aria-current={current ? "step" : undefined}
              data-module-key={module.moduleKey}
            >
              {reachable && !current ? (
                <Link
                  className="ob-rail-link"
                  href={href}
                  onClick={(event) => onRailClick(event, href)}
                >
                  {module.title}
                </Link>
              ) : (
                <span className="ob-rail-label">{module.title}</span>
              )}
              <OnboardingStatusCell status={module.derivedStatus} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default PacketModuleRail;
