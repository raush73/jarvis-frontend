"use client";

/**
 * Phase 17 S3 - the worker's own page for ONE PRE_DISPATCH job.
 *
 * Governance: VETTING_SYSTEM.md PRE_DISPATCH WORKER COMMUNICATION, "Worker Experience";
 * VETTING_BUILD_CHECKLIST.md PHASE 17 slice S3.
 *
 * IT ASKS ONE QUESTION AND OFFERS TWO ANSWERS. "Are you still interested in this job?" with
 * "Confirm" and "Remove me from this job". It is not an onboarding dashboard, not a
 * job board, and not a place to manage the worker's other job interests - that last is a
 * separately governed later slice, and building it here early would mean building a control the
 * server deliberately refuses to honour.
 *
 * MOBILE FIRST, BECAUSE THE WORKER IS ON A PHONE. This page is reached from a text-message-style
 * secure link, so it is a single narrow column, sized for one thumb, with type large enough to
 * read outdoors and buttons that cannot be mis-tapped. There is no sidebar, no navigation
 * chrome, no staff shell and nothing to scroll past before the question.
 *
 * IT SPEAKS THE WORKER'S LANGUAGE, NOT RECRUITING'S. No lane names, no request states, no
 * "PRE_DISPATCH", no "candidacy", no "vetting". The question and both answers come from the
 * SERVER, so the governed wording has one source and this page cannot drift from it.
 *
 * IT DISPLAYS ONLY WHAT IT IS SENT, WHICH IS THE POINT. The customer's identity and all
 * commercial terms are withheld by the backend projection, so there is nothing here to hide and
 * no forbidden value in props, page state, a data attribute, a query string or a log. This page
 * is NOT the confidentiality boundary and must never become the only thing standing between a
 * worker and a customer name.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getPreDispatchWorkerPrompt,
  submitPreDispatchWorkerResponse,
  PreDispatchLinkError,
  type PreDispatchLinkFailure,
  type PreDispatchSafeJob,
  type PreDispatchWorkerDecision,
  type PreDispatchWorkerPrompt,
} from "@/lib/recruiting/preDispatchWorkerResponseApi";

/** What the worker is shown for each way a link can fail. Honest, and free of internals. */
const FAILURE_COPY: Record<PreDispatchLinkFailure, { title: string; body: string }> = {
  EXPIRED: {
    title: "This link has expired",
    body: "Secure links expire 24 hours after they are sent. Please contact your recruiter and ask for a new link.",
  },
  ALREADY_USED: {
    title: "This link has already been used",
    body: "Your answer was already recorded. If you need to change it, please contact your recruiter.",
  },
  NOT_ACTIONABLE: {
    title: "This request is closed",
    body: "This job is no longer waiting on an answer from you. Please contact your recruiter if you have questions.",
  },
  INVALID: {
    title: "This link does not work",
    body: "The link may be incomplete or may have been replaced. Please contact your recruiter and ask for a new link.",
  },
  FAILED: {
    title: "Something went wrong",
    body: "We could not load this page. Please check your connection and try again.",
  },
};

/** Format a decimal string as currency without introducing floating-point error in the value. */
function money(value: string | null): string | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The safe job facts, as labelled rows.
 *
 * Built from the allowlisted projection only. A field with no authoritative value is OMITTED
 * rather than rendered as "TBD" or "Unknown", because inventing a placeholder would tell the
 * worker something Jarvis does not actually know.
 */
function jobFacts(job: PreDispatchSafeJob): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  const where = [job.city, job.state].filter(Boolean).join(", ");
  if (where) rows.push({ label: "Location", value: where });

  const pay = money(job.payRate);
  if (pay) rows.push({ label: "Your pay rate", value: `${pay} per hour` });

  const perDiem = money(job.perDiemDailyRate);
  if (perDiem) {
    const days = job.perDiemDaysPerWeek ? ` (${job.perDiemDaysPerWeek} days per week)` : "";
    rows.push({ label: "Your per diem", value: `${perDiem} per day${days}` });
  }

  const start = shortDate(job.anticipatedStartDate);
  if (start) rows.push({ label: "Expected start", value: start });

  if (job.estimatedDurationWeeks) {
    rows.push({
      label: "Expected length",
      value: `About ${job.estimatedDurationWeeks} weeks`,
    });
  } else {
    const end = shortDate(job.anticipatedEndDate);
    if (end) rows.push({ label: "Expected through", value: end });
  }

  if (job.estimatedRegHoursPerWeek) {
    const ot = job.estimatedOtHoursPerWeek && Number(job.estimatedOtHoursPerWeek) > 0
      ? ` plus about ${job.estimatedOtHoursPerWeek} hours overtime`
      : "";
    rows.push({
      label: "Expected hours",
      value: `About ${job.estimatedRegHoursPerWeek} hours per week${ot}`,
    });
  }

  if (job.estimatedWorkDaysPerWeek) {
    rows.push({ label: "Work days", value: `${job.estimatedWorkDaysPerWeek} days per week` });
  }

  return rows;
}

type Phase =
  | { kind: "LOADING" }
  | { kind: "READY"; prompt: PreDispatchWorkerPrompt }
  | { kind: "SUBMITTING"; prompt: PreDispatchWorkerPrompt; decision: PreDispatchWorkerDecision }
  | { kind: "DONE"; decision: PreDispatchWorkerDecision; alreadyRecorded: boolean }
  | { kind: "FAILED"; failure: PreDispatchLinkFailure };

/**
 * The route's entry point.
 *
 * A thin wrapper whose only job is the Suspense boundary that Next requires around
 * `useSearchParams`, following `app/workforce/apply/page.tsx` - the other public worker surface
 * that reads a `?token=` from the query string. Without it, `next build` fails to prerender this
 * route rather than failing at runtime, so the boundary is a build requirement and not a
 * stylistic choice.
 *
 * The fallback is `null` rather than a copy of the LOADING state below, matching
 * `app/friday/page.tsx`. The reason is styled-jsx: `<style jsx>` is declared inside
 * `JobInterestExperience`, so its class names are scoped to that component and markup rendered
 * here would arrive UNSTYLED - a flash of black-on-white text before the real card appears.
 * Rendering nothing for that instant is the better worker experience; the component's own
 * LOADING state covers the wait that the worker actually perceives.
 */
export default function WorkforceJobInterestPage() {
  return (
    <Suspense fallback={null}>
      <JobInterestExperience />
    </Suspense>
  );
}

function JobInterestExperience() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [phase, setPhase] = useState<Phase>({ kind: "LOADING" });

  useEffect(() => {
    if (!token) {
      setPhase({ kind: "FAILED", failure: "INVALID" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const prompt = await getPreDispatchWorkerPrompt(token);
        if (cancelled) return;
        setPhase({ kind: "READY", prompt });
      } catch (err) {
        if (cancelled) return;
        setPhase({
          kind: "FAILED",
          failure: err instanceof PreDispatchLinkError ? err.failure : "FAILED",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const answer = useCallback(
    async (decision: PreDispatchWorkerDecision) => {
      if (phase.kind !== "READY") return;
      const { prompt } = phase;
      setPhase({ kind: "SUBMITTING", prompt, decision });

      try {
        const outcome = await submitPreDispatchWorkerResponse(token, decision);
        setPhase({
          kind: "DONE",
          // The SERVER's recorded outcome decides what the worker is told, not the button they
          // pressed: a second link on an already-answered request reports the standing answer.
          decision:
            outcome.interestResult === "CONTINUED_INTEREST_CONFIRMED" ? "YES" : "NO",
          alreadyRecorded: outcome.alreadyRecorded,
        });
      } catch (err) {
        setPhase({
          kind: "FAILED",
          failure: err instanceof PreDispatchLinkError ? err.failure : "FAILED",
        });
      }
    },
    [phase, token],
  );

  return (
    <main className="ji-page">
      <div className="ji-card">
        {/*
          WHO IS ASKING. A worker reaches this page from a text-message link with no address bar
          worth reading and no other signal of who wants an answer, so naming the sender is
          identification rather than branding. It sits outside the phase switch deliberately: it
          must be present on the question, on both answers, and on every refused link, because a
          worker deciding whether a strange link is a scam is most likely to be looking at the
          states where something has gone wrong.
        */}
        <p className="ji-brand">Millwrights4Hire - MW4H</p>

        {phase.kind === "LOADING" && <p className="ji-muted">Loading…</p>}

        {phase.kind === "FAILED" && (
          <>
            <h1 className="ji-title">{FAILURE_COPY[phase.failure].title}</h1>
            <p className="ji-body">{FAILURE_COPY[phase.failure].body}</p>
          </>
        )}

        {phase.kind === "DONE" && (
          <>
            {/*
              YES CONFIRMS INTEREST AND NOTHING MORE. The worker is not dispatched, assigned,
              placed or hired by answering, so this state says only what was recorded. Wording
              like "you're still on this job" would read as a commitment Jarvis has not made.
            */}
            <h1 className="ji-title">
              {phase.decision === "YES"
                ? "Thank you — your interest is confirmed."
                : "You've been removed from this job posting"}
            </h1>
            <p className="ji-body">
              {phase.decision === "YES"
                ? "We've recorded that you're still interested in this job."
                : "We've recorded that you're no longer interested in this job posting. This does not affect any other job you're being considered for."}
            </p>
            {phase.alreadyRecorded && (
              <p className="ji-muted">This answer was already on file.</p>
            )}
          </>
        )}

        {(phase.kind === "READY" || phase.kind === "SUBMITTING") && (
          <>
            {/*
              THE HEADING ASKS; IT DOES NOT ANNOUNCE. The worker has not been dispatched,
              assigned, placed or hired, so nothing here may read as news about a job they
              already hold. "An update on your job" did exactly that.
            */}
            <h1 className="ji-title">
              {phase.prompt.workerFirstName
                ? `${phase.prompt.workerFirstName}, confirm you're still interested.`
                : "Confirm you're still interested."}
            </h1>

            <p className="ji-role">
              {phase.prompt.job.tradeName}
              {phase.prompt.job.specializationName
                ? ` — ${phase.prompt.job.specializationName}`
                : ""}
            </p>

            <dl className="ji-facts">
              {jobFacts(phase.prompt.job).map((row) => (
                <div className="ji-fact" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>

            {phase.prompt.actionable ? (
              <>
                <h2 className="ji-question">{phase.prompt.question}</h2>

                <div className="ji-actions">
                  <button
                    type="button"
                    className="ji-btn ji-btn-yes"
                    disabled={phase.kind === "SUBMITTING"}
                    onClick={() => answer("YES")}
                  >
                    {phase.kind === "SUBMITTING" && phase.decision === "YES"
                      ? "Saving…"
                      : phase.prompt.yesLabel}
                  </button>

                  <button
                    type="button"
                    className="ji-btn ji-btn-no"
                    disabled={phase.kind === "SUBMITTING"}
                    onClick={() => answer("NO")}
                  >
                    {phase.kind === "SUBMITTING" && phase.decision === "NO"
                      ? "Saving…"
                      : phase.prompt.noLabel}
                  </button>
                </div>

                {/* The Owner-governed sentence, rendered from the server's own value. */}
                <p className="ji-notice">{phase.prompt.expirationNotice}</p>
              </>
            ) : (
              <p className="ji-body">
                {phase.prompt.recordedAnswer?.interestResult === "WITHDRAWAL_REQUESTED"
                  ? "You asked to be removed from this job."
                  : phase.prompt.recordedAnswer
                    ? "You've already told us you're still interested in this job."
                    : "This job is no longer waiting on an answer from you."}
              </p>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        /* MOBILE FIRST. The base rules ARE the phone layout; the only media query widens the
           card on a desktop, rather than the other way round. */
        .ji-page {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #f4f5f7;
          padding: 16px 12px 48px;
        }
        .ji-card {
          width: 100%;
          max-width: 34rem;
          background: #ffffff;
          border: 1px solid #d4d7dd;
          border-radius: 12px;
          padding: 20px 18px 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        /* Identification, not a marketing banner: one quiet line that never competes with the
           question for the top of a phone screen. */
        .ji-brand {
          margin: 0 0 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e6e8ec;
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #2c3038;
        }
        .ji-title {
          margin: 0 0 12px;
          font-size: 1.375rem;
          line-height: 1.3;
          font-weight: 700;
          color: #14161a;
        }
        .ji-role {
          margin: 0 0 16px;
          font-size: 1.0625rem;
          font-weight: 600;
          color: #2c3038;
        }
        .ji-body {
          margin: 0 0 12px;
          font-size: 1rem;
          line-height: 1.55;
          color: #2c3038;
        }
        .ji-muted {
          margin: 8px 0 0;
          font-size: 0.9375rem;
          color: #5c626d;
        }
        .ji-facts {
          margin: 0 0 20px;
          padding: 0;
          border-top: 1px solid #e6e8ec;
        }
        .ji-fact {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #e6e8ec;
        }
        .ji-fact dt {
          font-size: 0.9375rem;
          color: #5c626d;
        }
        .ji-fact dd {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #14161a;
          text-align: right;
        }
        .ji-question {
          margin: 0 0 16px;
          font-size: 1.1875rem;
          line-height: 1.35;
          font-weight: 700;
          color: #14161a;
        }
        /* Stacked full-width buttons: one thumb, no mis-taps, and a 48px minimum target. */
        .ji-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ji-btn {
          width: 100%;
          min-height: 52px;
          padding: 14px 16px;
          font-size: 1.0625rem;
          font-weight: 700;
          border-radius: 10px;
          border: 2px solid transparent;
          cursor: pointer;
        }
        .ji-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .ji-btn-yes {
          background: #1c6b3c;
          color: #ffffff;
          border-color: #175832;
        }
        /* Solid red on white lettering, mirroring the green Confirm exactly in size, weight and
           construction. Withdrawing is a real choice a worker is entitled to make plainly, and an
           outlined button read as the lesser, hesitant option next to a solid green one. */
        .ji-btn-no {
          background: #a01b1b;
          color: #ffffff;
          border-color: #7f1515;
        }
        .ji-notice {
          margin: 18px 0 0;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #5c626d;
        }
        @media (min-width: 640px) {
          .ji-page {
            padding: 40px 24px 64px;
          }
          .ji-card {
            padding: 28px 28px 32px;
          }
        }
      `}</style>
    </main>
  );
}
