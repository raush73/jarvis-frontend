"use client";

/**
 * Module 4.1, step three - how many documents you are showing us.
 *
 * The two choices are the two combinations the GOVERNED LISTS establish, and the screen counts
 * the options in each list from the catalogue the SERVER published rather than claiming a number
 * of its own. A worker with a passport shows one thing; a worker with a driver's licence shows
 * that plus something that says he may work.
 *
 * The wording deliberately stays out of government-form vocabulary. What matters to the worker is
 * how many documents he needs and what each one is for.
 */

import type { EmploymentEligibilityCatalogueEntry } from "@/lib/workforce/employmentEligibilityApi";
import type { EmploymentEligibilityPresentationPath } from "./employmentEligibilityDraftStore";

type Props = {
  catalogue: readonly EmploymentEligibilityCatalogueEntry[];
  path: "" | EmploymentEligibilityPresentationPath;
  onPath: (path: EmploymentEligibilityPresentationPath) => void;
  disabled?: boolean;
  error?: string | null;
};

/** The same words wherever a chosen path is shown back to the worker. */
export function pathLabel(path: "" | EmploymentEligibilityPresentationPath): string {
  if (path === "LIST_A") return "One document that covers both";
  if (path === "LIST_B_AND_C") return "Two documents";
  return "Not chosen yet";
}

const ERROR_ID = "ee-path-error";

export function PresentationPathChoice({
  catalogue,
  path,
  onPath,
  disabled = false,
  error = null,
}: Props) {
  const inList = (list: string): number =>
    catalogue.filter((entry) => entry.list === list).length;

  return (
    <fieldset className="ee-fieldset" aria-describedby={error ? ERROR_ID : undefined}>
      <legend className="wf-label">What are you going to show us?</legend>

      <label className="ee-choice ee-choice-block">
        <input
          type="radio"
          name="ee-path"
          value="LIST_A"
          checked={path === "LIST_A"}
          disabled={disabled}
          onChange={() => onPath("LIST_A")}
        />
        <span>
          <span className="ee-choice-title">One document that covers both</span>
          <span className="ee-choice-detail">
            A single document that proves who you are and that you may work. There{" "}
            {inList("LIST_A") === 1 ? "is" : "are"} {inList("LIST_A")} to choose from.
          </span>
        </span>
      </label>

      <label className="ee-choice ee-choice-block">
        <input
          type="radio"
          name="ee-path"
          value="LIST_B_AND_C"
          checked={path === "LIST_B_AND_C"}
          disabled={disabled}
          onChange={() => onPath("LIST_B_AND_C")}
        />
        <span>
          <span className="ee-choice-title">Two documents</span>
          <span className="ee-choice-detail">
            One that proves who you are, and one that proves you may work.
          </span>
        </span>
      </label>

      {error ? (
        <p className="wf-field-error" id={ERROR_ID} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export default PresentationPathChoice;
