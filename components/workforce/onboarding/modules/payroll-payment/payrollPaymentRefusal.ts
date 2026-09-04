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
  // ABSENCE, AND IT SAYS SO (owner ruling 10A-R1). It sends him to enter the number rather than to
  // check one, which is what the two sentences below do and what an absent value must not be told.
  ROUTING_NUMBER_REQUIRED:
    "Enter the routing number - the nine digits printed at the bottom left of a check. Nothing was saved.",
  ROUTING_NUMBER_FORMAT_INVALID:
    "A routing number is the nine digits printed at the bottom left of a check. Check it and save again. Nothing was saved.",
  ROUTING_NUMBER_CHECKSUM_INVALID:
    "That routing number is not one a bank can have, so a digit is probably wrong. Check it against your check or your bank's app and save again. Nothing was saved.",
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
  /*
    [ADDED BY GATE 10C. The three a worker can now cause by performing the act, and none of them is
    something he can do by working through the screens in order - each is the browser having got
    ahead of the server. So each says what the true state is and what to do about it, and none
    blames him for it. All three are refusals BEFORE anything was put in force, and they say so:
    an act that failed left his proposal exactly as it was.]
  */
  PROPOSAL_NOT_REVIEW_READY:
    "There is still something to finish in your payment details, so we have not put anything in force. Go back, check what is highlighted, and read it through again.",
  ALREADY_AUTHORIZED:
    "Your payroll payment instructions are already in force, so nothing was changed. If they need to change, tell your MW4H contact and we will record new ones.",
  INSTRUCTION_BINDING_UNAVAILABLE:
    "Something went wrong at our end and nothing was put in force. Please try again.",
  /*
    [ADDED BY GATE 10C-E3 SLICE 4. Five refusals from the surface that asks a worker whether the
    record already governing his pay is still right, and FOUR OF THEM ARE THE SAME EVENT seen from
    four places: what he was looking at is not what we hold now. He caused none of them. Something
    else legitimately changed his payment record - MW4H recording a correction, or himself in
    another tab - between the screen being drawn and the button being pressed.

    THE SENTENCES DIFFER BECAUSE WHAT HE HAS IN HAND DIFFERS, which is the whole reason the server
    keeps the codes apart. A refused AFFIRMATION cost him nothing, so he is simply asked to look
    again. A refused REPLACEMENT was carrying details he had just typed, so his sentence says what
    became of them before it asks him to look again.

    NONE OF THEM NAMES A RECORD, a version, a date or an identifier, because none of that would
    help him and the last of it is not his to see.
  */
  VERIFICATION_NOT_APPLICABLE:
    "We are not asking you to check your payment details right now, so nothing was changed.",
  VERIFICATION_REFRESH_REQUIRED:
    "Your payment details changed while this page was open, so we did not record your answer. Please look at what we have now and tell us again.",
  VERIFICATION_INSTRUCTION_MISMATCH:
    "Your payment details changed while this page was open, so we did not record your answer. Please look at what we have now and tell us again.",
  NO_EFFECTIVE_INSTRUCTION:
    "We do not have payment details on record for you at the moment, so there was nothing to change. Please tell us how you would like to be paid.",
  REPLACEMENT_INSTRUCTION_MISMATCH:
    "Your payment details changed while you were making this change, so we did not put anything in force. Nothing you entered has been lost from this page - please look at what we have now and go on from there.",
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
