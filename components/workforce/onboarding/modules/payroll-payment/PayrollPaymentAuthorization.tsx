"use client";

/**
 * Module 4.4 Gate 10C - the authorization stage, as the worker performs it.
 *
 * THE LAST STEP OF THE MODULE AND THE ONLY IRREVERSIBLE ONE. Everything he did before this was a
 * saved proposal he could change; here he puts it in force. It renders beneath the review he is
 * authorizing rather than at a URL of its own, because the module declares a single step and this
 * is not a second question - the delivered I-9 and Federal Tax capsules compose their own acts into
 * the foot of a step for the same reason.
 *
 * IT BUILDS NO PART OF THE ACT ITSELF, AND THAT IS THE WHOLE DESIGN.
 *
 *  - THE MARK IS DRAWN ON THE DELIVERED SHARED SURFACE. `ExecutionSubjectCard` renders the governed
 *    wording, the version it is in force at, and the capture surface behind it. There is no canvas
 *    in this capsule, no stroke handling, no pointer arithmetic and no local signature engine. The
 *    coordinates never enter this file or this module's state - they go from the shared surface
 *    into one request and are discarded.
 *  - THE WORDING IS THE SERVER'S. The authorization statement arrives resolved and hashed and is
 *    passed through untouched. Nothing here authors it, edits it, paraphrases it or truncates it,
 *    and nothing here computes a hash.
 *  - THE ROUND TRIP IS THE SHARED CARD'S. It reads `revision`, `contentHash` and `ruleRevision` off
 *    the subject that produced what is on screen and hands them back with the act, so a worker who
 *    signed wording that has since moved is refused rather than silently re-pointed at wording he
 *    never saw.
 *
 * THE TWO KINDS OF WORDS ARE PRESENTED SEPARATELY AND LABELLED SEPARATELY. Jarvis's explanation is
 * above, under its own heading, marked as ours. The governed authorization is below it inside the
 * delivered card. They are never interleaved and the explanation is never placed inside the card -
 * what he signs is exactly the governed statement and nothing this module wrote.
 *
 * WHAT THIS FILE CANNOT DO, none of it a missing button:
 *
 *  - IT NEVER COMPLETES THE MODULE. The runtime's `complete` is not called here and is not reachable
 *    from here. Completion is DERIVED server-side from this module's own validator once the
 *    instruction, the act and the binding between them all exist. A browser claiming completion
 *    would be a second completion authority disagreeing with the first.
 *  - IT NEVER DECIDES WHETHER HE MAY AUTHORIZE. `available` and `blockers` are read and displayed.
 *    The server decides every one of those conditions again when the act arrives.
 *  - IT NEVER SEES A BANKING VALUE HE HAS GIVEN US. Every projection is masked and there is no call
 *    in this capsule that could obtain anything wider (10-R7).
 *  - IT PROMISES NO PAYCHECK, no bank acceptance, no transmission and no card. What it reports
 *    afterwards is what is on record, and the recorded-outcome shape has no field for anything
 *    else.
 *  - IT OFFERS NO WAY TO CHANGE INSTRUCTIONS ALREADY IN FORCE ON ITS OWN INITIATIVE.
 *
 *    [AMENDED BY GATE 10C-E3 SLICE 4, and the amendment is narrow. What this bullet used to say -
 *    that changing instructions in force was deferred and unbuilt - is no longer true: a worker
 *    who was SHOWN the record governing his pay and answered "No, I need to make a change" can now
 *    replace it, and the last step of that change is this same signature. What has NOT changed is
 *    that nothing here decides it. This component holds no control that offers a change, resolves
 *    no record, and compares nothing: it is handed a claim by the screen that asked him the
 *    question, or it is handed nothing, and an act carrying nothing is refused by the server
 *    exactly as it always was.]
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { packetPath } from "@/lib/workforce/onboardingRuntimeApi";
import ExecutionSubjectCard from "@/components/workforce/onboarding/execution/ExecutionSubjectCard";
import type { ExecutionAct } from "@/components/workforce/onboarding/execution/ExecutionFormControl";
import OnboardingErrorNotice from "@/components/workforce/onboarding/runtime/OnboardingErrorNotice";
import type { OnboardingExecutionSubject } from "@/lib/workforce/onboardingExecutionApi";
import {
  authorizeOwnPayrollPayment,
  getOwnPayrollPaymentAuthorization,
  payrollPaymentRefusalCode,
  PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT,
  type PayrollPaymentAuthorization as PayrollPaymentAuthorizationStage,
  type PayrollPaymentAuthorizationBlocker,
} from "@/lib/workforce/payrollPaymentApi";
import { payrollPaymentRefusalMessage } from "./payrollPaymentRefusal";

type Props = {
  invocationId: string;
  /**
   * Changes whenever the saved proposal changes.
   *
   * Availability depends on a proposal this component does not own, so it RE-READS rather than
   * remembering: a worker who corrects an account and saves must be offered the authorization
   * without reloading the page, and one whose proposal stops being admissible must stop being
   * offered it.
   */
  proposalToken: string;
  /** False for a packet that has left the worker's hands: shown, never acted on. */
  changeable: boolean;
  /**
   * [ADDED BY GATE 10C-E3 SLICE 4.] The record the worker deliberately chose to replace, or null.
   *
   * NULL IS THE DEFAULT AND THE OVERWHELMING CASE. It is non-null only after he pressed "No - I
   * need to make a change" against a record he was shown, and it is the identity of THAT record -
   * never re-read, never refreshed, never substituted for whatever is current when he signs. This
   * component does not resolve it, does not compare it and does not display it; it hands it on,
   * and the server decides.
   */
  replaces?: string | null;
  /**
   * The server refused the replacement because what is in force is no longer the record named.
   *
   * Raised so the screen that OWNS the claim can drop it and read the authority again. This
   * component does not re-aim the act at whatever arrived instead, because a worker who has never
   * seen that record has not asked to replace it.
   */
  onReplacementRefused?: () => void;
};

/**
 * The refusals that mean a replacement claim is no longer good (Gate 10C-E3).
 *
 * `ALREADY_AUTHORIZED` IS ONE OF THEM HERE, AND ONLY HERE. On an ordinary authorization it means
 * what it has always meant - the act arrived twice - and is answered exactly as before. On an
 * authorization carrying a replacement claim it can only mean the server did not accept the claim
 * and fell through to the default refusal, which is the same stale-screen situation as the other
 * two: read again, do not resend.
 */
const REPLACEMENT_LAPSED_CODES: readonly string[] = [
  "REPLACEMENT_INSTRUCTION_MISMATCH",
  "NO_EFFECTIVE_INSTRUCTION",
  "ALREADY_AUTHORIZED",
];

/** Why he may not authorize yet, in his own words. Keyed by code so none leaks as an identifier. */
const BLOCKER_MESSAGES: Record<PayrollPaymentAuthorizationBlocker, string> = {
  PROPOSAL_NOT_REVIEW_READY:
    "Finish the payment details above and read them through. Then you can put them in force here.",
  ALREADY_AUTHORIZED:
    "Your payroll payment instructions are already in force. If they need to change, tell us and we will record new ones.",
};

export function PayrollPaymentAuthorization({
  invocationId,
  proposalToken,
  changeable,
  replaces = null,
  onReplacementRefused,
}: Props) {
  const [stage, setStage] = useState<PayrollPaymentAuthorizationStage | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const reload = useCallback(() => setReloads((count) => count + 1), []);

  useEffect(() => {
    // `live` guards a response arriving after the worker moved on, which would otherwise show one
    // packet's authorization under another's screen.
    let live = true;
    getOwnPayrollPaymentAuthorization(invocationId)
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
  }, [invocationId, proposalToken, reloads]);

  /**
   * Perform the act.
   *
   * The subject handed back by the shared card is the one that produced what is on screen, so its
   * three content identifiers are read from it rather than refreshed - refreshing them is exactly
   * how a claim about a display the worker never saw gets submitted.
   *
   * WHAT COMES BACK REPLACES WHAT IS HELD. The response is the authoritative stage, so what he is
   * shown afterwards is the server's answer and never an optimistic local guess.
   */
  const authorize = useCallback(
    async (
      subject: OnboardingExecutionSubject,
      act: ExecutionAct,
    ): Promise<boolean> => {
      // An attestation cannot satisfy this subject. The delivered card only produces one for the
      // two acknowledgement forms, and the server refuses a mismatch independently; failing closed
      // here means a client defect cannot send an authorization with no mark attached.
      if (act.kind !== "CAPTURE") return false;
      if (submitting) return false;

      setSubmitting(true);
      setRefusal(null);
      try {
        const value = await authorizeOwnPayrollPayment(invocationId, {
          presented: {
            revision: subject.content.revision,
            contentHash: subject.content.contentHash,
            ruleRevision: subject.content.ruleRevision,
          },
          // The SUBJECT's own required act, copied. Naming an act here can only fail the
          // authorization; it can never define it.
          performedForm: subject.requiredForm,
          capture: act.capture,
          /*
            [ADDED BY GATE 10C-E3 SLICE 4.] The claim, when there is one, and nothing when there
            is not - the client omits the field entirely rather than sending null, so an ordinary
            authorization is the request it always was. Nothing here decides whether a claim is
            warranted: this component is handed one or it is not.
          */
          replaces: replaces ? { reviewedInstructionId: replaces } : null,
        });
        setStage(value);
        return true;
      } catch (failure: unknown) {
        const code = payrollPaymentRefusalCode(failure);
        setRefusal(
          code
            ? payrollPaymentRefusalMessage(code)
            : "Something went wrong at our end and nothing was put in force. Please try again.",
        );
        /*
          A REFUSED REPLACEMENT GOES BACK TO WHOEVER MADE THE CLAIM (Gate 10C-E3), and only when a
          claim was actually made - so an ordinary duplicate authorization behaves exactly as it
          did before this slice, refused and re-read in place.

          It is handed UP rather than handled here because the recovery is not this component's:
          the claim, the record on screen and the question the worker was answering all live in
          the module, and re-aiming the act from inside here is precisely the silent re-anchoring
          the server refused.
        */
        if (replaces !== null && code !== null && REPLACEMENT_LAPSED_CODES.includes(code)) {
          onReplacementRefused?.();
          return false;
        }
        // Anything that says the server has moved past what was on screen is followed by a fresh
        // read, so he never signs twice against a stage that no longer exists.
        if (code === "ALREADY_AUTHORIZED" || code === "PROPOSAL_NOT_REVIEW_READY") {
          reload();
        }
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [invocationId, onReplacementRefused, reload, replaces, submitting],
  );

  /* ---------------------------------------------------------------- render */

  if (loadError) {
    return (
      <section className="pp-authorize" data-pp-authorize data-pp-authorize-state="ERROR">
        <OnboardingErrorNotice error={loadError} onRetry={reload} />
      </section>
    );
  }

  if (!stage) {
    return (
      <section className="pp-authorize" data-pp-authorize data-pp-authorize-state="LOADING">
        <p className="wf-loading">Loading the last step.</p>
      </section>
    );
  }

  /* ------------------------------------------------------------- in force */

  if (stage.executed) {
    const executed = stage.executed;
    const bank = executed.paymentMethod === PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT;

    return (
      <section
        className="pp-authorize"
        data-pp-authorize
        data-pp-authorize-state="EXECUTED"
        aria-labelledby="pp-authorize-heading"
      >
        <h3 className="wf-section-title" id="pp-authorize-heading">
          Payroll Payment complete
        </h3>

        {/*
          THE SECURED RECORDED OUTCOME, WORD FOR WORD, and the two are different sentences because
          the two situations are different. For his own bank account the instruction is in effect
          and there is nothing outstanding. For the payroll card his SELECTION is complete and the
          card setup is still MW4H's to do, which the sentence says plainly rather than leaving him
          to discover it when no card arrives.

          NEITHER SENTENCE PROMISES ANYTHING GATE 10C DID NOT DO. No money moved, no bank was
          contacted or verified, no payroll provider was told, no payroll was run and no paycheck
          was identified. There is no field on the recorded outcome that could support such a
          sentence, which is what keeps this honest as the screen changes.
        */}
        <div className="pp-authorize-done" data-pp-executed>
          {bank ? (
            <p data-pp-outcome="DEPOSIT">
              Your payroll payment instructions have been saved and are now in effect.
            </p>
          ) : (
            <p data-pp-outcome="CARD">
              You selected an MW4H Comdata Payroll Card. Your payroll payment selection is complete.
              MW4H will complete the card setup.
            </p>
          )}
          <p className="pp-fine" data-pp-executed-when>
            You signed this on {longDate(executed.authorizedAt)}.
          </p>
        </div>

        {bank ? (
          <div className="pp-authorize-accounts" data-pp-executed-accounts>
            {/*
              KEYED BY POSITION, WHICH IS NOT THE SAME AS KEYING BY ARRAY ORDER, AND IS NOT AN
              IDENTITY CLAIM.

              The recorded outcome carries no `accountId`. It never did: the stable identifier is
              how a DRAFT account is recognised across saves so its protected values carry forward
              (QA-L4-R1), and there is no such round trip against an authorized version. Reaching
              for it here is what produced React's missing-key warning after a real authorization -
              the field was simply `undefined`.

              Position is the right answer for this one list rather than a convenient one. What is
              rendered is a frozen projection of an immutable instruction version: it cannot
              reorder, cannot gain a row and cannot lose one, so `position` is unique and stable
              for exactly as long as the list exists. The hazard that makes order-derived keys a
              mistake - a row's state following the wrong row after a move - needs a list that
              moves and children that hold state, and neither is true of these read-only lines.

              It changes no domain identity. Account identity still lives on the draft, still
              travels on save, and nothing about that is expressed on this screen.
            */}
            {executed.accounts.map((account) => (
              <p
                className="pp-fine"
                key={account.position}
                data-pp-executed-account={account.position}
              >
                {account.financialInstitutionName || "Your bank"} ending{" "}
                {account.accountNumberMasked ?? "in the digits you gave us"}
              </p>
            ))}
          </div>
        ) : null}

        <p className="pp-note" data-pp-executed-change>
          If your details change, tell us and we will record new instructions. We keep what you
          signed before, exactly as you signed it.
        </p>

        {/*
          WHERE HE GOES NEXT, once he has been told it is done. Signing was the last thing this
          module asked of him, and his sections are where he sees what that left outstanding - so
          the ordinary next step is offered plainly, and it is a link to a screen rather than
          anything that touches his record.
        */}
        <div className="wf-btn-row">
          <Link
            className="wf-btn wf-btn-primary"
            data-pp-return-to-packet
            href={packetPath(invocationId)}
          >
            Back to my sections
          </Link>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------------------- not open */

  if (!stage.available) {
    return (
      <section
        className="pp-authorize"
        data-pp-authorize
        data-pp-authorize-state="BLOCKED"
        aria-labelledby="pp-authorize-heading"
      >
        <h3 className="wf-section-title" id="pp-authorize-heading">
          One more step after this
        </h3>
        <ul className="pp-authorize-blockers">
          {stage.blockers.map((blocker) => (
            <li key={blocker} data-pp-blocker={blocker}>
              {BLOCKER_MESSAGES[blocker]}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  /* ----------------------------------------------------------- authorizing */

  return (
    <section
      className="pp-authorize"
      data-pp-authorize
      data-pp-authorize-state="READY"
      aria-labelledby="pp-authorize-heading"
    >
      <h3 className="wf-section-title" id="pp-authorize-heading">
        Put your payroll payment instructions in force
      </h3>

      {/*
        JARVIS'S OWN WORDS, under their own heading, OUTSIDE the card below. This block is Jarvis
        explaining; it is not part of what he signs and is not hashed with it.
      */}
      <div className="pp-authorize-guidance" data-pp-authorize-guidance>
        <h4 className="pp-guidance-heading">What this means, in our words</h4>
        {stage.guidance.map((paragraph, index) => (
          <p className="pp-guidance-text" key={index}>
            {paragraph}
          </p>
        ))}
      </div>

      {refusal ? (
        <p className="wf-field-error" role="alert" data-pp-authorize-refusal>
          {refusal}
        </p>
      ) : null}

      {/*
        THE DELIVERED SHARED CARD, and the delivered capture surface behind it. The governed
        wording, its version, the round-trip identifiers and the drawing pad are all its own - this
        module supplies the subject the server projected and a handler, and nothing else.
      */}
      <ul className="ob-exec-list" data-pp-authorization-statement>
        <ExecutionSubjectCard
          subject={stage.authorization}
          submitting={submitting}
          refusal={null}
          changeable={changeable}
          onSubmit={authorize}
        />
      </ul>
    </section>
  );
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

export default PayrollPaymentAuthorization;
