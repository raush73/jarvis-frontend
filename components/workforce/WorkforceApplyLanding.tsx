"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  WorkforceApiError,
  consumeWorkforceLink,
  getWizardState,
  startApplication,
} from "@/lib/workforce/workforceApi";
import { hasWorkerSession } from "@/lib/workforce/workerSession";
import { WIZARD_STEPS, stepPath } from "@/components/workforce/wizardSteps";

/**
 * Workforce Application landing - the single public entry point.
 *
 * Workers arriving from RoadTechs, Facebook, Craigslist, the company website, or a
 * recruiter-issued link all land here and all enter the SAME Workforce Application.
 * There is one application type and one workflow.
 *
 * A `?token=` query parameter is consumed as a recruiter-issued Workforce link, which
 * resumes the application already bound to that worker. Everyone else starts a new one.
 * Reading that parameter is why this lives behind a Suspense boundary in the route.
 */
export default function WorkforceApplyLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkToken = searchParams.get("token");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumable, setResumable] = useState(false);
  const [checking, setChecking] = useState(true);

  const firstStep = stepPath(WIZARD_STEPS[0].slug);

  // An existing session means an application is already in progress in this browser.
  // A submitted one goes straight to its receipt; there is nothing left to edit.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!hasWorkerSession()) {
        if (!cancelled) setChecking(false);
        return;
      }
      try {
        const state = await getWizardState();
        if (cancelled) return;
        if (state.status === "SUBMITTED") {
          router.replace("/workforce/apply/receipt");
          return;
        }
        setResumable(true);
      } catch {
        // A stale or rejected session simply means "start fresh".
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const begin = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (linkToken) {
        const result = await consumeWorkforceLink(linkToken);
        if (!result.authenticated) {
          setError(
            "That application link is no longer valid. You can start a new application below.",
          );
          setBusy(false);
          return;
        }
      } else {
        await startApplication();
      }
      router.push(firstStep);
    } catch (err) {
      setError(
        err instanceof WorkforceApiError
          ? err.message
          : "We could not start your application. Please try again.",
      );
      setBusy(false);
    }
  }, [firstStep, linkToken, router]);

  return (
    <div className="wf-landing">
      <div className="wf-landing-hero">
        <p className="wf-eyebrow">Workforce Application</p>
        <h1 className="wf-landing-title">Apply to join our workforce</h1>
        <p className="wf-landing-lead">
          Complete one application to be considered for craft work across our
          projects. It takes about 15 to 20 minutes. Your progress is saved as you
          go, so you can finish in one sitting or come back to it.
        </p>

        <h2 className="wf-section-title">What you will need</h2>
        <ul className="wf-list">
          <li>Your legal name, date of birth, and Social Security number</li>
          <li>Current address, phone number, and email address</li>
          <li>Your primary trade and your employment history</li>
          <li>Any certifications or licenses you hold</li>
          <li>The tools and personal protective equipment you can provide</li>
        </ul>

        {error ? (
          <div className="wf-error" role="alert">
            <p className="wf-error-title">{error}</p>
          </div>
        ) : null}

        {resumable ? (
          <>
            <div className="wf-notice">
              You already have an application in progress on this device. You can pick
              up where you left off.
            </div>
            <div className="wf-btn-row">
              <button
                type="button"
                className="wf-btn wf-btn-primary"
                onClick={() => router.push(firstStep)}
              >
                Resume my application
              </button>
            </div>
          </>
        ) : (
          <div className="wf-btn-row">
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              onClick={begin}
              disabled={busy || checking}
            >
              {busy
                ? "Starting."
                : linkToken
                  ? "Continue my application"
                  : "Start my application"}
            </button>
          </div>
        )}

        <p className="wf-hint" style={{ marginTop: 18 }}>
          Your Social Security number is encrypted the moment you submit it and is
          never shown back to you in full.
        </p>
      </div>
    </div>
  );
}
