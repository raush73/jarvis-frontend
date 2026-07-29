"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import { stepPath } from "@/components/workforce/wizardSteps";
import { CATALOG_UNAVAILABLE_LABEL } from "@/components/catalog/catalogContract";
import {
  type FinalReviewView,
  WorkforceApiError,
  getReview,
  submitApplication,
} from "@/lib/workforce/workforceApi";

/** One label/value pair, rendered only when there is something to show. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="wf-dt">{label}</dt>
      <dd className="wf-dd">{value?.trim() ? value : "Not provided"}</dd>
    </>
  );
}

function Group({
  title,
  editSlug,
  children,
}: {
  title: string;
  editSlug?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="wf-review-group">
      <div className="wf-review-head">
        <h2 className="wf-review-title">{title}</h2>
        {editSlug ? (
          <button
            type="button"
            className="wf-review-edit"
            onClick={() => router.push(stepPath(editSlug))}
          >
            Edit
          </button>
        ) : null}
      </div>
      <div className="wf-review-body">{children}</div>
    </div>
  );
}

/**
 * What a tag needs to render. Satisfied by catalog selections and by specializations, which are a
 * governed hierarchy under a Trade rather than a catalog and so carry no category.
 */
type TagSelection = { id: string; name: string | null; unavailable: boolean };

/**
 * Selected catalog entries.
 *
 * C4E §11.2: an entry that no longer resolves is retained and rendered with the single
 * platform-wide label, never dropped and never as a raw identifier. This screen previously used
 * its own wording, which is one of the divergent behaviors the contract retires.
 */
function Tags({ selections }: { selections: readonly TagSelection[] }) {
  if (selections.length === 0)
    return <p className="wf-entry-meta">None selected</p>;
  return (
    <ul className="wf-tags">
      {selections.map((selection) => (
        <li key={selection.id} className="wf-tag">
          {selection.unavailable
            ? selection.name
              ? `${selection.name} — ${CATALOG_UNAVAILABLE_LABEL}`
              : CATALOG_UNAVAILABLE_LABEL
            : selection.name}
        </li>
      ))}
    </ul>
  );
}

/**
 * Application Review and Submit.
 *
 * The review is the backend's own read-only composition of every stage view, so the
 * worker sees exactly what will be submitted. Submission reuses the existing Workforce
 * Application Submission service: it creates the immutable submitted application and
 * returns the receipt. There is no second submission path, and the call is idempotent,
 * so a duplicate click returns the original receipt rather than a second application.
 */
export default function ReviewPage() {
  const router = useRouter();
  const [review, setReview] = useState<FinalReviewView | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageError, setStageError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const value = await getReview();
        if (cancelled) return;
        if (value.status === "SUBMITTED") {
          router.replace("/workforce/apply/receipt");
          return;
        }
        setReview(value);
      } catch (err) {
        if (!cancelled) setStageError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const submit = useCallback(async () => {
    const receipt = await submitApplication();
    if (!receipt.submitted) {
      throw new WorkforceApiError(
        "Your application was not submitted. Please try again.",
        400,
      );
    }
    router.push("/workforce/apply/receipt");
  }, [router]);

  const identity = review?.identity;
  const legal = review?.legal;

  return (
    <WorkforceWizardShell
      slug="review"
      loading={loading}
      stageError={stageError}
      onSave={submit}
      continueLabel="Submit application"
      intro="Review your answers before submitting. Once submitted, your application cannot be changed."
    >
      {review && !review.readyToSubmit ? (
        <div className="wf-error" role="alert">
          <p className="wf-error-title">
            Some required information is still missing.
          </p>
          <ul className="wf-error-list">
            {review.incompleteStages.map((s) => (
              <li key={s.stage}>{s.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {review ? (
        <>
          <Group title="Identity" editSlug="identity">
            <dl className="wf-dl">
              <Row
                label="Name"
                value={[
                  identity?.firstName,
                  identity?.middleName,
                  identity?.lastName,
                  identity?.suffix,
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              <Row label="Date of birth" value={identity?.dateOfBirth ?? null} />
              <Row
                label="Social Security number"
                value={identity?.ssnMasked ?? null}
              />
            </dl>
          </Group>

          <Group title="Contact Information" editSlug="contact">
            <dl className="wf-dl">
              <Row label="Email" value={identity?.email ?? null} />
              <Row label="Phone" value={identity?.phone ?? null} />
              <Row
                label="Address"
                value={[
                  identity?.address1,
                  identity?.address2,
                  [identity?.city, identity?.state].filter(Boolean).join(", "),
                  identity?.zip,
                ]
                  .filter((p) => p && String(p).trim())
                  .join(" ")}
              />
            </dl>
          </Group>

          <Group title="Trade" editSlug="trade">
            <dl className="wf-dl">
              <Row
                label="Primary trade"
                value={
                  review.primaryTrade.primaryTradeUnavailable
                    ? review.primaryTrade.primaryTradeName
                      ? `${review.primaryTrade.primaryTradeName} — ${CATALOG_UNAVAILABLE_LABEL}`
                      : CATALOG_UNAVAILABLE_LABEL
                    : review.primaryTrade.primaryTradeName
                }
              />
              {/* Omitted entirely rather than shown empty: a trade whose taxonomy defines no
                  specializations was never asked the question, so there is no answer to report. */}
              {review.primaryTrade.specializations.length > 0 ? (
                <>
                  <dt className="wf-dt">Specializations</dt>
                  <dd className="wf-dd">
                    <Tags selections={review.primaryTrade.specializations} />
                  </dd>
                </>
              ) : null}
              {review.primaryTrade.skillSets.length > 0 ? (
                <>
                  <dt className="wf-dt">Skill sets</dt>
                  <dd className="wf-dd">
                    <Tags selections={review.primaryTrade.skillSets} />
                  </dd>
                </>
              ) : null}
            </dl>
          </Group>

          <Group title="Work History" editSlug="work-history">
            {review.workHistory.hasPreviousEmployment === false ? (
              <p className="wf-entry-meta">No previous employment reported.</p>
            ) : review.workHistory.entries.length === 0 ? (
              <p className="wf-entry-meta">No jobs added.</p>
            ) : (
              review.workHistory.entries.map((entry) => (
                <div key={entry.id} className="wf-entry">
                  <h3 className="wf-entry-title">
                    {entry.jobTitle} &middot; {entry.employerName}
                  </h3>
                  <p className="wf-entry-meta">
                    {entry.currentlyEmployed
                      ? `${entry.startDate} to present`
                      : `${entry.startDate} to ${entry.endDate ?? "unknown"}`}{" "}
                    &middot; {entry.city}, {entry.state}
                  </p>
                </div>
              ))
            )}
          </Group>

          <Group title="Certifications" editSlug="certifications">
            {review.certifications.hasCertifications === false ? (
              <p className="wf-entry-meta">No certifications reported.</p>
            ) : (
              <Tags selections={review.certifications.selections} />
            )}
          </Group>

          <Group title="Tools" editSlug="tools">
            {review.toolsPpe.hasTools === false ? (
              <p className="wf-entry-meta">No tools reported.</p>
            ) : (
              <Tags selections={review.toolsPpe.tools} />
            )}
          </Group>

          <Group title="Personal Protective Equipment" editSlug="ppe">
            {review.toolsPpe.hasPpe === false ? (
              <p className="wf-entry-meta">No equipment reported.</p>
            ) : (
              <Tags selections={review.toolsPpe.ppe} />
            )}
          </Group>

          <Group title="Military Service" editSlug="military">
            {legal?.military.hasMilitaryService ? (
              <dl className="wf-dl">
                <Row label="Branch" value={legal.military.branchLabel} />
                <Row
                  label="Component"
                  value={legal.military.serviceComponentLabel}
                />
                <Row
                  label="Service dates"
                  value={
                    legal.military.serviceStartDate ||
                    legal.military.serviceEndDate
                      ? `${legal.military.serviceStartDate ?? "unknown"} to ${
                          legal.military.serviceEndDate ?? "present"
                        }`
                      : null
                  }
                />
                <Row
                  label="Specialty"
                  value={legal.military.occupationalSpecialty}
                />
              </dl>
            ) : legal?.military.hasMilitaryService === false ? (
              <p className="wf-entry-meta">No military service reported.</p>
            ) : (
              <p className="wf-entry-meta">Not answered.</p>
            )}
          </Group>

          <Group title="Union Affiliation" editSlug="union">
            {legal?.unionAffiliation.isUnionAffiliated ? (
              <dl className="wf-dl">
                <Row label="Union member" value="Yes" />
                <Row label="Union" value={legal.unionAffiliation.unionName} />
                <Row
                  label="Local number"
                  value={legal.unionAffiliation.localNumber}
                />
              </dl>
            ) : legal?.unionAffiliation.isUnionAffiliated === false ? (
              <dl className="wf-dl">
                <Row label="Union member" value="No" />
              </dl>
            ) : (
              <p className="wf-entry-meta">Not answered.</p>
            )}
          </Group>

          <Group title="Legal Acknowledgments" editSlug="legal">
            <dl className="wf-dl">
              <Row
                label="Acknowledgments"
                value={
                  legal?.allAcknowledgmentsAccepted
                    ? `All ${legal.acknowledgments.length} accepted`
                    : "Not all accepted"
                }
              />
            </dl>
          </Group>

          <div className="wf-notice" style={{ marginTop: 18, marginBottom: 0 }}>
            By submitting, you confirm the information above is accurate and complete.
            Your application cannot be edited after submission.
          </div>
        </>
      ) : null}
    </WorkforceWizardShell>
  );
}
