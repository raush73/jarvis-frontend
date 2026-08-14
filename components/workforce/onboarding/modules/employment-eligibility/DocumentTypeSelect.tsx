"use client";

/**
 * Module 4.1 - choosing which document you are showing.
 *
 * EVERY option comes from the catalogue the SERVER published, and the words are the catalogue's
 * own prompt. This file contains no list of documents, no document name, and no opinion about
 * which document is better: a catalogue version that adds, removes or rewords an acceptable
 * document changes this screen without changing this file.
 *
 * Radios rather than a dropdown, deliberately. On a phone the whole list stays visible and each
 * option is a large target, and a worker comparing what is in his hand against what is on the
 * screen does not have to open a menu to see the choices.
 */

import type {
  EmploymentEligibilityCatalogueEntry,
  EmploymentEligibilityDocumentList,
} from "@/lib/workforce/employmentEligibilityApi";

type Props = {
  list: EmploymentEligibilityDocumentList;
  /** The catalogue entries for this list, exactly as the server published them. */
  options: readonly EmploymentEligibilityCatalogueEntry[];
  documentTypeKey: string;
  onSelect: (documentTypeKey: string) => void;
  legend: string;
  disabled?: boolean;
  error?: string | null;
};

export function DocumentTypeSelect({
  list,
  options,
  documentTypeKey,
  onSelect,
  legend,
  disabled = false,
  error = null,
}: Props) {
  const errorId = `ee-type-error-${list}`;

  return (
    <fieldset
      className="ee-fieldset"
      data-ee-type-choice={list}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="wf-label">{legend}</legend>

      {options.map((entry) => (
        <label className="ee-choice" key={entry.documentTypeKey}>
          <input
            type="radio"
            name={`ee-type-${list}`}
            value={entry.documentTypeKey}
            checked={documentTypeKey === entry.documentTypeKey}
            disabled={disabled}
            onChange={() => onSelect(entry.documentTypeKey)}
          />
          <span>{entry.prompt}</span>
        </label>
      ))}

      {options.length === 0 ? (
        <p className="wf-empty">There is nothing to choose from here just now.</p>
      ) : null}

      {error ? (
        <p className="wf-field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export default DocumentTypeSelect;
