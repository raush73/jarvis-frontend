"use client";

/**
 * Module 4.4 - how the worker's pay is divided between his accounts.
 *
 * THE WORKER IS NOT SHOWN AN ENUM, AND HE DOES NOT NEED THE CONCEPT. The two governed modes are
 * presented as the two things a person actually wants: "split it by percentage" and "send set
 * amounts and put the rest somewhere". The tokens behind those sentences are imported and never
 * spelled on screen.
 *
 * ONE MODE PER INSTRUCTION, NEVER BOTH (4.4.4 LOCKED, 10-R3). That is why the mode is asked ONCE,
 * above the accounts, rather than per account: a screen that let each account pick its own method
 * would be offering the worker a configuration the rules refuse, and then refusing it. Choosing a
 * mode here rewrites every account's method to match, because that is what choosing it MEANS.
 *
 * THE UI PREVENTS WHAT IT CAN AND ENFORCES NOTHING. Exactly one account may take the remainder, so
 * the remainder is a radio group - a shape in which "two of them" cannot be expressed. The
 * percentage total is added up and shown as he types. Both are courtesies. The server applies the
 * same rules to every caller and its refusal is what decides, which is what makes it safe for this
 * screen to be helpful rather than authoritative.
 */

import {
  PAYROLL_DEPOSIT_ALLOCATION_FIXED_AMOUNT,
  PAYROLL_DEPOSIT_ALLOCATION_PERCENTAGE,
  PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE,
  PAYROLL_PAYMENT_ALLOCATION_MODE_FIXED,
  PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE,
  type PayrollPaymentAllocationMode,
} from "@/lib/workforce/payrollPaymentApi";
import type { PayrollAccountEntry } from "./payrollPaymentEntry";

/**
 * The percentage total, in hundredths, or null when something is not a figure.
 *
 * IN HUNDREDTHS AND NOT IN FLOATS, for the reason the server gives: a total that must equal exactly
 * one hundred cannot be checked by adding floating-point numbers together. `33.33 + 33.33 + 33.34`
 * is exactly 100 in hundredths and is not exactly 100 as a float, and a worker whose percentages
 * add up correctly must not be told they do not.
 */
export function percentageTotalHundredths(
  entries: readonly PayrollAccountEntry[],
): number | null {
  let total = 0;
  for (const entry of entries) {
    const text = entry.allocationPercentage.trim();
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
    const [whole, fraction = ""] = text.split(".");
    total += Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  }
  return total;
}

/** The total as the worker would write it. */
export function formatHundredths(hundredths: number): string {
  const whole = Math.trunc(hundredths / 100);
  const rest = hundredths % 100;
  return rest === 0 ? `${whole}` : `${whole}.${String(rest).padStart(2, "0")}`;
}

export default function AllocationEditor({
  mode,
  entries,
  disabled,
  onModeChange,
  onEntryChange,
}: {
  mode: PayrollPaymentAllocationMode | null;
  entries: readonly PayrollAccountEntry[];
  disabled: boolean;
  onModeChange: (mode: PayrollPaymentAllocationMode) => void;
  onEntryChange: (index: number, next: PayrollAccountEntry) => void;
}) {
  const total = percentageTotalHundredths(entries);
  const remainderHolder = entries.findIndex(
    (entry) => entry.allocationKind === PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE,
  );

  return (
    <div className="pp-allocation" data-pp-allocation>
      <fieldset className="pp-fieldset">
        <legend className="pp-legend">How should your pay be divided?</legend>

        <label className="pp-choice" data-pp-mode="percentage">
          <input
            type="radio"
            name="pp-allocation-mode"
            checked={mode === PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE}
            disabled={disabled}
            onChange={() => onModeChange(PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE)}
          />
          <span className="pp-choice-body">
            <span className="pp-choice-title">By percentage</span>
            <span className="pp-choice-detail">
              Each account gets a share of every paycheque - for example 80% to one and 20% to
              another. The shares have to add up to 100%. Choose this if you want the split to stay
              the same however much you earn.
            </span>
          </span>
        </label>

        <label className="pp-choice" data-pp-mode="fixed">
          <input
            type="radio"
            name="pp-allocation-mode"
            checked={mode === PAYROLL_PAYMENT_ALLOCATION_MODE_FIXED}
            disabled={disabled}
            onChange={() => onModeChange(PAYROLL_PAYMENT_ALLOCATION_MODE_FIXED)}
          />
          <span className="pp-choice-body">
            <span className="pp-choice-title">Set amounts, with the rest in one account</span>
            <span className="pp-choice-detail">
              You name a dollar amount for one or more accounts, and one account gets whatever is
              left over. Choose this if you want to put a fixed amount aside each payday.
            </span>
          </span>
        </label>

        <p className="pp-help">
          You can use one of these two ways, not both at once.
        </p>
      </fieldset>

      {mode === PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE ? (
        <div className="pp-allocation-rows" data-pp-percentage-rows>
          {entries.map((entry, index) => (
            <div className="pp-field pp-field-inline" key={entry.key}>
              <label className="pp-label" htmlFor={`pp-share-${entry.key}`}>
                Share for {entry.financialInstitutionName.trim() || `account ${index + 1}`}
              </label>
              <span className="pp-suffix-wrap">
                <input
                  id={`pp-share-${entry.key}`}
                  className="pp-input pp-input-narrow"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  data-pp-field="percentage"
                  data-pp-percentage-for={index + 1}
                  value={entry.allocationPercentage}
                  disabled={disabled}
                  onChange={(event) =>
                    onEntryChange(index, {
                      ...entry,
                      allocationKind: PAYROLL_DEPOSIT_ALLOCATION_PERCENTAGE,
                      allocationPercentage: event.target.value,
                      allocationAmount: "",
                    })
                  }
                />
                <span className="pp-suffix">%</span>
              </span>
            </div>
          ))}

          <p
            className="pp-total"
            role="status"
            data-pp-percentage-total={total === null ? "" : formatHundredths(total)}
          >
            {total === null
              ? "Enter each share as a number, like 60 or 33.33."
              : total === 100_00
                ? "That adds up to 100%."
                : `That adds up to ${formatHundredths(total)}%. It has to be exactly 100%.`}
          </p>
        </div>
      ) : null}

      {mode === PAYROLL_PAYMENT_ALLOCATION_MODE_FIXED ? (
        <div className="pp-allocation-rows" data-pp-fixed-rows>
          <fieldset className="pp-fieldset">
            <legend className="pp-legend-small">
              Which account should get whatever is left?
            </legend>
            {entries.map((entry, index) => (
              <label className="pp-radio" key={entry.key} data-pp-remainder-for={index + 1}>
                <input
                  type="radio"
                  name="pp-remainder"
                  checked={index === remainderHolder}
                  disabled={disabled}
                  onChange={() =>
                    entries.forEach((each, at) =>
                      onEntryChange(at, {
                        ...each,
                        allocationKind:
                          at === index
                            ? PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE
                            : PAYROLL_DEPOSIT_ALLOCATION_FIXED_AMOUNT,
                        allocationAmount: at === index ? "" : each.allocationAmount,
                        allocationPercentage: "",
                      }),
                    )
                  }
                />
                <span>{entry.financialInstitutionName.trim() || `Account ${index + 1}`}</span>
              </label>
            ))}
            <p className="pp-help">
              Only one account can get the remainder. If you only have one account, it gets all of
              your pay.
            </p>
          </fieldset>

          {entries.map((entry, index) =>
            entry.allocationKind === PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE ? null : (
              <div className="pp-field pp-field-inline" key={entry.key}>
                <label className="pp-label" htmlFor={`pp-amount-${entry.key}`}>
                  Amount for {entry.financialInstitutionName.trim() || `account ${index + 1}`}
                </label>
                <span className="pp-suffix-wrap">
                  <span className="pp-prefix">$</span>
                  <input
                    id={`pp-amount-${entry.key}`}
                    className="pp-input pp-input-narrow"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    data-pp-field="amount"
                    data-pp-amount-for={index + 1}
                    value={entry.allocationAmount}
                    disabled={disabled}
                    onChange={(event) =>
                      onEntryChange(index, {
                        ...entry,
                        allocationKind: PAYROLL_DEPOSIT_ALLOCATION_FIXED_AMOUNT,
                        allocationAmount: event.target.value,
                        allocationPercentage: "",
                      })
                    }
                  />
                </span>
              </div>
            ),
          )}

          {remainderHolder === -1 ? (
            <p className="pp-field-note" role="status" data-pp-remainder-missing>
              Choose the one account that should get whatever is left of your pay.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
