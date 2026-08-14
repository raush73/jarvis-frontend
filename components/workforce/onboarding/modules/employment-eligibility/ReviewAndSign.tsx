"use client";

/**
 * Module 4.1 - what we have, and your signature on it.
 *
 * TWO THINGS, IN THIS ORDER, and the order is the point: the worker reads back what is ON HIS
 * RECORD, and only then is he asked to sign a statement about it. The read-back is built from the
 * authoritative read rather than from what this screen believes it just sent, so what he signs is
 * what the server holds.
 *
 * WHAT THE READ-BACK MAY SAY. His own answers, his own document choices, and the MASKED tail of
 * any protected identifier - never the identifier itself, which no read returns. There is no
 * Social Security Number here in any form. There is also no examination result and no
 * certification result: whether what he presented satisfies the employer is an authorized MW4H
 * conclusion recorded elsewhere, and a worker's review must not appear to answer it.
 *
 * THE SIGNATURE IS NOT BUILT HERE. It is the DELIVERED execution surface, handed the one subject
 * the server declared for this module, and every part of the act is the server's: the wording, the
 * version it is in force at, its hash, the rule revision, and which act it requires. This file
 * authors no statement, edits none, chooses no act, and computes nothing that travels with the
 * submission. What the worker signs and what the server verifies are therefore the same thing by
 * construction, not by agreement.
 */

import type {
  EmploymentEligibilityCatalogueEntry,
  EmploymentEligibilityRecord,
} from "@/lib/workforce/employmentEligibilityApi";
import type { OnboardingExecutionSubject } from "@/lib/workforce/onboardingExecutionApi";
import ExecutionSubjectCard from "@/components/workforce/onboarding/execution/ExecutionSubjectCard";
import type { ExecutionAct } from "@/components/workforce/onboarding/execution/ExecutionFormControl";
import type { ExecutionRefusal } from "@/components/workforce/onboarding/execution/useExecutionSubmission";
import { statusLabel } from "./WorkAuthorizationChoice";

/* -------------------------------------------------------------------------- */
/*  The read-back                                                              */
/* -------------------------------------------------------------------------- */

type ReviewProps = {
  record: EmploymentEligibilityRecord;
  /** The catalogue the server published, for saying each document in its own words. */
  catalogue: readonly EmploymentEligibilityCatalogueEntry[];
};

export function EmploymentEligibilityReview({ record, catalogue }: ReviewProps) {
  const promptFor = (documentTypeKey: string): string =>
    catalogue.find((entry) => entry.documentTypeKey === documentTypeKey)?.prompt ??
    "A document you gave us earlier";

  return (
    <section className="ee-review" aria-labelledby="ee-review-heading">
      <h3 className="wf-section-title" id="ee-review-heading">
        What we have from you
      </h3>

      <dl className="ee-review-list">
        <div className="ee-review-row">
          <dt>Is this you?</dt>
          <dd data-ee-review="identity">
            {record.identityConfirmed
              ? "Yes, you told us this is you."
              : "You told us something is not correct, and MW4H will review it with you."}
          </dd>
        </div>

        <div className="ee-review-row">
          <dt>Your permission to work</dt>
          <dd data-ee-review="status">{statusLabel(record.status)}</dd>
        </div>

        {record.workAuthorizationExpiresOn ? (
          <div className="ee-review-row">
            <dt>Runs out on</dt>
            <dd data-ee-review="end-date">{record.workAuthorizationExpiresOn}</dd>
          </div>
        ) : null}
      </dl>

      <ul className="ee-review-documents">
        {record.documents.map((document) => (
          <li
            className="wf-card ee-review-document"
            key={document.documentTypeKey}
            data-ee-review-document={document.documentTypeKey}
          >
            <p className="ee-review-document-title">
              {promptFor(document.documentTypeKey)}
            </p>
            {document.issuingAuthority ? (
              <p className="ee-review-meta">Issued by {document.issuingAuthority}</p>
            ) : null}
            {document.expiresOn ? (
              <p className="ee-review-meta">Runs out on {document.expiresOn}</p>
            ) : null}
            {/*
              THE MASKED TAIL AND NOTHING MORE. The number itself is sealed at rest and is
              returned by no read, so there is nothing here that could show it even if this
              screen asked.
            */}
            {document.identifierLast4 ? (
              <p className="ee-review-meta" data-ee-review-identifier>
                Number ending {document.identifierLast4}. We only ever show you the last four
                characters.
              </p>
            ) : null}
            <p className="ee-review-meta" data-ee-review-evidence={document.evidenceCaptured}>
              {document.evidenceCaptured
                ? "We have your picture of this document."
                : "We still need a picture of this document."}
            </p>
          </li>
        ))}
      </ul>

      {record.documents.length === 0 ? (
        <p className="wf-empty">You have not told us which documents you are showing us yet.</p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  The signature                                                              */
/* -------------------------------------------------------------------------- */

type Props = ReviewProps & {
  /** The subject the SERVER declared for this module, or null while it is unknown. */
  subject: OnboardingExecutionSubject | null;
  submitting: boolean;
  refusal: ExecutionRefusal | null;
  onSubmit: (
    subject: OnboardingExecutionSubject,
    act: ExecutionAct,
  ) => Promise<boolean>;
};

export function ReviewAndSign({
  record,
  catalogue,
  subject,
  submitting,
  refusal,
  onSubmit,
}: Props) {
  return (
    <div className="ee-review-and-sign">
      <EmploymentEligibilityReview record={record} catalogue={catalogue} />

      {subject ? (
        <section className="ob-exec-section" aria-labelledby="ee-sign-heading">
          <h3 className="wf-section-title" id="ee-sign-heading">
            Read this and sign it
          </h3>
          <p className="ee-intro">
            This is the last thing we need from you. Read it, then sign with your finger or your
            mouse.
          </p>
          <ul className="ob-exec-list">
            <ExecutionSubjectCard
              subject={subject}
              submitting={submitting}
              refusal={refusal}
              changeable
              onSubmit={onSubmit}
            />
          </ul>
        </section>
      ) : (
        <p className="wf-empty" data-ee-sign-unavailable>
          We cannot show you what to sign just now. Please try again in a moment.
        </p>
      )}
    </div>
  );
}

export default ReviewAndSign;
