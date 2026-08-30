/**
 * Module 4.4 Payroll Payment - the governed refusals, in the worker's own words.
 *
 * One place, keyed by CODE, and TYPED OVER EVERY CODE A WORKER CAN RECEIVE, so a code he can be
 * shown cannot exist in this capsule without a sentence being written for it. An unknown code
 * cannot leak through as a raw identifier because there is no path here that renders one.
 *
 * TWO PROPERTIES EVERY SENTENCE BELOW KEEPS:
 *
 *  - IT NEVER ECHOES A PROTECTED VALUE, and it cannot: these are constants written ahead of time,
 *    with no interpolation and nowhere for a routing or account number to be substituted in. That
 *    is the point of answering a refusal with a fixed sentence rather than with the server's
 *    message - the server's refusals are already free of worker values, and this makes it
 *    structurally impossible for that to regress on the browser's side.
 *  - IT SAYS WHAT HAPPENED TO WHAT HE ENTERED. A refused save stored nothing, and a worker who is
 *    not told that will reasonably assume the opposite and leave.
 *
 * ON INTERNAL DETAIL. No sentence names a rule number, an exception, a field path or an enum. The
 * worker is told what to do about it, which is the only part of a refusal that is his.
 */

import type { PayrollPaymentWorkerRefusalCode } from "@/lib/workforce/payrollPaymentApi";

const REFUSAL_MESSAGES: Record<PayrollPaymentWorkerRefusalCode, string> = {
  PAYMENT_METHOD_NOT_GOVERNED:
    "We can only pay you one of the two ways shown above. Choose one of them and save again.",
  DEPOSIT_ACCOUNT_REQUIRED:
    "Add the account you would like your pay sent to. Nothing was saved.",
  TOO_MANY_DEPOSIT_ACCOUNTS:
    "You can split your pay between up to three accounts. Remove one and save again. Nothing was saved.",
  ACCOUNTS_NOT_PERMITTED_FOR_METHOD:
    "You chose to be paid on a payroll card, so there are no bank accounts to save. Nothing was saved.",
  ALLOCATION_MODE_REQUIRED:
    "Choose how your pay should be divided before saving. Nothing was saved.",
  ALLOCATION_MODE_NOT_GOVERNED:
    "We can only divide your pay one of the two ways shown above. Choose one of them and save again.",
  ACCOUNT_TYPE_NOT_GOVERNED:
    "Tell us whether each account is a checking or a savings account. Nothing was saved.",
  ALLOCATION_KIND_NOT_GOVERNED:
    "One of the amounts below is not something we can accept. Check them and save again. Nothing was saved.",
  FINANCIAL_INSTITUTION_REQUIRED:
    "Tell us the name of your bank or credit union. Nothing was saved.",
  ACCOUNT_POSITION_INVALID:
    "Something went wrong at our end and nothing was saved. Please try again.",
  // Neither of these is the worker's mistake. The first is reachable honestly - a second tab, or a
  // stale screen, saving an account that has since been removed - so it tells him to look at what
  // we actually hold rather than implying he did something wrong.
  DEPOSIT_ACCOUNT_NOT_RECOGNIZED:
    "Your account details have changed since this page was loaded, so nothing was saved. Reload the page to see what we have, then make your change again.",
  DEPOSIT_ACCOUNT_DUPLICATED:
    "Something went wrong at our end and nothing was saved. Please try again.",
  ALLOCATION_MODE_MIXED:
    "You can divide your pay by percentage, or by set amounts with one account getting whatever is left - but not both at once. Nothing was saved.",
  PERCENTAGE_TOTAL_INVALID:
    "Your percentages have to add up to exactly 100%. Adjust them and save again. Nothing was saved.",
  REMAINING_BALANCE_ACCOUNT_REQUIRED:
    "Choose which one account should get whatever is left of your pay. Nothing was saved.",
  MULTIPLE_REMAINING_BALANCE_ACCOUNTS:
    "Only one account can get whatever is left of your pay. Choose one and save again. Nothing was saved.",
  ALLOCATION_VALUE_INVALID:
    "One of the amounts below is missing or is not a figure we can use. Check them and save again. Nothing was saved.",
  ROUTING_NUMBER_FORMAT_INVALID:
    "A routing number is the nine digits printed at the bottom left of a cheque. Check it and save again. Nothing was saved.",
  ROUTING_NUMBER_CHECKSUM_INVALID:
    "That routing number is not one a bank can have, so a digit is probably wrong. Check it against your cheque or your bank's app and save again. Nothing was saved.",
  ACCOUNT_NUMBER_INVALID:
    "Check the account number and save again. Nothing was saved.",
  ACCOUNT_NUMBER_CONFIRMATION_REQUIRED:
    "Type the account number a second time so we can be sure it is right. Nothing was saved.",
  // The mismatch. It says nothing about the two entries beyond the fact that they differ - not the
  // values, not their lengths, and not where they diverged.
  ACCOUNT_NUMBER_CONFIRMATION_MISMATCH:
    "The two account numbers you typed are not the same, so we have not saved either of them. Please type the account number again in both boxes.",
  DRAFT_PROTECTION_UNAVAILABLE:
    "We could not store your details safely just now, so we did not store them at all. Nothing was saved. Please try saving again.",
  DRAFT_PROTECTION_INVALID:
    "We could not open the details we had saved for you. Nothing has been changed. Tell your MW4H contact.",
};

/** The worker's sentence for one governed refusal code. */
export function payrollPaymentRefusalMessage(
  code: PayrollPaymentWorkerRefusalCode,
): string {
  return REFUSAL_MESSAGES[code];
}

/**
 * What a reported rule means, in the worker's own words.
 *
 * The SAME codes arrive two ways and mean the same thing both times: thrown, when a save is
 * refused outright, and reported in `violations`, when the server has looked at an unfinished
 * proposal and is telling him what still has to be true. So the wording is shared, minus the
 * "nothing was saved" half - because in the reported case something WAS saved, and saying
 * otherwise would be false.
 */
export function payrollPaymentViolationMessage(code: string): string {
  const known = (REFUSAL_MESSAGES as Record<string, string | undefined>)[code];
  if (!known) {
    return "Something above still needs your attention before you can review this.";
  }
  return known.replace(/\s*Nothing was saved\.\s*$/, "");
}
