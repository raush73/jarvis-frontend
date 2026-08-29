"use client";

/**
 * Module 4.4 - one bank account, as the worker enters it.
 *
 * WHAT HE IS ASKED FOR IS WHAT IS ON HIS CHEQUE, and the wording says where to find it. A worker who
 * has never set this up before does not know what a routing number is, and telling him "enter your
 * routing number" is not asking a question - it is assuming the answer.
 *
 * THE BANK'S NAME IS HIS TO STATE (10-R3). Jarvis does not look it up, does not confirm it against
 * anybody, and does not correct him. The screen therefore never claims his bank has been found,
 * recognised or verified, because it has not been: there is no live routing-number lookup in this
 * system by ruling, and a screen that implied otherwise would be describing a check that does not
 * run.
 *
 * THE ROUTING NUMBER IS CHECKED, THE ACCOUNT NUMBER IS CONFIRMED, AND THEY ARE DIFFERENT THINGS.
 * A routing number carries a check digit, so a wrong one can be caught arithmetically and is - once,
 * on entry, with no second box (10-R3). An account number carries nothing, so it is typed twice and
 * the SERVER compares the two (10-R10). See `AccountNumberField` for what the browser can and
 * cannot honestly enforce about that.
 *
 * AFTER A SAVE, HE SEES A MASK AND EMPTY BOXES. That is the whole of what comes back (10-R7). The
 * screen says which account is which by its number in the list and by his bank's name, never by
 * showing him digits he has already given us.
 */

import { useId, useState } from "react";
import {
  PAYROLL_ACCOUNT_NUMBER_MAX_LENGTH,
  PAYROLL_ACCOUNT_NUMBER_MIN_LENGTH,
  PAYROLL_DEPOSIT_ACCOUNT_TYPES,
  PAYROLL_ROUTING_NUMBER_LENGTH,
  type PayrollDepositAccountType,
} from "@/lib/workforce/payrollPaymentApi";
import AccountNumberField from "./AccountNumberField";
import type { PayrollAccountEntry } from "./payrollPaymentEntry";

/** What each account type is called on screen. The wire token is not the worker's word for it. */
const ACCOUNT_TYPE_WORDS: Record<PayrollDepositAccountType, string> = {
  CHECKING: "Checking account",
  SAVINGS: "Savings account",
};

/**
 * The ABA check digit, as a courtesy.
 *
 * A COURTESY AND NOT THE AUTHORITY. The server runs this same arithmetic behind its own
 * substitutable verification boundary and its answer is what decides; running it here means a
 * worker is told beside the box rather than after a round trip. Provider-independent by ruling:
 * nothing is called, nothing is looked up, and a valid check digit says only that the number is
 * one a bank COULD have - never that it is his bank, or that his account exists.
 */
export function routingChecksumHolds(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const digit = (at: number): number => Number(routing[at]);
  const total =
    3 * (digit(0) + digit(3) + digit(6)) +
    7 * (digit(1) + digit(4) + digit(7)) +
    (digit(2) + digit(5) + digit(8));
  return total % 10 === 0;
}

export default function DepositAccountEditor({
  entry,
  position,
  removable,
  disabled,
  onChange,
  onRemove,
}: {
  entry: PayrollAccountEntry;
  position: number;
  removable: boolean;
  disabled: boolean;
  onChange: (next: PayrollAccountEntry) => void;
  onRemove: () => void;
}) {
  const ids = useId();
  const [blocked, setBlocked] = useState(false);

  const set = (patch: Partial<PayrollAccountEntry>): void => {
    onChange({ ...entry, ...patch });
  };

  const routing = entry.routingNumber.trim();
  const routingTyped = routing.length > 0;
  const routingComplete = routing.length === PAYROLL_ROUTING_NUMBER_LENGTH;
  const routingWrong = routingComplete && !routingChecksumHolds(routing);

  const account = entry.accountNumber.trim();
  const confirmation = entry.accountNumberConfirmation.trim();
  const bothTyped = account.length > 0 && confirmation.length > 0;
  // A hint while he types, and nothing more: the comparison that matters is the server's.
  const differs = bothTyped && account !== confirmation;

  return (
    <section className="pp-account" data-pp-account={position}>
      <header className="pp-account-head">
        <h4 className="pp-account-title">
          {position === 1 ? "First account" : position === 2 ? "Second account" : "Third account"}
        </h4>
        {removable ? (
          <button
            type="button"
            className="wf-button-quiet"
            data-pp-remove-account={position}
            disabled={disabled}
            onClick={onRemove}
          >
            Remove this account
          </button>
        ) : null}
      </header>

      <div className="pp-field">
        <label className="pp-label" htmlFor={`${ids}-bank`}>
          Name of your bank or credit union
        </label>
        <input
          id={`${ids}-bank`}
          className="pp-input"
          type="text"
          autoComplete="off"
          data-pp-field="institution"
          value={entry.financialInstitutionName}
          disabled={disabled}
          onChange={(event) => set({ financialInstitutionName: event.target.value })}
        />
      </div>

      <fieldset className="pp-fieldset pp-fieldset-inline">
        <legend className="pp-legend-small">What kind of account is it?</legend>
        {PAYROLL_DEPOSIT_ACCOUNT_TYPES.map((type) => (
          <label className="pp-radio" key={type} data-pp-account-type={type}>
            <input
              type="radio"
              name={`${ids}-type`}
              checked={entry.accountType === type}
              disabled={disabled}
              onChange={() => set({ accountType: type })}
            />
            <span>{ACCOUNT_TYPE_WORDS[type]}</span>
          </label>
        ))}
      </fieldset>

      <div className="pp-field">
        <label className="pp-label" htmlFor={`${ids}-routing`}>
          Routing number
        </label>
        <p className="pp-help" id={`${ids}-routing-help`}>
          Nine digits, printed at the bottom left of your cheques. Your bank&rsquo;s app will show it
          too.
          {entry.storedRoutingMasked
            ? ` We have ${entry.storedRoutingMasked} saved. Leave this blank to keep it.`
            : ""}
        </p>
        <input
          id={`${ids}-routing`}
          className="pp-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          data-pp-field="routing"
          aria-describedby={`${ids}-routing-help`}
          aria-invalid={routingWrong || undefined}
          value={entry.routingNumber}
          disabled={disabled}
          onChange={(event) => set({ routingNumber: event.target.value })}
        />
        {routingWrong ? (
          <p className="pp-field-error" role="status" data-pp-routing-invalid>
            That is not a routing number a bank can have, so one of the digits is probably wrong.
            Check it against your cheque or your bank&rsquo;s app.
          </p>
        ) : null}
        {routingTyped && !routingComplete ? (
          <p className="pp-field-note" role="status" data-pp-routing-short>
            A routing number has nine digits.
          </p>
        ) : null}
      </div>

      <div className="pp-confirm-pair" data-pp-confirm-pair>
        <AccountNumberField
          id={`${ids}-account`}
          testId="account"
          label="Account number"
          help={
            entry.storedAccountMasked
              ? `We have ${entry.storedAccountMasked} saved. Leave both boxes blank to keep it, or type the whole number twice to change it.`
              : "The number of the account itself, not the card number."
          }
          value={entry.accountNumber}
          disabled={disabled}
          invalid={differs}
          onChange={(value) => set({ accountNumber: value })}
          onBlocked={() => setBlocked(true)}
        />

        <AccountNumberField
          id={`${ids}-account-again`}
          testId="account-confirm"
          label="Type the account number again"
          help="Please type it out rather than copying it. Typing it twice is the only way we can catch a wrong digit before payday."
          value={entry.accountNumberConfirmation}
          disabled={disabled}
          invalid={differs}
          onChange={(value) => set({ accountNumberConfirmation: value })}
          onBlocked={() => setBlocked(true)}
        />

        {blocked ? (
          <p className="pp-field-note" role="status" data-pp-entry-blocked>
            Please type the account number in rather than pasting it. We ask for it twice so that a
            wrong digit is caught now instead of on payday, and a copy of the first box cannot do
            that.
          </p>
        ) : null}

        {differs ? (
          <p className="pp-field-error" role="status" data-pp-confirm-differs>
            The two account numbers are not the same yet. Check both boxes.
          </p>
        ) : null}

        {entry.confirmed && account.length === 0 && confirmation.length === 0 ? (
          <p className="pp-field-note" role="status" data-pp-confirmed>
            You have already typed this account number twice and it matched.
          </p>
        ) : null}
      </div>

      <p className="pp-fine">
        Account numbers are usually between {PAYROLL_ACCOUNT_NUMBER_MIN_LENGTH} and{" "}
        {PAYROLL_ACCOUNT_NUMBER_MAX_LENGTH} digits. We will never show you the whole number again
        once it is saved.
      </p>
    </section>
  );
}
