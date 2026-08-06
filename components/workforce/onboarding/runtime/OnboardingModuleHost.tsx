"use client";

/**
 * Phase 1 - the module host.
 *
 * The frame every onboarding module renders inside, and the whole point of this phase: a
 * module phase ships a governed module by registering interview screens and a validator,
 * and changes nothing here.
 *
 * Routing is resolution, not a lookup table. The module slug is matched against the
 * SERVER-SUPPLIED module set for this packet, and the step against the steps that module
 * declared. A slug naming a module the worker was not assigned, or a step the module never
 * declared, is refused rather than rendered - which is what stops a fabricated URL from
 * presenting a screen that was never required.
 */

import { useEffect } from "react";
import Link from "next/link";
import {
  ONBOARDING_HOME,
  packetPath,
} from "@/lib/workforce/onboardingRuntimeApi";
import { useOnboardingRuntime } from "./OnboardingRuntimeContext";
import { resolveOnboardingModuleRenderer } from "./moduleRegistry";
import ModuleStepRail from "./ModuleStepRail";
import PacketModuleRail from "./PacketModuleRail";
import OnboardingProgress from "./OnboardingProgress";
import OnboardingErrorNotice from "./OnboardingErrorNotice";
import OnboardingNavigation from "./OnboardingNavigation";
import RestartNotice from "./RestartNotice";

type Props = {
  invocationId: string;
  moduleSlug: string;
  stepSlug: string;
};

export function OnboardingModuleHost({ invocationId, moduleSlug, stepSlug }: Props) {
  const {
    runtime,
    loading,
    error,
    reload,
    draft,
    openModule,
    setValue,
    saveDraft,
    completeModule,
    findPacket,
    findModule,
  } = useOnboardingRuntime();

  useEffect(() => {
    void openModule(invocationId, moduleSlug);
  }, [invocationId, moduleSlug, openModule]);

  if (loading && !runtime) {
    return <p className="wf-loading">Loading your onboarding.</p>;
  }

  if (error && !runtime) {
    return <OnboardingErrorNotice error={error} onRetry={() => void reload()} />;
  }

  const packet = findPacket(invocationId);
  const activeModule = findModule(invocationId, moduleSlug);

  // Refused rather than rendered. An unassigned module has no screen, and inventing an
  // empty one would look like a section the worker simply had not filled in.
  if (!packet || !activeModule) {
    return (
      <div className="wf-error" role="alert" data-error-kind="NOT_ROUTABLE">
        <p className="wf-error-title">We could not find that part of your onboarding.</p>
        <p>
          It may already be complete, or it may not be part of what was assigned to you.
          Your onboarding home shows everything that is outstanding.
        </p>
        <div className="wf-btn-row" style={{ marginTop: 16 }}>
          <Link className="wf-btn wf-btn-primary" href={ONBOARDING_HOME}>
            Go to my onboarding
          </Link>
        </div>
      </div>
    );
  }

  const step = activeModule.steps.find((entry) => entry.slug === stepSlug);
  if (!step) {
    return (
      <div className="wf-error" role="alert" data-error-kind="NOT_ROUTABLE">
        <p className="wf-error-title">That question is not part of this section.</p>
        <p>Open the section again and we will take you to the right place.</p>
        <div className="wf-btn-row" style={{ marginTop: 16 }}>
          <Link className="wf-btn wf-btn-primary" href={packetPath(invocationId)}>
            Back to my sections
          </Link>
        </div>
      </div>
    );
  }

  const renderer = resolveOnboardingModuleRenderer(activeModule.moduleKey);
  const busy = Boolean(draft?.saving) || Boolean(draft?.loading);

  /*
    Whether this section can be CHANGED is the server's answer, carried in the restart
    posture, and it is read here rather than inferred from how the worker arrived. A typed
    URL reaches this component exactly as a link does, so a section the server would refuse
    to write must not be given inputs and a save button: the write is refused either way,
    and offering it would invite the worker to enter answers that cannot be kept.
  */
  const changeable = activeModule.restart.posture !== "CLOSED";

  return (
    <div className="wf-shell ob-shell">
      <header className="wf-head">
        <p className="wf-eyebrow">Onboarding</p>
        <h1 className="wf-title">{activeModule.title}</h1>
        <OnboardingProgress completion={packet.completion} />
      </header>

      <div className="ob-layout">
        <aside className="ob-aside">
          <PacketModuleRail
            invocationId={invocationId}
            modules={packet.modules}
            currentModuleKey={activeModule.moduleKey}
          />
        </aside>

        <div className="wf-card ob-main">
          <ModuleStepRail
            invocationId={invocationId}
            module={activeModule}
            currentStepSlug={step.slug}
          />

          <h2 className="wf-section-title">{step.title}</h2>

          <RestartNotice restart={activeModule.restart} subject="This section" />

          {draft?.saveError ? (
            <OnboardingErrorNotice
              error={draft.saveError}
              saving
              onRetry={() => void saveDraft()}
            />
          ) : null}

          {!changeable ? (
            <p className="wf-empty" data-readonly-module={activeModule.moduleKey}>
              This section is shown for reference only. Nothing here can be changed now.
            </p>
          ) : draft?.loading ? (
            <p className="wf-loading">Loading your answers.</p>
          ) : renderer ? (
            renderer({
              invocationId,
              module: activeModule,
              step,
              draft: draft?.data ?? {},
              setValue,
              save: saveDraft,
              complete: completeModule,
              busy,
            })
          ) : (
            /*
              No capsule has registered a renderer for this module. That is the expected
              state in this phase, which ships the runtime and zero business modules. It is
              reported plainly rather than as a blank screen, so an unregistered module is
              never mistaken for a section with nothing to answer.
            */
            <p className="wf-empty" data-unrendered-module={activeModule.moduleKey}>
              This section is not available in this environment yet.
            </p>
          )}
        </div>
      </div>

      {changeable ? (
        <OnboardingNavigation
          invocationId={invocationId}
          module={activeModule}
          currentStepSlug={step.slug}
          onSave={saveDraft}
          busy={busy}
        />
      ) : (
        <div className="wf-btn-row">
          <Link className="wf-btn wf-btn-primary" href={ONBOARDING_HOME}>
            Go to my onboarding
          </Link>
        </div>
      )}
    </div>
  );
}

export default OnboardingModuleHost;
