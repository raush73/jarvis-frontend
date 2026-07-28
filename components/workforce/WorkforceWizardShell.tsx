"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  WorkerSessionExpiredError,
  WorkforceApiError,
  syncStageCursor,
} from "@/lib/workforce/workforceApi";
import { clearWorkerSession, hasWorkerSession } from "@/lib/workforce/workerSession";
import {
  WIZARD_STEPS,
  WIZARD_STEP_COUNT,
  nextStepPath,
  previousStepPath,
  stepIndex,
} from "./wizardSteps";

type Props = {
  /** Slug of the screen being rendered (must exist in WIZARD_STEPS). */
  slug: string;
  /** Optional helper text under the heading. */
  intro?: ReactNode;
  /**
   * Persist this screen to the backend. Resolve to continue, or throw to stay put.
   * Omit on read-only screens.
   */
  onSave?: () => Promise<void>;
  /** Label for the forward button (default "Save & Continue"). */
  continueLabel?: string;
  /** Hide the forward button (screens that own their own primary action). */
  hideContinue?: boolean;
  /** Called instead of the default forward navigation. */
  onContinue?: () => void | Promise<void>;
  /** True while the screen is loading its own data. */
  loading?: boolean;
  /**
   * Whatever the screen's own load or in-screen actions threw, passed through unhandled.
   *
   * A screen must not absorb these: a stage that quietly renders blank after its data failed
   * to arrive looks healthy and invites the worker to overwrite real answers with nothing.
   */
  stageError?: unknown;
  children: ReactNode;
};

/**
 * Shared frame for every Workforce Application screen: progress rail, heading, error
 * surface, and save/continue navigation.
 *
 * Save and validation belong to the backend. This shell only relays what the backend
 * says; it applies no business rules of its own.
 */
export default function WorkforceWizardShell({
  slug,
  intro,
  onSave,
  continueLabel = "Save & Continue",
  hideContinue = false,
  onContinue,
  loading = false,
  stageError,
  children,
}: Props) {
  const router = useRouter();
  const index = stepIndex(slug);
  const step = WIZARD_STEPS[index];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [savedSessionError, setSavedSessionError] =
    useState<WorkerSessionExpiredError | null>(null);

  // A dead session takes over the screen wherever it surfaced - loading the stage or
  // trying to leave it.
  const sessionError =
    savedSessionError ??
    (stageError instanceof WorkerSessionExpiredError ? stageError : null);

  // Every screen requires a worker session; without one the wizard has no draft to
  // read or write, so send the worker back to the entry page.
  useEffect(() => {
    if (!hasWorkerSession()) router.replace("/workforce/apply");
  }, [router]);

  const back = previousStepPath(slug);
  const forward = nextStepPath(slug);

  const handleContinue = useCallback(async () => {
    setBusy(true);
    setError(null);
    setFieldErrors([]);
    try {
      if (onSave) await onSave();

      // Advance the backend stage cursor when this screen was the last one of its
      // stage, so a resumed application reflects real progress.
      const nextStep = WIZARD_STEPS[index + 1];
      if (nextStep && step && nextStep.stage !== step.stage) {
        await syncStageCursor(nextStep.stage);
      }

      if (onContinue) {
        await onContinue();
      } else if (forward) {
        router.push(forward);
      }
    } catch (err) {
      if (err instanceof WorkerSessionExpiredError) {
        // Explain what happened in place. Bouncing to the entry page instead reads as
        // "your work is gone" and hides the reason it ended.
        setSavedSessionError(err);
        return;
      }
      if (err instanceof WorkforceApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }, [forward, index, onContinue, onSave, router, step]);

  // Abandoning an unreachable application is deliberate, so the stale identifier goes too.
  const startOver = useCallback(() => {
    clearWorkerSession();
    router.replace("/workforce/apply");
  }, [router]);

  // A stage that failed to load is reported here rather than by the screen, so a failed
  // load can never be mistaken for a stage the worker simply has not filled in.
  const stageMessage =
    sessionError || stageError == null
      ? null
      : stageError instanceof WorkforceApiError
        ? stageError.message
        : "We could not load this step. Please try again.";

  const shownError = sessionError ? null : (error ?? stageMessage);
  const shownFieldErrors = error ? fieldErrors : [];

  const percent = Math.round(((index + 1) / WIZARD_STEP_COUNT) * 100);

  return (
    <div className="wf-shell">
      <header className="wf-head">
        <p className="wf-eyebrow">Workforce Application</p>
        <h1 className="wf-title">{step?.title ?? "Application"}</h1>
        <p className="wf-progress-text">
          Step {index + 1} of {WIZARD_STEP_COUNT}
        </p>
        <div className="wf-progress-track" aria-hidden="true">
          <div className="wf-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <ol className="wf-rail">
          {WIZARD_STEPS.map((s, i) => (
            <li
              key={s.slug}
              className={`wf-rail-item ${
                i < index ? "is-done" : i === index ? "is-current" : "is-upcoming"
              }`}
            >
              {s.label}
            </li>
          ))}
        </ol>
      </header>

      <div className="wf-card">
        {sessionError ? (
          <div className="wf-error" role="alert">
            <p className="wf-error-title">
              {sessionError.expired
                ? "Your secure application session expired."
                : "Your secure application session is no longer valid."}
            </p>
            <p>
              {sessionError.expired
                ? "The secure session protecting your information timed out, so this step could not be loaded or saved."
                : "This browser is no longer holding a session we can accept, so this step could not be loaded or saved."}{" "}
              Answers you already saved are kept on our servers, but this application
              cannot be reopened from this device. Starting again begins a new
              application.
            </p>
            <div className="wf-btn-row" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="wf-btn wf-btn-primary"
                onClick={startOver}
              >
                Start a new application
              </button>
            </div>
          </div>
        ) : (
          <>
            {intro ? <div className="wf-intro">{intro}</div> : null}

            {shownError ? (
              <div className="wf-error" role="alert">
                <p className="wf-error-title">{shownError}</p>
                {shownFieldErrors.length > 0 ? (
                  <ul className="wf-error-list">
                    {shownFieldErrors.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {loading ? <p className="wf-loading">Loading.</p> : children}
          </>
        )}
      </div>

      {sessionError ? null : (
        <div className="wf-actions">
          <button
            type="button"
            className="wf-btn wf-btn-ghost"
            onClick={() => back && router.push(back)}
            disabled={!back || busy}
          >
            Back
          </button>
          <p className="wf-save-note">
            Your progress is saved each time you continue.
          </p>
          {hideContinue ? null : (
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              onClick={handleContinue}
              disabled={busy || loading}
            >
              {busy ? "Saving." : continueLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
