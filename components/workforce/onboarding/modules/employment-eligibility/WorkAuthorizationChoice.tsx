"use client";

/**
 * Module 4.1, step two - your permission to work.
 *
 * The four choices are the module's GOVERNED categories, presented in plain language rather than
 * in government-form vocabulary. The vocabulary itself is the server's and is imported rather
 * than retyped, so a category cannot exist on this screen that the server would refuse.
 *
 * THE END DATE. Exactly one category carries a date on which permission runs out, and the field
 * for it appears only for that category - because for the others the server REFUSES a date rather
 * than ignoring it, and offering an input that cannot be saved would invite a worker to fill it in.
 *
 * Capturing that date is data capture and nothing more. Nothing in this module or on this screen
 * reminds, chases, schedules or expires anything on the strength of it.
 */

import {
  EMPLOYMENT_ELIGIBILITY_STATUSES,
  EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE,
  type EmploymentEligibilityStatus,
} from "@/lib/workforce/employmentEligibilityApi";

type Props = {
  status: "" | EmploymentEligibilityStatus;
  endDate: string;
  onStatus: (status: EmploymentEligibilityStatus) => void;
  onEndDate: (value: string) => void;
  disabled?: boolean;
  recorded?: boolean;
  /** Shown once the worker has tried to save without choosing. */
  error?: string | null;
  /** Shown beside the date when the chosen category requires one and none is stated. */
  endDateError?: string | null;
};

/** Plain language for each governed category. Never a code, never a form line number. */
const STATUS_LABELS: Record<EmploymentEligibilityStatus, string> = {
  US_CITIZEN: "I am a citizen of the United States.",
  NONCITIZEN_NATIONAL: "I am a noncitizen national of the United States.",
  LAWFUL_PERMANENT_RESIDENT: "I am a lawful permanent resident of the United States.",
  AUTHORIZED_TO_WORK:
    "I am allowed to work in the United States until a date that is set for me.",
};

/** The same words wherever a recorded category is shown back to the worker. */
export function statusLabel(status: EmploymentEligibilityStatus | null): string {
  return status ? STATUS_LABELS[status] : "Not answered yet";
}

const ERROR_ID = "ee-status-error";
const END_DATE_ERROR_ID = "ee-end-date-error";
const END_DATE_HINT_ID = "ee-end-date-hint";

export function WorkAuthorizationChoice({
  status,
  endDate,
  onStatus,
  onEndDate,
  disabled = false,
  recorded = false,
  error = null,
  endDateError = null,
}: Props) {
  const carriesEndDate =
    status !== "" &&
    EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE.includes(status);

  return (
    <section className="ee-step" data-ee-step="work-authorization">
      <p className="ee-intro">
        Tell us which of these describes you. Choose the one that is true for you now.
      </p>

      <fieldset className="ee-fieldset" aria-describedby={error ? ERROR_ID : undefined}>
        <legend className="wf-label">Your permission to work in the United States</legend>

        {EMPLOYMENT_ELIGIBILITY_STATUSES.map((choice) => (
          <label className="ee-choice" key={choice}>
            <input
              type="radio"
              name="ee-status"
              value={choice}
              checked={status === choice}
              disabled={disabled}
              onChange={() => onStatus(choice)}
            />
            <span>{STATUS_LABELS[choice]}</span>
          </label>
        ))}

        {error ? (
          <p className="wf-field-error" id={ERROR_ID} role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>

      {carriesEndDate ? (
        <div className="ee-field" data-ee-end-date>
          <label className="wf-label" htmlFor="ee-end-date">
            The date your permission to work runs out
          </label>
          <input
            className="wf-input"
            id="ee-end-date"
            type="date"
            value={endDate}
            disabled={disabled}
            onChange={(event) => onEndDate(event.target.value)}
            aria-describedby={
              endDateError ? `${END_DATE_ERROR_ID} ${END_DATE_HINT_ID}` : END_DATE_HINT_ID
            }
          />
          <p className="wf-hint" id={END_DATE_HINT_ID}>
            Use the date shown on your document. We keep it with your answers; we do not chase
            you about it.
          </p>
          {endDateError ? (
            <p className="wf-field-error" id={END_DATE_ERROR_ID} role="alert">
              {endDateError}
            </p>
          ) : null}
        </div>
      ) : null}

      {recorded ? (
        <p className="ee-note" data-ee-status-recorded>
          This is the answer we have on file for you. You can change it, and if you do we will
          ask you for your documents again before we save it.
        </p>
      ) : null}
    </section>
  );
}

export default WorkAuthorizationChoice;
