"use client";

/**
 * Module 4.4 - how the worker would like to be paid.
 *
 * BOTH APPROVED METHODS ARE OFFERED, AND NEITHER IS RECOMMENDED (10-R14). There is no default, no
 * pre-selection, no "most people choose this", and no ordering claim: the two are presented as
 * equals and the choice is his. A payroll card is the right answer for a worker without a bank
 * account, and a screen that treats it as the lesser option is telling him something untrue about
 * his own circumstances.
 *
 * NOTHING HERE IS ALREADY IN FORCE, AND THE WORDING SAYS SO. Choosing the card does not create a
 * card, assign one, order one or activate one - this gate carries his ELECTION as far as review and
 * no further (10-R15). The card copy therefore describes what MW4H will do afterwards, in the
 * future tense, because that is the truth.
 *
 * THE TOKENS ARE IMPORTED AND NEVER SPELLED. See the wire contract's own header, and 10-R16: the
 * words on this screen are the worker's, and the wire vocabulary lives in one file that is not
 * this one.
 */

import {
  PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT,
  PAYROLL_PAYMENT_METHOD_PAYROLL_CARD,
  type PayrollPaymentMethod,
} from "@/lib/workforce/payrollPaymentApi";

export default function PaymentMethodChoice({
  chosen,
  disabled,
  onChoose,
}: {
  chosen: PayrollPaymentMethod | null;
  disabled: boolean;
  onChoose: (method: PayrollPaymentMethod) => void;
}) {
  return (
    <fieldset className="pp-fieldset" data-pp-method-choice>
      <legend className="pp-legend">How would you like to receive your pay?</legend>

      <p className="pp-help">
        Both choices are available to you. You do not need a bank account to be paid.
      </p>

      <label
        className="pp-choice"
        data-pp-choice="bank"
        data-pp-chosen={chosen === PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT}
      >
        <input
          type="radio"
          name="pp-method"
          value={PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT}
          checked={chosen === PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT}
          disabled={disabled}
          onChange={() => onChoose(PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT)}
        />
        <span className="pp-choice-body">
          <span className="pp-choice-title">Direct Deposit</span>
          <span className="pp-choice-detail">
            Your pay goes straight into your own bank or credit union account on payday. You can
            split it between up to three accounts. You will need your routing number and account
            number, which are on your cheques or in your bank&rsquo;s app.
          </span>
        </span>
      </label>

      <label
        className="pp-choice"
        data-pp-choice="card"
        data-pp-chosen={chosen === PAYROLL_PAYMENT_METHOD_PAYROLL_CARD}
      >
        <input
          type="radio"
          name="pp-method"
          value={PAYROLL_PAYMENT_METHOD_PAYROLL_CARD}
          checked={chosen === PAYROLL_PAYMENT_METHOD_PAYROLL_CARD}
          disabled={disabled}
          onChange={() => onChoose(PAYROLL_PAYMENT_METHOD_PAYROLL_CARD)}
        />
        <span className="pp-choice-body">
          <span className="pp-choice-title">MW4H Comdata Payroll Card</span>
          <span className="pp-choice-detail">
            Your pay goes onto a payroll card instead of a bank account. You do not need a bank
            account and you do not need to enter any bank details here. If you choose this, MW4H
            will arrange the card with you after this section is finished.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
