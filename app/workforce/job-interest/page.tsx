"use client";

/**
 * Phase 17 S3/S4 - the worker's own page for ONE PRE_DISPATCH job, and their other open interests.
 *
 * Governance: VETTING_SYSTEM.md PRE_DISPATCH WORKER COMMUNICATION, "Worker Experience";
 * VETTING_BUILD_CHECKLIST.md PHASE 17 slices S3 and S4.
 *
 * IT ASKS ONE QUESTION AND OFFERS TWO ANSWERS. "Are you still interested in this job?" with
 * "Confirm" and "Remove me from this job posting". S4 adds the worker's OTHER open interests
 * beneath it, but does not change what the page is: it is still one question about one job, with
 * an optional tidy-up attached. It is not an onboarding dashboard and not a job board.
 *
 * S4'S OTHER INTERESTS ARE A LIST, NOT A RANKING. They are rendered in the order the server sends
 * them, which is the order the worker became a candidate. Nothing is starred, scored, sorted by pay
 * or marked preferred, because the worker is not being asked to choose between them - they may hold
 * as many interests as they like, and holding several costs them nothing.
 *
 * KEEP HAS NO CONTROL, AND ITS ABSENCE IS THE FEATURE. Keep is the default and writes nothing, so a
 * Keep button would be a button that does nothing on a page where every other button does something.
 * The worker acts only to LEAVE a posting; leaving everything alone requires no action and produces
 * no record.
 *
 * TOGGLING REMOVE MUTATES NOTHING. Selecting Remove marks a row in local state only. Nothing reaches
 * the server until the worker answers the primary question and then confirms an explicit summary of
 * what will be removed, so there is no one-tap path to closing a job posting by accident.
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
import { useRouter, useSearchParams } from "next/navigation";
import {
  getPreDispatchWorkerPrompt,
  requestPreDispatchJobOfferReview,
  submitPreDispatchWorkerResponse,
  PreDispatchLinkError,
  type PreDispatchLinkFailure,
  type PreDispatchOtherInterest,
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

/**
 * Phase 17 S4. How ONE other posting is named to the worker, in a single line.
 *
 * IT IS THE TRADE AND THE PLACE, WHICH IS ALL THE WORKER IS ENTITLED TO KNOW. There is no customer,
 * company, site or street address here because the server never sends one. It also never shows an
 * `orderCandidateId`: an opaque handle is meaningless to a worker, and Section 15 forbids exposing
 * internal ids in the confirmation.
 */
function jobHeadline(job: PreDispatchSafeJob): string {
  const role = job.specializationName
    ? `${job.tradeName} — ${job.specializationName}`
    : job.tradeName;
  const where = [job.city, job.state].filter(Boolean).join(", ");
  return where ? `${role} in ${where}` : role;
}

/** A response deadline, phrased for someone reading it on a phone. */
function deadlineText(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Phase =
  | { kind: "LOADING" }
  | { kind: "READY"; prompt: PreDispatchWorkerPrompt }
  /**
   * Phase 17 S4. The worker answered, and postings are marked for removal, so they are shown
   * exactly what will be closed before anything is sent.
   *
   * IT EXISTS ONLY WHEN THERE IS SOMETHING DESTRUCTIVE TO CONFIRM. With no removals marked, the
   * primary answer submits directly, as it did in S3 - an extra tap to confirm "nothing else will
   * change" would be friction that protects nobody.
   */
  | {
      kind: "CONFIRMING";
      prompt: PreDispatchWorkerPrompt;
      decision: PreDispatchWorkerDecision;
      removing: string[];
    }
  | { kind: "SUBMITTING"; prompt: PreDispatchWorkerPrompt; decision: PreDispatchWorkerDecision }
  | {
      kind: "DONE";
      prompt: PreDispatchWorkerPrompt;
      decision: PreDispatchWorkerDecision;
      alreadyRecorded: boolean;
      /**
       * Phase 17 S4. The candidacies the SERVER reported closing - never the page's own selection.
       *
       * Section 15 forbids claiming a removal succeeded when it was skipped for having gone stale,
       * so the confirmation is built from what committed. When this is empty, nothing else changed
       * and the primary copy may truthfully say so.
       */
      removed: string[];
    }
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

/**
 * Phase 17 S4. ONE of the worker's other open interests.
 *
 * IT RENDERS THE CATEGORY THE SERVER ASSIGNED AND DECIDES NOTHING. `KEEP_OR_REMOVE` gets a Remove
 * toggle; `PENDING_JOB_OFFER` gets a label, its deadline and Review. The two treatments are
 * mutually exclusive here because they are mutually exclusive in Ruling A, and the server enforces
 * the same split on the write path - a row shown as read-only cannot be withdrawn even if this
 * markup were altered to offer it.
 *
 * IT CARRIES ITS OWN `<style jsx>`, WHICH IS A REQUIREMENT RATHER THAN A PREFERENCE. styled-jsx
 * scopes class names to the component that declares the block, so the parent's stylesheet does not
 * reach these elements and this markup would otherwise render unstyled.
 */
function OtherInterestRow({
  interest,
  copy,
  marked,
  busy,
  reviewing,
  onToggleRemoval,
  onReview,
}: {
  interest: PreDispatchOtherInterest;
  copy: PreDispatchWorkerPrompt["otherInterestsCopy"];
  marked: boolean;
  busy: boolean;
  reviewing: boolean;
  onToggleRemoval: (orderCandidateId: string) => void;
  onReview: (orderCandidateId: string) => void;
}) {
  const offered = interest.category === "PENDING_JOB_OFFER";
  const respondBy = deadlineText(interest.pendingJobOffer?.respondByAt ?? null);
  const pay = money(interest.job.payRate);

  return (
    <li className={`oi-row${marked ? " oi-row-marked" : ""}`}>
      <p className="oi-role">{jobHeadline(interest.job)}</p>

      {/*
        A SHORT LINE, NOT THE FULL FACT TABLE. The primary job gets the detailed breakdown because
        it is the job being asked about; a sibling gets enough to be recognised. Both come from the
        same safe projection, so neither can disclose more than the other.
      */}
      {pay && <p className="oi-detail">{pay} per hour</p>}

      {offered ? (
        <>
          {/* Ruling A: clearly labelled, and given no Keep or Remove control at all. */}
          <p className="oi-badge">{copy.pendingJobOfferLabel}</p>
          <p className="oi-detail">{copy.pendingJobOfferNotice}</p>
          {respondBy && <p className="oi-detail">Please respond by {respondBy}.</p>}

          <button
            type="button"
            className="oi-btn oi-btn-review"
            disabled={reviewing || busy}
            onClick={() => onReview(interest.orderCandidateId)}
          >
            {reviewing ? "Opening…" : copy.reviewJobOfferLabel}
          </button>
        </>
      ) : (
        /*
          ONE BUTTON THAT TOGGLES, AND NO KEEP BUTTON BESIDE IT. Keep is the state this row is
          already in, so it is offered as a way OUT of a mark rather than as an action of its own.
          `aria-pressed` is what tells a screen reader whether this posting is currently marked,
          since the visible cue is the label change and the strikethrough.

          THE ACCESSIBLE NAME ADDS THE JOB, BECAUSE THE VISIBLE LABEL IS NOT UNIQUE ON THIS PAGE.
          "Remove me from this job posting" is the governed wording for BOTH the primary red button
          and this row, so a worker on a screen reader would otherwise hear the same button name
          several times with no way to tell which job each one meant. The governed text is kept and
          the job is appended, so the accessible name still contains the visible label - the visible
          wording is unchanged, and only the announcement gains the context a sighted worker already
          has from the job name printed directly above it.
        */
        <button
          type="button"
          className={`oi-btn ${marked ? "oi-btn-undo" : "oi-btn-remove"}`}
          disabled={busy}
          aria-pressed={marked}
          aria-label={`${marked ? copy.undoRemoveLabel : copy.removeLabel}: ${jobHeadline(
            interest.job,
          )}`}
          onClick={() => onToggleRemoval(interest.orderCandidateId)}
        >
          {marked ? copy.undoRemoveLabel : copy.removeLabel}
        </button>
      )}

      {marked && (
        <p className="oi-marked-note">
          We&apos;ll remove you from this posting when you save your answer.
        </p>
      )}

      <style jsx>{`
        .oi-row {
          list-style: none;
          padding: 14px 0;
          border-bottom: 1px solid #e6e8ec;
        }
        .oi-row:last-child {
          border-bottom: none;
        }
        /* A marked row is visibly on its way out, without being hidden or reordered. */
        .oi-row-marked .oi-role {
          text-decoration: line-through;
          color: #5c626d;
        }
        .oi-role {
          margin: 0 0 4px;
          font-size: 1rem;
          font-weight: 600;
          color: #14161a;
        }
        .oi-detail {
          margin: 0 0 4px;
          font-size: 0.9375rem;
          line-height: 1.5;
          color: #5c626d;
        }
        /* The Pending Job Offer label. Informational, and deliberately not styled as a button. */
        .oi-badge {
          display: inline-block;
          margin: 4px 0 6px;
          padding: 3px 9px;
          border-radius: 999px;
          background: #e8f0fb;
          border: 1px solid #b9cef0;
          font-size: 0.8125rem;
          font-weight: 700;
          color: #1c4a86;
        }
        .oi-btn {
          width: 100%;
          min-height: 48px;
          margin-top: 8px;
          padding: 12px 16px;
          font-size: 1rem;
          font-weight: 700;
          border-radius: 10px;
          border: 2px solid transparent;
          cursor: pointer;
        }
        .oi-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }
        /* OUTLINED, NOT SOLID RED. The solid red button on this page means "remove me from the job
           I was asked about" and is the primary answer. A sibling removal is a smaller, secondary
           action and must not compete with it for the eye or the thumb. */
        .oi-btn-remove {
          background: #ffffff;
          color: #8f1919;
          border-color: #d7a5a5;
        }
        .oi-btn-undo {
          background: #ffffff;
          color: #175832;
          border-color: #9dc3ac;
        }
        .oi-btn-review {
          background: #ffffff;
          color: #1c4a86;
          border-color: #a8c2e6;
        }
        .oi-marked-note {
          margin: 8px 0 0;
          font-size: 0.875rem;
          line-height: 1.45;
          color: #8f1919;
        }
      `}</style>
    </li>
  );
}

function JobInterestExperience() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [phase, setPhase] = useState<Phase>({ kind: "LOADING" });

  /**
   * Phase 17 S4. Which other postings the worker has marked to leave.
   *
   * LOCAL, AND DELIBERATELY NOT PART OF `phase`. It survives the move into CONFIRMING and back out
   * again, so a worker who reviews the summary and taps "Go back" finds their marks exactly as they
   * left them rather than having to redo them.
   *
   * IT IS A SELECTION, NOT A RECORD. Nothing here has been sent anywhere. Abandoning the page loses
   * these marks and changes nothing about the worker's candidacies, which is the correct outcome:
   * Keep is the default, and an unsent intention to leave is not a withdrawal.
   */
  const [removing, setRemoving] = useState<string[]>([]);

  /** The posting whose Job Offer credential is currently being fetched, if any. */
  const [reviewing, setReviewing] = useState<string | null>(null);
  /**
   * Set when a Review attempt was refused, e.g. the deadline passed while this page sat open.
   *
   * IT DOES NOT DESTROY THE PAGE. A closed offer is not a broken link, and dropping the worker into
   * the FAILED state would cost them the primary answer they came here to give. They are told the
   * offer is no longer open and the rest of the page keeps working.
   */
  const [reviewFailed, setReviewFailed] = useState(false);

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

  /**
   * Send the primary answer, together with whatever removals were confirmed.
   *
   * ONE REQUEST, ALWAYS. The link is single-use, so there is no version of this that sends the
   * answer and the removals separately - and therefore no state in which a worker's postings were
   * closed but their answer to this job was lost.
   */
  const submit = useCallback(
    async (
      prompt: PreDispatchWorkerPrompt,
      decision: PreDispatchWorkerDecision,
      removeOrderCandidateIds: string[],
    ) => {
      setPhase({ kind: "SUBMITTING", prompt, decision });

      try {
        const outcome = await submitPreDispatchWorkerResponse(
          token,
          decision,
          removeOrderCandidateIds,
        );
        setPhase({
          kind: "DONE",
          prompt,
          // The SERVER's recorded outcome decides what the worker is told, not the button they
          // pressed: a second link on an already-answered request reports the standing answer.
          decision:
            outcome.interestResult === "CONTINUED_INTEREST_CONFIRMED" ? "YES" : "NO",
          alreadyRecorded: outcome.alreadyRecorded,
          // WHAT COMMITTED, NOT WHAT WAS ASKED. See the `removed` field's own note.
          removed: outcome.siblingRemoval?.removedOrderCandidateIds ?? [],
        });
      } catch (err) {
        setPhase({
          kind: "FAILED",
          failure: err instanceof PreDispatchLinkError ? err.failure : "FAILED",
        });
      }
    },
    [token],
  );

  /**
   * The worker pressed Confirm or Remove on the PRIMARY question.
   *
   * IT DIVERTS TO THE SUMMARY WHEN, AND ONLY WHEN, SOMETHING WOULD BE CLOSED. Section 14 requires a
   * clear confirmation of which other opportunities will be removed and forbids an accidental
   * one-click destructive mutation. With nothing marked there is nothing destructive to warn about,
   * so the answer goes straight out and the S3 flow is unchanged.
   */
  const answer = useCallback(
    (decision: PreDispatchWorkerDecision) => {
      if (phase.kind !== "READY") return;
      const { prompt } = phase;

      // Marks are intersected with what the server still lists as removable, so a row that stopped
      // being an ordinary Keep/Remove opportunity between the read and now cannot be carried into
      // the summary as though it were.
      const confirmed = prompt.otherInterests
        .filter(
          (interest) =>
            interest.category === "KEEP_OR_REMOVE" &&
            removing.includes(interest.orderCandidateId),
        )
        .map((interest) => interest.orderCandidateId);

      if (confirmed.length === 0) {
        void submit(prompt, decision, []);
        return;
      }

      setPhase({ kind: "CONFIRMING", prompt, decision, removing: confirmed });
    },
    [phase, removing, submit],
  );

  /**
   * Phase 17 S4. Mark or unmark one other posting for removal.
   *
   * IT WRITES NOTHING. This is the whole of what a Remove tap does until the worker answers the
   * primary question and confirms the summary.
   */
  const toggleRemoval = useCallback((orderCandidateId: string) => {
    setRemoving((current) =>
      current.includes(orderCandidateId)
        ? current.filter((id) => id !== orderCandidateId)
        : [...current, orderCandidateId],
    );
  }, []);

  /**
   * Phase 17 S4. Hand the worker over to the Job Offer surface for a posting that already has one.
   *
   * IT ACQUIRES A CREDENTIAL; IT DOES NOT MAKE A DECISION. Accept and decline live where they have
   * always lived, on the Job Offer page. This page cannot answer an offer, and the offer's deadline
   * is unchanged by looking at it.
   *
   * IT DOES NOT SPEND THIS PAGE'S LINK, so the worker can open their offer, decide not to act, come
   * back and still answer the question they were asked here.
   */
  const reviewJobOffer = useCallback(
    async (orderCandidateId: string) => {
      if (reviewing) return;
      setReviewing(orderCandidateId);
      setReviewFailed(false);

      try {
        const handoff = await requestPreDispatchJobOfferReview(token, orderCandidateId);
        router.push(`/workforce/job-offer?token=${encodeURIComponent(handoff.token)}`);
      } catch {
        // Every refusal reads the same to the worker, because the difference between "the deadline
        // passed", "staff withdrew it" and "you already answered" is information about what
        // happened behind the scenes and does not change what they do next.
        setReviewFailed(true);
        setReviewing(null);
      }
    },
    [reviewing, router, token],
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
            {/*
              PHASE 17 S4. THE PRIMARY-NO SENTENCE IS NOW CONDITIONAL, BECAUSE S4 CAN MAKE IT FALSE.
              "This does not affect any other job you're being considered for" was true in S3, when
              this page could only ever touch one candidacy. It is preserved EXACTLY when this
              submission closed nothing else - including when the worker marked removals that had all
              gone stale, since in that case nothing else genuinely changed. When postings were
              closed, the sentence is replaced rather than softened: the removals are then listed
              below, so the worker is told what happened instead of being reassured that nothing did.
            */}
            <p className="ji-body">
              {phase.decision === "YES"
                ? "We've recorded that you're still interested in this job."
                : phase.removed.length === 0
                  ? "We've recorded that you're no longer interested in this job posting. This does not affect any other job you're being considered for."
                  : "We've recorded that you're no longer interested in this job posting."}
            </p>
            {phase.removed.length > 0 && (
              <>
                <p className="ji-body">You also asked to be removed from:</p>
                <ul className="ji-removed">
                  {/*
                    NAMED FROM THE SERVER'S IDS, RENDERED AS TRADE AND PLACE. An id the server did
                    not report closing is not listed, and an id it did report is looked up in the
                    prompt for a human name - never printed as the id itself.
                  */}
                  {phase.removed.map((id) => {
                    const interest = phase.prompt.otherInterests.find(
                      (candidate) => candidate.orderCandidateId === id,
                    );
                    return (
                      <li key={id}>
                        {interest ? jobHeadline(interest.job) : "Another job posting"}
                      </li>
                    );
                  })}
                </ul>
                {/*
                  ONLY WHEN IT IS TRUE. A worker who left the primary posting AND every other one
                  has nothing left open, and reassuring them otherwise would be a false statement
                  about their own record. Presence of a still-open interest is checked, not assumed.
                */}
                {phase.prompt.otherInterests.some(
                  (interest) => !phase.removed.includes(interest.orderCandidateId),
                ) && (
                  <p className="ji-body">
                    You&apos;re still being considered for any other jobs not listed here.
                  </p>
                )}
              </>
            )}
            {phase.alreadyRecorded && (
              <p className="ji-muted">This answer was already on file.</p>
            )}
          </>
        )}

        {/*
          PHASE 17 S4. THE DELIBERATE CONFIRMATION. It replaces the question rather than sitting
          beside it, so the worker's whole screen is the list of what is about to be closed. Nothing
          has been sent at this point: "Go back" is a genuine cancel, not an undo of a completed
          action, because there is nothing yet to undo.
        */}
        {phase.kind === "CONFIRMING" && (
          <>
            <h1 className="ji-title">
              {phase.prompt.otherInterestsCopy.confirmationHeading}
            </h1>

            <p className="ji-body">
              {phase.decision === "YES"
                ? "You're confirming you're still interested in this job:"
                : "You're asking to be removed from this job:"}
            </p>
            <p className="ji-role">{jobHeadline(phase.prompt.job)}</p>

            <p className="ji-body">
              {phase.removing.length === 1
                ? "You're also asking to be removed from this job posting:"
                : "You're also asking to be removed from these job postings:"}
            </p>
            <ul className="ji-removed">
              {phase.removing.map((id) => {
                const interest = phase.prompt.otherInterests.find(
                  (candidate) => candidate.orderCandidateId === id,
                );
                return (
                  <li key={id}>
                    {interest ? jobHeadline(interest.job) : "Another job posting"}
                  </li>
                );
              })}
            </ul>

            {/*
              SAID PLAINLY, BECAUSE IT IS TRUE AND IT MATTERS. Leaving a posting is not reversible
              from this page, and a worker is entitled to know that before they tap rather than
              after.
            */}
            <p className="ji-notice">
              Once you save this, you&apos;ll be taken off the job postings listed above. Contact
              your recruiter if you change your mind.
            </p>

            <div className="ji-actions">
              <button
                type="button"
                className="ji-btn ji-btn-no"
                onClick={() => void submit(phase.prompt, phase.decision, phase.removing)}
              >
                Save my answer
              </button>
              <button
                type="button"
                className="ji-btn ji-btn-back"
                onClick={() => setPhase({ kind: "READY", prompt: phase.prompt })}
              >
                Go back
              </button>
            </div>
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

            {/*
              PHASE 17 S4. THE WORKER'S OTHER OPEN INTERESTS.
              It sits BELOW the primary job and ABOVE the primary question, which is the order the
              worker needs: this job, then everything else, then the one answer that submits it all.
              The section is absent entirely when there is nothing else open, so a worker with one
              interest sees exactly the S3 page.
            */}
            {phase.prompt.otherInterests.length > 0 && (
              <section className="ji-others">
                <h2 className="ji-others-heading">
                  {phase.prompt.otherInterestsCopy.heading}
                </h2>
                {/* Says that Keep is the default. Served, not written here. */}
                <p className="ji-others-notice">
                  {phase.prompt.otherInterestsCopy.notice}
                </p>

                {reviewFailed && (
                  <p className="ji-others-notice" role="status">
                    That job offer is no longer open. Please contact your recruiter if you have
                    questions.
                  </p>
                )}

                <ul className="ji-others-list">
                  {phase.prompt.otherInterests.map((interest) => (
                    <OtherInterestRow
                      key={interest.orderCandidateId}
                      interest={interest}
                      copy={phase.prompt.otherInterestsCopy}
                      marked={removing.includes(interest.orderCandidateId)}
                      busy={phase.kind === "SUBMITTING"}
                      reviewing={reviewing === interest.orderCandidateId}
                      onToggleRemoval={toggleRemoval}
                      onReview={reviewJobOffer}
                    />
                  ))}
                </ul>
              </section>
            )}

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
        /* PHASE 17 S4. The other-interests section, set apart from the primary job so it reads as
           additional information rather than as more detail about the job in question. */
        .ji-others {
          margin: 0 0 20px;
          padding: 14px 14px 6px;
          background: #f7f8fa;
          border: 1px solid #e0e3e8;
          border-radius: 10px;
        }
        .ji-others-heading {
          margin: 0 0 6px;
          font-size: 1.0625rem;
          font-weight: 700;
          color: #14161a;
        }
        .ji-others-notice {
          margin: 0 0 8px;
          font-size: 0.9375rem;
          line-height: 1.5;
          color: #5c626d;
        }
        .ji-others-list {
          margin: 0;
          padding: 0;
          list-style: none;
        }
        /* The removal summary, on the confirmation screen and on the recorded outcome. */
        .ji-removed {
          margin: 0 0 14px;
          padding: 0 0 0 20px;
        }
        .ji-removed li {
          margin: 0 0 6px;
          font-size: 1rem;
          line-height: 1.5;
          font-weight: 600;
          color: #14161a;
        }
        /* "Go back" is a cancel, so it is quiet: a worker who has second thoughts should not have
           to choose between two equally loud buttons. */
        .ji-btn-back {
          background: #ffffff;
          color: #2c3038;
          border-color: #c3c8d1;
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
