"use client";

/**
 * Module 4.1 - the reviewer records his examination.
 *
 * THE ONE PLACE THE DETERMINATION IS MADE, and the worker has never seen anything like it. He
 * presented documents; whether each one satisfies the employer is this form's question and only
 * this form's. For a Social Security Account Number card that means the governed rule -
 * RESTRICTIVE_LEGEND_PROHIBITED - is shown here beside the card's own row, the reviewer opens the
 * actual captured image, and he answers. Nothing on this screen was asked of the worker, and nothing
 * on it is computed from the image.
 *
 * ONE SUBMISSION FOR THE WHOLE EXAMINATION, because the server records one examination covering
 * exactly the documents presented. A per-document submit would let a reviewer leave a document
 * unexamined and think he had finished.
 *
 * THE VERSION IS CARRIED THROUGH, unaltered, from the review the reviewer was shown. If the worker
 * saved a newer version while this was open, the server refuses on that mismatch and says so - which
 * is exactly the behaviour wanted: the reviewer looks again rather than recording a judgment about
 * documents that have been replaced.
 *
 * SERVER REFUSALS ARE FINAL. A refusal is surfaced as a refusal; nothing here converts one into an
 * apparent success or retries it.
 */

import { useMemo, useState } from "react";
import {
  recordEmploymentEligibilityExamination,
  type EmploymentEligibilityDocumentOutcome,
  type EmploymentEligibilityExaminationMethod,
  type EmploymentEligibilityStaffReview,
} from "@/lib/workforce/employmentEligibilityApi";
import { OnboardingAdminErrorNotice } from "@/components/workforce/admin/OnboardingAdminNotice";

/** Plain language for the governed method vocabulary. */
const METHOD_LABELS: Record<string, string> = {
  REMOTE_EXAMINATION_OF_UPLOADED_EVIDENCE:
    "Remotely, from the evidence the worker uploaded",
  IN_PERSON_EXAMINATION: "In person, with the documents in hand",
};

/** Plain language for the governed examination rules. */
const RULE_LABELS: Record<string, string> = {
  RESTRICTIVE_LEGEND_PROHIBITED:
    "Not acceptable if the card is printed with a restriction on working - check the card itself.",
};

export function EmploymentEligibilityExaminationForm({
  candidateId,
  review,
  onRecorded,
  children,
}: {
  candidateId: string;
  review: EmploymentEligibilityStaffReview;
  /** Reload the authoritative review. Nothing here updates state from what it just sent. */
  onRecorded: () => void;
  /** The per-document evidence affordance, rendered by the panel that owns retrieval. */
  children?: (documentRecordId: string) => React.ReactNode;
}) {
  const methods = review.examinationMethods;
  const [method, setMethod] = useState<EmploymentEligibilityExaminationMethod>(
    methods[0] ?? "REMOTE_EXAMINATION_OF_UPLOADED_EVIDENCE",
  );
  const [outcomes, setOutcomes] = useState<
    Record<string, EmploymentEligibilityDocumentOutcome>
  >({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const setVersion = review.setVersion;
  const catalogueVersion = review.catalogueVersion;

  /** Every presented document must carry a conclusion before this can be submitted. */
  const complete = useMemo(
    () =>
      review.documents.length > 0 &&
      review.documents.every(
        (document) => outcomes[document.documentRecordId] !== undefined,
      ),
    [review.documents, outcomes],
  );

  /** Nothing is examinable until every presented document has confirmed evidence. */
  const examinable = review.documents.every(
    (document) => document.evidenceConfirmed,
  );

  const submit = async () => {
    if (setVersion === null || catalogueVersion === null) return;
    setBusy(true);
    setError(null);
    try {
      await recordEmploymentEligibilityExamination(candidateId, {
        attestationSetVersion: setVersion,
        catalogueVersion,
        method,
        documentOutcomes: review.documents.map((document) => ({
          documentTypeKey: document.documentTypeKey,
          outcome: outcomes[document.documentRecordId],
        })),
      });
      setOutcomes({});
      onRecorded();
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  if (review.documents.length === 0) return null;

  return (
    <form
      className="oba-processing"
      data-ee-examination-form="true"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="oba-module-title">How you examined the documents</legend>
        {methods.map((option) => (
          <label className="oba-inline-field" key={option}>
            <input
              type="radio"
              name="ee-examination-method"
              value={option}
              checked={method === option}
              onChange={() => setMethod(option)}
            />
            <span>{METHOD_LABELS[option] ?? option}</span>
          </label>
        ))}
      </fieldset>

      {review.documents.map((document) => (
        <fieldset
          key={document.documentRecordId}
          data-ee-examine-document={document.documentTypeKey}
        >
          <legend className="oba-module-title">
            {document.prompt ?? document.documentTypeKey}
          </legend>
          <p className="oba-cell-detail">
            {document.list.replace("_", " ")} · issued by{" "}
            {document.issuingAuthority || "not recorded"}
            {document.expiresOn ? ` · expires ${document.expiresOn}` : ""}
          </p>

          {document.examinationRules.map((rule) => (
            <p
              className="oba-reveal-warning"
              key={rule}
              data-ee-examination-rule={rule}
            >
              {RULE_LABELS[rule] ?? rule}
            </p>
          ))}

          {children ? <p>{children(document.documentRecordId)}</p> : null}

          {document.evidenceConfirmed ? (
            <>
              {review.documentOutcomeVocabulary.map((outcome) => (
                <label className="oba-inline-field" key={outcome}>
                  <input
                    type="radio"
                    name={`ee-outcome-${document.documentRecordId}`}
                    value={outcome}
                    checked={outcomes[document.documentRecordId] === outcome}
                    onChange={() =>
                      setOutcomes((current) => ({
                        ...current,
                        [document.documentRecordId]: outcome,
                      }))
                    }
                  />
                  <span>
                    {outcome === "ACCEPTED"
                      ? "Acceptable"
                      : "Not acceptable"}
                  </span>
                </label>
              ))}
            </>
          ) : (
            <p className="oba-field-absent">
              There is no confirmed evidence for this document yet, so it cannot
              be examined.
            </p>
          )}
        </fieldset>
      ))}

      {error ? <OnboardingAdminErrorNotice error={error} /> : null}

      <div className="oba-processing-buttons">
        <button
          type="submit"
          className="oba-btn oba-btn-primary"
          disabled={busy || !complete || !examinable}
        >
          {busy ? "Recording…" : "Record this examination"}
        </button>
      </div>
    </form>
  );
}

export default EmploymentEligibilityExaminationForm;
