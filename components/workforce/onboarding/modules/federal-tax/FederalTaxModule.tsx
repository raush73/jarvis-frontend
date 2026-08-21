"use client";

/**
 * Module 4.2 Federal Tax - the worker's guided interview.
 *
 * The worker's own part of a regulated module, rendered by the DELIVERED onboarding runtime at the
 * canonical worker URL. It reaches him the way every module does - the capsule registered a renderer
 * under its module key - and nothing in the runtime, the navigation, the status layer, the document
 * foundation or the execution foundation was changed to admit it.
 *
 * WHAT THE WORKER DOES HERE: he confirms that the record Jarvis holds is his, answers plain-language
 * questions about his own circumstances, reads an explanation beside any of them he wants explained,
 * saves when he chooses to, leaves and comes back, reviews everything he has said, corrects whatever
 * he wants to correct, and finally signs to put his choices in force. That is the whole of it.
 *
 * THE INTERVIEW AND THE ACT ARE DIFFERENT THINGS AND ARE KEPT SO. Every step below saves answers and
 * nothing else - no step of the interview executes, and typing has never put anything in force. The
 * one irreversible act lives in `FederalTaxCertification`, composed into the foot of the review step
 * rather than given a fourth URL, because the module's declared steps are the INTERVIEW's and
 * signing is not a fourth question. The delivered I-9 capsule composes its own act the same way.
 *
 * WHAT HE CANNOT DO HERE, and none of it is a missing button - none of it exists:
 *
 *  1. HE CANNOT SIGN ANYTHING FROM THIS FILE, AND THIS FILE COMPLETES NOTHING. There is no canvas
 *     anywhere in this capsule, no stroke handling and no local signature engine: the mark is drawn
 *     on the DELIVERED shared capture surface, which the certification component composes and which
 *     this one never touches. `complete` - the runtime's completion call - is never called anywhere
 *     in this capsule either, and finishing every question does not finish this module. Completion
 *     is DERIVED server-side from this module's own validator once an executed election, an
 *     execution record and a retained artifact all exist.
 *  2. HE CANNOT SEE A GOVERNMENT DOCUMENT, a numbered step of one, a worksheet or a line reference.
 *     He answers questions about his life; the mapping onto what a government document requires is
 *     Jarvis's problem and is not shown to him.
 *  3. HE CANNOT SEE A FULL IDENTIFICATION NUMBER. What arrives is a mask the identity authority
 *     produced, and there is no call in this capsule that could obtain anything wider.
 *  4. HE CANNOT BE TOLD WHAT TO ANSWER. Nothing here recommends, defaults, pre-selects, ranks or
 *     hints. The guidance explains what a question means and stops.
 *  5. HE CANNOT CORRECT, REPLACE OR RE-ELECT ONCE IT IS IN FORCE. A subsequent election, a
 *     correction and a future-year replacement are separately governed work with no client here.
 *
 * TWO PROPERTIES THIS FILE EXISTS TO KEEP:
 *
 *  - EXPLICIT SAVE, in the strong sense. Nothing is persisted by typing. `setValue` and `save` - the
 *    runtime's shared draft recorder and its save cycle - are deliberately never called, and the
 *    module declares no captured keys for them to write into, so no half-typed withholding amount can
 *    reach the shared draft. A Save states the whole answer set, deliberately, or nothing happens.
 *  - THE SERVER DECIDES WHICH QUESTIONS APPLY. The applicable questions arrive decided, in order.
 *    This screen renders them and holds no branch rule, which is why a worker who changes a gate
 *    answer is asked to save: saving is how the interview moves, and the screen says so plainly
 *    rather than pretending a branch opened on its own.
 *
 * WHERE UNSAVED ANSWERS LIVE. In the capsule's own in-session store, not in this component, because
 * the runtime gives each declared step its own URL and unmounts this component between them. Not in
 * browser storage either - see the store's own file for why that is a prohibition rather than a
 * preference.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OnboardingModuleRendererProps } from "@/components/workforce/onboarding/runtime/moduleRegistry";
import OnboardingErrorNotice from "@/components/workforce/onboarding/runtime/OnboardingErrorNotice";
import {
  FEDERAL_TAX_STEP_SLUGS,
  federalTaxRefusalCode,
  getOwnFederalTaxInterview,
  saveOwnFederalTaxInterview,
  type FederalTaxAnswerKey,
  type FederalTaxInterview,
  type FederalTaxQuestion,
  type FederalTaxWorkerRefusalCode,
} from "@/lib/workforce/federalTaxApi";
import {
  answersOf,
  readFederalTaxAnswers,
  resetFederalTaxAnswersFromServer,
  seedFederalTaxAnswers,
  stateFederalTaxAnswer,
  toSaveInput,
  useFederalTaxAnswers,
  type FederalTaxAnswers,
  type FederalTaxAnswerValue,
} from "./federalTaxAnswerStore";
import FederalTaxCertification from "./FederalTaxCertification";
import IdentityCard from "./IdentityCard";
import QuestionField from "./QuestionField";
import ReviewPanel from "./ReviewPanel";
import "./federal-tax.css";

const [IDENTITY_STEP, WITHHOLDING_STEP, REVIEW_STEP] = FEDERAL_TAX_STEP_SLUGS;

/**
 * What each governed refusal means, in the worker's own words, WHEN IT REFUSES A SAVE.
 *
 * Keyed by CODE so an unknown one cannot slip through as a raw identifier. TYPED OVER THE WORKER'S
 * CODES so a code he can receive cannot be added to the client without words being written for it.
 *
 * THE CERTIFICATION CODES ARE ANSWERED HERE ONLY AS A SAVE COULD RAISE THEM, WHICH IS BARELY. They
 * classify the ACT, and the act has its own refusal surface beside its own signing control - telling
 * a worker at the top of the page that his signature was refused, while the refusal also appears
 * beside the control he pressed, would say it twice and in the wrong place. The wording below is
 * therefore deliberately about his answers, because that is the only thing a save can be about.
 */
const REFUSAL_MESSAGES: Record<FederalTaxWorkerRefusalCode, string> = {
  ANSWER_NOT_GOVERNED:
    "One of your answers is not something we can accept. Check the amounts and choices below and save again.",
  IDENTITY_NOT_AVAILABLE:
    "We cannot show you the details you are being asked to confirm, so we have not saved that confirmation.",
  DRAFT_PROTECTION_UNAVAILABLE:
    "We could not store your answers safely just now, so we did not store them at all. Nothing was saved. Please try saving again.",
  DRAFT_PROTECTION_INVALID:
    "We could not open the answers we had saved for you. Nothing has been changed. Tell your MW4H contact.",
  INTERVIEW_NOT_COMPLETE:
    "There is still something to answer or confirm above. Your answers were not saved.",
  ELECTION_ALREADY_EXECUTED:
    "Your choices are already in force, so we did not change them. If they need to change, tell your MW4H contact.",
  EXEMPTION_CONDITIONS_REQUIRED:
    "We could not accept that. Your answers were not saved.",
  ELECTION_BINDING_UNAVAILABLE:
    "Something went wrong at our end and nothing was changed. Please try again.",
  REVISION_BINDING_REQUIRED:
    "Something went wrong at our end and nothing was changed. Please try again.",
  // The four later-election codes, answered in terms of a SAVE for the same reason as the ones
  // above: they classify an act performed on the certification surface, which shows its own refusal
  // beside the control that raised it. A save is only ever about his answers, so that is what these
  // say - and none of them can be reached by editing an answer.
  NO_OPERATIVE_ELECTION:
    "Your answers were not saved. Nothing about your record has changed.",
  VALUE_NOT_GOVERNED:
    "One of your answers is not something we can accept. Check the amounts and choices below and save again.",
  CORRECTION_REASON_REQUIRED:
    "Your answers were not saved. Nothing about your record has changed.",
  CORRECTION_REASON_NOT_PERMITTED:
    "Your answers were not saved. Nothing about your record has changed.",
};

/**
 * The governed shape of an entered amount, mirrored from the question set.
 *
 * A COURTESY AND NOT THE AUTHORITY, exactly as the delivered modules mirror their own rules: the
 * server applies this same rule to every caller and its refusal is what decides. Checking it here
 * means a worker is told beside the field rather than after a round trip, and it is a string rule
 * rather than a number rule for the reason the server gives - turning an exact decimal into a
 * floating-point value in order to check it introduces the imprecision the rule exists to avoid.
 */
const GOVERNED_AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

/** The questions of one declared step, in governed order. */
function questionsOfStep(
  interview: FederalTaxInterview | null,
  stepSlug: string,
): FederalTaxQuestion[] {
  return (interview?.questions ?? []).filter(
    (question) => question.step === stepSlug,
  );
}

/** Which applicable answers are malformed, named by key. Never carries the value. */
function malformedAmounts(
  questions: FederalTaxQuestion[],
  answers: FederalTaxAnswers,
): FederalTaxAnswerKey[] {
  return questions
    .filter((question) => {
      if (question.kind !== "AMOUNT") return false;
      const value = answers[question.key];
      if (typeof value !== "string") return false;
      const trimmed = value.trim();
      return trimmed !== "" && !GOVERNED_AMOUNT.test(trimmed);
    })
    .map((question) => question.key);
}

/**
 * Whether what the worker holds differs from what the server last confirmed it stored.
 *
 * Compared against the SAME projection the store seeds from, so the two sides mean the same thing by
 * "unanswered". Comparing raw values instead would report a worker as having unsaved work the instant
 * he arrived, because an unconfirmed confirmation reads as false on the wire and as unanswered here.
 */
function hasUnsavedAnswers(
  interview: FederalTaxInterview | null,
  answers: FederalTaxAnswers,
): boolean {
  if (!interview) return false;
  const stored = answersOf(interview);
  return interview.questions.some((question) => {
    const held = answers[question.key];
    const saved = stored[question.key];
    if (held === saved) return false;
    // An empty box and an unanswered question are the same state, so a worker who clicked into an
    // amount and clicked out again is not told he has unsaved work.
    const heldEmpty = held === null || (typeof held === "string" && held.trim() === "");
    const savedEmpty = saved === null || (typeof saved === "string" && saved.trim() === "");
    return !(heldEmpty && savedEmpty);
  });
}

export function FederalTaxModule({
  invocationId,
  module,
  step,
  busy,
}: OnboardingModuleRendererProps) {
  const answers = useFederalTaxAnswers(invocationId);

  const [interview, setInterview] = useState<FederalTaxInterview | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  /** Broken rules are shown once the worker has tried to save, not while he is still typing. */
  const [attempted, setAttempted] = useState(false);
  /** Bumped by each refused attempt, so the worker is taken to what is wrong every time. */
  const [refusedAttempts, setRefusedAttempts] = useState(0);
  const [saved, setSaved] = useState(false);
  /** True when the last Save opened questions the worker had not been asked before. */
  const [opened, setOpened] = useState(false);
  const [reloads, setReloads] = useState(0);

  const summary = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    setReloads((count) => count + 1);
  }, []);

  /* ------------------------------------------------------------------ read */

  useEffect(() => {
    // `live` guards a response arriving after the worker moved on, which would otherwise show one
    // packet's interview under another's screen.
    let live = true;
    getOwnFederalTaxInterview(invocationId)
      .then((value) => {
        if (!live) return;
        // Offered to the session's answers ONCE per packet, before the worker has touched anything,
        // so a resuming worker sees what he saved and a typing worker is never overwritten.
        seedFederalTaxAnswers(invocationId, value);
        setInterview(value);
        setLoadError(null);
      })
      .catch((failure: unknown) => {
        if (live) setLoadError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId, reloads]);

  /* ------------------------------------------------------------ what we have */

  const stepQuestions = useMemo(
    () => questionsOfStep(interview, step.slug),
    [interview, step.slug],
  );

  const sectionClosed =
    module.status === "COMPLETE" || module.status === "ALREADY_COMPLETE";
  const disabled = saving || busy || sectionClosed;

  const malformed = useMemo(
    () => malformedAmounts(stepQuestions, answers),
    [answers, stepQuestions],
  );
  const shownMalformed = attempted ? malformed : [];

  const dirty = useMemo(
    () => hasUnsavedAnswers(interview, answers),
    [answers, interview],
  );

  useEffect(() => {
    if (!dirty) return;
    // A reload or a closed tab is the one way unsaved answers are actually lost, because they live
    // in memory and deliberately nowhere else. The browser's own prompt is the only protection that
    // reaches it, and it is registered only while there is something to lose.
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (refusedAttempts === 0) return;
    // Focus follows the refusal. A worker on a phone has the button under his thumb and the reason
    // above the fold; moving him to the reason is the whole point of reporting it.
    summary.current?.focus();
  }, [refusedAttempts]);

  /* ----------------------------------------------------------------- edits */

  const answer = useCallback(
    (key: FederalTaxAnswerKey, value: FederalTaxAnswerValue) => {
      stateFederalTaxAnswer(invocationId, key, value);
      setSaved(false);
      setOpened(false);
    },
    [invocationId],
  );

  /* ------------------------------------------------------------------ save */

  /**
   * THE explicit save: the whole answer set, in one deliberate act, or nothing.
   *
   * The answers are read from the store rather than from this render so that what is sent is what the
   * worker last typed, and the answers stay exactly where they are if the server refuses - a refused
   * save is not a reason to lose them, and nothing was recorded.
   *
   * WHAT COMES BACK REPLACES WHAT WAS SENT. The server normalizes an answer set, erasing whatever the
   * worker's own branching made inapplicable, so the screen is re-seeded from its answer rather than
   * from the request. That is also how a newly opened branch appears: it was decided server-side and
   * read back, never guessed here.
   */
  const save = useCallback(async (): Promise<boolean> => {
    const held = readFederalTaxAnswers(invocationId);
    setAttempted(true);

    if (malformedAmounts(interview?.questions ?? [], held).length > 0) {
      setSaveError(null);
      setSaved(false);
      setRefusedAttempts((count) => count + 1);
      return false;
    }

    const asked = new Set((interview?.questions ?? []).map((question) => question.key));

    setSaving(true);
    try {
      const value = await saveOwnFederalTaxInterview(invocationId, toSaveInput(held));
      resetFederalTaxAnswersFromServer(invocationId, value);
      setInterview(value);
      setSaveError(null);
      setAttempted(false);
      setSaved(true);
      setOpened(value.questions.some((question) => !asked.has(question.key)));
      return true;
    } catch (failure: unknown) {
      setSaveError(failure);
      setSaved(false);
      setRefusedAttempts((count) => count + 1);
      return false;
    } finally {
      setSaving(false);
    }
  }, [interview, invocationId]);

  /* ---------------------------------------------------------------- render */

  if (loadError) {
    return (
      <section className="ft-module" data-ft-state="ERROR">
        <OnboardingErrorNotice error={loadError} onRetry={() => void reload()} />
      </section>
    );
  }

  if (!interview) {
    return (
      <section className="ft-module" data-ft-state="LOADING">
        <p className="wf-loading">Loading your answers.</p>
      </section>
    );
  }

  const stepForKey = (key: string): string | null =>
    interview.questions.find((question) => question.key === key)?.step ?? null;

  const messages = (
    <>
      {interview.questionSetSuperseded ? (
        <p className="ft-note" role="status" data-ft-question-set-superseded>
          We have changed some of these questions since you last answered them. What you told us has
          been kept, but please read through it again and confirm your review once more.
        </p>
      ) : null}

      {saveError ? <RefusalNotice error={saveError} /> : null}

      {shownMalformed.length > 0 ? (
        <div
          className="wf-error ft-summary"
          role="alert"
          tabIndex={-1}
          ref={summary}
          data-ft-violations="true"
        >
          <p className="wf-error-title">Check the following before saving.</p>
          <ul className="wf-list">
            {shownMalformed.map((key) => (
              <li key={key} data-ft-violation={key}>
                Enter an amount in dollars and cents, with nothing but numbers and a decimal point.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {saved ? (
        <p className="ft-saved" role="status" data-ft-saved="true">
          Your answers are saved. You can stop here and come back to this whenever you like.
        </p>
      ) : null}

      {opened ? (
        <p className="ft-note" role="status" data-ft-opened="true">
          Because of what you have told us, there are a few more things to ask you below.
        </p>
      ) : null}

      {dirty ? (
        <p className="ft-dirty" role="status" data-ft-unsaved="true">
          You have answers that are not saved yet. Press Save before you close this page, or they
          will be lost.
        </p>
      ) : null}
    </>
  );

  const progress = (
    <ol className="ft-progress" data-ft-progress>
      {interview.steps.map((declared) => (
        <li
          className="ft-progress-step"
          key={declared.slug}
          data-ft-step={declared.slug}
          data-ft-step-recorded={declared.recorded ? "true" : "false"}
        >
          <span className="ft-progress-title">{declared.title}</span>
          <span className="ft-progress-state">
            {declared.recorded ? "Answered" : "Still to do"}
          </span>
        </li>
      ))}
    </ol>
  );

  const saveRow = (
    <div className="wf-btn-row ft-actions">
      <button
        type="button"
        className="wf-btn wf-btn-primary"
        disabled={disabled}
        onClick={() => void save()}
        data-ft-save
      >
        {saving ? "Saving." : "Save"}
      </button>
    </div>
  );

  /* ------------------------------------------------------------ step one */

  if (step.slug === IDENTITY_STEP) {
    return (
      <section className="ft-module" data-ft-state="IDENTITY">
        {messages}
        <p className="ft-intro">
          Before you make any choices about your pay, please check that the details we already hold
          are yours.
        </p>
        <IdentityCard identity={interview.identity} />
        {stepQuestions.map((question) => (
          <QuestionField
            key={question.key}
            question={question}
            value={answers[question.key]}
            onAnswer={(value) => answer(question.key, value)}
            disabled={disabled || interview.identity === null}
            error={null}
          />
        ))}
        {sectionClosed ? null : saveRow}
        {progress}
      </section>
    );
  }

  /* ------------------------------------------------------------ step two */

  if (step.slug === WITHHOLDING_STEP) {
    return (
      <section
        className="ft-module"
        data-ft-state="WITHHOLDING"
        data-ft-dirty={dirty ? "true" : "false"}
      >
        {messages}
        <p className="ft-intro">
          These questions decide how much federal income tax is held back from each of your
          paychecks. Answer them about yourself. Nothing here is saved until you press Save, and
          saving is also how we know what else to ask you.
        </p>
        {stepQuestions.map((question) => (
          <QuestionField
            key={question.key}
            question={question}
            value={answers[question.key]}
            onAnswer={(value) => answer(question.key, value)}
            disabled={disabled}
            error={
              shownMalformed.includes(question.key)
                ? "Enter an amount in dollars and cents, or leave it empty."
                : null
            }
          />
        ))}
        {sectionClosed ? null : saveRow}
        {progress}
      </section>
    );
  }

  /* ---------------------------------------------------------- step three */

  return (
    <section className="ft-module" data-ft-state="REVIEW">
      {messages}
      <p className="ft-intro">
        This is everything you have told us. Read it through, change anything that is not what you
        meant, and then confirm that you have read it.
      </p>

      <ReviewPanel
        lines={interview.review}
        invocationId={invocationId}
        moduleSlug={module.moduleSlug}
        stepForKey={stepForKey}
      />

      {questionsOfStep(interview, REVIEW_STEP).map((question) => (
        <QuestionField
          key={question.key}
          question={question}
          value={answers[question.key]}
          onAnswer={(value) => answer(question.key, value)}
          disabled={disabled}
          error={null}
        />
      ))}

      <p className="ft-note" data-ft-confirmation-is-not-execution>
        Confirming this says that you have read your answers and they are what you meant. It does not
        put them in force on its own - the last step is below, and you have to sign it.
      </p>

      {sectionClosed ? null : saveRow}

      {/*
        THE LAST STEP, composed here rather than routed to.
        It reads its own governed stage from the server and re-reads it whenever the interview
        changes, which is why the token below is the server's own account of this interview rather
        than anything this component decided: availability depends on answers, and a screen that
        remembered availability across a save would offer a signature the server would refuse.
      */}
      <FederalTaxCertification
        invocationId={invocationId}
        interviewToken={`${interview.savedAt ?? "never"}:${
          interview.interviewComplete ? "complete" : "open"
        }:${interview.questionSetSuperseded ? "superseded" : "current"}`}
        changeable={!sectionClosed}
      />

      {progress}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A refusal, said in this module's own words.
 *
 * Keyed by the governed CODE it carries. Where the code is one of this module's, the worker is told
 * which rule was broken; where it is not, the server's own message stands rather than being
 * paraphrased into something it did not say.
 */
function RefusalNotice({ error }: { error: unknown }) {
  const code = federalTaxRefusalCode(error);
  const spoken = code === null ? null : REFUSAL_MESSAGES[code];
  const message =
    spoken ??
    (((error as { message?: unknown })?.message as string | undefined) ??
      "Something went wrong. Nothing was changed.");

  return (
    <div className="wf-error" role="alert" data-ft-refusal={code ?? "UNCLASSIFIED"}>
      <p className="wf-error-title">We could not save your answers.</p>
      <p>{message}</p>
      <p className="ft-note">
        Your answers are still on this screen. Nothing was recorded.
      </p>
    </div>
  );
}

export default FederalTaxModule;
