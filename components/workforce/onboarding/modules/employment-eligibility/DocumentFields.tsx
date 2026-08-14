"use client";

/**
 * Module 4.1 - what we ask about the document you chose.
 *
 * THE CATALOGUE DECIDES WHAT APPEARS HERE. Each field is rendered because the selected catalogue
 * entry says it CAPTURES that fact, and it is marked required because the entry says it REQUIRES
 * it. Nothing is asked because a form once asked it, and nothing is asked "just in case": a field
 * the entry does not capture is REFUSED by the server if sent, so rendering one would invite a
 * worker to fill in something that cannot be saved.
 *
 * THAT IS THE WHOLE MECHANISM BEHIND ONE IMPORTANT CASE. The acceptable document whose printed
 * number is a Social Security Number captures no document number, so no number input appears for
 * it - not because this file knows which document that is, but because the entry says what it
 * captures and this file renders exactly that.
 *
 * AND WHAT IS NEVER ASKED, of any document. The worker is not asked whether his document is
 * acceptable, whether it is restricted, whether it bears any legend, or whether it satisfies
 * anything. Reading the document and reaching that conclusion is MW4H's, performed by an
 * authorized person looking at the document itself. There is no control on this screen through
 * which a worker could answer it, and no field in the module's record for the answer to land in.
 *
 * A CONTROLLED component holding nothing. Every value comes down and every change goes back up.
 */

import type {
  EmploymentEligibilityCatalogueEntry,
  EmploymentEligibilityDocumentField,
} from "@/lib/workforce/employmentEligibilityApi";
import type { EmploymentEligibilityDocumentDraft } from "./employmentEligibilityDraftStore";

type Props = {
  entry: EmploymentEligibilityCatalogueEntry;
  document: EmploymentEligibilityDocumentDraft;
  onChange: (
    field: EmploymentEligibilityDocumentField,
    value: string,
  ) => void;
  disabled?: boolean;
  /** Per-field messages, keyed by the governed field they belong to. */
  errors?: Partial<Record<EmploymentEligibilityDocumentField, string>>;
};

export function DocumentFields({
  entry,
  document,
  onChange,
  disabled = false,
  errors = {},
}: Props) {
  const captures = (field: EmploymentEligibilityDocumentField): boolean =>
    entry.captures.includes(field);
  const requires = (field: EmploymentEligibilityDocumentField): boolean =>
    entry.requires.includes(field);

  const id = (field: string): string => `ee-${entry.documentTypeKey}-${field}`;
  const describedBy = (field: EmploymentEligibilityDocumentField): string | undefined => {
    const parts = [`${id(field)}-hint`];
    if (errors[field]) parts.push(`${id(field)}-error`);
    return parts.join(" ");
  };

  return (
    <div className="ee-fields" data-ee-fields={entry.documentTypeKey}>
      {captures("documentNumber") ? (
        <div className="ee-field">
          <label className="wf-label" htmlFor={id("documentNumber")}>
            The number printed on it
            {requires("documentNumber") ? null : (
              <span className="ee-optional"> (only if it has one)</span>
            )}
          </label>
          <input
            className="wf-input"
            id={id("documentNumber")}
            type="text"
            autoComplete="off"
            value={document.documentNumber}
            disabled={disabled}
            onChange={(event) => onChange("documentNumber", event.target.value)}
            aria-describedby={describedBy("documentNumber")}
          />
          <p className="wf-hint" id={`${id("documentNumber")}-hint`}>
            We keep this securely. When we show it back to you, you will see only the last four
            characters.
          </p>
          {errors.documentNumber ? (
            <p
              className="wf-field-error"
              id={`${id("documentNumber")}-error`}
              role="alert"
            >
              {errors.documentNumber}
            </p>
          ) : null}
        </div>
      ) : null}

      {captures("issuingAuthority") ? (
        <div className="ee-field">
          <label className="wf-label" htmlFor={id("issuingAuthority")}>
            Who issued it?
            {requires("issuingAuthority") ? null : (
              <span className="ee-optional"> (if you know)</span>
            )}
          </label>
          <input
            className="wf-input"
            id={id("issuingAuthority")}
            type="text"
            value={document.issuingAuthority}
            disabled={disabled}
            onChange={(event) => onChange("issuingAuthority", event.target.value)}
            aria-describedby={describedBy("issuingAuthority")}
          />
          {/* The prompt is the CATALOGUE's, so what the worker is told this means for his
              document changes with the catalogue and not with this file. */}
          <p className="wf-hint" id={`${id("issuingAuthority")}-hint`}>
            {entry.issuingAuthorityPrompt}
          </p>
          {errors.issuingAuthority ? (
            <p
              className="wf-field-error"
              id={`${id("issuingAuthority")}-error`}
              role="alert"
            >
              {errors.issuingAuthority}
            </p>
          ) : null}
        </div>
      ) : null}

      {captures("expiresOn") ? (
        <div className="ee-field">
          <label className="wf-label" htmlFor={id("expiresOn")}>
            The date it runs out
            {requires("expiresOn") ? null : (
              <span className="ee-optional"> (if it shows one)</span>
            )}
          </label>
          <input
            className="wf-input"
            id={id("expiresOn")}
            type="date"
            value={document.expiresOn}
            disabled={disabled}
            onChange={(event) => onChange("expiresOn", event.target.value)}
            aria-describedby={describedBy("expiresOn")}
          />
          <p className="wf-hint" id={`${id("expiresOn")}-hint`}>
            Copy the date from the document.
          </p>
          {errors.expiresOn ? (
            <p className="wf-field-error" id={`${id("expiresOn")}-error`} role="alert">
              {errors.expiresOn}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default DocumentFields;
