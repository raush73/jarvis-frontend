"use client";

/**
 * Module 4.1 - the authorized MW4H review panel.
 *
 * A PANEL inside the delivered Phase 2 workspace, registered under this module's key, exactly as
 * the workspace was designed for: no second administrative shell, no route of its own, and no
 * change to the workspace to accommodate it. The affirmative certification is taken through the
 * workspace's OWN processing controls, which render beside this panel - so this panel has no certify
 * button, and could not have one: the server derives that outcome from governed state rather than
 * accepting a result from a caller.
 *
 * WHAT IT SHOWS: who the worker said he is and what he attested, the documents he presented with
 * the governed rules that apply to each, whether each one's evidence is a confirmed capture, the
 * derived first-day-of-employment display, the SERVER'S list of what is blocking certification, and
 * the examination and certification history behind all of it.
 *
 * IT DECIDES NOTHING. Certification readiness is the server's, rendered here; a panel that computed
 * its own would eventually offer a certification the server refuses.
 *
 * MASKED BY DEFAULT. A protected document identifier appears as its last four characters. The whole
 * value reaches this screen only through a deliberate, purpose-stated, separately-granted and
 * server-audited disclosure, and it lives in component state for as long as the reviewer looks at
 * it - never in storage, never in a URL, and never in anything this panel keeps.
 *
 * IT RENDERS NOTHING WITHOUT THE GRANT, and asks for nothing either. An absent panel invites no
 * request the server will refuse, and a disabled one would still disclose that this worker has a
 * record to look at.
 */

import {
  getStaffEmploymentEligibility,
  revealEmploymentEligibilityIdentifier,
} from "@/lib/workforce/employmentEligibilityApi";
import type { EmploymentEligibilityStaffReview } from "@/lib/workforce/employmentEligibilityApi";
import type { OnboardingAdminPanelProps } from "@/components/workforce/admin/adminPanelRegistry";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminPermissions } from "@/components/workforce/admin/adminPermissions";
import { useOnboardingAdminResource } from "@/components/workforce/admin/useOnboardingAdminResource";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "@/components/workforce/admin/OnboardingAdminNotice";
import {
  OnboardingAdminField,
  OnboardingAdminFieldList,
  OnboardingAdminPanel,
  OnboardingAdminTimestamp,
} from "@/components/workforce/admin/panels/DetailPanel";
import { OnboardingAdminMaskedValue } from "@/components/workforce/admin/panels/MaskedValue";
import { EmploymentEligibilityArtifact } from "./EmploymentEligibilityArtifact";
import { EmploymentEligibilityEvidence } from "./EmploymentEligibilityEvidence";
import { EmploymentEligibilityExaminationForm } from "./EmploymentEligibilityExaminationForm";

/**
 * The module's own grants, checked so a control can decide whether to RENDER.
 *
 * The reveal grant is read from EFFECTIVE grants rather than through the role-aware helper, exactly
 * as the delivered sensitive control does: `SensitiveDataGuard` treats no role as a bypass, so an
 * administrator who lacks the grant must not be offered a disclosure the server will refuse.
 */
const EXAMINE = "workforce.onboarding.employment-eligibility.examine";
const IDENTIFIER_REVEAL =
  "workforce.onboarding.employment-eligibility.identifier.reveal";

/** Plain language for what the server says is blocking certification. */
const BLOCK_LABELS: Record<string, string> = {
  WORKER_PHASE_OUTSTANDING: "The worker has not recorded his information yet.",
  WORKER_ATTESTATION_OUTSTANDING:
    "The worker has not signed his attestation for the record now on file.",
  CANONICAL_IDENTITY_INCOMPLETE:
    "His identity record is missing something certification depends on.",
  IDENTITY_NOT_CONFIRMED_BY_WORKER:
    "He did not confirm that the identity we showed him is his.",
  EXAMINATION_OUTSTANDING: "Nobody has examined the documents yet.",
  EXAMINATION_STALE:
    "The examination on file was of an earlier version of his record. Examine the current one.",
  EXAMINATION_CATALOGUE_DRIFTED:
    "The examination on file was made under a different document catalogue version.",
  EXAMINATION_COVERAGE_INCOMPLETE:
    "A presented document has no conclusion recorded against it.",
  DOCUMENT_EXAMINATION_REJECTED:
    "A presented document was found not acceptable. The worker needs to replace it.",
  EVIDENCE_NOT_CONFIRMED:
    "A presented document has no confirmed upload, so there is nothing to examine.",
  CERTIFICATION_ALREADY_RECORDED:
    "This version has already been certified.",
};

const STATUS_LABELS: Record<string, string> = {
  US_CITIZEN: "A citizen of the United States",
  NONCITIZEN_NATIONAL: "A noncitizen national of the United States",
  LAWFUL_PERMANENT_RESIDENT: "A lawful permanent resident",
  AUTHORIZED_TO_WORK: "Authorized to work until a stated date",
};

const OUTCOME_LABELS: Record<string, string> = {
  ACCEPTED: "Acceptable",
  REJECTED: "Not acceptable",
};

export function EmploymentEligibilityReviewPanel({
  worker,
}: OnboardingAdminPanelProps) {
  const session = useSession();
  const { canReadDocuments } = useOnboardingAdminPermissions(session);
  const canExamine = session.hasPermission(EXAMINE);
  // EFFECTIVE grants only. No role is a bypass here, exactly as the server's guard is not bypassed.
  const canRevealIdentifier = session.permissions.includes(IDENTIFIER_REVEAL);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getStaffEmploymentEligibility(worker.candidateId),
    [worker.candidateId],
    { enabled: canExamine },
  );

  if (!canExamine) return null;

  return (
    <OnboardingAdminPanel
      title="Employment eligibility"
      description="What this worker told us about his permission to work, the documents he presented, and where the employer review stands. Recording an examination here does not certify: certification is the processing action below."
    >
      {loading ? (
        <OnboardingAdminLoading label="Loading employment eligibility" />
      ) : null}
      {error ? (
        <OnboardingAdminErrorNotice error={error} onRetry={reload} />
      ) : null}

      {data && data.setVersion === null ? (
        <OnboardingAdminEmpty
          title="This worker has recorded nothing yet."
          detail="There is nothing to examine until he has completed his part."
        />
      ) : null}

      {data && data.setVersion !== null ? (
        <ReviewBody
          review={data}
          candidateId={worker.candidateId}
          canReadDocuments={canReadDocuments}
          canRevealIdentifier={canRevealIdentifier}
          onChanged={reload}
        />
      ) : null}
    </OnboardingAdminPanel>
  );
}

function ReviewBody({
  review,
  candidateId,
  canReadDocuments,
  canRevealIdentifier,
  onChanged,
}: {
  review: EmploymentEligibilityStaffReview;
  candidateId: string;
  canReadDocuments: boolean;
  canRevealIdentifier: boolean;
  onChanged: () => void;
}) {
  return (
    <>
      <p className="oba-cell-detail" data-ee-set-version={review.setVersion}>
        Version {review.setVersion} · effective{" "}
        <OnboardingAdminTimestamp value={review.effectiveFrom} /> · catalogue{" "}
        {review.catalogueVersion}
        {review.catalogueVersion !== review.currentCatalogueVersion
          ? ` (current catalogue is ${review.currentCatalogueVersion})`
          : ""}
      </p>

      <OnboardingAdminFieldList>
        <OnboardingAdminField
          label="What he told us"
          value={
            review.status
              ? (STATUS_LABELS[review.status] ?? review.status)
              : null
          }
          hint={
            review.workAuthorizationExpiresOn
              ? `Authorized until ${review.workAuthorizationExpiresOn}`
              : undefined
          }
        />
        <OnboardingAdminField
          label="He confirmed his identity"
          value={review.identityConfirmedByWorker ? "Yes" : "No"}
        />
        <OnboardingAdminField
          label="His signature"
          value={
            review.workerAttestationOutstanding
              ? "Not signed for the record now on file"
              : "Signed"
          }
        />
        <OnboardingAdminField
          label="First day of employment"
          value={
            review.timeliness.state === "ESTABLISHED"
              ? review.timeliness.firstDayOfEmployment
              : null
          }
          hint={
            review.timeliness.state === "ESTABLISHED" &&
            review.timeliness.daysSinceFirstDay !== null
              ? `${review.timeliness.daysSinceFirstDay} day(s) since his first day`
              : "Not yet established - he has no dispatched assignment yet"
          }
        />
      </OnboardingAdminFieldList>

      <table className="oba-table" data-ee-documents="true">
        <caption className="oba-cell-detail">
          What he presented. Open each one and examine it.
        </caption>
        <thead>
          <tr>
            <th scope="col">Document</th>
            <th scope="col">Details</th>
            <th scope="col">Number</th>
            <th scope="col">Evidence</th>
            <th scope="col">Examination</th>
          </tr>
        </thead>
        <tbody>
          {review.documents.map((document) => (
            <tr
              key={document.documentRecordId}
              data-ee-document={document.documentTypeKey}
            >
              <td>
                <span className="oba-module-title">
                  {document.prompt ?? document.documentTypeKey}
                </span>
                <span className="oba-cell-detail">
                  {document.list.replace("_", " ")}
                </span>
              </td>
              <td>
                <span>{document.issuingAuthority || "-"}</span>
                {document.expiresOn ? (
                  <span className="oba-cell-detail">
                    Expires {document.expiresOn}
                  </span>
                ) : null}
                {document.examinationRules.map((rule) => (
                  <span
                    className="oba-cell-detail"
                    key={rule}
                    data-ee-rule={rule}
                  >
                    {rule === "RESTRICTIVE_LEGEND_PROHIBITED"
                      ? "Check for a restriction on working"
                      : rule}
                  </span>
                ))}
              </td>
              <td>
                {document.hasProtectedIdentifier ? (
                  <OnboardingAdminMaskedValue
                    label="Document number"
                    maskedValue={
                      document.identifierLast4
                        ? `•••• ${document.identifierLast4}`
                        : null
                    }
                    hasValue={true}
                    canReveal={canRevealIdentifier}
                    revealLabel="Reveal number"
                    onReveal={async (purpose) => {
                      const revealed =
                        await revealEmploymentEligibilityIdentifier(
                          candidateId,
                          document.documentRecordId,
                          purpose,
                        );
                      return revealed.identifier;
                    }}
                  />
                ) : (
                  <span className="oba-field-absent">Not captured</span>
                )}
              </td>
              <td>
                <EmploymentEligibilityEvidence
                  document={document}
                  canReadDocuments={canReadDocuments}
                />
              </td>
              <td>
                {document.examinationOutcome ? (
                  <span
                    className={
                      document.examinationOutcome === "ACCEPTED"
                        ? "oba-badge oba-badge-executed"
                        : "oba-badge oba-badge-refused"
                    }
                  >
                    {OUTCOME_LABELS[document.examinationOutcome]}
                  </span>
                ) : (
                  <span className="oba-badge oba-badge-pending">
                    Not examined
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {review.certifiable ? (
        <p className="oba-notice oba-notice-empty" data-ee-certifiable="true">
          <span className="oba-notice-title">
            Everything required is in order.
          </span>
          <span className="oba-notice-detail">
            Certify using the processing action below.
          </span>
        </p>
      ) : (
        <div
          className="oba-notice oba-notice-error"
          role="alert"
          data-ee-blocks="true"
        >
          <p className="oba-notice-title">
            Certification is not available yet.
          </p>
          <ul>
            {review.certificationBlocks.map((block) => (
              <li className="oba-notice-detail" key={block} data-ee-block={block}>
                {BLOCK_LABELS[block] ?? block}
              </li>
            ))}
          </ul>
        </div>
      )}

      <EmploymentEligibilityExaminationForm
        candidateId={candidateId}
        review={review}
        onRecorded={onChanged}
      >
        {(documentRecordId) => {
          const document = review.documents.find(
            (row) => row.documentRecordId === documentRecordId,
          );
          return document ? (
            <EmploymentEligibilityEvidence
              document={document}
              canReadDocuments={canReadDocuments}
            />
          ) : null;
        }}
      </EmploymentEligibilityExaminationForm>

      {review.examination ? (
        <p className="oba-cell-detail" data-ee-examination="current">
          Examined{" "}
          <OnboardingAdminTimestamp value={review.examination.examinedAt} /> ·
          version {review.examination.attestationSetVersion} · method{" "}
          {review.examination.method}
        </p>
      ) : null}

      {review.examinationHistory.length > 1 ? (
        <p className="oba-cell-detail" data-ee-examination-history="true">
          {review.examinationHistory.length} examinations recorded. Earlier ones
          are kept as evidence of what was concluded then.
        </p>
      ) : null}

      {review.certification ? (
        <p className="oba-cell-detail" data-ee-certification="current">
          Certified{" "}
          <OnboardingAdminTimestamp value={review.certification.certifiedAt} />{" "}
          · version {review.certification.attestationSetVersion}
          {review.certification.firstDayOfEmployment
            ? ` · first day ${review.certification.firstDayOfEmployment}`
            : ""}
          {review.certification.correctionReason ? (
            <>
              {" · corrected: "}
              <span data-ee-certification-correction="true">
                {review.certification.correctionReason}
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      {/*
        The completed record itself, for the administrative processing this module exists to feed.
        It OPENS the artifact through the delivered audited retrieval and does nothing else: it does
        not generate one, does not bundle one, does not export one, and does not transmit one.
      */}
      {review.certification ? (
        <EmploymentEligibilityArtifact
          certification={review.certification}
          canReadDocuments={canReadDocuments}
        />
      ) : null}
    </>
  );
}

export default EmploymentEligibilityReviewPanel;
