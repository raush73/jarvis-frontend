"use client";

/**
 * Phase 1 - packet visualization.
 *
 * The whole obligation in one list: every module the packet requires, with its recorded
 * status, so the worker sees what onboarding asks of him rather than only the screen he is
 * on. Rendered from the server-supplied module set, in the order the server resolved.
 */

import Link from "next/link";
import {
  modulePath,
  type OnboardingRuntimeModule,
} from "@/lib/workforce/onboardingRuntimeApi";
import OnboardingStatusCell from "../status/OnboardingStatusCell";

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
  return (
    <nav className="ob-rail" aria-label="Sections of your onboarding">
      <ol className="ob-rail-list">
        {modules.map((module) => {
          const complete =
            module.status === "COMPLETE" || module.status === "ALREADY_COMPLETE";
          const current = module.moduleKey === currentModuleKey;
          // Jump-to-module is offered only where the server permits working on it. A
          // module the server would refuse is shown as context, not as a link.
          const reachable =
            module.actionable || module.restart.posture === "RE_ENTERABLE";

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
                  href={modulePath(invocationId, module.moduleSlug, module.resumeStepSlug)}
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
