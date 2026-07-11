"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { StatusBadge } from "@/components/careers/StatusBadge";
import { JobPostingFormModal } from "@/components/careers/JobPostingFormModal";
import { ConfirmDialog } from "@/components/careers/ConfirmDialog";
import { useStaffDirectory } from "@/components/careers/useStaffDirectory";
import { formatDateTime } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { staffLabel } from "@/lib/careers/staffApi";
import {
  JobPosting,
  POSTING_STATUS_LABELS,
  VISIBILITY_LABELS,
  archiveJobPosting,
  closeJobPosting,
  employmentTypeLabel,
  fillJobPosting,
  getJobPosting,
  pauseJobPosting,
  postingStatusTone,
  postingTitle,
  publicApplicationUrl,
  publishJobPosting,
} from "@/lib/careers/jobPostingsApi";
import {
  FLSA_CLASSIFICATION_LABELS,
  PAY_TYPE_LABELS,
  TRAVEL_REQUIREMENT_LABELS,
  WORK_LOCATION_LABELS,
  formatTime12h,
} from "@/lib/careers/positionsApi";

// Local, display-only formatters (no negative/placeholder wording).
const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString() : "—";
const formatMoney = (n: number | null): string | null =>
  n != null ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : null;
const yesNo = (b: boolean): string => (b ? "Yes" : "No");

type LifecycleAction = "publish" | "pause" | "fill" | "close" | "archive";

export default function CareersPostingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { byId: staffById } = useStaffDirectory();

  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<LifecycleAction | null>(
    null,
  );
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getJobPosting(id);
      setPosting(data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load job posting."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmLifecycle = async () => {
    if (!posting || !confirmAction) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      const action: Record<LifecycleAction, () => Promise<JobPosting>> = {
        publish: () => publishJobPosting(posting.id),
        pause: () => pauseJobPosting(posting.id),
        fill: () => fillJobPosting(posting.id),
        close: () => closeJobPosting(posting.id),
        archive: () => archiveJobPosting(posting.id),
      };
      const updated = await action[confirmAction]();
      setPosting(updated);
      setConfirmAction(null);
    } catch (e) {
      setConfirmError(
        getApiErrorMessage(e, `Failed to ${confirmAction} posting.`),
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  const managerDisplay = (p: JobPosting): string => {
    if (!p.hiringManagerUserId) return "—";
    const user = staffById.get(p.hiringManagerUserId);
    return user ? staffLabel(user) : p.hiringManagerUserId;
  };

  if (loading) {
    return (
      <CareersShell
        title="Job Posting"
        backHref="/careers/postings"
        backLabel="Job Postings"
      >
        <div className="state-block">Loading job posting…</div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  if (error || !posting) {
    return (
      <CareersShell
        title="Job Posting"
        backHref="/careers/postings"
        backLabel="Job Postings"
      >
        <div className="state-block state-error">
          {error ?? "Job posting not found."}
        </div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  const canClose =
    posting.status === "DRAFT" ||
    posting.status === "PUBLISHED" ||
    posting.status === "PAUSED" ||
    posting.status === "FILLED";
  const canArchive =
    posting.status === "FILLED" || posting.status === "CLOSED";
  const publicUrl = publicApplicationUrl(posting);

  const hiringRequirements = [
    posting.drugScreenRequired ? "Drug Screen" : null,
    posting.backgroundCheckRequired ? "Background Check" : null,
    posting.driversLicenseRequired ? "Driver's License" : null,
    posting.motorVehicleRecordRequired ? "Motor Vehicle Record" : null,
  ].filter((x): x is string => x !== null);
  const physicalRequirements = [
    posting.liftRequirements ? "Lift Requirements" : null,
    posting.climbingRequirements ? "Climbing Requirements" : null,
    posting.outdoorWork ? "Outdoor Work" : null,
    posting.overnightTravel ? "Overnight Travel" : null,
  ].filter((x): x is string => x !== null);
  const startingPay = formatMoney(posting.startingPay);
  const maximumPay = formatMoney(posting.maximumPay);
  const signOnBonus = formatMoney(posting.signOnBonus);
  const hasCompensation =
    startingPay !== null ||
    maximumPay !== null ||
    signOnBonus !== null ||
    !!posting.commissionPlan ||
    !!posting.benefitsSummaryOverride;

  return (
    <CareersShell
      title={postingTitle(posting)}
      subtitle={posting.position?.title ?? "Job Posting"}
      backHref="/careers/postings"
      backLabel="Job Postings"
      actions={
        <>
          <StatusBadge
            label={POSTING_STATUS_LABELS[posting.status]}
            tone={postingStatusTone(posting.status)}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </button>
          {posting.status === "DRAFT" || posting.status === "PAUSED" ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setConfirmError(null);
                setConfirmAction("publish");
              }}
            >
              {posting.status === "PAUSED" ? "Republish" : "Publish"}
            </button>
          ) : null}
          {posting.status === "PUBLISHED" ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setConfirmError(null);
                  setConfirmAction("pause");
                }}
              >
                Pause
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setConfirmError(null);
                  setConfirmAction("fill");
                }}
              >
                Mark Filled
              </button>
            </>
          ) : null}
          {canClose ? (
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setConfirmError(null);
                setConfirmAction("close");
              }}
            >
              Close
            </button>
          ) : null}
          {canArchive ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setConfirmError(null);
                setConfirmAction("archive");
              }}
            >
              Archive
            </button>
          ) : null}
        </>
      }
    >
      <div className="summary-row">
        <div className="summary-card">
          <span className="summary-label">Status</span>
          <span className="summary-value">
            {POSTING_STATUS_LABELS[posting.status]}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Position</span>
          <span className="summary-value">
            {posting.position?.title ?? "—"}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Department</span>
          <span className="summary-value">{posting.department ?? "—"}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Employment Type</span>
          <span className="summary-value">
            {employmentTypeLabel(posting.employmentType)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Visibility</span>
          <span className="summary-value">
            {VISIBILITY_LABELS[posting.visibility]}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Location</span>
          <span className="summary-value">{posting.location ?? "—"}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Hiring Manager</span>
          <span className="summary-value">{managerDisplay(posting)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Posting Code</span>
          <span className="summary-value">{posting.postingCode ?? "—"}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Openings</span>
          <span className="summary-value">{posting.numberOfOpenings}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Posting Date</span>
          <span className="summary-value">{formatDate(posting.postingDate)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Closing Date</span>
          <span className="summary-value">{formatDate(posting.closingDate)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Expected Start</span>
          <span className="summary-value">
            {formatDate(posting.expectedStartDate)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Published</span>
          <span className="summary-value">
            {formatDateTime(posting.publishedAt)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Closed</span>
          <span className="summary-value">
            {formatDateTime(posting.closedAt)}
          </span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Description</h2>
        </div>
        <div className="panel-body">
          {posting.description ? (
            <p className="field-text">{posting.description}</p>
          ) : (
            <p className="field-empty">No description provided.</p>
          )}
        </div>
      </section>

      {/* Inherited Position Profile snapshot (V2.1.2b + V2.1.6B): captured at
          posting creation. These values belong to the posting and are unaffected
          by later Position edits; editing the posting never changes the Position. */}
      <section className="panel">
        <div className="panel-header">
          <h2>Inherited Position Profile (Snapshot)</h2>
        </div>
        <div className="panel-body meta-grid">
          <div className="field">
            <span className="field-label">Pay Type</span>
            <p className="field-text">
              {posting.payType ? PAY_TYPE_LABELS[posting.payType] : "—"}
            </p>
          </div>
          <div className="field">
            <span className="field-label">FLSA Classification</span>
            <p className="field-text">
              {posting.flsaClassification
                ? FLSA_CLASSIFICATION_LABELS[posting.flsaClassification]
                : "—"}
            </p>
          </div>
          <div className="field">
            <span className="field-label">Work Location</span>
            <p className="field-text">
              {posting.workLocation
                ? WORK_LOCATION_LABELS[posting.workLocation]
                : "—"}
            </p>
          </div>
          <div className="field">
            <span className="field-label">Travel Requirement</span>
            <p className="field-text">
              {posting.travelRequirement
                ? TRAVEL_REQUIREMENT_LABELS[posting.travelRequirement]
                : "—"}
            </p>
          </div>
          <div className="field">
            <span className="field-label">Standard Work Days</span>
            <p className="field-text">{posting.standardWorkDays ?? "—"}</p>
          </div>
          <div className="field">
            <span className="field-label">Standard Hours / Week</span>
            <p className="field-text">
              {posting.standardHoursPerWeek != null
                ? posting.standardHoursPerWeek
                : "—"}
            </p>
          </div>
          <div className="field">
            <span className="field-label">Standard Start Time</span>
            <p className="field-text">
              {formatTime12h(posting.standardStartTime)}
            </p>
          </div>
          <div className="field">
            <span className="field-label">Standard End Time</span>
            <p className="field-text">{formatTime12h(posting.standardEndTime)}</p>
          </div>
          <div className="field">
            <span className="field-label">Standard Lunch</span>
            <p className="field-text">
              {posting.standardLunchMinutes != null
                ? `${posting.standardLunchMinutes} minutes`
                : "—"}
            </p>
          </div>
        </div>
        <div className="panel-body meta-grid">
          <div className="field">
            <span className="field-label">Responsibilities</span>
            {posting.responsibilities ? (
              <p className="field-text">{posting.responsibilities}</p>
            ) : (
              <p className="field-empty">Not specified.</p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Qualifications</span>
            {posting.qualifications ? (
              <p className="field-text">{posting.qualifications}</p>
            ) : (
              <p className="field-empty">Not specified.</p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Hiring Requirements</span>
            {hiringRequirements.length > 0 ? (
              <p className="field-text">{hiringRequirements.join(", ")}</p>
            ) : (
              <p className="field-empty">Not specified.</p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Physical Requirements</span>
            {physicalRequirements.length > 0 ? (
              <p className="field-text">{physicalRequirements.join(", ")}</p>
            ) : (
              <p className="field-empty">Not specified.</p>
            )}
            {posting.additionalPhysicalRequirements ? (
              <p className="field-text">
                {posting.additionalPhysicalRequirements}
              </p>
            ) : null}
          </div>
          <div className="field">
            <span className="field-label">Default Certifications</span>
            {(posting.certifications ?? []).length > 0 ? (
              <p className="field-text">
                {(posting.certifications ?? []).map((c) => c.name).join(", ")}
              </p>
            ) : (
              <p className="field-empty">Not specified.</p>
            )}
          </div>
        </div>
      </section>

      {hasCompensation ? (
        <section className="panel">
          <div className="panel-header">
            <h2>Compensation</h2>
          </div>
          <div className="panel-body meta-grid">
            {startingPay ? (
              <div className="field">
                <span className="field-label">Starting Pay</span>
                <p className="field-text">{startingPay}</p>
              </div>
            ) : null}
            {maximumPay ? (
              <div className="field">
                <span className="field-label">Maximum Pay</span>
                <p className="field-text">{maximumPay}</p>
              </div>
            ) : null}
            {signOnBonus ? (
              <div className="field">
                <span className="field-label">Sign-on Bonus</span>
                <p className="field-text">{signOnBonus}</p>
              </div>
            ) : null}
            {posting.commissionPlan ? (
              <div className="field">
                <span className="field-label">Commission Plan</span>
                <p className="field-text">{posting.commissionPlan}</p>
              </div>
            ) : null}
            {posting.benefitsSummaryOverride ? (
              <div className="field">
                <span className="field-label">Benefits Summary Override</span>
                <p className="field-text">{posting.benefitsSummaryOverride}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <h2>Application Settings</h2>
        </div>
        <div className="panel-body meta-grid">
          <div className="field">
            <span className="field-label">Resume Required</span>
            <p className="field-text">{yesNo(posting.resumeRequired)}</p>
          </div>
          <div className="field">
            <span className="field-label">Cover Letter Required</span>
            <p className="field-text">{yesNo(posting.coverLetterRequired)}</p>
          </div>
          <div className="field">
            <span className="field-label">Internal Applicants Only</span>
            <p className="field-text">{yesNo(posting.internalApplicantsOnly)}</p>
          </div>
          <div className="field">
            <span className="field-label">External Applicants Allowed</span>
            <p className="field-text">
              {yesNo(posting.externalApplicantsAllowed)}
            </p>
          </div>
          <div className="field">
            <span className="field-label">Auto-Close When Filled</span>
            <p className="field-text">{yesNo(posting.autoCloseWhenFilled)}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Metadata</h2>
        </div>
        <div className="panel-body meta-grid">
          <div className="field">
            <span className="field-label">Public Application ID</span>
            {posting.publicCode ? (
              <p className="field-text">
                <span className="mono">{posting.publicCode}</span>
              </p>
            ) : (
              <p className="field-empty">
                Generated when the posting is first published.
              </p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Public Application URL</span>
            {publicUrl ? (
              <input
                className="url-readonly"
                type="text"
                value={publicUrl}
                readOnly
                aria-label="Canonical public application URL"
                onFocus={(e) => e.currentTarget.select()}
              />
            ) : (
              <p className="field-empty">
                Available once the posting is published.
              </p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Public URL Slug</span>
            <p className="field-text">
              <span className="mono">{posting.slug}</span>
            </p>
          </div>
          <div className="field">
            <span className="field-label">Created By</span>
            <p className="field-text">
              {posting.createdByUserId ? (
                <span className="mono" title={posting.createdByUserId}>
                  {posting.createdByUserId}
                </span>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="field">
            <span className="field-label">Created</span>
            <p className="field-text">{formatDateTime(posting.createdAt)}</p>
          </div>
          <div className="field">
            <span className="field-label">Last Updated</span>
            <p className="field-text">{formatDateTime(posting.updatedAt)}</p>
          </div>
        </div>
      </section>

      <JobPostingFormModal
        open={editOpen}
        mode="edit"
        posting={posting}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setPosting(saved);
          setEditOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction === "publish"
            ? posting.status === "PAUSED"
              ? "Republish posting"
              : "Publish posting"
            : confirmAction === "pause"
              ? "Pause posting"
              : confirmAction === "fill"
                ? "Mark posting as filled"
                : confirmAction === "archive"
                  ? "Archive posting"
                  : "Close posting"
        }
        tone={confirmAction === "close" ? "danger" : "primary"}
        confirmLabel={
          confirmAction === "publish"
            ? posting.status === "PAUSED"
              ? "Republish"
              : "Publish"
            : confirmAction === "pause"
              ? "Pause"
              : confirmAction === "fill"
                ? "Mark Filled"
                : confirmAction === "archive"
                  ? "Archive"
                  : "Close"
        }
        busy={confirmBusy}
        error={confirmError}
        message={
          confirmAction === "publish" ? (
            posting.status === "PAUSED" ? (
              <>
                Republish <strong>{postingTitle(posting)}</strong>? This returns
                the posting to the public careers site. Its permanent public
                application ID is unchanged.
              </>
            ) : (
              <>
                Publish <strong>{postingTitle(posting)}</strong>? This activates
                the posting and assigns its permanent public application ID. The
                public ID never changes once assigned.
              </>
            )
          ) : confirmAction === "pause" ? (
            <>
              Pause <strong>{postingTitle(posting)}</strong>? This temporarily
              removes it from the public careers site. You can republish it later.
            </>
          ) : confirmAction === "fill" ? (
            <>
              Mark <strong>{postingTitle(posting)}</strong> as filled? The posting
              is no longer public but is retained and can still be closed or
              archived.
            </>
          ) : confirmAction === "archive" ? (
            <>
              Archive <strong>{postingTitle(posting)}</strong>? This retains it
              for historical reference only. This action is final.
            </>
          ) : (
            <>
              Close <strong>{postingTitle(posting)}</strong>? A closed posting can
              no longer be published or reopened.
            </>
          )
        }
        onConfirm={handleConfirmLifecycle}
        onCancel={() => {
          if (!confirmBusy) setConfirmAction(null);
        }}
      />

      <style jsx>{`
        .btn-primary {
          background: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 7px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: #ffffff;
          color: #374151;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-secondary:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-danger {
          background: #dc2626;
          color: #ffffff;
          border: none;
          border-radius: 7px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-danger:hover:not(:disabled) {
          background: #b91c1c;
        }
        .btn-danger:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .action-error {
          background: #fff1f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 13px;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
        }
        .summary-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }
        .summary-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .summary-label {
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .summary-value {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          word-break: break-word;
        }
        .panel {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 18px;
        }
        .panel-header {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .panel-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        .panel-body {
          padding: 16px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field-label {
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .field-text {
          font-size: 13px;
          color: #111827;
          line-height: 1.6;
          margin: 0;
          white-space: pre-wrap;
        }
        .field-empty {
          font-size: 13px;
          color: #9ca3af;
          font-style: italic;
          margin: 0;
        }
        .mono {
          font-family: var(--font-geist-mono, monospace);
          font-size: 12px;
          color: #6b7280;
        }
        .url-readonly {
          width: 100%;
          font-family: var(--font-geist-mono, monospace);
          font-size: 12px;
          color: #111827;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 7px;
          padding: 8px 10px;
        }
        .url-readonly:focus {
          outline: 2px solid #2563eb;
          outline-offset: 1px;
        }
        @media (max-width: 900px) {
          .summary-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .summary-row,
          .meta-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </CareersShell>
  );
}

const blockStyles = `
  .state-block {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 40px 20px;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
  }
  .state-error {
    background: #fff1f2;
    border-color: #fecaca;
    color: #991b1b;
  }
`;
