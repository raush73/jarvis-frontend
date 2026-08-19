"use client";

/**
 * Module 4.2 Federal Tax - one governed question, rendered.
 *
 * IT RENDERS THE QUESTION THE SERVER SENT AND DECIDES NOTHING ABOUT IT. The prompt, the answer kind,
 * the options and whether an answer is required all arrive from the governed question set. This
 * component holds no question text, no option list and no rule: it switches on the KIND the server
 * declared, which is what lets a later governed revision change the questions without a screen having
 * to be rewritten to agree with it.
 *
 * THE QUESTION COMES FROM THE SERVER; THE VALUE COMES FROM THE SESSION. They are separate props for a
 * reason: what the worker has typed since his last Save is not on his record, and rendering
 * `question.answer` would show him the saved answer while he was editing a different one.
 *
 * IT SUGGESTS NOTHING, and that is enforced by what is absent. No option is pre-selected, no answer is
 * defaulted, no option is marked usual or recommended, and the options are rendered in the governed
 * order rather than reordered to put one first. An unanswered question renders as unanswered.
 *
 * A BLANK AMOUNT IS "NO ELECTION" AND IS SAID IN THOSE WORDS. It is not shown as a zero and is never
 * filled in, because an elected zero and no election are different facts and a worker must not be
 * nudged into stating one when he meant the other.
 */

import type { FederalTaxQuestion } from "@/lib/workforce/federalTaxApi";
import type { FederalTaxAnswerValue } from "./federalTaxAnswerStore";
import QuestionGuidance from "./QuestionGuidance";

export default function QuestionField({
  question,
  value,
  onAnswer,
  disabled,
  error,
}: {
  question: FederalTaxQuestion;
  value: FederalTaxAnswerValue;
  onAnswer: (value: FederalTaxAnswerValue) => void;
  disabled: boolean;
  error: string | null;
}) {
  const name = `ft-${question.key}`;
  const errorId = `${name}-error`;
  const described = error ? errorId : undefined;

  return (
    <fieldset className="wf-card ft-question" data-ft-question={question.key}>
      <legend className="ft-prompt">{question.prompt}</legend>

      {question.kind === "CONFIRMATION" ? (
        <label className="ft-check" htmlFor={name}>
          <input
            id={name}
            type="checkbox"
            checked={value === true}
            onChange={(event) => onAnswer(event.target.checked ? true : null)}
            disabled={disabled}
            aria-describedby={described}
          />
          <span>Yes, that is right</span>
        </label>
      ) : null}

      {question.kind === "YES_NO" ? (
        <div className="ft-options">
          {[
            { value: true, label: "Yes" },
            { value: false, label: "No" },
          ].map((option) => (
            <label className="ft-option" key={option.label}>
              <input
                type="radio"
                name={name}
                checked={value === option.value}
                onChange={() => onAnswer(option.value)}
                disabled={disabled}
                aria-describedby={described}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.kind === "CHOICE" ? (
        <div className="ft-options">
          {question.choices.map((choice) => (
            <label className="ft-option" key={choice.value}>
              <input
                type="radio"
                name={name}
                value={choice.value}
                checked={value === choice.value}
                onChange={() => onAnswer(choice.value)}
                disabled={disabled}
                aria-describedby={described}
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {question.kind === "AMOUNT" ? (
        <div className="ft-amount">
          <label className="wf-label" htmlFor={name}>
            Amount in dollars
          </label>
          <input
            id={name}
            className="wf-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onAnswer(event.target.value)}
            disabled={disabled}
            aria-describedby={described}
          />
          <p className="ft-hint">
            Leave this empty if there is nothing you want counted here. Empty is not the same as
            entering nought.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="wf-field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}

      <QuestionGuidance guidance={question.guidance} questionKey={question.key} />
    </fieldset>
  );
}
