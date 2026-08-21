"use client";

/**
 * Module 4.2 Federal Tax - electing again, once an election is already in force.
 *
 * TWO GOVERNED REASONS, AND THE WORKER SAYS WHICH (8D-R4). One says the information on his current
 * record was WRONG; the other says it was RIGHT for the time it applied and he is now electing
 * differently. THE DISTINCTION IS THE WHOLE POINT OF THIS SCREEN, and it is why this is not a single
 * "change my W-4" button: Jarvis cannot derive which of the two he means, and guessing would either
 * put a fabricated admission of error on his permanent record or hide a real one.
 *
 * HE IS NEVER SHOWN THE VOCABULARY THE RECORD USES. The two sentences he chooses between are the
 * SERVER'S, projected with the option, and this component neither authors nor reworded either of
 * them. A worker does not have to know what "supersede" means in order to fix a mistake.
 *
 * IT EDITS NOTHING AND CAN EDIT NOTHING. What he is about to put in force is the answer set the
 * server already holds - he changes it in the interview above, saves, and comes back here - and the
 * act itself travels the SAME governed sequence a first election travels, through the same single
 * route. There is no field on the request that names a version to change, no control here that could
 * revise a recorded election, and nothing that deletes one. His earlier election, its execution and
 * its retained copy all survive exactly as they were.
 *
 * WHAT THIS FILE DOES NOT DO, none of it a missing button:
 *
 *  - IT NEVER DECIDES WHETHER HE MAY ELECT AGAIN. `available`, the blockers and the options are read
 *    and displayed; the server re-decides every one of those conditions when the act arrives, which
 *    is why the reason gate below withholds a control rather than granting one.
 *  - IT NEVER MANUFACTURES A REASON. A reason is collected exactly where the chosen option says one
 *    is required, and sending one where it is not is REFUSED by the server rather than dropped.
 *  - IT BUILDS NO PART OF THE ACT. The governed wording, its version, the round-trip identifiers and
 *    the capture surface are all the delivered shared card's, exactly as on the first election.
 *  - IT IS NOT A PORTAL AND OPENS NO SECOND WAY IN. This affordance exists only inside the
 *    authenticated, bound onboarding runtime that rendered it. There is no access link here, no
 *    one-time code, no re-authentication and no post-hire route: a worker who has left that runtime
 *    reaches nothing from this file, and that limitation is deliberate.
 */

import { useCallback, useState } from "react";
import ExecutionSubjectCard from "@/components/workforce/onboarding/execution/ExecutionSubjectCard";
import type { ExecutionAct } from "@/components/workforce/onboarding/execution/ExecutionFormControl";
import type { ExecutionRefusal } from "@/components/workforce/onboarding/execution/useExecutionSubmission";
import type { OnboardingExecutionSubject } from "@/lib/workforce/onboardingExecutionApi";
import {
  certifyOwnFederalTaxNewElection,
  type FederalTaxCertification,
  type FederalTaxCertificationBlocker,
  type FederalTaxNewElection as FederalTaxNewElectionState,
} from "@/lib/workforce/federalTaxApi";
import { classifyFederalTaxRefusal } from "./federalTaxRefusal";

/** Why electing again is not open to him, in his own words. Keyed by code, never shown as one. */
const BLOCKER_MESSAGES: Record<FederalTaxCertificationBlocker, string> = {
  INTERVIEW_NOT_COMPLETE:
    "Change the answers above to what you want them to be, confirm that you have read them through, and then you can put the new choices in force here.",
  QUESTION_SET_SUPERSEDED:
    "We have changed some of these questions since you answered them. Please read your answers through again and confirm your review once more.",
  ELECTION_ALREADY_EXECUTED:
    "Your choices are already in force. If they need to change, tell your MW4H contact.",
  NO_OPERATIVE_ELECTION:
    "You do not have federal withholding choices in force yet, so there is nothing to correct or replace.",
};

export default function FederalTaxNewElection({
  invocationId,
  newElection,
  changeable,
  onCertified,
}: {
  invocationId: string;
  /**
   * Whether he may elect again, the governed reasons he may state, and the authoritative
   * certification projected against the act he has not yet performed. ALL THE SERVER'S ANSWERS,
   * carried whole - including the subject, which this file passes through untouched.
   */
  newElection: FederalTaxNewElectionState;
  /** False for a packet that has left his hands: shown, never acted on. */
  changeable: boolean;
  onCertified: (stage: FederalTaxCertification) => void;
}) {
  /**
   * Which of the two he is stating, and what he says was wrong.
   *
   * NEITHER IS PRE-SELECTED AND NEITHER IS REMEMBERED. Defaulting the choice would decide on his
   * behalf whether he had made a mistake, and a reason kept across a change of option would carry an
   * admission of error into an election that states the opposite - so it is cleared when he chooses
   * again.
   */
  const [origin, setOrigin] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<ExecutionRefusal | null>(null);

  const chosen = newElection.options.find((option) => option.origin === origin);

  const choose = useCallback((next: string) => {
    setOrigin(next);
    setReason("");
    setRefusal(null);
  }, []);

  /**
   * Perform the act.
   *
   * The subject handed back by the shared card is the one that produced what is on screen, so its
   * three content identifiers are read from it rather than refreshed - refreshing them is exactly how
   * a claim about a display the worker never saw gets submitted.
   */
  const certify = useCallback(
    async (
      subject: OnboardingExecutionSubject,
      act: ExecutionAct,
    ): Promise<boolean> => {
      // An attestation cannot satisfy this subject, and a later election is not an act this screen
      // may compose without a chosen reason. Failing closed here means a client defect cannot send
      // an election whose origin nobody stated.
      if (act.kind !== "CAPTURE") return false;
      if (!chosen || submitting) return false;

      setSubmitting(true);
      setRefusal(null);
      try {
        const value = await certifyOwnFederalTaxNewElection(invocationId, {
          presented: {
            revision: subject.content.revision,
            contentHash: subject.content.contentHash,
            ruleRevision: subject.content.ruleRevision,
          },
          // The SUBJECT's own required act, copied. Naming an act here can only fail the
          // certification; it can never define it.
          performedForm: subject.requiredForm,
          capture: act.capture,
          // COPIED FROM THE OPTION HE CHOSE, verbatim. Never re-derived from which control was
          // clicked, and never inferred from whether he typed a reason.
          origin: chosen.origin,
          // SENT ONLY WHERE THE CHOSEN OPTION REQUIRES ONE. The pair rule is the server's, and the
          // client does not attempt to satisfy it by inventing one.
          correctionReason: chosen.requiresReason ? reason : null,
        });
        onCertified(value);
        setOrigin(null);
        setReason("");
        return true;
      } catch (failure: unknown) {
        setRefusal(classifyFederalTaxRefusal(failure));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [chosen, invocationId, onCertified, reason, submitting],
  );

  /* ---------------------------------------------------------------- render */

  if (!newElection.available) {
    // STATED RATHER THAN HIDDEN, and the options are NOT listed beside it: offering him two reasons
    // under a sentence saying he may use neither would invite an attempt the server would refuse.
    return (
      <div className="ft-again" data-ft-again data-ft-again-state="BLOCKED">
        <h4 className="ft-guidance-heading">If something needs to change</h4>
        <ul className="ft-certify-blockers">
          {newElection.blockers.map((blocker) => (
            <li key={blocker} data-ft-again-blocker={blocker}>
              {BLOCKER_MESSAGES[blocker]}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="ft-again" data-ft-again data-ft-again-state="OPEN">
      <h4 className="ft-guidance-heading">If something needs to change</h4>
      <p className="ft-note">
        Your choices above stay exactly as they are unless you sign new ones. If you do, we keep both
        - the record you signed before, and the new one - so it is always clear what applied when.
      </p>

      <div className="ft-again-options" role="group" aria-label="Why you are electing again">
        {newElection.options.map((option) => (
          <label
            className="ft-check"
            key={option.origin}
            htmlFor={`ft-again-${option.origin}`}
          >
            <input
              id={`ft-again-${option.origin}`}
              type="radio"
              name="ft-again-origin"
              data-ft-again-option={option.origin}
              checked={origin === option.origin}
              disabled={!changeable || submitting}
              onChange={() => choose(option.origin)}
            />
            <span>
              <span className="ft-again-title">{option.title}</span>
              <span className="ft-again-description">{option.description}</span>
            </span>
          </label>
        ))}
      </div>

      {/*
        THE REASON IS COLLECTED WHERE ONE IS ADMISSIBLE AND NOWHERE ELSE. It appears for the option
        that says something was wrong, and there is no field on screen for the option that says
        nothing was.
      */}
      {chosen?.requiresReason ? (
        <div className="ft-again-reason">
          <label className="wf-label" htmlFor="ft-again-reason">
            What was wrong on your current record?
          </label>
          <textarea
            id="ft-again-reason"
            className="wf-input"
            data-ft-again-reason
            rows={3}
            value={reason}
            disabled={!changeable || submitting}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="ft-note">
            A short description is enough - for example that the filing status or an amount was not
            what you meant. This is kept with the new record.
          </p>
        </div>
      ) : null}

      {refusal ? (
        <p className="wf-field-error" role="alert" data-ft-again-refusal={refusal.kind}>
          {refusal.message}
        </p>
      ) : null}

      {/*
        THE SIGNING CONTROL IS WITHHELD UNTIL HE HAS SAID WHY, rather than offered and then refused.
        A correction with no stated reason and an unchosen option are both refused by the server on
        the same rules, so withholding the control is the honest ordering rather than a second
        opinion about admissibility.
      */}
      {chosen && (!chosen.requiresReason || reason.trim().length > 0) ? (
        <>
          <p className="ft-note" data-ft-again-authoritative-notice>
            You are signing the same federal certification again, for the new choices. The wording is
            the federal government&apos;s own and we are not allowed to change it.
          </p>
          <ul className="ob-exec-list" data-ft-again-certification>
            <ExecutionSubjectCard
              subject={newElection.certification}
              submitting={submitting}
              refusal={null}
              changeable={changeable}
              onSubmit={certify}
            />
          </ul>
        </>
      ) : (
        <p className="ft-note" data-ft-again-gate>
          {chosen
            ? "Tell us what was wrong, and then you can sign the new record."
            : "Choose one of the two above, and then you can sign the new record."}
        </p>
      )}
    </div>
  );
}
