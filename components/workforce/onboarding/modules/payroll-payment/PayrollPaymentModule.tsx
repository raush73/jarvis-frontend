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
 * [AMENDED BY GATE 10C. He can now finish: after reading his proposal through he signs it, and the
 * signature is the terminal act of this module. The act itself is not built here - it is composed
 * beneath the review by `PayrollPaymentAuthorization` on the DELIVERED shared execution card, and
 * this file supplies neither wording, nor a canvas, nor a completion.]
 *
 * WHAT HE CANNOT DO HERE, AND NONE OF IT IS A MISSING BUTTON - NONE OF IT EXISTS:
 *
 *  1. HE CANNOT COMPLETE THE MODULE FROM THE BROWSER, AND THIS FILE COMPLETES NOTHING. `complete` -
 *     the runtime's completion call - is never called anywhere in this capsule. What finishes this
 *     module is the governed act, and whether it finished it is DERIVED server-side from the
 *     module's own validator; the browser reads that answer and never asserts it.
 *  2. HE CANNOT CHOOSE WHEN IT STARTS. There is no effective-date control, because the
 *     authoritative effective date is not his to choose (10-R2). [AMENDED BY GATE 10C: nor is he
 *     told which paycheck it starts with. That sentence was removed from the review, because which
 *     paycheck an instruction first affects is a downstream payroll question this gate does not own
 *     and cannot answer.]
 *  3. HE CANNOT GET A CARD HERE. Choosing the payroll card records a CHOICE, and authorizing it
 *     records an authorized SELECTION. Nothing in this capsule creates, orders, assigns or
 *     activates a card, and nothing is sent outside Jarvis (10-R14); the card setup itself is
 *     MW4H's to do afterwards, which is exactly what the recorded outcome says.
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
import PayrollPaymentAuthorization from "./PayrollPaymentAuthorization";
import PayrollPaymentReviewPanel from "./PayrollPaymentReviewPanel";
import RemoveAccountPrompt from "./RemoveAccountPrompt";
import {
  entriesFromServer,
  newAccountEntry,
  reconcileEntries,
  toAccountInput,
  type PayrollAccountEntry,
} from "./payrollPaymentEntry";
import {
  payrollPaymentRefusalMessage,
  payrollPaymentViolationMessage,
} from "./payrollPaymentRefusal";
import "./payroll-payment.css";

/** Where in his own interview the worker is. Not persisted, and not a position we remember. */
type Stage = "METHOD" | "DETAILS" | "REVIEW";

/** Nothing is outstanding until he has asked to go on. See `attempted` below. */
const NOTHING_OUTSTANDING: PayrollPaymentInterview["violations"] = [];

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

  /**
   * HOW MANY TIMES THE SAVED PROPOSAL HAS CHANGED, handed to the Gate 10C stage below.
   *
   * Whether he may authorize depends on a proposal this component owns and that one does not, so
   * it RE-READS on every change rather than remembering: a worker who corrects an account and
   * saves must be offered the signature without reloading the page, and one whose proposal stops
   * being admissible must stop being offered it. A counter rather than the proposal itself,
   * because what the stage needs to know is that something moved, not what moved.
   */
  const [savedRevisions, setSavedRevisions] = useState(0);

  /**
   * WHETHER HE HAS ASKED TO GO ON. The broken rules are shown when he has, and not before.
   *
   * WHY THIS FLAG EXISTS (QA-L4-UX-7). The rules come from the server, and the server is asked
   * as soon as the worker CHOOSES Direct Deposit - because choosing a payment method is itself
   * saved. So the very first answer, before he has been given a box to type in, is that he has
   * no account yet: perfectly true, and it was being shown to him in a red box headed "Before
   * you can go on" while he was going on. Real-browser QA caught exactly that.
   *
   * A HALF-FILLED FORM IS NOT AN ERROR, AND THIS IS THE WHOLE DISTINCTION. The screen holds two
   * different things and used to conflate them: what the server says is outstanding, which is a
   * fact about the proposal, and whether the worker has reached the point where being told about
   * it helps him, which is a fact about him. Red says "you asked to go on and this must be
   * corrected first". It does not say "you have not finished typing".
   *
   * IT GATES PRESENTATION AND NOTHING ELSE. Every rule is still applied, still by the server,
   * still on every save; `readyForReview` is still the server's answer and still what stops the
   * review from opening. What the flag decides is the moment a sentence appears on screen.
   */
  const [attempted, setAttempted] = useState(false);

  /**
   * WHICH ROW HE HAS ASKED TO REMOVE, by its row key, while he is being asked whether he means
   * it (QA-L4-UX-6). Null when nothing is being asked.
   *
   * BY KEY AND NOT BY INDEX, deliberately. An index is a position, and this module has already
   * paid once for treating a position as an identity (QA-L4-R1): the row a worker pointed at is
   * the row that must be removed, not whichever row later occupies that slot.
   */
  const [removing, setRemoving] = useState<string | null>(null);

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

  /**
   * He has changed something, so what the server last said is outstanding is no longer what it
   * would say now (QA-L4-UX-7).
   *
   * The list on screen is a SNAPSHOT of the last answer, and an edit is the moment it goes stale.
   * Leaving it up would leave a worker who has just fixed the thing looking at the complaint about
   * it, which is the other half of the same defect: red must not outlive the condition that
   * earned it. The next save asks again and, if anything is genuinely still outstanding, says so.
   */
  const changed = useCallback(() => {
    setSaved(false);
    setAttempted(false);
  }, []);

  const changeEntry = useCallback(
    (index: number, next: PayrollAccountEntry) => {
      setEntries((held) => held.map((entry, at) => (at === index ? next : entry)));
      changed();
    },
    [changed],
  );

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
    changed();
  }, [changed, mode]);

  /**
   * REMOVE THE ROW HE POINTED AT, once he has said he means it.
   *
   * REMOVING AN ACCOUNT IS DESTRUCTIVE TWICE OVER, which is why it is asked about first
   * (QA-L4-UX-6). It discards banking details he typed out and confirmed digit by digit, and it
   * can unpick how his pay is divided - taking away the account that was to receive the remainder
   * leaves an instruction that no longer says where the rest of his wages go. Real-browser QA
   * removed an account with one click and no question asked.
   *
   * The removal ITSELF is unchanged: the row goes, nothing else is touched, and the surviving rows
   * keep their own server identities and their own protected values (QA-L4-R1).
   */
  const removeAccount = useCallback(
    (key: string) => {
      setEntries((held) => held.filter((entry) => entry.key !== key));
      setRemoving(null);
      changed();
    },
    [changed],
  );

  const chooseMode = useCallback(
    (next: PayrollPaymentAllocationMode) => {
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
      changed();
    },
    [changed],
  );

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
            : reconcileEntries(held, value.accounts),
        );
        setSaveError(null);
        setSaved(true);
        setSavedRevisions((count) => count + 1);
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

  /**
   * The two acts that ASK TO GO ON, and the only two that put a red summary on screen.
   *
   * Both are the worker deliberately handing the proposal to the server, which is the point at
   * which what is still outstanding is something he needs to be told (QA-L4-UX-7). Every OTHER
   * save in this file - and there is one every time he picks a payment method - is a consequence
   * of something else he did, and answers a question he did not ask.
   */
  const attemptSave = useCallback(async () => {
    setAttempted(true);
    await persist();
  }, [persist]);

  const chooseMethod = useCallback(
    async (next: PayrollPaymentMethod) => {
      setMethod(next);
      setSaved(false);
      // Choosing how to be paid is the START of the work, so it reports nothing as outstanding.
      setAttempted(false);
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
    setAttempted(true);
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
  /**
   * What the server says is outstanding, shown when he has asked to go on AND WE HAVE THE ANSWER TO
   * THAT ASKING (QA-L4-UX-7, corrected by QA-L4-UX-7A).
   *
   * `interview.violations` is untouched and is still the server's own list. Two things have to be
   * true before it is put on screen, and the second one is what QA-L4-UX-7A adds.
   *
   * WHY IT IS NOT ENOUGH THAT HE ASKED. `interview` is the LAST ANSWER THE SERVER GAVE, which
   * during a request in flight is the answer to an OLDER question. Real-browser QA caught what that
   * costs: a worker with three valid accounts clicked Review info, and for the length of the round
   * trip the screen showed him "Add the account you would like your pay sent to" and "Choose how
   * your pay should be divided" - both perfectly true when they were said, which was when he first
   * chose Direct Deposit and the server held nothing. He had answered both since. The proposal was
   * accepted and the review opened, so the outcome was right and only the frame in between was
   * wrong: the screen presented a stale answer as though it were the verdict on the request it was
   * still waiting for.
   *
   * SO THE CONDITION IS "A REQUEST HE MADE HAS COME BACK". While one is in flight we do not yet
   * know, and a screen that does not know says nothing; a request that FAILED told us nothing
   * either, and is answered by the refusal notice above rather than by re-showing an older list
   * under "Before you can go on".
   *
   * IT SUPPRESSES A FRAME AND NOT A RULE. Every rule is still applied by the server on every save,
   * `readyForReview` is still what decides whether the review opens, and the moment a real answer
   * arrives saying something is outstanding, it is shown.
   */
  const answered = attempted && !saving && saveError === null;
  const outstanding = answered ? interview.violations : NOTHING_OUTSTANDING;
  const removingEntry = entries.find((entry) => entry.key === removing) ?? null;

  return (
    <section className="pp-module" data-pp-state={stage}>
      {/*
        THE OWNER'S HEADING (owner ruling, final 10A-R1 UI correction). "How you get paid" described
        the question this screen opens with; what the screen actually does, once he has chosen his
        own bank, is show him how his payroll is DISTRIBUTED across the accounts he named - which is
        the heading's job to say. A label only: nothing below it changes, and no domain, API or
        persisted name carries this wording.
      */}
      <h2 className="pp-title">Payroll Distribution</h2>

      {/*
        [AMENDED BY GATE 10C to add the third condition. "Carry on where you left off" is an
        invitation to finish something, and a worker who has already signed has nothing left to
        carry on with - telling him otherwise would suggest his part was still outstanding.]
      */}
      {interview.savedAt && stage !== "REVIEW" && !sectionClosed ? (
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

      {sectionClosed ? (
        /*
          HIS PART IS DONE, so what he is shown is what is ON RECORD rather than the form he filled
          in. The stage below reads the server's own answer, which is the only authority for
          whether this module is finished - this component neither derives nor asserts it.
        */
        <PayrollPaymentAuthorization
          invocationId={invocationId}
          proposalToken={`closed:${savedRevisions}`}
          changeable={false}
        />
      ) : stage === "REVIEW" && review ? (
        <>
          <PayrollPaymentReviewPanel review={review} />

          {/*
            GATE 10C - THE TERMINAL WORKER ACT, beneath what he is checking and never folded into
            it. `Save and finish later` is deliberately NOT offered here: it is an abandonment and
            resume action, truthful for a worker who leaves before he has finished, and presenting
            it as the last thing to do after he has read everything through would tell him he had
            completed something he had not. What finishes this module is the signature below.
          */}
          <PayrollPaymentAuthorization
            invocationId={invocationId}
            proposalToken={`review:${savedRevisions}`}
            changeable={!disabled}
          />

          <div className="pp-actions wf-btn-row">
            <button
              type="button"
              className="wf-btn wf-btn-secondary"
              data-pp-action="change"
              disabled={disabled}
              onClick={() => {
                setReview(null);
                setStage(method === null ? "METHOD" : "DETAILS");
              }}
            >
              Edit payment information
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
                  onRemove={() => setRemoving(entry.key)}
                />
              ))}

              {removingEntry ? (
                <RemoveAccountPrompt
                  entry={removingEntry}
                  disabled={disabled}
                  onCancel={() => setRemoving(null)}
                  onConfirm={() => removeAccount(removingEntry.key)}
                />
              ) : null}

              {entries.length < PAYROLL_PAYMENT_MAX_DEPOSIT_ACCOUNTS ? (
                <div className="wf-btn-row">
                  <button
                    type="button"
                    className="wf-btn wf-btn-secondary"
                    data-pp-action="add-account"
                    disabled={disabled}
                    onClick={addAccount}
                  >
                    Add another account
                  </button>
                </div>
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

          {outstanding.length > 0 ? (
            <div className="wf-error pp-summary" role="alert" data-pp-violations="true">
              <p className="wf-error-title">Before you can go on:</p>
              <ul className="wf-list">
                {outstanding.map((violation) => (
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

          {/*
            WHAT IS HAPPENING WHILE HE WAITS (QA-L4-UX-7A). Something neutral stands where the red
            box used to flash, and it is the truth about the only thing going on: we are asking.
            Both actions are already disabled for the duration, so he cannot ask twice over.
          */}
          {saving ? (
            <p className="pp-note" role="status" data-pp-in-flight>
              Saving what you have told us.
            </p>
          ) : null}

          {saved && !saving ? (
            <p className="pp-saved" role="status" data-pp-saved="true">
              Saved. You can leave this and come back to it.
            </p>
          ) : null}

          {/*
            THE TWO ACTIONS, AS ACTIONS (QA-L4-UX-1). They carry the shared `wf-btn` classes every
            other Workforce screen uses, and the hierarchy says which one goes forward: Review info
            is the primary, Save and finish later is beside it as the secondary. They were written
            against `wf-button` and `wf-button-secondary`, which no stylesheet in this application
            defines, so they reached the worker as unstyled native buttons - which is to say as
            text. Real-browser QA reported not being able to tell what was clickable, and it was
            right.
          */}
          <div className="pp-actions wf-btn-row">
            <button
              type="button"
              className="wf-btn wf-btn-secondary"
              data-pp-action="save"
              disabled={disabled || method === null}
              onClick={() => void attemptSave()}
            >
              Save and finish later
            </button>
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              data-pp-action="review"
              disabled={disabled || method === null}
              onClick={() => void openReview()}
            >
              Review info
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default PayrollPaymentModule;
