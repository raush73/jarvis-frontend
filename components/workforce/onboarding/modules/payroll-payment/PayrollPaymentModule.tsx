"use client";

/**
 * Module 4.4 Payroll Payment - the worker's own interview, through review.
 *
 * The worker's part of a regulated module, rendered by the DELIVERED onboarding runtime at the
 * canonical worker URL. It reaches him the way every module does - the capsule registered a renderer
 * under its module key - and nothing in the runtime, the navigation, the status layer, the document
 * foundation or the execution foundation was changed to admit it.
 *
 * WHAT THE WORKER DOES HERE: he says how he would like to be paid, and if that is into his own bank
 * account he enters it, types the account number a second time so a wrong digit is caught now,
 * splits his pay between up to three accounts if he wants to, and reads back what he has told us
 * with the numbers masked. He can stop part-way and come back to it. That is the whole of it.
 *
 * WHAT HE CANNOT DO HERE, AND NONE OF IT IS A MISSING BUTTON - NONE OF IT EXISTS:
 *
 *  1. HE CANNOT PUT THE INSTRUCTION IN FORCE, AND THIS FILE COMPLETES NOTHING. There is no signature
 *     control in this capsule, no authorize call, no execute call and no activation. `complete` -
 *     the runtime's completion call - is never called anywhere in this capsule, and reaching the end
 *     of the review does not finish this module. Putting a payroll instruction in force is a
 *     separate governed act that does not exist yet (10-R15).
 *  2. HE CANNOT CHOOSE WHEN IT STARTS. There is no effective-date control, because the authoritative
 *     effective date is not his to choose. The review says he will be told which paycheque it
 *     starts with, which is the truth.
 *  3. HE CANNOT GET A CARD HERE. Choosing the payroll card records a CHOICE. Nothing in this capsule
 *     creates, orders, assigns or activates a card, and nothing is sent outside Jarvis (10-R14).
 *  4. HE CANNOT SEE A BANKING VALUE HE HAS ALREADY GIVEN US. Every projection is masked and there is
 *     no call here that could obtain anything wider (10-R7).
 *  5. HE CANNOT SATISFY THE SECOND ENTRY WITH A COPY OF THE FIRST. See `AccountNumberField` for what
 *     the browser enforces and, more importantly, for what it does not: the SERVER compares the two
 *     entries and its comparison is the authority (10-R10, 10-R13).
 *
 * THREE PROPERTIES THIS FILE EXISTS TO KEEP:
 *
 *  - EXPLICIT SAVE, in the strong sense. Nothing is persisted by typing. `setValue` and `save` - the
 *    runtime's shared debounced draft recorder and its save cycle - are deliberately never called,
 *    and the module declares NO CAPTURED DRAFT KEYS for them to write into. That is not a style
 *    choice: the shared draft is the framework's generic store, and a half-typed account number must
 *    never reach it. What this capsule saves, it saves through this module's own route, into the
 *    server's purpose-bound encrypted draft (10-R17).
 *  - TYPED BANKING VALUES LIVE IN THIS COMPONENT'S STATE AND NOWHERE ELSE, for as short a time as
 *    the interview allows. They are cleared the moment a save succeeds. Nothing in this capsule
 *    writes one to browser storage, a cookie, a URL, a query string, an analytics call or the
 *    console - see `payrollPaymentEntry.ts`, which is where that rule is written down.
 *  - THE SERVER DECIDES WHAT IS ADMISSIBLE. The rules broken so far arrive from the server as
 *    `violations` and are rendered in the worker's own words; `readyForReview` is the server's
 *    answer about the proposal as a whole. This screen re-implements no rule as authority. Where it
 *    checks something locally - the routing check digit, the percentage total - it is so the worker
 *    is told beside the box instead of after a round trip, and the server checks it again.
 *
 * ON THE ONE DECLARED STEP. This module declares a single step, so the method question, the account
 * details and the review are stages WITHIN one screen rather than three URLs. That is deliberate and
 * is the delivered capsules' own pattern for a stage that is not a separate question - the I-9 and
 * Federal Tax capsules compose their act into the foot of a step for the same reason. It also means
 * this component stays mounted while he works, so the entry state above has a single, honest
 * lifetime rather than being reconstructed per step.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OnboardingModuleRendererProps } from "@/components/workforce/onboarding/runtime/moduleRegistry";
import OnboardingErrorNotice from "@/components/workforce/onboarding/runtime/OnboardingErrorNotice";
import {
  getOwnPayrollPayment,
  getOwnPayrollPaymentReview,
  payrollPaymentRefusalCode,
  saveOwnPayrollPayment,
  PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE,
  PAYROLL_PAYMENT_ALLOCATION_MODE_FIXED,
  PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE,
  PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS,
  PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT,
  PAYROLL_PAYMENT_METHOD_PAYROLL_CARD,
  type PayrollPaymentAllocationMode,
  type PayrollPaymentInterview,
  type PayrollPaymentMethod,
  type PayrollPaymentReview,
} from "@/lib/workforce/payrollPaymentApi";
import AllocationEditor from "./AllocationEditor";
import DepositAccountEditor from "./DepositAccountEditor";
import PaymentMethodChoice from "./PaymentMethodChoice";
import PayrollPaymentReviewPanel from "./PayrollPaymentReviewPanel";
import {
  entriesFromServer,
  newAccountEntry,
  toAccountInput,
  withoutEnteredValues,
  type PayrollAccountEntry,
} from "./payrollPaymentEntry";
import {
  payrollPaymentRefusalMessage,
  payrollPaymentViolationMessage,
} from "./payrollPaymentRefusal";
import "./payroll-payment.css";

/** Where in his own interview the worker is. Not persisted, and not a position we remember. */
type Stage = "METHOD" | "DETAILS" | "REVIEW";

export function PayrollPaymentModule({
  invocationId,
  module,
  busy,
}: OnboardingModuleRendererProps) {
  const [interview, setInterview] = useState<PayrollPaymentInterview | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloads, setReloads] = useState(0);

  const [method, setMethod] = useState<PayrollPaymentMethod | null>(null);
  const [mode, setMode] = useState<PayrollPaymentAllocationMode | null>(null);
  const [entries, setEntries] = useState<PayrollAccountEntry[]>([]);
  const [stage, setStage] = useState<Stage>("METHOD");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [review, setReview] = useState<PayrollPaymentReview | null>(null);
  const [reviewError, setReviewError] = useState<unknown>(null);

  /* ------------------------------------------------------------------ read */

  useEffect(() => {
    // `live` guards a response arriving after the worker moved on, which would otherwise show one
    // packet's proposal under another's screen.
    let live = true;
    getOwnPayrollPayment(invocationId)
      .then((value) => {
        if (!live) return;
        setInterview(value);
        setMethod(value.paymentMethod);
        setMode(value.allocationMode);
        setEntries(entriesFromServer(value.accounts));
        // RESUMING IS READING. Where he comes back to is derived from what the server actually
        // holds, not from a position anything remembered for him.
        setStage(value.paymentMethod === null ? "METHOD" : "DETAILS");
        setLoadError(null);
      })
      .catch((failure: unknown) => {
        if (live) setLoadError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId, reloads]);

  /* --------------------------------------------------------------- what we have */

  const sectionClosed =
    module.status === "COMPLETE" || module.status === "ALREADY_COMPLETE";
  const disabled = saving || busy || sectionClosed;

  const bank = method === PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT;

  /**
   * ONE ACCOUNT IS NOT A DIVISION, AND HE IS NOT ASKED TO DESCRIBE ONE.
   *
   * The governed rules require an allocation mode on every deposit instruction, including one with
   * a single account - so the question cannot simply be skipped, and something must be stated. But
   * asking a worker who named one account how he would like his pay divided between his accounts is
   * asking him to answer a question that does not apply to him, and the two answers he could give
   * mean exactly the same thing.
   *
   * So a single account is stated as what it is: the account gets whatever there is. That is the
   * remainder encoding, which is the one of the two that cannot be got wrong - there is no
   * percentage to total and nothing to keep adding up to a hundred as his pay changes. THE MOMENT HE
   * ADDS A SECOND ACCOUNT the question becomes real, and `addAccount` clears the mode so that he
   * is asked it rather than inheriting an answer he never gave.
   */
  const single = bank && entries.length === 1;

  const dirty = useMemo(
    () =>
      entries.some(
        (entry) =>
          entry.routingNumber.trim().length > 0 ||
          entry.accountNumber.trim().length > 0 ||
          entry.accountNumberConfirmation.trim().length > 0,
      ),
    [entries],
  );

  useEffect(() => {
    if (!dirty) return;
    // A reload or a closed tab is the one way typed banking values are actually lost, because they
    // live in memory and deliberately nowhere else. The browser's own prompt is the only protection
    // that reaches it, and it is registered only while there is something to lose.
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ----------------------------------------------------------------- edits */

  const changeEntry = useCallback((index: number, next: PayrollAccountEntry) => {
    setEntries((held) => held.map((entry, at) => (at === index ? next : entry)));
    setSaved(false);
  }, []);

  const addAccount = useCallback(() => {
    setEntries((held) => {
      if (held.length >= PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS) return held;
      // Going from one account to two makes the dividing question real for the first time, so it is
      // asked from scratch rather than inherited from the single-account statement.
      if (held.length === 1) setMode(null);
      return [
        ...held.map((entry) =>
          held.length === 1
            ? { ...entry, allocationKind: null, allocationPercentage: "", allocationAmount: "" }
            : entry,
        ),
        newAccountEntry(held.length === 1 ? null : mode),
      ];
    });
    setSaved(false);
  }, [mode]);

  const removeAccount = useCallback((index: number) => {
    setEntries((held) => held.filter((_, at) => at !== index));
    setSaved(false);
  }, []);

  const chooseMode = useCallback((next: PayrollPaymentAllocationMode) => {
    setMode(next);
    // Choosing a mode rewrites every account's method to match, because that is what choosing it
    // MEANS - one mode per instruction, never both.
    setEntries((held) =>
      held.map((entry) => ({
        ...entry,
        allocationKind:
          next === PAYROLL_PAYMENT_ALLOCATION_MODE_PERCENTAGE ? "PERCENTAGE" : null,
        allocationPercentage: "",
        allocationAmount: "",
      })),
    );
    setSaved(false);
  }, []);

  /* ------------------------------------------------------------------ save */

  /**
   * THE explicit save: the whole proposal, in one deliberate act, or nothing.
   *
   * What comes back replaces what was sent, and the typed banking values are dropped from state on
   * success - they have served their only purpose the moment the server accepts them.
   */
  const persist = useCallback(
    async (
      overrides: {
        method?: PayrollPaymentMethod | null;
        withAccounts?: boolean;
      } = {},
    ): Promise<PayrollPaymentInterview | null> => {
      const chosen = overrides.method === undefined ? method : overrides.method;
      const sendAccounts = overrides.withAccounts !== false;
      const alone =
        chosen === PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT && entries.length === 1;

      setSaving(true);
      try {
        const value = await saveOwnPayrollPayment(invocationId, {
          paymentMethod: chosen,
          allocationMode:
            chosen !== PAYROLL_PAYMENT_METHOD_BANK_DEPOSIT
              ? null
              : alone
                ? PAYROLL_PAYMENT_ALLOCATION_MODE_FIXED
                : mode,
          accounts: sendAccounts
            ? entries.map((entry, index) =>
                toAccountInput(
                  alone
                    ? {
                        ...entry,
                        allocationKind: PAYROLL_DEPOSIT_ALLOCATION_REMAINING_BALANCE,
                        allocationPercentage: "",
                        allocationAmount: "",
                      }
                    : entry,
                  index + 1,
                ),
              )
            : undefined,
        });
        setInterview(value);
        setMode(value.allocationMode);
        setEntries((held) =>
          value.accounts.length === 0
            ? []
            : held.map((entry, index) =>
                withoutEnteredValues(entry, value.accounts[index]),
              ),
        );
        setSaveError(null);
        setSaved(true);
        return value;
      } catch (failure: unknown) {
        setSaveError(failure);
        setSaved(false);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [entries, invocationId, method, mode],
  );

  const chooseMethod = useCallback(
    async (next: PayrollPaymentMethod) => {
      setMethod(next);
      setSaved(false);
      setReview(null);
      // A worker who moves to the payroll card is not also stating bank accounts, and one who moves
      // the other way has none to state yet.
      const value = await persist({ method: next, withAccounts: false });
      if (!value) return;
      if (next === PAYROLL_PAYMENT_METHOD_PAYROLL_CARD) {
        setEntries([]);
        return;
      }
      setEntries((held) => (held.length === 0 ? [newAccountEntry(mode)] : held));
    },
    [mode, persist],
  );

  const openReview = useCallback(async () => {
    const value = await persist();
    if (!value || !value.readyForReview) return;
    try {
      const projection = await getOwnPayrollPaymentReview(invocationId);
      setReview(projection);
      setReviewError(null);
      setStage("REVIEW");
    } catch (failure: unknown) {
      setReviewError(failure);
    }
  }, [invocationId, persist]);

  /* ---------------------------------------------------------------- render */

  if (loadError) {
    return (
      <section className="pp-module" data-pp-state="ERROR">
        <OnboardingErrorNotice
          error={loadError}
          onRetry={() => setReloads((count) => count + 1)}
        />
      </section>
    );
  }

  if (!interview) {
    return (
      <section className="pp-module" data-pp-state="LOADING">
        <p className="wf-loading">Loading what you have told us so far.</p>
      </section>
    );
  }

  const refusal = payrollPaymentRefusalCode(saveError);
  const violations = interview.violations;

  return (
    <section className="pp-module" data-pp-state={stage}>
      <h2 className="pp-title">How you get paid</h2>

      {interview.savedAt && stage !== "REVIEW" ? (
        <p className="pp-note" role="status" data-pp-resumed>
          We saved what you told us last time, so you can carry on where you left off.
        </p>
      ) : null}

      {saveError ? (
        <div className="wf-error" role="alert" data-pp-refusal={refusal ?? "UNKNOWN"}>
          <p className="wf-error-title">We could not save that.</p>
          <p>
            {refusal
              ? payrollPaymentRefusalMessage(refusal)
              : "Something went wrong at our end and nothing was saved. Please try again."}
          </p>
        </div>
      ) : null}

      {reviewError ? (
        <div className="wf-error" role="alert" data-pp-review-error>
          <p>We could not show you the summary just now. Nothing has been changed.</p>
        </div>
      ) : null}

      {stage === "REVIEW" && review ? (
        <>
          <PayrollPaymentReviewPanel review={review} />
          <div className="pp-actions">
            <button
              type="button"
              className="wf-button-secondary"
              data-pp-action="change"
              disabled={disabled}
              onClick={() => {
                setReview(null);
                setStage(method === null ? "METHOD" : "DETAILS");
              }}
            >
              Change something
            </button>
          </div>
        </>
      ) : (
        <>
          <PaymentMethodChoice
            chosen={method}
            disabled={disabled}
            onChoose={(next) => void chooseMethod(next)}
          />

          {bank ? (
            <div className="pp-details" data-pp-details>
              <h3 className="pp-subtitle">Your account details</h3>
              <p className="pp-help">
                You can send your pay to one account, or split it between as many as{" "}
                {PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS}.
              </p>

              {entries.map((entry, index) => (
                <DepositAccountEditor
                  key={entry.key}
                  entry={entry}
                  position={index + 1}
                  removable={entries.length > 1}
                  disabled={disabled}
                  onChange={(next) => changeEntry(index, next)}
                  onRemove={() => removeAccount(index)}
                />
              ))}

              {entries.length < PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS ? (
                <button
                  type="button"
                  className="wf-button-secondary"
                  data-pp-action="add-account"
                  disabled={disabled}
                  onClick={addAccount}
                >
                  Add another account
                </button>
              ) : (
                <p className="pp-note" role="status" data-pp-account-ceiling>
                  You can split your pay between up to{" "}
                  {PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS} accounts, so this is as many as you can
                  add.
                </p>
              )}

              {single ? (
                <p className="pp-note" role="status" data-pp-single-account>
                  All of your pay will go into this account. If you would like it split up, add
                  another account and we will ask you how to divide it.
                </p>
              ) : (
                <AllocationEditor
                  mode={mode}
                  entries={entries}
                  disabled={disabled}
                  onModeChange={chooseMode}
                  onEntryChange={changeEntry}
                />
              )}
            </div>
          ) : null}

          {violations.length > 0 ? (
            <div className="wf-error pp-summary" role="alert" data-pp-violations="true">
              <p className="wf-error-title">Before you can go on:</p>
              <ul className="wf-list">
                {violations.map((violation) => (
                  <li
                    key={`${violation.code}-${violation.position ?? "all"}-${violation.field ?? ""}`}
                    data-pp-violation={violation.code}
                  >
                    {violation.position === null
                      ? payrollPaymentViolationMessage(violation.code)
                      : `Account ${violation.position}: ${payrollPaymentViolationMessage(violation.code)}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {saved ? (
            <p className="pp-saved" role="status" data-pp-saved="true">
              Saved. You can leave this and come back to it.
            </p>
          ) : null}

          <div className="pp-actions">
            <button
              type="button"
              className="wf-button-secondary"
              data-pp-action="save"
              disabled={disabled || method === null}
              onClick={() => void persist()}
            >
              Save and finish later
            </button>
            <button
              type="button"
              className="wf-button"
              data-pp-action="review"
              disabled={disabled || method === null}
              onClick={() => void openReview()}
            >
              Check what I have entered
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default PayrollPaymentModule;
