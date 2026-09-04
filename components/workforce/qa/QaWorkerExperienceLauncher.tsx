"use client";

/**
 * QA-L3 - the staff QA persona launcher.
 *
 * ONE SCREEN WITH TWO DISTINCT ACTS, and the difference between them is the point:
 *
 *  - LAUNCH - choose a formally TEST-classified worker, choose which of the two AUTHORIZED
 *    experiences to open, and open a NEW real onboarding run as that worker in a separate tab.
 *  - RE-ENTER - sign that same test worker back in, creating NO new onboarding run at all, so a QA
 *    session that expired mid-run can be resumed against the work that is already there.
 *
 * THEY ARE DELIBERATELY NOT ONE CONTROL WITH A CHECKBOX. An operator whose session expired halfway
 * through a packet wants the packet he was already testing, and a launch would bury it under a newer
 * one; an operator starting fresh QA wants a new run. Presenting them as separate acts with separate
 * results is what keeps those two intentions from being confused for each other, and their result
 * state is kept separate for the same reason - a re-entry panel reporting an invocation would be
 * describing something that does not exist.
 *
 * It is a QA facility and says so; it is not a production worker tool and contains none of one.
 *
 * THE SCOPE IS A CHOICE BETWEEN EXACTLY TWO GOVERNED VALUES, AND IT HAS NO DEFAULT. Owner ruling
 * QA-L5-R1 authorized the surgical Payroll Payment path and the complete onboarding packet, and
 * nothing else; owner judgment call JC-1 requires the staff member to say which he means, so neither
 * is preselected and the launch stays disabled until he chooses. A defaulted scope would mean an
 * operator could open a full multi-module worker journey while believing he opened one module.
 *
 * THE COMPLETE PACKET'S CONTENTS ARE NOT KNOWN TO THIS SCREEN AND MUST NEVER BE. Its modules are
 * whatever the production onboarding registry holds (owner ruling QA-L5-R2), which the worker
 * runtime renders from the server's own packet; there is no module list, module map or module count
 * in this file, and a module that is not implemented simply does not appear - which is correct.
 *
 * WHAT IS DELIBERATELY ABSENT, and none of it may be added here:
 *
 *  - No production-worker search, lookup, or free-text identifier field. The only workers this
 *    screen can name are the ones QA-L2's TEST directory returned, and the only inputs on it are
 *    radios over that list and over the two authorized scopes. There is nothing to type an
 *    arbitrary candidate into.
 *  - No module chooser and no arbitrary scope. A staff member selects one of the two GOVERNED
 *    scopes; he cannot name a module, a module set, a workflow or an invocation kind, and the
 *    internal invocation vocabulary is not shown to him at all.
 *  - No invocation field, no packet field, no resume, reopen or rebind control. Every launch is a
 *    NEW run, and the re-entry act is NOT an exception to this: it takes no invocation, names no
 *    packet, and lands the worker on the delivered onboarding home so that the APPLICATION'S OWN
 *    RUNTIME decides what work he has. This screen never chooses a packet for a worker.
 *  - No reset, delete, clear, wipe, force-complete or force-uncomplete control, and no cleanup on
 *    failure. A run that was created stays created.
 *  - No classification editor. Whether a worker is TEST is not this screen's to change.
 *  - No known-persona list. Which workers are eligible is a server answer; a name or an identifier
 *    hardcoded here would be a second, quieter classification.
 *
 * AUTHORIZATION IS THE SERVER'S, AND THIS SCREEN'S RENDERING IS NOT A CONTROL. It reads the
 * effective grant list - `permissions.includes`, NOT `hasPermission`, because that helper treats
 * the `admin` role as a bypass and `SensitiveDataGuard` does not - so the screen does not advertise
 * a launch the server will refuse. An operator who reaches the URL anyway, or edits the page, is
 * refused by QA-L2 on every request: the three cumulative controls live there.
 *
 * THE ENTRY TOKEN NEVER REACHES THIS FILE. `launchQaWorkerHandoff` returns a shape with no field
 * for one, so nothing here can hold, render, store, log or route with a secret.
 *
 * THE PRESENTATION PRIMITIVES ARE THE DELIVERED ONES - the panel, the field list, the timestamp -
 * because a QA screen is not a reason for a second set of them. What is NOT reused is the
 * administrative workspace's shell, navigation and admission gate: this facility is `workforce.qa.*`
 * and not `workforce.onboarding.*`, and rendering it inside the onboarding workspace would put an
 * onboarding grant in front of a QA capability the server authorizes on its own.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth/useSession";
import {
  QA_WORKER_EXPERIENCE_LAUNCH_PERMISSION,
  QA_WORKER_EXPERIENCE_SCOPES,
  listQaTestWorkers,
  type QaWorkerExperienceScope,
} from "@/lib/workforce/qaWorkerExperienceApi";
import {
  launchQaWorkerHandoff,
  reEnterQaWorkerHandoff,
  type QaWorkerHandoff,
  type QaWorkerReEntry,
} from "@/lib/workforce/qaWorkerHandoff";
import { useOnboardingAdminResource } from "@/components/workforce/admin/useOnboardingAdminResource";
import {
  OnboardingAdminField,
  OnboardingAdminFieldList,
  OnboardingAdminPanel,
  OnboardingAdminTimestamp,
} from "@/components/workforce/admin/panels/DetailPanel";
import { classifyQaLauncherError, type QaLauncherAct } from "./qaLauncherErrors";
import { openQaWorkerTab } from "./qaWorkerTab";

/**
 * The two authorized experiences, in an operator's words.
 *
 * COPY ONLY. The set itself is the server's closed one, imported rather than restated, so this
 * screen cannot offer a scope the server would refuse and cannot quietly acquire a third. The
 * wording is what makes the choice understandable before it is made - the difference between
 * exercising one module and walking a worker's whole onboarding journey is not obvious from a key -
 * and it deliberately exposes no internal invocation vocabulary.
 */
const QA_SCOPE_COPY: Record<
  QaWorkerExperienceScope,
  { label: string; description: string }
> = {
  PAYROLL_PAYMENT: {
    label: "Payroll Payment only",
    description:
      "Isolated, surgical QA of the Payroll Payment module by itself. The worker lands directly in that module and is required to record it again on this run.",
  },
  COMPLETE_PACKET: {
    label: "Complete onboarding packet",
    description:
      "End-to-end QA of the worker's whole onboarding packet. The worker lands on his packet overview and works through every onboarding module the platform currently requires of him. Which modules those are is decided by the platform, not by this screen: anything not yet built simply is not there, and a module the worker cannot finish on his own stays truthfully unfinished.",
  },
};

function QaNotice({
  error,
  onRetry,
  act = "LAUNCH",
}: {
  error: unknown;
  onRetry?: () => void;
  /** Which act was refused, so the notice can state truthfully what was created. */
  act?: QaLauncherAct;
}) {
  const notice = classifyQaLauncherError(error, act);

  return (
    <div className="oba-notice oba-notice-error" role="alert">
      <p className="oba-notice-title">{notice.title}</p>
      <p className="oba-notice-detail">{notice.detail}</p>
      {notice.code ? (
        <p className="oba-notice-code">Refusal code: {notice.code}</p>
      ) : null}
      {notice.signInRequired ? (
        <Link className="oba-btn" href="/login">
          Go to sign in
        </Link>
      ) : null}
      {notice.retryable && onRetry ? (
        <button type="button" className="oba-btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export default function QaWorkerExperienceLauncher() {
  const session = useSession();

  // The effective grant, with no role bypass. See the file header.
  const mayLaunch = session.permissions.includes(
    QA_WORKER_EXPERIENCE_LAUNCH_PERMISSION,
  );

  const [selected, setSelected] = useState<string | null>(null);
  // NULL, and it stays null until the operator says which experience he wants (JC-1). There is no
  // initial value here, and neither scope may become one.
  const [scope, setScope] = useState<QaWorkerExperienceScope | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<QaWorkerHandoff | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [tabBlocked, setTabBlocked] = useState(false);

  // RE-ENTRY STATE, KEPT SEPARATE FROM THE LAUNCH'S THROUGHOUT. Sharing `launched` would mean a
  // panel that has an invocation field rendering a result that has no invocation, and sharing
  // `failure` would mean a failed re-entry appearing under "Launch outcome" - which is precisely
  // the confusion between the two acts this screen exists to prevent.
  const [reEntering, setReEntering] = useState(false);
  const [reEntered, setReEntered] = useState<QaWorkerReEntry | null>(null);
  const [reEntryFailure, setReEntryFailure] = useState<unknown>(null);
  const [reEntryTabBlocked, setReEntryTabBlocked] = useState(false);

  // A second click in the same tick would read a state flag that has not flushed yet. The ref is
  // the actual guard against a duplicate launch; the disabled button is the courtesy.
  const inFlight = useRef(false);

  /**
   * Either act running blocks both buttons.
   *
   * NOT MERELY TIDINESS: both acts establish a worker session in this browser, and two handoffs
   * overlapping would have the second one's session consumption racing the first one's.
   */
  const busy = launching || reEntering;

  const directory = useOnboardingAdminResource(() => listQaTestWorkers(), [], {
    enabled: session.ready && session.authenticated && mayLaunch,
  });

  const workers = directory.data ?? [];
  const chosen = workers.find((worker) => worker.candidateId === selected) ?? null;

  const launch = () => {
    if (inFlight.current) return;
    const candidateId = selected;
    // Both choices are required, and neither is supplied here on the operator's behalf.
    const chosenScope = scope;
    if (!candidateId || !chosenScope) return;

    inFlight.current = true;
    setLaunching(true);
    setFailure(null);
    setTabBlocked(false);
    setLaunched(null);

    // Opened HERE, inside the click, so a popup blocker allows it. It is empty and addresses
    // nothing until the handoff below succeeds.
    const tab = openQaWorkerTab();

    void (async () => {
      try {
        const handoff = await launchQaWorkerHandoff(candidateId, chosenScope);
        setLaunched(handoff);
        if (tab) {
          tab.navigate(handoff.workerPath);
        } else {
          setTabBlocked(true);
        }
      } catch (thrown) {
        // No cleanup call of any kind. A run QA-L2 created stays in the worker's history.
        setFailure(thrown);
        tab?.close();
      } finally {
        inFlight.current = false;
        setLaunching(false);
      }
    })();
  };

  /**
   * Sign the selected test worker back in, creating no new onboarding run.
   *
   * IT NEEDS THE WORKER AND NOTHING ELSE. There is deliberately no scope read here - `scope` is not
   * consulted by this function at all - because nothing is composed, so there is nothing for a
   * scope to describe. That is why the button below enables on a worker selection alone.
   *
   * IT CALLS THE RE-ENTRY HANDOFF AND NEVER THE LAUNCH ONE, and it builds no route: the handoff
   * returns the delivered onboarding home, and no invocation identifier passes through this
   * function to build anything else from.
   */
  const reEnter = () => {
    if (inFlight.current) return;
    const candidateId = selected;
    if (!candidateId) return;

    inFlight.current = true;
    setReEntering(true);
    setReEntryFailure(null);
    setReEntryTabBlocked(false);
    setReEntered(null);

    // Opened HERE, inside the click, so a popup blocker allows it - the same delivered helper the
    // launch uses, for the same reason.
    const tab = openQaWorkerTab();

    void (async () => {
      try {
        const handoff = await reEnterQaWorkerHandoff(candidateId);
        setReEntered(handoff);
        if (tab) {
          tab.navigate(handoff.workerPath);
        } else {
          setReEntryTabBlocked(true);
        }
      } catch (thrown) {
        // Nothing to clean up, and nothing that could be cleaned up: no run was created.
        setReEntryFailure(thrown);
        tab?.close();
      } finally {
        inFlight.current = false;
        setReEntering(false);
      }
    })();
  };

  if (!session.ready) {
    return (
      <p className="oba-loading" role="status">
        Checking your access…
      </p>
    );
  }

  if (!session.authenticated) {
    return (
      <div className="oba-notice oba-notice-error" role="alert">
        <p className="oba-notice-title">Sign in to continue.</p>
        <p className="oba-notice-detail">
          The QA worker experience launcher is a staff facility and is available only to
          signed-in staff.
        </p>
        <Link className="oba-btn" href="/login">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="oba-shell">
      <header className="oba-header">
        <div>
          <h1 className="oba-title">QA / test worker experience</h1>
          <p className="oba-subtitle">
            Opens a NEW real onboarding run for a formally test-classified worker and hands this
            browser that worker&apos;s own session in a separate tab, or re-enters an existing test
            worker&apos;s session without creating any new onboarding work. This is a quality
            assurance facility, not a production worker tool: no production worker can be reached
            from it, and nothing here is a shortcut around a worker&apos;s normal secure entry.
          </p>
        </div>
      </header>

      {!mayLaunch ? (
        <div className="oba-notice oba-notice-error" role="alert">
          <p className="oba-notice-title">
            The QA worker experience launcher is not available to you.
          </p>
          <p className="oba-notice-detail">
            It requires the {QA_WORKER_EXPERIENCE_LAUNCH_PERMISSION} grant, which no role confers
            by breadth, and it is additionally switched on per environment. Both are decided by
            the server, which refuses every request from here regardless of what this page shows.
          </p>
        </div>
      ) : (
        <div className="oba-body">
          <OnboardingAdminPanel
            title="Launch scope"
            description="Choose which experience to open. There is no default."
          >
            <p className="oba-notice-detail">
              Both are real onboarding runs and both are always a NEW run. No earlier run can be
              reopened from this screen, and no other experience can be requested: the server
              accepts these two and refuses everything else.
            </p>

            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="oba-label">Choose a launch scope</legend>
              {QA_WORKER_EXPERIENCE_SCOPES.map((option) => (
                <p key={option} className="oba-notice-detail">
                  <input
                    type="radio"
                    name="qa-scope"
                    id={`qa-scope-${option}`}
                    value={option}
                    checked={scope === option}
                    disabled={busy}
                    onChange={() => setScope(option)}
                  />{" "}
                  <label htmlFor={`qa-scope-${option}`}>
                    <strong>{QA_SCOPE_COPY[option].label}</strong> —{" "}
                    {QA_SCOPE_COPY[option].description}
                  </label>
                </p>
              ))}
            </fieldset>
          </OnboardingAdminPanel>

          <OnboardingAdminPanel
            title="QA personas"
            description="The workers formally classified as test workers."
          >
            <p className="oba-notice-detail">
              This list is the server&apos;s answer and not a list kept here. A worker who is no
              longer classified as a test worker is refused at launch even if this page still
              shows him.
            </p>

            {directory.loading ? (
              <p className="oba-loading" role="status">
                Loading QA personas…
              </p>
            ) : null}

            {directory.error ? (
              <QaNotice error={directory.error} onRetry={directory.reload} />
            ) : null}

            {!directory.loading && !directory.error && workers.length === 0 ? (
              <div className="oba-notice oba-notice-empty">
                <p className="oba-notice-title">No test workers are classified.</p>
                <p className="oba-notice-detail">
                  A QA persona is created by formal classification, which is not done from this
                  screen.
                </p>
              </div>
            ) : null}

            {workers.length > 0 ? (
              <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
                <legend className="oba-label">Choose a test worker</legend>
                <table className="oba-table">
                  <thead>
                    <tr>
                      <th scope="col">Choose</th>
                      <th scope="col">Worker</th>
                      <th scope="col">Classification</th>
                      <th scope="col">Candidate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((worker) => (
                      <tr key={worker.candidateId}>
                        <td>
                          <input
                            type="radio"
                            name="qa-persona"
                            id={`qa-persona-${worker.candidateId}`}
                            value={worker.candidateId}
                            checked={selected === worker.candidateId}
                            disabled={busy}
                            onChange={() => setSelected(worker.candidateId)}
                          />
                        </td>
                        <td>
                          <label htmlFor={`qa-persona-${worker.candidateId}`}>
                            {worker.displayName}
                          </label>
                        </td>
                        <td>{worker.workerClassification}</td>
                        <td>{worker.candidateId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </fieldset>
            ) : null}
          </OnboardingAdminPanel>

          <OnboardingAdminPanel title="Launch">
            <p className="oba-notice-detail">
              {chosen && scope
                ? `Opens a new ${QA_SCOPE_COPY[scope].label} run for ${chosen.displayName} in a separate tab. Your staff session in this tab is not affected.`
                : "Choose a test worker and a launch scope above to enable the launch."}
            </p>
            <button
              type="button"
              className="oba-btn oba-btn-primary"
              disabled={!selected || !scope || busy}
              onClick={launch}
            >
              {launching
                ? "Launching…"
                : scope
                  ? `Launch ${QA_SCOPE_COPY[scope].label} as this test worker`
                  : "Launch as this test worker"}
            </button>
          </OnboardingAdminPanel>

          {failure ? (
            <OnboardingAdminPanel title="Launch outcome">
              <QaNotice error={failure} />
            </OnboardingAdminPanel>
          ) : null}

          {launched ? (
            <OnboardingAdminPanel
              title="Launched"
              description="A new run was created and this browser now holds that worker's own session."
            >
              <p className="oba-notice-detail">
                Your staff session in this tab is untouched: the worker session is stored under
                its own separate keys, exactly as a worker arriving from his own secure link
                would have it.
              </p>
              <OnboardingAdminFieldList>
                <OnboardingAdminField
                  label="Worker"
                  value={chosen?.displayName ?? launched.candidateId}
                />
                <OnboardingAdminField label="Invocation" value={launched.invocationId} />
                <OnboardingAdminField
                  label="Launch scope"
                  value={QA_SCOPE_COPY[launched.scope].label}
                  hint="Reported by the server for the run it actually composed."
                />
                <OnboardingAdminField
                  label="Entry link validity"
                  value={<OnboardingAdminTimestamp value={launched.expiresAt} />}
                  hint="The entry link was already used by this handoff. Entry links are single use."
                />
              </OnboardingAdminFieldList>
              {tabBlocked ? (
                <p className="oba-notice-detail">
                  This browser blocked the new tab. The run is ready either way - open it
                  yourself:
                </p>
              ) : null}
              <a
                className="oba-btn"
                href={launched.workerPath}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the worker experience
              </a>
            </OnboardingAdminPanel>
          ) : null}

          {/*
           * RE-ENTRY - a different act with a different purpose, and it says so plainly.
           *
           * IT REQUIRES NO LAUNCH SCOPE, which is visible in the button's `disabled` expression:
           * `scope` is absent from it. An operator recovering an expired session has already
           * chosen his scope - on the run he is halfway through - and asking him to choose one
           * again would imply this act composes something.
           */}
          <OnboardingAdminPanel
            title="Re-enter an existing test worker session"
            description="For a QA session that expired while work was already in progress."
          >
            <p className="oba-notice-detail">
              This creates NO new onboarding packet and no new onboarding run. It signs you in as
              the selected test worker again and nothing else: his existing onboarding is left
              exactly as it is, including anything already recorded, and no launch scope is needed
              because nothing is being composed.
            </p>
            <p className="oba-notice-detail">
              The worker lands on his normal onboarding home and the application finds his
              outstanding work itself, exactly as it would for a worker arriving from his own
              secure link. This screen does not choose a packet for him.
            </p>
            <p className="oba-notice-detail">
              {chosen
                ? `Signs this browser in as ${chosen.displayName} in a separate tab, with no new onboarding run. Your staff session in this tab is not affected.`
                : "Choose a test worker above to enable re-entry."}
            </p>
            <button
              type="button"
              className="oba-btn"
              disabled={!selected || busy}
              onClick={reEnter}
            >
              {reEntering ? "Re-entering…" : "Re-enter as this test worker"}
            </button>
          </OnboardingAdminPanel>

          {reEntryFailure ? (
            <OnboardingAdminPanel title="Re-entry outcome">
              <QaNotice error={reEntryFailure} act="RE_ENTRY" />
            </OnboardingAdminPanel>
          ) : null}

          {reEntered ? (
            <OnboardingAdminPanel
              title="Re-entered"
              description="No new run was created. This browser now holds that worker's own session."
            >
              <p className="oba-notice-detail">
                Your staff session in this tab is untouched: the worker session is stored under
                its own separate keys, exactly as a worker arriving from his own secure link
                would have it.
              </p>
              {/*
               * NO INVOCATION FIELD AND NO SCOPE FIELD, because there is neither one to report.
               * The re-entry result type has no shape to carry them, so this panel could not
               * render one even if a future edit asked it to.
               */}
              <OnboardingAdminFieldList>
                <OnboardingAdminField
                  label="Worker"
                  value={chosen?.displayName ?? reEntered.candidateId}
                />
                <OnboardingAdminField
                  label="New onboarding work created"
                  value="None"
                  hint="Re-entry authenticates the worker only. It creates no invocation and no packet."
                />
                <OnboardingAdminField
                  label="Entry link validity"
                  value={<OnboardingAdminTimestamp value={reEntered.expiresAt} />}
                  hint="The entry link was already used by this handoff. Entry links are single use."
                />
              </OnboardingAdminFieldList>
              {reEntryTabBlocked ? (
                <p className="oba-notice-detail">
                  This browser blocked the new tab. The session is ready either way - open the
                  worker&apos;s onboarding yourself:
                </p>
              ) : null}
              <a
                className="oba-btn"
                href={reEntered.workerPath}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the worker&apos;s onboarding
              </a>
            </OnboardingAdminPanel>
          ) : null}
        </div>
      )}
    </div>
  );
}
