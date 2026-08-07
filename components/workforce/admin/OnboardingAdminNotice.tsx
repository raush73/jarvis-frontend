"use client";

/**
 * Phase 2 - the one way the workspace reports a refusal, an empty state, or a wait.
 *
 * Every administrative surface renders failures through this component, so a refused
 * authorization looks the same whichever surface met it and cannot be mistaken for a broken
 * screen. The refusal CODE is shown deliberately: an operator who has to ask for a grant is
 * better served by the exact code than by a paraphrase.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import {
  classifyOnboardingAdminError,
  type ClassifiedOnboardingAdminError,
} from "./adminErrors";

export function OnboardingAdminErrorNotice({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const classified: ClassifiedOnboardingAdminError = classifyOnboardingAdminError(error);

  return (
    <div className="oba-notice oba-notice-error" role="alert">
      <p className="oba-notice-title">{classified.title}</p>
      <p className="oba-notice-detail">{classified.detail}</p>
      {classified.code ? (
        <p className="oba-notice-code">Refusal code: {classified.code}</p>
      ) : null}
      {classified.kind === "SESSION_REQUIRED" ? (
        <Link className="oba-btn" href="/login">
          {classified.actionLabel ?? "Go to sign in"}
        </Link>
      ) : null}
      {classified.retryable && onRetry ? (
        <button type="button" className="oba-btn" onClick={onRetry}>
          {classified.actionLabel ?? "Try again"}
        </button>
      ) : null}
    </div>
  );
}

/** A neutral, non-failure state: nothing to show, and nothing wrong. */
export function OnboardingAdminEmpty({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className="oba-notice oba-notice-empty">
      <p className="oba-notice-title">{title}</p>
      {detail ? <p className="oba-notice-detail">{detail}</p> : null}
      {children}
    </div>
  );
}

export function OnboardingAdminLoading({ label = "Loading" }: { label?: string }) {
  return (
    <p className="oba-loading" role="status">
      {label}…
    </p>
  );
}
