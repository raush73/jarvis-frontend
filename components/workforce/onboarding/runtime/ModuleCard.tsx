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
  type OnboardingWorkerAction,
} from "@/lib/workforce/onboardingRuntimeApi";
import OnboardingModuleStatus from "../status/OnboardingModuleStatus";

type Props = {
  invocationId: string;
  module: OnboardingRuntimeModule;
};

/**
 * The worker-facing words for each governed action.
 *
 * PRESENTATION OF THE SERVER'S ANSWER, and nothing more. Which action a module offers is
 * decided server-side from its record, its packet and its restart posture; this only spells
 * that answer in the ratified vocabulary. A module key appears nowhere in this file, so no
 * screen here can decide that a particular section happens to be editable.
 */
const ACTION_LABELS: Record<Exclude<OnboardingWorkerAction, "NONE">, string> = {
  ENTER: "Enter Info",
  CONTINUE: "Continue",
  EDIT: "Edit Info",
  VIEW: "View Info",
};

/** The one action carries the page's emphasis only where there is work outstanding. */
const ACTION_EMPHASIS: Record<Exclude<OnboardingWorkerAction, "NONE">, string> = {
  ENTER: "wf-btn-primary",
  CONTINUE: "wf-btn-primary",
  EDIT: "wf-btn-ghost",
  VIEW: "wf-btn-ghost",
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
  const action = module.workerAction;

  return (
    <li
      className="ob-module-card"
      data-module-key={module.moduleKey}
      data-worker-action={action}
    >
      <div className="ob-module-card-head">
        {/*
          THREE SEPARATE THINGS, said separately: what the section is, where it stands, and
          what the worker may do about it. The name and the status are here; the action is a
          control of its own further down, and the status is never that control.
        */}
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
          ONE action, and only the one the SERVER named. Navigation never enables something
          the server would refuse, and where the server offers nothing this renders nothing
          rather than an action the worker would be turned away from.
        */}
        {action === "NONE" ? null : (
          <Link
            className={`wf-btn ${ACTION_EMPHASIS[action]} wf-btn-sm`}
            data-module-action={action}
            href={modulePath(invocationId, module.moduleSlug, module.resumeStepSlug)}
          >
            {ACTION_LABELS[action]}
          </Link>
        )}
      </div>
    </li>
  );
}

export default ModuleCard;
