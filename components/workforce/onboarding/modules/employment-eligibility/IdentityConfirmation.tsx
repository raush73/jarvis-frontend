"use client";

/**
 * Module 4.1, step one - is this you?
 *
 * The name shown here is the worker's own canonical identity, read from the certified worker
 * portal projection. This screen displays it and asks ONE question about it.
 *
 * WHAT IT IS NOT. It is not an identity editor. There is no field here through which a worker
 * could state a different name, and there is no date of birth and no Social Security Number on
 * this screen, because none is needed to ask him whether the name Jarvis holds is his. A worker
 * who says it is wrong is told MW4H will look at it - which is the truth: the answer is recorded
 * as a governed part of his record, the module reports it as something that stops certification,
 * and nothing here rewrites canonical identity or opens a correction workflow.
 *
 * A CONTROLLED component holding nothing. The answer comes down as a prop and goes back up, so
 * the only copy of it lives in the capsule's own in-session draft until an explicit Save.
 */

import type { EmploymentEligibilityIdentityAnswer } from "./employmentEligibilityDraftStore";

type Props = {
  /** The worker's canonical display name, or null when Jarvis holds no name parts. */
  displayName: string | null;
  answer: EmploymentEligibilityIdentityAnswer;
  onAnswer: (answer: EmploymentEligibilityIdentityAnswer) => void;
  disabled?: boolean;
  /** True once a governed version carrying this answer is on the worker's record. */
  recorded?: boolean;
  /** Shown beside the question once the worker has tried to save without answering it. */
  error?: string | null;
};

const ERROR_ID = "ee-identity-error";

export function IdentityConfirmation({
  displayName,
  answer,
  onAnswer,
  disabled = false,
  recorded = false,
  error = null,
}: Props) {
  return (
    <section className="ee-step" data-ee-step="identity">
      <p className="ee-intro">
        We need to be sure we are asking the right person. This is the name we have for you.
      </p>

      {displayName ? (
        <p className="wf-card ee-identity-name" data-worker-name>
          {displayName}
        </p>
      ) : (
        <p className="wf-empty" data-worker-name-missing>
          We do not have your name on file yet. Choose the second answer below and MW4H will
          sort this out with you.
        </p>
      )}

      <fieldset className="ee-fieldset" aria-describedby={error ? ERROR_ID : undefined}>
        <legend className="wf-label">Is this you?</legend>

        <label className="ee-choice">
          <input
            type="radio"
            name="ee-identity"
            value="CONFIRMED"
            checked={answer === "CONFIRMED"}
            disabled={disabled}
            onChange={() => onAnswer("CONFIRMED")}
          />
          <span>Yes, this is me.</span>
        </label>

        <label className="ee-choice">
          <input
            type="radio"
            name="ee-identity"
            value="DISPUTED"
            checked={answer === "DISPUTED"}
            disabled={disabled}
            onChange={() => onAnswer("DISPUTED")}
          />
          <span>This information is not correct.</span>
        </label>

        {error ? (
          <p className="wf-field-error" id={ERROR_ID} role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>

      {answer === "DISPUTED" ? (
        <p className="ee-note" role="status" data-ee-identity-disputed>
          Thank you for telling us. We will keep your answer and MW4H will review your details
          with you. Nothing you enter here changes your personal information.
        </p>
      ) : null}

      {recorded ? (
        <p className="ee-note" data-ee-identity-recorded>
          This is the answer we have on file for you. You can change it, and if you do we will
          ask you for your documents again before we save it.
        </p>
      ) : null}
    </section>
  );
}

export default IdentityConfirmation;
