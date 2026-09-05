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
import OnboardingWorkerIdentity from "./OnboardingWorkerIdentity";

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
    refreshPacketIfStale,
    findPacket,
    findModule,
    workerDisplayName,
  } = useOnboardingRuntime();

  useEffect(() => {
    void openModule(invocationId, moduleSlug);
  }, [invocationId, moduleSlug, openModule]);

  /*
    THE CACHED PACKET, BROUGHT BACK UP TO DATE.

    A module completes in whatever way its own governance requires - the generic completion
    call for one, a certification for another - and moving between modules loads the
    destination and its draft without re-reading the packet. The projection would then keep
    showing a section as outstanding that the server has already recorded complete, until the
    worker reloaded the browser.

    This asks for a fresh read whenever a worker write has actually happened, and does nothing
    at all when none has. It names no module and knows of none: what changed is the SERVER's
    to say, and this only makes sure it is asked.
  */
  useEffect(() => {
    void refreshPacketIfStale(invocationId);
  }, [invocationId, moduleSlug, stepSlug, refreshPacketIfStale]);

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

  /*
    WHETHER THE WORKER FINISHED THIS SECTION, AND NOTHING ELSE.

    Read from `derivedStatus`, which the module rail and every operator surface already read,
    so the words here cannot disagree with the status chip beside them. `COMPLETE` is matched
    exactly and no other state is treated as success: a worker phase finished but awaiting our
    team is real, tracked, and NOT the same as complete, and calling it complete would tell
    him a section was closed while MW4H still owed work on it.

    It is a statement about the RECORD, never about whether the section can be changed. That
    remains the restart posture's answer above, and completion does not soften it.
  */
  const moduleComplete = activeModule.derivedStatus.state === "COMPLETE";

  return (
    <div className="wf-shell ob-shell">
      <header className="wf-head">
        <p className="wf-eyebrow">Onboarding</p>
        <OnboardingWorkerIdentity name={workerDisplayName} />
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

          <RestartNotice
            restart={activeModule.restart}
            subject="This section"
            complete={moduleComplete}
          />

          {draft?.saveError ? (
            <OnboardingErrorNotice
              error={draft.saveError}
              saving
              onRetry={() => void saveDraft()}
            />
          ) : null}

          {!changeable && moduleComplete ? (
            /*
              A SECTION HE FINISHED, SAID SO.

              Read-only and complete are two different facts, and this branch exists because
              only stating the first left a worker who had just signed looking at a screen
              that talked about work he still had to do. Completion is stated first and in his
              terms; that the record can no longer be changed here is stated after it, where
              it reads as the consequence of being finished rather than as a refusal.

              NO SECTION CONTENT IS RENDERED, exactly as in the read-only case below. The
              renderer stays unmounted, so there is no input and no act to reach, and nothing
              about this branch relaxes what the server would refuse to write. It also means
              no captured value passes through here: the confirmation is that the record is on
              file, and protected banking, tax and identity values stay where they are.
            */
            <div
              className="ob-module-complete"
              role="status"
              data-readonly-module={activeModule.moduleKey}
              data-module-complete={activeModule.moduleKey}
            >
              <p className="ob-module-complete-title">{activeModule.title} complete</p>
              <p className="ob-module-complete-body">
                What you entered has been saved and your submission was recorded
                successfully. It is now on file with MW4H, and you do not need to enter it
                again.
              </p>
              <p className="ob-module-complete-note">
                This section is shown for reference only. Nothing here can be changed now.
              </p>
            </div>
          ) : !changeable ? (
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
          <Link
            className="wf-btn wf-btn-primary"
            data-ob-return-to-packet
            href={packetPath(invocationId)}
          >
            Back to my sections
          </Link>
          <Link className="wf-btn wf-btn-ghost wf-btn-sm" href={ONBOARDING_HOME}>
            Go to my onboarding
          </Link>
        </div>
      )}
    </div>
  );
}

export default OnboardingModuleHost;
