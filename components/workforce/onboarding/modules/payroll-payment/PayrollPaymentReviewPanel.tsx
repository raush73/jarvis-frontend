"use client";

/**
 * Module 4.4 - what the worker is asked to check, and the end of this gate.
 *
 * MASKED, EVERY TIME (10-R7). Every banking value on this panel is the mask the server produced. The
 * projection this panel renders has no field a full routing or account number could occupy, so
 * "the review shows masked values" is a property of the contract rather than a habit of this
 * component.
 *
 * THIS IS A PROPOSAL AND THE SCREEN SAYS SO. There is no signature control here, no authorize
 * button, no activate button, no effective date and no completion. Not hidden, not disabled -
 * ABSENT (10-R15). What the worker has done is tell us how he would like to be paid; putting that
 * instruction in force is a separate, later, governed act, and this panel's last paragraph tells
 * him plainly that it has not happened yet.
 *
 * THE HONESTY OF THE WAITING MESSAGE MATTERS MORE THAN ITS REASSURANCE. A worker who is told
 * "you're all set" and then is paid by paper cheque was misled by this screen. So the wording
 * describes the true state: we have his instruction, it has not been put in force, and somebody
 * will do that next.
 *
 * FOR THE PAYROLL CARD, IT IS NOT A CARD YET. No card has been created, ordered, assigned or
 * activated by anything in this gate, and nothing has been sent to anybody outside Jarvis (10-R14).
 * The wording is in the future tense throughout for that reason.
 */

import {
  PAYROLL_ACCOUNT_CONFIRMATION_INDEPENDENT_SECOND_ENTRY,
  PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE,
  PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE,
  PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT,
  type PayrollPaymentAccountView,
  type PayrollPaymentReview,
} from "@/lib/workforce/payrollPaymentApi";

const ACCOUNT_TYPE_WORDS: Record<string, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
};

/** How one account's share reads, in the worker's words. */
function shareOf(
  account: PayrollPaymentAccountView,
  percentageMode: boolean,
): string {
  if (account.allocationKind === PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE) {
    return "Whatever is left of your pay";
  }
  if (percentageMode && account.allocationPercentage) {
    return `${account.allocationPercentage}% of your pay`;
  }
  if (account.allocationAmount) {
    return `$${account.allocationAmount} of each paycheque`;
  }
  return "Not set yet";
}

export default function PayrollPaymentReviewPanel({
  review,
}: {
  review: PayrollPaymentReview;
}) {
  const bank = review.paymentMethod === PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT;
  const percentageMode =
    review.allocationMode === PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE;

  return (
    <section className="pp-review" data-pp-review>
      <h3 className="pp-review-title">Please check this before you go on</h3>

      <dl className="pp-review-list">
        <dt>How you will be paid</dt>
        <dd data-pp-review-method>
          {bank ? "Direct Deposit into your own account" : "MW4H Comdata Payroll Card"}
        </dd>
      </dl>

      {bank ? (
        <>
          {review.accounts.map((account) => (
            <div
              className="pp-review-account"
              key={account.position}
              data-pp-review-account={account.position}
            >
              <h4 className="pp-review-account-title">
                {account.financialInstitutionName || "Your bank"}
                {account.accountType ? (
                  <span className="pp-review-chip" data-pp-review-account-type>
                    {ACCOUNT_TYPE_WORDS[account.accountType] ?? account.accountType}
                  </span>
                ) : null}
              </h4>
              <dl className="pp-review-list">
                <dt>Routing number</dt>
                <dd data-pp-review-routing>{account.routingNumberMasked ?? "Not entered"}</dd>
                <dt>Account number</dt>
                <dd data-pp-review-account-number>
                  {account.accountNumberMasked ?? "Not entered"}
                </dd>
                <dt>What goes here</dt>
                <dd data-pp-review-share>{shareOf(account, percentageMode)}</dd>
              </dl>
            </div>
          ))}

          <p className="pp-fine" data-pp-review-masking>
            We only ever show you the last few digits. We are not able to show you the whole numbers
            again, and neither can anyone who helps you with your account.
          </p>

          {review.accountConfirmationMethod ===
          PAYROLL_ACCOUNT_CONFIRMATION_INDEPENDENT_SECOND_ENTRY ? (
            <p className="pp-note" role="status" data-pp-review-confirmed>
              You typed each account number twice and they matched.
            </p>
          ) : null}

          <p className="pp-note" data-pp-review-institution-source>
            You told us the name of your bank. We have not checked it with the bank itself, so please
            make sure it is right.
          </p>
        </>
      ) : (
        <div className="pp-review-card" data-pp-review-card>
          <p>
            You have chosen to be paid on an MW4H Comdata payroll card. You do not need to enter any
            bank details.
          </p>
          <p data-pp-review-card-next>
            MW4H will arrange the card with you after this. It has not been ordered or set up yet,
            and there is nothing more for you to do about it here.
          </p>
        </div>
      )}

      <p className="pp-review-pending" role="status" data-pp-review-pending>
        This is what you have told us, and it has not been put in place yet. Nothing has been sent to
        your bank. You will be asked to confirm it in a later step, and we will tell you which
        paycheque it starts with.
      </p>
    </section>
  );
}
