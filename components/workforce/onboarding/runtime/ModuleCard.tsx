"use client";

/**
 * Phase 1 - per-module summary card.
 *
 * Renders one module as the SERVER described it: its plain-language title, whether it is
 * required, its recorded status, how much of it is done, and its entry action.
 *
 * Out-of-order completion renders correctly here for free, because status is server-recorded
 * per module rather than derived from this card's position in a list.
 */

import Link from "next/link";
import {
  modulePath,
  type OnboardingRuntimeModule,
} from "@/lib/workforce/onboardingRuntimeApi";
import OnboardingModuleStatus from "../status/OnboardingModuleStatus";

type Props = {
  invocationId: string;
  module: OnboardingRuntimeModule;
};

/** Why the calling workflow asked for this module, in the worker's terms. */
const REASON_TEXT: Record<string, string> = {
  INITIAL: "First time",
  VERIFICATION: "Please confirm this is still correct",
  RENEWAL: "Needs renewing",
  UPDATE: "Needs updating",
};

export function ModuleCard({ invocationId, module }: Props) {
  const satisfiedSteps = module.steps.filter((step) => step.satisfied).length;
  const complete = module.status === "COMPLETE" || module.status === "ALREADY_COMPLETE";
  const openable = module.actionable || module.restart.posture === "RE_ENTERABLE";

  return (
    <li className="ob-module-card" data-module-key={module.moduleKey}>
      <div className="ob-module-card-head">
        <h3 className="ob-module-card-title">{module.title}</h3>
        {/*
          The status the SERVER derived, in the server's words. A governed outcome - a
          decline, a not-required determination - renders as the completion it is rather
          than as a card with nothing in it.
        */}
        <OnboardingModuleStatus status={module.derivedStatus} />
      </div>

      <p className="ob-module-card-meta">
        {REASON_TEXT[module.requirementReason] ?? "Required"}
        {module.steps.length > 0 ? (
          <>
            {" · "}
            {complete
              ? `${module.steps.length} ${module.steps.length === 1 ? "question" : "questions"}`
              : `${satisfiedSteps} of ${module.steps.length} answered`}
          </>
        ) : null}
      </p>

      {/*
        What the module will ask for, in the module's own words. The titles come from the
        module's declared steps, so a module says what it needs without the runtime
        knowing anything about it.
      */}
      {!complete && module.steps.length > 0 ? (
        <p className="ob-module-card-asks">
          We&apos;ll ask about: {module.steps.map((step) => step.title).join(", ")}
        </p>
      ) : null}

      {module.status === "BLOCKED" ? (
        <p className="ob-module-card-note">
          This opens once the section it depends on is finished.
        </p>
      ) : null}

      {!module.hasWorkerPhase ? (
        <p className="ob-module-card-note">
          Our team completes this one. There is nothing for you to fill in.
        </p>
      ) : null}

      <div className="ob-module-card-action">
        {/*
          The action is offered only where the SERVER said it is available. Navigation
          never enables something the server would refuse.
        */}
        {openable ? (
          <Link
            className={`wf-btn ${complete ? "wf-btn-ghost" : "wf-btn-primary"} wf-btn-sm`}
            href={modulePath(invocationId, module.moduleSlug, module.resumeStepSlug)}
          >
            {complete
              ? "Review or update"
              : satisfiedSteps > 0
                ? "Continue"
                : "Start"}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export default ModuleCard;
