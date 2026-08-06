"use client";

/**
 * Phase 1 - worker session continuity.
 *
 * Session expiry is ANTICIPATED rather than discovered. A worker part-way through a section
 * should never have the first sign of an expiring session be a failed save.
 *
 * Three behaviours, in order:
 *
 *  1. A warning appears before the session ends, while there is still time to act.
 *  2. Recovery is in place. The worker re-enters through the governed scoped-link mechanism
 *     and returns to the same module and step; nothing about the module is restarted.
 *  3. Nothing is discarded. Answers already saved are on the server, and answers not yet
 *     saved stay in the runtime container, which no session event clears.
 *
 * Renewal itself is not implemented here: the backend slides the session on every
 * authenticated response, and `onboardingWorkerFetch` absorbs the reissued token. This
 * component watches the result of that mechanism rather than adding a second one.
 */

import { useCallback, useEffect, useState } from "react";
import {
  WORKER_SESSION_SYNC_EVENT,
  getWorkerSession,
} from "@/lib/workforce/workerSession";
import { getOnboardingSession } from "@/lib/workforce/onboardingRuntimeApi";
import { useOnboardingRuntime } from "./OnboardingRuntimeContext";

/** How long before expiry the worker is warned. */
const WARN_BEFORE_MS = 5 * 60 * 1000;
const POLL_MS = 30 * 1000;

type Phase = "OK" | "EXPIRING" | "EXPIRED";

export function OnboardingSessionWatch() {
  const { reload } = useOnboardingRuntime();
  const [phase, setPhase] = useState<Phase>("OK");
  const [checking, setChecking] = useState(false);

  const evaluate = useCallback(() => {
    const session = getWorkerSession();
    if (!session) {
      setPhase("EXPIRED");
      return;
    }
    const remaining = Date.parse(session.expiresAt) - Date.now();
    setPhase(remaining <= WARN_BEFORE_MS ? "EXPIRING" : "OK");
  }, []);

  useEffect(() => {
    evaluate();
    const timer = setInterval(evaluate, POLL_MS);
    window.addEventListener(WORKER_SESSION_SYNC_EVENT, evaluate);
    return () => {
      clearInterval(timer);
      window.removeEventListener(WORKER_SESSION_SYNC_EVENT, evaluate);
    };
  }, [evaluate]);

  /**
   * Touch the server, which slides the session on any authenticated response and lets the
   * client absorb the reissued token. Recovery therefore happens without leaving the
   * screen the worker is on.
   */
  const keepAlive = useCallback(async () => {
    setChecking(true);
    try {
      await getOnboardingSession();
      await reload();
    } catch {
      // The refusal already cleared the credential; the next evaluation reports EXPIRED
      // and the worker is told how to come back.
    } finally {
      setChecking(false);
      evaluate();
    }
  }, [evaluate, reload]);

  if (phase === "OK") return null;

  if (phase === "EXPIRED") {
    return (
      <div className="ob-session-notice is-expired" role="alert">
        <p className="wf-error-title">Your secure session has ended.</p>
        <p>
          Everything you saved is safely on our servers, and anything still on this screen
          is still here. Open your onboarding link again and you will come back to exactly
          this point.
        </p>
      </div>
    );
  }

  return (
    <div className="ob-session-notice is-expiring" role="status" aria-live="polite">
      <p className="wf-error-title">Your secure session is about to time out.</p>
      <p>
        Staying signed in keeps you on this question. Nothing you have entered will be
        lost either way.
      </p>
      <div className="wf-btn-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="wf-btn wf-btn-primary wf-btn-sm"
          onClick={() => void keepAlive()}
          disabled={checking}
        >
          {checking ? "Checking." : "Stay signed in"}
        </button>
      </div>
    </div>
  );
}

export default OnboardingSessionWatch;
