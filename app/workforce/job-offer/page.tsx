"use client";

/**
 * Gate JO-2 - the worker's own page for ONE Job Offer.
 *
 * Governance: VETTING_SYSTEM.md, MW4H SELECTION, JOB OFFER AND ACTUAL DISPATCH.
 *
 * IT IS A DIFFERENT PAGE FROM THE PRE_DISPATCH ONE, DELIBERATELY. That page asks "are you still
 * interested in this job?" while the worker is one of several candidates. This one says MW4H has
 * SELECTED them and asks for a decision that creates a real assignment and ends their other job
 * interests. Governance forbids conflating the two questions, and reusing one page for both would
 * have meant one set of copy trying to be true of both.
 *
 * IT ANNOUNCES, THEN ASKS. "You've been selected for this job" is news the worker can act on,
 * which is exactly what PRE_DISPATCH copy may never say. The two answers - Accept Job Offer and
 * Decline Job Offer - come from the SERVER, so the governed wording has one source and this page
 * cannot drift from it.
 *
 * THE CONSEQUENCE IS SHOWN BEFORE THE DECISION, NOT AFTER IT. Accepting removes the worker from
 * consideration for their other active postings, so those postings are listed above the buttons
 * where the worker cannot miss them. They are DISPLAY ONLY: there is no toggle, no ranking and no
 * preference control, because the server serves none and would refuse to act on one. Building that
 * here early would mean building a control the backend deliberately does not honour.
 *
 * MOBILE FIRST, BECAUSE THE WORKER IS ON A PHONE. This page is reached from a text-message-style
 * secure link, so it is a single narrow column, sized for one thumb, with type large enough to read
 * outdoors and buttons that cannot be mis-tapped. There is no sidebar, no navigation chrome, no
 * staff shell and nothing to scroll past before the offer.
 *
 * IT DISPLAYS ONLY WHAT IT IS SENT, WHICH IS THE POINT. The customer's identity and all commercial
 * terms are withheld by the backend projection, so there is nothing here to hide and no forbidden
 * value in props, page state, a data attribute, a query string or a log. This page is NOT the
 * confidentiality boundary and must never become the only thing standing between a worker and a
 * customer name.
 *
 * IT CLAIMS NOTHING WAS SENT. JO-2 wires no delivery of any kind, so the paperwork sentence is
 * phrased as what FOLLOWS acceptance and never as a document that is on its way.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  getJobOfferPrompt,
  submitJobOfferDecision,
  JobOfferLinkError,
  type JobOfferDecision,
  type JobOfferLinkFailure,
  type JobOfferPrompt,
  type JobOfferSafeJob,
} from "@/lib/recruiting/jobOfferApi";

/**
 * What the worker is shown for each way a link can fail. Honest, and free of internals.
 *
 * NOTE WHAT NONE OF THESE SAY. No expired or broken link is described as having cancelled,
 * declined or closed the job offer, because a link expiring is not a business event: the offer
 * remains open and a recruiter can issue a new link for it.
 */
const FAILURE_COPY: Record<JobOfferLinkFailure, { title: string; body: string }> = {
  EXPIRED: {
    title: "This link has expired",
    // GATE JO-2C CORRECTED TWO FALSE CLAIMS IN THIS SENTENCE. It said links expire "24 hours after
    // they are SENT": Jarvis implements no delivery, so nothing is ever sent, and the lifetime is no
    // longer a fixed 24 hours - a credential now lasts as long as the offer's own response deadline.
    // Neither number nor verb is restated here, because the honest thing a worker needs is what to do
    // next, and any duration written here would be a third place for the real rule to drift from.
    body: "This secure link is no longer valid. If the job offer is still open, please contact your recruiter and ask for a new link.",
  },
  ALREADY_USED: {
    title: "This link has already been used",
    body: "Your decision on this job offer was already recorded. If you need to change it, please contact your recruiter.",
  },
  NOT_ACTIONABLE: {
    title: "This job offer is closed",
    body: "This job offer is no longer waiting on a decision from you. Please contact your recruiter if you have questions.",
  },
  /**
   * GATE JO-2C. The response deadline passed with no answer.
   *
   * IT DOES NOT SAY, IMPLY OR HINT THAT THE WORKER DECLINED. That is the entire reason `LAPSED` exists
   * as a state and as a screen. No delivery system exists, so Jarvis cannot even establish that this
   * worker was ever reached, and describing silence as a refusal would attribute a choice to them that
   * they may never have had the chance to make.
   *
   * IT IS ALSO NOT THE EXPIRED-LINK SCREEN. There the credential died and the offer may still be open;
   * here the OFFER closed. Telling a worker to ask for a new link would send them to a recruiter for
   * something that no longer exists.
   */
  LAPSED: {
    title: "The deadline to respond has passed",
    body: "This job offer needed an answer by a set time, and that time has now passed, so it is no longer available. Nothing has been recorded as your decision. Please contact your recruiter if you are still interested in work.",
  },
  /**
   * GATE JO-2C. MW4H withdrew the offer.
   *
   * THE GOVERNED SENTENCE, AND NO REASON. `rescindedReason` is internal, is not selected by any
   * worker-facing query, and is never disclosed here. The worker is also told nothing about how many
   * other workers were offered the job or anything else about MW4H's staffing decisions.
   *
   * AND NOTHING SUGGESTING FAULT. It does not say the worker was unqualified, was too slow, or lost the
   * job to somebody else. It says the offer is gone, which is the only thing that is both true and
   * theirs to know.
   */
  RESCINDED: {
    title: "This job offer is no longer available",
    body: "This job offer is no longer available. This is not a reflection on you or your qualifications, and you remain in consideration for work. Please contact your recruiter if you have questions.",
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
 * Gate JO-2C. The absolute response deadline, in the worker's OWN locale and time zone.
 *
 * DEVICE LOCALE FOR DISPLAY, ABSOLUTE INSTANT FOR TRUTH. The stored value is a single absolute moment;
 * `toLocaleTimeString` with no explicit locale renders it the way this worker's own phone renders times,
 * which is what makes "3:00 PM" mean the same wall-clock moment to a worker in Texas and a worker in
 * Arizona. Formatting is the only thing delegated to the device - the comparison that decides whether a
 * response is late happens on the server against this same instant.
 *
 * TODAY AND TOMORROW ARE NAMED, because "by 3:00 PM" is genuinely ambiguous and a worker acting on the
 * wrong day loses the job. The day is compared in LOCAL time, matching what the worker sees on the
 * device's own clock.
 */
function deadlineAbsolute(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const time = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDelta = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);

  if (dayDelta === 0) return `${time} today`;
  if (dayDelta === 1) return `${time} tomorrow`;

  const day = due.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return `${time} on ${day}`;
}

/**
 * Gate JO-2C. The relative time remaining, in the coarsest honest unit.
 *
 * BOTH FORMS ARE SHOWN, NOT ONE. An absolute deadline alone makes a worker do arithmetic against a
 * clock they may not have looked at; a countdown alone is useless the moment the page is left open or
 * screenshotted, and is silently wrong if the device clock is off. Together, the absolute value is the
 * one to act on and this one conveys the urgency.
 *
 * DELIBERATELY APPROXIMATE, AND ROUNDED DOWN. "About 57 minutes remaining" understates rather than
 * overstates, so a worker trusting it is never encouraged to answer later than they safely can.
 *
 * Returns null once the deadline has passed. The countdown never runs negative and never becomes a
 * verdict: whether an offer is over is the server's `decisionState`, not this arithmetic.
 */
function deadlineRelative(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const ms = due.getTime() - now.getTime();
  if (ms <= 0) return null;

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Less than a minute remaining.";
  if (minutes === 1) return "About 1 minute remaining.";
  if (minutes < 60) return `About ${minutes} minutes remaining.`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "About 1 hour remaining.";
  if (hours < 48) return `About ${hours} hours remaining.`;

  return `About ${Math.floor(hours / 24)} days remaining.`;
}

/**
 * The safe job facts, as labelled rows.
 *
 * Built from the allowlisted projection only. A field with no authoritative value is OMITTED rather
 * than rendered as "TBD" or "Unknown", because inventing a placeholder would tell the worker
 * something Jarvis does not actually know - and this is the information a worker is being asked to
 * commit to.
 */
function jobFacts(job: JobOfferSafeJob): { label: string; value: string }[] {
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
    rows.push({ label: "Expected length", value: `About ${job.estimatedDurationWeeks} weeks` });
  } else {
    const end = shortDate(job.anticipatedEndDate);
    if (end) rows.push({ label: "Expected through", value: end });
  }

  if (job.estimatedRegHoursPerWeek) {
    const ot =
      job.estimatedOtHoursPerWeek && Number(job.estimatedOtHoursPerWeek) > 0
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

/** A one-line summary of a competing posting, safe by construction. */
function postingSummary(job: JobOfferSafeJob): string {
  const role = job.specializationName ? `${job.tradeName} — ${job.specializationName}` : job.tradeName;
  const where = [job.city, job.state].filter(Boolean).join(", ");
  return where ? `${role} in ${where}` : role;
}

type Phase =
  | { kind: "LOADING" }
  | { kind: "READY"; prompt: JobOfferPrompt }
  | { kind: "SUBMITTING"; prompt: JobOfferPrompt; decision: JobOfferDecision }
  | { kind: "DONE"; decision: JobOfferDecision; alreadyRecorded: boolean }
  | { kind: "FAILED"; failure: JobOfferLinkFailure };

/**
 * The route's entry point.
 *
 * A thin wrapper whose only job is the Suspense boundary that Next requires around
 * `useSearchParams`. Without it, `next build` fails to prerender this route rather than failing at
 * runtime, so the boundary is a build requirement and not a stylistic choice.
 *
 * The fallback is `null` because `<style jsx>` is declared inside `JobOfferExperience`, so its
 * class names are scoped to that component and markup rendered here would arrive UNSTYLED - a flash
 * of black-on-white text before the real card appears.
 */
export default function WorkforceJobOfferPage() {
  return (
    <Suspense fallback={null}>
      <JobOfferExperience />
    </Suspense>
  );
}

function JobOfferExperience() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  /**
   * A LINK WITH NO TOKEN IS KNOWN TO BE UNUSABLE AT FIRST RENDER, so it is the INITIAL state
   * rather than something an effect discovers and corrects. Deciding it in a lazy initializer
   * avoids rendering a "Loading…" that was never going to resolve, and avoids the cascading
   * re-render that setting state synchronously inside an effect causes.
   */
  const [phase, setPhase] = useState<Phase>(() =>
    token ? { kind: "LOADING" } : { kind: "FAILED", failure: "INVALID" },
  );

  /**
   * Gate JO-2C. The local clock the countdown is rendered against.
   *
   * IT TICKS, BECAUSE A FROZEN "About 57 minutes remaining" BECOMES A LIE. A worker who leaves this page
   * open while thinking it over would otherwise read a number that stopped being true when they opened
   * it, and the page would be encouraging them to answer later than they safely can.
   *
   * IT IS A LOCAL CLOCK AND NOT A POLL. Nothing is requested from the server on this interval: no offer
   * is re-read, no state is refreshed and no link is touched. Half a minute is deliberately coarse -
   * enough to keep a minutes-granularity countdown honest, and far too slow to be a heartbeat.
   */
  const [now, setNow] = useState<Date>(() => new Date());
  const ticking = phase.kind === "READY" || phase.kind === "SUBMITTING";

  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [ticking]);

  useEffect(() => {
    // Nothing to fetch, and nothing to correct: the initial state already says so.
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const prompt = await getJobOfferPrompt(token);
        if (cancelled) return;

        /**
         * GATE JO-2C. AN OFFER THAT ENDED WITHOUT THE WORKER GETS ITS OWN SCREEN, NOT THE OFFER CARD.
         *
         * A lapsed or rescinded offer is gone, so showing the job details with the buttons hidden would
         * invite a worker to keep reading terms they can no longer accept, and would leave them to work
         * out from a single greyed-out sentence what actually happened. These two outcomes also need
         * DIFFERENT explanations - a passed deadline is something the worker could have acted on, a
         * rescission is not theirs at all - which one shared fallback sentence cannot give them.
         *
         * ACCEPTED AND DECLINED KEEP THE JO-2 BEHAVIOUR of the card with an already-decided sentence,
         * because there the worker DID decide and re-reading what they agreed to is useful.
         */
        if (prompt.decisionState === "LAPSED") {
          setPhase({ kind: "FAILED", failure: "LAPSED" });
          return;
        }
        if (prompt.decisionState === "RESCINDED") {
          setPhase({ kind: "FAILED", failure: "RESCINDED" });
          return;
        }

        setPhase({ kind: "READY", prompt });
      } catch (err) {
        if (cancelled) return;
        setPhase({
          kind: "FAILED",
          failure: err instanceof JobOfferLinkError ? err.failure : "FAILED",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const decide = useCallback(
    async (decision: JobOfferDecision) => {
      if (phase.kind !== "READY") return;
      const { prompt } = phase;
      setPhase({ kind: "SUBMITTING", prompt, decision });

      try {
        const outcome = await submitJobOfferDecision(token, decision);
        setPhase({
          kind: "DONE",
          // The SERVER's recorded decision decides what the worker is told, not the button they
          // pressed: a second link on an already-decided offer reports the standing decision.
          decision: outcome.decisionState === "ACCEPTED" ? "ACCEPT" : "DECLINE",
          alreadyRecorded: outcome.alreadyRecorded,
        });
      } catch (err) {
        setPhase({
          kind: "FAILED",
          failure: err instanceof JobOfferLinkError ? err.failure : "FAILED",
        });
      }
    },
    [phase, token],
  );

  return (
    <main className="jo-page">
      <div className="jo-card">
        {/*
          WHO IS ASKING. A worker reaches this page from a text-message link with no address bar
          worth reading and no other signal of who wants a decision, so naming the sender is
          identification rather than branding. It sits outside the phase switch deliberately: it
          must be present on the offer, on both outcomes, and on every refused link, because a
          worker deciding whether a strange link is a scam is most likely to be looking at the
          states where something has gone wrong.

          The identity string is SERVED, not written here, so "Millwrights4Hire - MW4H" has one
          definition and can never be rendered as "Millwrights for Hire".
        */}
        <p className="jo-brand">
          {phase.kind === "READY" || phase.kind === "SUBMITTING"
            ? phase.prompt.companyIdentity
            : "Millwrights4Hire - MW4H"}
        </p>

        {phase.kind === "LOADING" && <p className="jo-muted">Loading…</p>}

        {phase.kind === "FAILED" && (
          <>
            <h1 className="jo-title">{FAILURE_COPY[phase.failure].title}</h1>
            <p className="jo-body">{FAILURE_COPY[phase.failure].body}</p>
          </>
        )}

        {phase.kind === "DONE" && phase.decision === "ACCEPT" && (
          <>
            {/*
              CONCISE AND TRUE. It confirms what was recorded and says what comes next. It does NOT
              say paperwork has been sent, because JO-2 wires no delivery and nothing sent it.
            */}
            <h1 className="jo-title">Job offer accepted.</h1>
            <p className="jo-body">We&apos;ve recorded your acceptance of this job offer.</p>
            <p className="jo-body">
              Dispatch paperwork and reporting instructions will follow.
            </p>
            {phase.alreadyRecorded && (
              <p className="jo-muted">This decision was already on file.</p>
            )}
          </>
        )}

        {phase.kind === "DONE" && phase.decision === "DECLINE" && (
          <>
            {/*
              DECLINING ONE JOB IS NOT WITHDRAWING FROM EVERYTHING, and the worker is told so
              plainly - because the server genuinely leaves their other candidacies open.
            */}
            <h1 className="jo-title">Job offer declined.</h1>
            <p className="jo-body">
              We&apos;ve recorded that you declined this job offer.
            </p>
            <p className="jo-body">Your other active job interests were not affected.</p>
            {phase.alreadyRecorded && (
              <p className="jo-muted">This decision was already on file.</p>
            )}
          </>
        )}

        {(phase.kind === "READY" || phase.kind === "SUBMITTING") && (
          <>
            {/*
              THE HEADING ANNOUNCES SELECTION, which is what makes this page not a PRE_DISPATCH
              question. The worker has been chosen; what remains is their decision.
            */}
            <h1 className="jo-title">
              {phase.prompt.workerFirstName
                ? `${phase.prompt.workerFirstName}, you've been selected for this job.`
                : "You've been selected for this job."}
            </h1>

            <p className="jo-body">{phase.prompt.prompt}</p>

            <p className="jo-role">
              {phase.prompt.job.tradeName}
              {phase.prompt.job.specializationName
                ? ` — ${phase.prompt.job.specializationName}`
                : ""}
            </p>

            <dl className="jo-facts">
              {jobFacts(phase.prompt.job).map((row) => (
                <div className="jo-fact" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>

            {/*
              THE CONSEQUENCE, ABOVE THE BUTTONS. Rendered only when the server says acceptance
              would actually close something, so a worker with no other active postings is never
              warned about losing something they do not have. The list is exactly what the
              acceptance transaction closes - never a wider "jobs we think you'd suit" list.
            */}
            {phase.prompt.consequenceNotice && phase.prompt.competingPostings.length > 0 && (
              <section className="jo-consequence">
                <p className="jo-consequence-notice">{phase.prompt.consequenceNotice}</p>
                <ul className="jo-consequence-list">
                  {phase.prompt.competingPostings.map((posting) => (
                    <li key={posting.orderCandidateId}>{postingSummary(posting.job)}</li>
                  ))}
                </ul>
              </section>
            )}

            {/*
              GATE JO-2C. THE RESPONSE DEADLINE, ABOVE THE BUTTONS AND IMPOSSIBLE TO MISS.

              BOTH FORMS, DELIBERATELY. The absolute time is the fact to act on and survives the page
              being left open, screenshotted or read tomorrow; the countdown carries the urgency that an
              absolute time alone does not. A worker who is never told the deadline cannot meet it, and
              JO-2 served this value and rendered nothing.

              RENDERED FROM THE SERVER'S TIMESTAMP, FORMATTED BY THE DEVICE. The instant is the server's;
              only its presentation is local, so the worker sees their own wall clock while enforcement
              stays server-side. A device with a wrong clock therefore shows a wrong countdown and still
              cannot answer late.

              ONLY WHILE THE OFFER IS ACTUALLY OPEN. A deadline on a closed offer would be noise, and a
              deadline beside an already-recorded decision would suggest it could still be changed.
            */}
            {phase.prompt.actionable && phase.prompt.respondByAt && (
              <section className="jo-deadline" aria-live="polite">
                <p className="jo-deadline-absolute">
                  Please respond by {deadlineAbsolute(phase.prompt.respondByAt, now)}.
                </p>
                {deadlineRelative(phase.prompt.respondByAt, now) && (
                  <p className="jo-deadline-relative">
                    {deadlineRelative(phase.prompt.respondByAt, now)}
                  </p>
                )}
              </section>
            )}

            {phase.prompt.actionable ? (
              <>
                <div className="jo-actions">
                  <button
                    type="button"
                    className="jo-btn jo-btn-accept"
                    disabled={phase.kind === "SUBMITTING"}
                    onClick={() => decide("ACCEPT")}
                  >
                    {phase.kind === "SUBMITTING" && phase.decision === "ACCEPT"
                      ? "Saving…"
                      : phase.prompt.acceptLabel}
                  </button>

                  <button
                    type="button"
                    className="jo-btn jo-btn-decline"
                    disabled={phase.kind === "SUBMITTING"}
                    onClick={() => decide("DECLINE")}
                  >
                    {phase.kind === "SUBMITTING" && phase.decision === "DECLINE"
                      ? "Saving…"
                      : phase.prompt.declineLabel}
                  </button>
                </div>

                {/*
                  The supporting sentence, rendered from the server's own value and OUTSIDE the
                  button, as governance requires. It describes what follows acceptance and makes no
                  claim that anything has been delivered.
                */}
                <p className="jo-notice">{phase.prompt.paperworkNotice}</p>
              </>
            ) : (
              <p className="jo-body">
                {phase.prompt.decisionState === "ACCEPTED"
                  ? "You've already accepted this job offer."
                  : phase.prompt.decisionState === "DECLINED"
                    ? "You've already declined this job offer."
                    : "This job offer is no longer waiting on a decision from you."}
              </p>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        /* MOBILE FIRST. The base rules ARE the phone layout; the only media query widens the
           card on a desktop, rather than the other way round. */
        .jo-page {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background: #f4f5f7;
          padding: 16px 12px 48px;
        }
        .jo-card {
          width: 100%;
          max-width: 34rem;
          background: #ffffff;
          border: 1px solid #d4d7dd;
          border-radius: 12px;
          padding: 20px 18px 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
        /* Identification, not a marketing banner: one quiet line that never competes with the
           offer for the top of a phone screen. */
        .jo-brand {
          margin: 0 0 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e6e8ec;
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: #2c3038;
        }
        .jo-title {
          margin: 0 0 12px;
          font-size: 1.375rem;
          line-height: 1.3;
          font-weight: 700;
          color: #14161a;
        }
        .jo-role {
          margin: 0 0 16px;
          font-size: 1.0625rem;
          font-weight: 600;
          color: #2c3038;
        }
        .jo-body {
          margin: 0 0 12px;
          font-size: 1rem;
          line-height: 1.55;
          color: #2c3038;
        }
        .jo-muted {
          margin: 8px 0 0;
          font-size: 0.9375rem;
          color: #5c626d;
        }
        .jo-facts {
          margin: 0 0 20px;
          padding: 0;
          border-top: 1px solid #e6e8ec;
        }
        .jo-fact {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #e6e8ec;
        }
        .jo-fact dt {
          font-size: 0.9375rem;
          color: #5c626d;
        }
        .jo-fact dd {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #14161a;
          text-align: right;
        }
        /* A bordered, tinted block, because this is the one thing on the page a worker must not
           scroll past. It is informational styling - not a warning colour that would read as an
           error, and not a control. */
        /* GATE JO-2C. The response deadline. Visually distinct from the amber consequence warning
           below, because it is time pressure rather than a warning about losing something, and a
           worker must not have to read carefully to tell the two apart. */
        .jo-deadline {
          margin: 0 0 20px;
          padding: 14px;
          background: #eef4fb;
          border: 1px solid #b9cde4;
          border-radius: 10px;
        }
        .jo-deadline-absolute {
          margin: 0;
          font-size: 1.0625rem;
          line-height: 1.4;
          font-weight: 700;
          color: #1c3557;
        }
        .jo-deadline-relative {
          margin: 6px 0 0;
          font-size: 0.9375rem;
          line-height: 1.4;
          color: #40597c;
        }
        .jo-consequence {
          margin: 0 0 20px;
          padding: 14px 14px 10px;
          background: #fdf6e7;
          border: 1px solid #e3c987;
          border-radius: 10px;
        }
        .jo-consequence-notice {
          margin: 0 0 10px;
          font-size: 0.9375rem;
          line-height: 1.5;
          font-weight: 600;
          color: #4a3a12;
        }
        .jo-consequence-list {
          margin: 0;
          padding-left: 20px;
        }
        .jo-consequence-list li {
          margin: 0 0 6px;
          font-size: 0.9375rem;
          line-height: 1.45;
          color: #4a3a12;
        }
        /* Stacked full-width buttons: one thumb, no mis-taps, and a 48px minimum target. */
        .jo-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .jo-btn {
          width: 100%;
          min-height: 52px;
          padding: 14px 16px;
          font-size: 1.0625rem;
          font-weight: 700;
          border-radius: 10px;
          border: 2px solid transparent;
          cursor: pointer;
        }
        .jo-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .jo-btn-accept {
          background: #1c6b3c;
          color: #ffffff;
          border-color: #175832;
        }
        /* CLEAR OPPOSITE TREATMENT, and deliberately not ambiguous. Solid red on white lettering,
           mirroring Accept exactly in size, weight and construction. Declining a job offer is a
           real choice a worker is entitled to make plainly; an outlined or greyed button would
           read as the lesser, discouraged option next to a solid green one. */
        .jo-btn-decline {
          background: #a01b1b;
          color: #ffffff;
          border-color: #7f1515;
        }
        .jo-notice {
          margin: 18px 0 0;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #5c626d;
        }
        @media (min-width: 640px) {
          .jo-page {
            padding: 40px 24px 64px;
          }
          .jo-card {
            padding: 28px 28px 32px;
          }
        }
      `}</style>
    </main>
  );
}
