"use client";

/**
 * Module 4.4 Gate 10C-E3 - the one question asked about a record ALREADY IN FORCE.
 *
 * WHAT MAKES THIS DIFFERENT FROM THE REVIEW PANEL, and why it is a second component rather than a
 * prop on the first. That panel shows a PROPOSAL and says so in its last line: this is what you
 * have told us, it is not in place yet, signing puts it in force. Every one of those sentences is
 * false here. This panel shows the instruction that is ALREADY governing his pay, and the worker
 * is not being asked to check his typing - he is being asked whether the arrangement he made some
 * time ago is still the one he wants. Rendering the proposal panel over an instruction in force
 * would require inventing the draft fields it reads and would tell him his wages were waiting on a
 * signature. The one thing the two screens genuinely share - how a split reads in words - is
 * shared as `shareOf` rather than copied.
 *
 * WHAT HE IS SHOWN IS WHAT THE SERVER ALREADY SHOWS EVERY OTHER READER: the masked projection of
 * the instruction, unchanged. This component reads the payment method and the accounts off it and
 * NOTHING ELSE. The version number, the date it took effect, whether anything superseded it and
 * the record's own identity are all on the object it holds and none of them reach the screen -
 * they are record-keeping facts, and a worker asked "is this still right?" is not helped by any of
 * them.
 *
 * THE IDENTITY IS NEVER RENDERED AND NEVER PUT IN AN ATTRIBUTE. This panel is not given it. It
 * calls back to say YES or to say CHANGE, and the module that holds the identity is the one that
 * decides what to do with either answer - so there is no path from this file to a screen, a DOM
 * attribute or a log carrying an opaque record identifier.
 *
 * TWO ANSWERS, BOTH PLAINLY LABELLED, NEITHER OF THEM A TRAP. "Yes" writes an affirmation and
 * changes no payment details. "No" changes nothing yet - it opens the same interview he filled in
 * the first time, and his current instructions keep governing his pay until he authorizes new
 * ones. There is no confirmation modal in front of either, because neither is destructive at the
 * moment it is pressed.
 */

import {
  PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE,
  PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT,
  type PayrollPaymentInstructionView,
} from "@/lib/workforce/payrollPaymentApi";
import { shareOf } from "./PayrollPaymentReviewPanel";

const ACCOUNT_TYPE_WORDS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
};

type Props = {
  /** The masked instruction in force, exactly as the server projected it. */
  instruction: PayrollPaymentInstructionView;
  /** True while his answer is with the server. Both actions are held for the duration. */
  submitting: boolean;
  /** False for a packet that is no longer his to act on. */
  changeable: boolean;
  onYes: () => void;
  onChange: () => void;
};

export function PayrollPaymentVerifyPanel({
  instruction,
  submitting,
  changeable,
  onYes,
  onChange,
}: Props) {
  const bank = instruction.paymentMethod === PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT;
  const percentageMode =
    instruction.allocationMode === PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE;
  const held = submitting || !changeable;

  return (
    <section
      className="pp-verify"
      data-pp-verify
      aria-labelledby="pp-verify-heading"
    >
      <h3 className="pp-review-title" id="pp-verify-heading">
        Review how you get paid
      </h3>

      <dl className="pp-review-list">
        <dt>How you are paid now</dt>
        <dd data-pp-verify-method>
          {bank
            ? "Direct Deposit into your own account"
            : "MW4H Comdata Payroll Card"}
        </dd>
      </dl>

      {bank ? (
        <>
          {instruction.accounts.map((account) => (
            <div
              className="pp-review-account"
              key={account.position}
              data-pp-verify-account={account.position}
            >
              <h4 className="pp-review-account-title">
                {account.financialInstitutionName || "Your bank"}
                <span className="pp-review-chip" data-pp-verify-account-type>
                  {ACCOUNT_TYPE_WORDS[account.accountType] ?? account.accountType}
                </span>
              </h4>
              <dl className="pp-review-list">
                <dt>Routing number</dt>
                <dd data-pp-verify-routing>{account.routingNumberMasked}</dd>
                <dt>Account number</dt>
                <dd data-pp-verify-account-number>
                  {account.accountNumberMasked}
                </dd>
                <dt>What goes here</dt>
                <dd data-pp-verify-share>{shareOf(account, percentageMode)}</dd>
              </dl>
            </div>
          ))}

          <p className="pp-fine" data-pp-verify-masking>
            We only ever show you the last few digits. We are not able to show you
            the whole numbers again, and neither can anyone who helps you with your
            account.
          </p>
        </>
      ) : (
        /*
          THE CARD, AS THE WORKER RECOGNISES IT, and no further than that. Whether a card was
          ordered, whether it arrived, whether it is active and who is dealing with it are MW4H's
          business and are not on the projection this panel holds - so there is no sentence here
          that could report one, and no control that could start one.
        */
        <div className="pp-review-card" data-pp-verify-card>
          <p>You are paid on an MW4H Comdata payroll card.</p>
        </div>
      )}

      {/*
        THE QUESTION, IN ONE LINE AND IN HIS WORDS. It is tied to both answers by
        `aria-describedby`, so a worker moving through the page by keyboard or hearing it read
        aloud is told what the two buttons are answering rather than meeting "Yes" on its own.
      */}
      <p className="pp-verify-question" id="pp-verify-question">
        Is this still how you want to be paid?
      </p>

      {submitting ? (
        <p className="pp-note" role="status" data-pp-verify-in-flight>
          Saving your answer.
        </p>
      ) : null}

      <div className="pp-actions wf-btn-row">
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          data-pp-verify-action="yes"
          aria-describedby="pp-verify-question"
          disabled={held}
          onClick={onYes}
        >
          Yes - this is still correct
        </button>
        <button
          type="button"
          className="wf-btn wf-btn-secondary"
          data-pp-verify-action="change"
          aria-describedby="pp-verify-question"
          disabled={held}
          onClick={onChange}
        >
          No - I need to make a change
        </button>
      </div>

      {/*
        WHAT PRESSING "NO" ACTUALLY DOES, said before he presses it. A worker who thinks choosing
        to change his details stops his pay in the meantime will not press it, and one who thinks
        it has already taken effect will stop halfway through. Both are answered here.
      */}
      <p className="pp-fine" data-pp-verify-change-note>
        If you need to change something, we will take you through your payment
        details again. Nothing changes until you finish and sign.
      </p>
    </section>
  );
}

export default PayrollPaymentVerifyPanel;
