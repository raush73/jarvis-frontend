"use client";

/**
 * Module 4.2 Federal Tax - the certification stage, as the worker performs it.
 *
 * THE LAST STEP OF THE MODULE AND THE ONLY IRREVERSIBLE ONE. Everything the worker did before this
 * was a saved answer he could change; here he puts those answers in force. It renders on the review
 * step beneath the review he is certifying rather than at a URL of its own, because the module's
 * declared steps are the interview's and this is not a fourth question - the delivered I-9 capsule
 * composes its own act into its final step the same way.
 *
 * IT BUILDS NO PART OF THE ACT ITSELF, AND THAT IS THE WHOLE DESIGN.
 *
 *  - THE MARK IS DRAWN ON THE DELIVERED SHARED SURFACE. `ExecutionSubjectCard` renders the governed
 *    wording, the version it is in force at, and the capture surface behind it. There is no canvas
 *    in this capsule, no stroke handling, no pointer arithmetic, no local signature engine and no
 *    local persistence of a mark. The coordinates never enter this file, this module's state, or
 *    this module's store - they go from the shared surface into one request and are discarded.
 *  - THE WORDING IS THE SERVER'S. The authoritative certification arrives resolved and hashed and is
 *    passed through untouched. Nothing here authors it, edits it, paraphrases it, truncates it or
 *    reorders it, and nothing here computes a hash.
 *  - THE ROUND TRIP IS THE SHARED CARD'S. It reads `revision`, `contentHash` and `ruleRevision` off
 *    the subject that produced what is on screen and hands them back with the act, so a worker who
 *    signed wording that has since moved is refused rather than silently re-pointed at wording he
 *    never saw.
 *
 * THE TWO KINDS OF WORDS ARE PRESENTED SEPARATELY AND LABELLED SEPARATELY (ruling OR-3). Jarvis's
 * explanation is above, under its own heading, in its own block, marked as ours. The authoritative
 * certification is below it inside the delivered card, marked as the federal government's own
 * wording. They are never interleaved, never merged into one paragraph, and the explanation is never
 * placed inside the card - what the worker signs under penalty of perjury is exactly the governed
 * body and nothing this module wrote.
 *
 * WHAT THIS FILE CANNOT DO, none of it a missing button:
 *
 *  - IT NEVER COMPLETES THE MODULE. The runtime's `complete` is not called here and is not reachable
 *    from here. Completion is DERIVED server-side from this module's own validator once an executed
 *    election, an execution record and a retained artifact all exist; a browser claiming completion
 *    would be a second completion authority disagreeing with the first.
 *  - IT NEVER DECIDES WHETHER HE MAY CERTIFY. `available` and `blockers` are read and displayed. The
 *    server decides every one of those conditions again when the act arrives, which is why the
 *    affirmation gate below withholds a control rather than granting one.
 *  - IT NEVER ADJUDICATES THE EXEMPTION. It shows him the two governed conditions and records which
 *    he affirmed. It does not estimate, suggest, pre-tick or work either of them out for him.
 *  - IT NEVER SEES A FULL IDENTIFICATION NUMBER, and there is no call in this capsule that could
 *    obtain one. The retained artifact is opened through the DELIVERED document client by identity,
 *    which returns a short-lived URL fetched at the moment of viewing.
 *  - IT NEVER EDITS A RECORDED ELECTION. Once one is in force, what this screen offers is the
 *    GOVERNED LATER ELECTION - a correction or a subsequent election, composed by
 *    `FederalTaxNewElection` and travelling its own route - and his own history, shown by
 *    `FederalTaxHistory`. Both append. Neither revises, replaces in place, or removes anything.
 *  - IT OFFERS NO FUTURE-YEAR REPLACEMENT, no post-hire self-service, no access link and no
 *    one-time code. Those remain separately governed, deferred work with no client in this capsule,
 *    and everything here exists only inside the authenticated, bound onboarding runtime.
 */

import { useCallback, useEffect, useState } from "react";
import ExecutionSubjectCard from "@/components/workforce/onboarding/execution/ExecutionSubjectCard";
import type { ExecutionAct } from "@/components/workforce/onboarding/execution/ExecutionFormControl";
import type { ExecutionRefusal } from "@/components/workforce/onboarding/execution/useExecutionSubmission";
import OnboardingErrorNotice from "@/components/workforce/onboarding/runtime/OnboardingErrorNotice";
import { getOnboardingDocumentDownload } from "@/lib/workforce/onboardingDocumentApi";
import { type OnboardingExecutionSubject } from "@/lib/workforce/onboardingExecutionApi";
import {
  certifyOwnFederalTaxElection,
  getOwnFederalTaxCertification,
  // Aliased because this component is named for the stage it renders. The wire type keeps its own
  // name in the client; here it is "the stage", which is also how the prose below refers to it.
  type FederalTaxCertification as FederalTaxCertificationStage,
  type FederalTaxCertificationBlocker,
} from "@/lib/workforce/federalTaxApi";
import FederalTaxHistory from "./FederalTaxHistory";
import FederalTaxNewElection from "./FederalTaxNewElection";
import { classifyFederalTaxRefusal } from "./federalTaxRefusal";

type Props = {
  invocationId: string;
  /**
   * Changes whenever the interview changes.
   *
   * Availability depends on answers this component does not own, so it RE-READS rather than
   * remembering: a worker who confirms his review and saves must be offered the certification
   * without reloading the page, and one who un-confirms it must stop being offered it.
   */
  interviewToken: string;
  /** False for a packet that has left the worker's hands: shown, never acted on. */
  changeable: boolean;
};

/** Why he may not certify yet, in his own words. Keyed by code so none leaks as an identifier. */
const BLOCKER_MESSAGES: Record<FederalTaxCertificationBlocker, string> = {
  INTERVIEW_NOT_COMPLETE:
    "Answer everything above and confirm that you have read it through. Then you can put your choices in force here.",
  QUESTION_SET_SUPERSEDED:
    "We have changed some of these questions since you answered them. Please read your answers through again and confirm your review once more.",
  ELECTION_ALREADY_EXECUTED:
    "Your choices are already in force. Below you can correct them or elect differently; either way we keep what you signed before.",
  // Unreachable on the FIRST-election stage, whose blockers are the ones above: this term blocks a
  // LATER election only. Worded rather than omitted, because a screen that had no sentence for a
  // governed blocker would render a blank where a reason belongs.
  NO_OPERATIVE_ELECTION:
    "You do not have federal withholding choices in force yet, so there is nothing to correct or replace.",
};

export function FederalTaxCertification({
  invocationId,
  interviewToken,
  changeable,
}: Props) {
  const [stage, setStage] = useState<FederalTaxCertificationStage | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<ExecutionRefusal | null>(null);
  const [reloads, setReloads] = useState(0);
  const [viewError, setViewError] = useState<unknown>(null);

  /**
   * The two governed affirmations, held for the length of one attempt and nowhere else.
   *
   * NEITHER IS EVER PRE-TICKED, and neither is inferred from the exemption election it is about -
   * which is the entire point of asking. They are not saved, not drafted and not read back: an
   * affirmation is something the worker states in the same request as his signature.
   */
  const [affirmedFirst, setAffirmedFirst] = useState(false);
  const [affirmedSecond, setAffirmedSecond] = useState(false);

  const reload = useCallback(() => setReloads((count) => count + 1), []);

  useEffect(() => {
    // `live` guards a response arriving after the worker moved on, which would otherwise show one
    // packet's certification under another's screen.
    let live = true;
    getOwnFederalTaxCertification(invocationId)
      .then((value) => {
        if (!live) return;
        setStage(value);
        setLoadError(null);
      })
      .catch((failure: unknown) => {
        if (live) setLoadError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId, interviewToken, reloads]);

  /**
   * Perform the act.
   *
   * The subject handed back by the shared card is the one that produced what is on screen, so its
   * three content identifiers are read from it rather than refreshed - refreshing them is exactly
   * how a claim about a display the worker never saw gets submitted.
   *
   * WHAT COMES BACK REPLACES WHAT IS HELD. The response is the authoritative certification stage,
   * so the executed state a worker sees is the server's answer and never an optimistic local guess.
   */
  const certify = useCallback(
    async (
      subject: OnboardingExecutionSubject,
      act: ExecutionAct,
    ): Promise<boolean> => {
      // An attestation cannot satisfy this subject. The delivered card only produces one for the two
      // acknowledgement forms, and the server refuses a mismatch independently; failing closed here
      // means a client defect cannot send a certification with no mark attached.
      if (act.kind !== "CAPTURE") return false;
      if (submitting) return false;

      setSubmitting(true);
      setRefusal(null);
      try {
        const value = await certifyOwnFederalTaxElection(invocationId, {
          presented: {
            revision: subject.content.revision,
            contentHash: subject.content.contentHash,
            ruleRevision: subject.content.ruleRevision,
          },
          // The SUBJECT's own required act, copied. Naming an act here can only fail the
          // certification; it can never define it.
          performedForm: subject.requiredForm,
          capture: act.capture,
          hadNoLiabilityForPriorYear: affirmedFirst,
          expectsNoLiabilityForApplicableYear: affirmedSecond,
        });
        setStage(value);
        return true;
      } catch (failure: unknown) {
        const classified = classifyFederalTaxRefusal(failure);
        setRefusal(classified);
        // Anything that invalidated what was on screen is followed by a fresh read, so he never
        // signs twice against a stage the server has already moved past.
        if (classified.kind === "STALE" || classified.kind === "GONE") reload();
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [affirmedFirst, affirmedSecond, invocationId, reload, submitting],
  );

  /**
   * Open his own copy, through the AUTHORIZED retrieval path.
   *
   * The URL is fetched at the moment of viewing rather than held on the page, so a link cannot
   * outlive its short expiry, and the artifact is named by IDENTITY - this capsule never holds,
   * builds or is told a storage location.
   */
  const view = useCallback(
    async (onboardingDocumentId: string) => {
      try {
        const download = await getOnboardingDocumentDownload(
          invocationId,
          onboardingDocumentId,
        );
        setViewError(null);
        window.open(download.url, "_blank", "noopener,noreferrer");
      } catch (failure: unknown) {
        setViewError(failure);
      }
    },
    [invocationId],
  );

  /**
   * The same retrieval, for any of his elections.
   *
   * ONE PATH FOR THE CURRENT COPY AND EVERY HISTORICAL ONE, because they are the same kind of thing:
   * each election's artifact is the document THAT election produced, named by identity, fetched at
   * the moment of viewing. A superseded copy is not regenerated to be opened.
   */
  const openArtifact = useCallback(
    (onboardingDocumentId: string) => {
      void view(onboardingDocumentId);
    },
    [view],
  );

  /* ---------------------------------------------------------------- render */

  if (loadError) {
    return (
      <section className="ft-certify" data-ft-certify data-ft-certify-state="ERROR">
        <OnboardingErrorNotice error={loadError} onRetry={reload} />
      </section>
    );
  }

  if (!stage) {
    return (
      <section className="ft-certify" data-ft-certify data-ft-certify-state="LOADING">
        <p className="wf-loading">Loading the last step.</p>
      </section>
    );
  }

  /* ------------------------------------------------------------- in force */

  if (stage.executed) {
    const executed = stage.executed;
    return (
      <section
        className="ft-certify"
        data-ft-certify
        data-ft-certify-state="EXECUTED"
        aria-labelledby="ft-certify-heading"
      >
        <h3 className="wf-section-title" id="ft-certify-heading">
          Your choices are in force
        </h3>

        <div className="ft-certify-done" data-ft-executed>
          <p>
            You signed this on {longDate(executed.executedAt)}, and it applies to your pay from{" "}
            {longDate(executed.effectiveFrom)}. We have told payroll.
          </p>
          {executed.exemptionClaimed ? (
            <p data-ft-executed-exemption>
              You are claiming that no federal income tax needs to be held back from your pay.
            </p>
          ) : null}
          <p className="ft-note">
            This is what we have on record. Nothing changes it on its own, and we will not change it
            without you - nobody here can alter your choices for you. If something needs to change,
            you can tell us below while your onboarding is open.
          </p>
        </div>

        {executed.artifactDocumentId ? (
          <div className="ft-certify-artifact" data-ft-artifact>
            <p>
              We have kept a copy of your completed federal withholding record. It is in your
              documents, and you can open it here too.
            </p>
            <div className="wf-btn-row">
              <button
                type="button"
                className="wf-btn wf-btn-secondary"
                data-ft-artifact-view
                onClick={() => void view(executed.artifactDocumentId as string)}
              >
                Open your copy
              </button>
            </div>
            {viewError ? (
              <p className="wf-field-error" role="alert" data-ft-artifact-error>
                We could not open your copy just now. Please try again in a moment.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="wf-empty" data-ft-artifact-pending>
            Your copy is being prepared. It will appear in your documents shortly.
          </p>
        )}

        {/*
          HIS WHOLE RECORD, AND THE GOVERNED WAY TO ADD TO IT. History first, because what he has
          already elected is the context for electing again; then the two governed reasons, whose
          wording is the server's. Both are append-only: the panel below produces a NEW election
          through the same governed sequence as his first one, and the panel above it is a record
          rather than a set of controls.
        */}
        <FederalTaxHistory history={stage.history} onOpenArtifact={openArtifact} />

        <FederalTaxNewElection
          invocationId={invocationId}
          newElection={stage.newElection}
          changeable={changeable}
          onCertified={setStage}
        />
      </section>
    );
  }

  /* ------------------------------------------------------------- not open */

  if (!stage.available) {
    return (
      <section
        className="ft-certify"
        data-ft-certify
        data-ft-certify-state="BLOCKED"
        aria-labelledby="ft-certify-heading"
      >
        <h3 className="wf-section-title" id="ft-certify-heading">
          One more step after this
        </h3>
        <ul className="ft-certify-blockers">
          {stage.blockers.map((blocker) => (
            <li key={blocker} data-ft-blocker={blocker}>
              {BLOCKER_MESSAGES[blocker]}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  /* ------------------------------------------------------------ certifying */

  // A worker claiming an exemption affirms BOTH governed conditions or is not offered the signing
  // control at all. Withholding the control rather than letting him sign and be refused is the
  // honest ordering: the server applies the same rule and refuses either way.
  const exemptionSatisfied =
    !stage.exemptionElected || (affirmedFirst && affirmedSecond);

  return (
    <section
      className="ft-certify"
      data-ft-certify
      data-ft-certify-state="READY"
      aria-labelledby="ft-certify-heading"
    >
      <h3 className="wf-section-title" id="ft-certify-heading">
        Put your choices in force
      </h3>

      {/*
        WHAT HE IS PUTTING IN FORCE, as the SERVER read it back from the answers it holds. Rendered
        from the stage rather than from the interview on screen above, so what he is shown at the
        moment of signing is what the server will actually record.
      */}
      <dl className="ft-review-list" data-ft-certify-review>
        {stage.review.map((line) => (
          <div className="ft-review-row" key={line.key} data-ft-certify-line={line.key}>
            <dt className="ft-review-question">{line.prompt}</dt>
            <dd className="ft-review-answer">{line.answer}</dd>
          </div>
        ))}
      </dl>

      {/*
        JARVIS'S OWN WORDS, under their own heading, OUTSIDE the certification card below (OR-3).
        This block is Jarvis explaining; it is not part of what he certifies and is not hashed with
        it. It is never rendered inside the card and the card's wording is never rendered in here.
      */}
      <div className="ft-certify-guidance" data-ft-certify-guidance>
        <h4 className="ft-guidance-heading">What this means, in our words</h4>
        {stage.guidance.map((paragraph, index) => (
          <p className="ft-guidance-text" key={index}>
            {paragraph}
          </p>
        ))}
      </div>

      {stage.exemptionElected ? (
        <div className="ft-certify-exemption" data-ft-exemption-conditions>
          <h4 className="ft-guidance-heading">
            Both of these have to be true, and only you can say so
          </h4>
          {stage.exemptionGuidance.map((paragraph, index) => (
            <p className="ft-guidance-text" key={index}>
              {paragraph}
            </p>
          ))}
          <label className="ft-check" htmlFor="ft-affirm-0">
            <input
              id="ft-affirm-0"
              type="checkbox"
              data-ft-affirm="0"
              checked={affirmedFirst}
              disabled={!changeable || submitting}
              onChange={(event) => setAffirmedFirst(event.target.checked)}
            />
            <span>{conditionText(stage, 0)}</span>
          </label>
          <label className="ft-check" htmlFor="ft-affirm-1">
            <input
              id="ft-affirm-1"
              type="checkbox"
              data-ft-affirm="1"
              checked={affirmedSecond}
              disabled={!changeable || submitting}
              onChange={(event) => setAffirmedSecond(event.target.checked)}
            />
            <span>{conditionText(stage, 1)}</span>
          </label>
        </div>
      ) : null}

      {refusal ? (
        <p className="wf-field-error" role="alert" data-ft-certify-refusal={refusal.kind}>
          {refusal.message}
        </p>
      ) : null}

      {exemptionSatisfied ? (
        <>
          <p className="ft-note" data-ft-authoritative-notice>
            The wording below is the federal government&apos;s own. We are not allowed to change it,
            and it is what you are signing.
          </p>
          {/*
            THE DELIVERED SHARED CARD, and the delivered capture surface behind it. The governed
            wording, its version, the round-trip identifiers and the drawing pad are all its own -
            this module supplies the subject the server projected and a handler, and nothing else.
          */}
          <ul className="ob-exec-list" data-ft-authoritative-certification>
            <ExecutionSubjectCard
              subject={stage.certification}
              submitting={submitting}
              refusal={null}
              changeable={changeable}
              onSubmit={certify}
            />
          </ul>
        </>
      ) : (
        <p className="ft-note" data-ft-exemption-gate>
          Confirm both of the statements above, and then you can sign this.
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

/** One governed condition's wording, as the server supplied it. Never authored here. */
function conditionText(
  stage: FederalTaxCertificationStage,
  index: number,
): string {
  return stage.exemptionConditions[index]?.condition ?? "";
}

function longDate(value: string): string {
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "an earlier date";
  return when.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default FederalTaxCertification;
