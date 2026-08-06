"use client";

/**
 * Phase 1 - the single error surface.
 *
 * Every runtime failure renders through here so the worker sees one consistent shape:
 * what happened, what it means for his answers, and what to do next. Field-level codes the
 * module's validator returned are listed in place rather than replacing the screen, because
 * a correction is not a failure of the runtime.
 */

import { useRouter } from "next/navigation";
import { ONBOARDING_HOME } from "@/lib/workforce/onboardingRuntimeApi";
import {
  classifyOnboardingError,
  isSessionFailure,
  type ClassifiedOnboardingError,
} from "./runtimeErrors";

type Props = {
  error: unknown;
  /** True when the failure came from a save, which changes the explanation. */
  saving?: boolean;
  /** Retry the operation that failed. Omit where retrying makes no sense. */
  onRetry?: () => void;
};

export function OnboardingErrorNotice({ error, saving = false, onRetry }: Props) {
  const router = useRouter();
  if (error == null) return null;

  const classified: ClassifiedOnboardingError = classifyOnboardingError(error, {
    saving,
  });

  const action = (() => {
    if (isSessionFailure(classified.kind)) {
      return (
        <a className="wf-btn wf-btn-primary" href={ONBOARDING_HOME}>
          {classified.actionLabel}
        </a>
      );
    }
    if (classified.retryable && onRetry) {
      return (
        <button type="button" className="wf-btn wf-btn-primary" onClick={onRetry}>
          {classified.actionLabel ?? "Try again"}
        </button>
      );
    }
    if (classified.actionLabel) {
      return (
        <button
          type="button"
          className="wf-btn wf-btn-secondary"
          onClick={() => router.push(ONBOARDING_HOME)}
        >
          {classified.actionLabel}
        </button>
      );
    }
    return null;
  })();

  return (
    <div className="wf-error" role="alert" data-error-kind={classified.kind}>
      <p className="wf-error-title">{classified.title}</p>
      <p>{classified.detail}</p>
      {classified.fieldErrors.length > 0 ? (
        <ul className="wf-error-list">
          {classified.fieldErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      {action ? (
        <div className="wf-btn-row" style={{ marginTop: 16 }}>
          {action}
        </div>
      ) : null}
    </div>
  );
}

export default OnboardingErrorNotice;
