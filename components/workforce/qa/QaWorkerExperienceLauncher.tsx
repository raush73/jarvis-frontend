"use client";

/**
 * QA-L3 - the staff QA persona launcher.
 *
 * ONE SCREEN WITH ONE ACT: choose a formally TEST-classified worker, and open a NEW real Payroll
 * Payment onboarding run as that worker in a separate tab. It is a QA facility and says so; it is
 * not a production worker tool and contains none of one.
 *
 * WHAT IS DELIBERATELY ABSENT, and none of it may be added here:
 *
 *  - No production-worker search, lookup, or free-text identifier field. The only workers this
 *    screen can name are the ones QA-L2's TEST directory returned, and the only input on it is a
 *    radio over that list. There is nothing to type an arbitrary candidate into.
 *  - No module chooser, no `COMPLETE_PACKET`, no scope parameter. The scope is QA-L2's constant;
 *    this screen DISPLAYS it and never sends one.
 *  - No invocation field, no packet field, no resume, reopen or rebind control. Every launch is a
 *    NEW run, which is the only thing the backend offers.
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
  listQaTestWorkers,
} from "@/lib/workforce/qaWorkerExperienceApi";
import {
  launchQaWorkerHandoff,
  type QaWorkerHandoff,
} from "@/lib/workforce/qaWorkerHandoff";
import { useOnboardingAdminResource } from "@/components/workforce/admin/useOnboardingAdminResource";
import {
  OnboardingAdminField,
  OnboardingAdminFieldList,
  OnboardingAdminPanel,
  OnboardingAdminTimestamp,
} from "@/components/workforce/admin/panels/DetailPanel";
import { classifyQaLauncherError } from "./qaLauncherErrors";
import { openQaWorkerTab } from "./qaWorkerTab";

/**
 * What V1 launches, in an operator's words.
 *
 * DISPLAY TEXT AND NOT A REQUEST FIELD. The authoritative scope is the `moduleScope` QA-L2 returns,
 * which this screen shows back once a run exists; this label exists so the operator knows what he
 * is about to open before he opens it.
 */
const QA_LAUNCH_SCOPE_LABEL = "Payroll Payment";

function QaNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const notice = classifyQaLauncherError(error);

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
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<QaWorkerHandoff | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [tabBlocked, setTabBlocked] = useState(false);

  // A second click in the same tick would read a state flag that has not flushed yet. The ref is
  // the actual guard against a duplicate launch; the disabled button is the courtesy.
  const inFlight = useRef(false);

  const directory = useOnboardingAdminResource(() => listQaTestWorkers(), [], {
    enabled: session.ready && session.authenticated && mayLaunch,
  });

  const workers = directory.data ?? [];
  const chosen = workers.find((worker) => worker.candidateId === selected) ?? null;

  const launch = () => {
    if (inFlight.current) return;
    const candidateId = selected;
    if (!candidateId) return;

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
        const handoff = await launchQaWorkerHandoff(candidateId);
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
            browser that worker&apos;s own session in a separate tab. This is a quality assurance
            facility, not a production worker tool: no production worker can be reached from it,
            and nothing here is a shortcut around a worker&apos;s normal secure entry.
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
            description="Fixed by the server. It is not chosen here."
          >
            <p className="oba-notice-detail">
              Version 1 launches <strong>{QA_LAUNCH_SCOPE_LABEL}</strong> only, and always as a
              NEW run. No other module, no full packet, and no earlier run can be requested from
              this screen.
            </p>
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
                            disabled={launching}
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
              {chosen
                ? `Opens a new ${QA_LAUNCH_SCOPE_LABEL} run for ${chosen.displayName} in a separate tab. Your staff session in this tab is not affected.`
                : "Choose a test worker above to enable the launch."}
            </p>
            <button
              type="button"
              className="oba-btn oba-btn-primary"
              disabled={!selected || launching}
              onClick={launch}
            >
              {launching
                ? "Launching…"
                : `Launch ${QA_LAUNCH_SCOPE_LABEL} as this test worker`}
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
                <OnboardingAdminField label="Module scope" value={launched.moduleScope} />
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
        </div>
      )}
    </div>
  );
}
