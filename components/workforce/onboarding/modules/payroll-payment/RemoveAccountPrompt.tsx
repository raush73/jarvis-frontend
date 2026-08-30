"use client";

/**
 * Module 4.4 - the question a worker is asked before a bank account is taken away (QA-L4-UX-6).
 *
 * REMOVING AN ACCOUNT USED TO HAPPEN ON THE FIRST CLICK. Real-browser QA clicked "Remove this
 * account" and the account was simply gone: no question, no undo, and nothing on screen to say
 * what had just been discarded. Two different things are lost in that click, and both are the
 * worker's:
 *
 *  1. BANKING DETAILS HE CANNOT GET BACK FROM US. He typed the account number out twice, digit by
 *     digit, precisely because nothing can check it for him; the server holds it sealed and will
 *     never show it to him again (10-R7). Removing the account discards the only copy he can
 *     reach, so re-adding it means typing the whole thing twice over.
 *  2. HOW HIS PAY IS DIVIDED. If the account he removes was the one taking the remainder, the
 *     instruction no longer says where the rest of his wages go - and this screen deliberately
 *     does NOT quietly hand that to another account (see the module: the remainder is left
 *     unassigned and he is asked). A worker who did not realise he was removing the remainder
 *     account should be told before it happens rather than puzzled by an error afterwards.
 *
 * WHAT IT SAYS ABOUT THE ACCOUNT IS THE MASK AND NOTHING WIDER. The bank's name and the kind of
 * account are his own words, already on the screen behind this dialog. The number is the MASKED
 * TAIL the server returned, which is the only form of it this browser is allowed to display - and
 * the transient plaintext of a half-typed new account is deliberately not read here, because a
 * dialog is a screenshot waiting to happen.
 *
 * IT IS A DIALOG, AND AN ACCESSIBLE ONE, following this application's one existing precedent for
 * asking a worker something he cannot ignore (Module 4.7's unsaved-changes prompt): labelled,
 * described, focus moved into it on open, Escape dismisses, and the keyboard lands on Cancel -
 * the option that cannot lose anything.
 *
 * IT DECIDES NOTHING. Cancel and Remove are handed straight back to the module, which owns what
 * removal means; this component neither saves, nor removes, nor touches an account identity.
 */

import { useEffect, useRef } from "react";
import type { PayrollAccountEntry } from "./payrollPaymentEntry";

/** The worker's word for the kind of account, or nothing when he has not said yet. */
const ACCOUNT_TYPE_WORDS: Record<string, string> = {
  CHECKING: "Checking account",
  SAVINGS: "Savings account",
};

export function RemoveAccountPrompt({
  entry,
  disabled,
  onCancel,
  onConfirm,
}: {
  entry: PayrollAccountEntry;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Focus lands on the option that cannot lose anything.
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const bank = entry.financialInstitutionName.trim();
  const kind = entry.accountType === null ? null : ACCOUNT_TYPE_WORDS[entry.accountType];
  /**
   * The tail of the MASK the server returned, and never of anything he has typed.
   *
   * `storedAccountMasked` is already the only form of the number this browser holds for a saved
   * account; the digits are lifted out of it so the sentence reads as a sentence. An account the
   * server has never seen has no mask, so it is named by his bank alone - which is right: there is
   * no saved number to identify it by, and the one in the box is not ours to put on a dialog.
   */
  const tail = (entry.storedAccountMasked ?? "").replace(/\D/g, "");

  return (
    <div className="pp-prompt-scrim" data-pp-remove-prompt>
      <div
        className="wf-card pp-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-remove-title"
        aria-describedby="pp-remove-detail"
      >
        <h4 className="wf-section-title" id="pp-remove-title">
          Remove this bank account?
        </h4>
        <div id="pp-remove-detail" className="pp-prompt-body">
          <p>You are about to remove:</p>
          <ul className="pp-prompt-account" data-pp-remove-account-summary>
            {bank.length > 0 ? <li data-pp-remove-bank>{bank}</li> : null}
            {kind ? <li data-pp-remove-kind>{kind}</li> : null}
            {tail.length > 0 ? (
              <li data-pp-remove-tail>Account ending in {tail}</li>
            ) : null}
          </ul>
          <p>
            If this account receives part of your pay, you may need to update how your pay is
            divided between the accounts you keep.
          </p>
        </div>
        <div className="wf-btn-row pp-prompt-actions">
          <button
            type="button"
            className="wf-btn wf-btn-ghost"
            data-pp-action="remove-cancel"
            ref={cancelRef}
            disabled={disabled}
            onClick={onCancel}
          >
            Cancel
          </button>
          {/*
            The irreversible answer, filled in so it cannot be mistaken for the safe one
            (QA-L4-UX-6A). `wf-btn` supplies the shape and the module's stylesheet supplies the
            fill; it remains a native button, so the keyboard, Enter, Space and assistive
            technology all reach it exactly as before.
          */}
          <button
            type="button"
            className="wf-btn pp-btn-destructive"
            data-pp-action="remove-confirm"
            disabled={disabled}
            onClick={onConfirm}
          >
            Remove account
          </button>
        </div>
      </div>
    </div>
  );
}

export default RemoveAccountPrompt;
