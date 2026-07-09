"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { StatusBadge } from "@/components/careers/StatusBadge";
import { WidgetPanel } from "@/components/careers/WidgetPanel";
import { StatusTransitionDialog } from "@/components/careers/StatusTransitionDialog";
import { useStaffDirectory } from "@/components/careers/useStaffDirectory";
import { formatDateTime } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { staffLabel } from "@/lib/careers/staffApi";
import { applicantName } from "@/lib/careers/applicantsApi";
import {
  POSTING_STATUS_LABELS,
  postingStatusTone,
  postingTitle,
} from "@/lib/careers/jobPostingsApi";
import { Position, getPosition } from "@/lib/careers/positionsApi";
import {
  ALLOWED_TRANSITIONS,
  APPLICATION_STATUS_LABELS,
  Application,
  InternalApplicationStatus,
  SOURCE_LABELS,
  TRANSITION_ACTION_LABELS,
  appliedAt,
  applicationStatusTone,
  getApplication,
  getResumeDownload,
  isDestructiveTransition,
  transitionApplication,
} from "@/lib/careers/applicationsApi";

export default function CareersApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { byId: staffById } = useStaffDirectory();

  const [application, setApplication] = useState<Application | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toStatus, setToStatus] = useState<InternalApplicationStatus | null>(
    null,
  );
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getApplication(id);
      setApplication(data);
      // Best-effort enrichment: the application's jobPosting include does not
      // nest the underlying Position, so fetch it for the "Position" field.
      const positionId = data.jobPosting?.positionId;
      if (positionId) {
        getPosition(positionId)
          .then((p) => setPosition(p))
          .catch(() => setPosition(null));
      } else {
        setPosition(null);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load application."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirmTransition = async (reviewNote: string) => {
    if (!application || !toStatus) return;
    setTransitionBusy(true);
    setTransitionError(null);
    try {
      const updated = await transitionApplication(
        application.id,
        toStatus,
        reviewNote || undefined,
      );
      setApplication(updated);
      setToStatus(null);
    } catch (e) {
      setTransitionError(getApiErrorMessage(e, "Failed to update status."));
    } finally {
      setTransitionBusy(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!application?.resumeDocumentId) return;
    setResumeBusy(true);
    setResumeError(null);
    try {
      const info = await getResumeDownload(application.resumeDocumentId);
      window.open(info.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setResumeError(
        getApiErrorMessage(e, "Failed to prepare resume download."),
      );
    } finally {
      setResumeBusy(false);
    }
  };

  const managerDisplay = (uid: string | null): string => {
    if (!uid) return "—";
    const user = staffById.get(uid);
    return user ? staffLabel(user) : uid;
  };

  if (loading) {
    return (
      <CareersShell
        title="Application"
        backHref="/careers/applications"
        backLabel="Applications"
      >
        <div className="state-block">Loading application…</div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  if (error || !application) {
    return (
      <CareersShell
        title="Application"
        backHref="/careers/applications"
        backLabel="Applications"
      >
        <div className="state-block state-error">
          {error ?? "Application not found."}
        </div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  const applicant = application.internalApplicant;
  const posting = application.jobPosting;
  const transitions = ALLOWED_TRANSITIONS[application.status] ?? [];

  return (
    <CareersShell
      title={applicantName(applicant)}
      subtitle={postingTitle(posting)}
      backHref="/careers/applications"
      backLabel="Applications"
      actions={
        <>
          <StatusBadge
            label={APPLICATION_STATUS_LABELS[application.status]}
            tone={applicationStatusTone(application.status)}
          />
          {transitions.map((t) => (
            <button
              key={t}
              type="button"
              className={
                isDestructiveTransition(t) ? "btn-danger" : "btn-primary"
              }
              onClick={() => {
                setTransitionError(null);
                setToStatus(t);
              }}
            >
              {TRANSITION_ACTION_LABELS[t]}
            </button>
          ))}
        </>
      }
    >
      {transitions.length === 0 ? (
        <div className="terminal-note">
          This application is in a terminal status
          {" "}({APPLICATION_STATUS_LABELS[application.status]}) and has no
          further status transitions.
        </div>
      ) : null}

      <div className="two-col">
        {/* Applicant Summary */}
        <section className="panel">
          <div className="panel-header">
            <h2>Applicant Summary</h2>
            <Link
              className="panel-link"
              href={`/careers/applicants/${applicant.id}`}
            >
              View applicant
            </Link>
          </div>
          <div className="panel-body info-grid">
            <div className="field">
              <span className="field-label">Name</span>
              <p className="field-text">{applicantName(applicant)}</p>
            </div>
            <div className="field">
              <span className="field-label">Email</span>
              <p className="field-text">{applicant.email}</p>
            </div>
            <div className="field">
              <span className="field-label">Phone</span>
              <p className="field-text">{applicant.phone ?? "—"}</p>
            </div>
            <div className="field">
              <span className="field-label">City</span>
              <p className="field-text">{applicant.city ?? "—"}</p>
            </div>
            <div className="field">
              <span className="field-label">State</span>
              <p className="field-text">{applicant.state ?? "—"}</p>
            </div>
          </div>
        </section>

        {/* Job Posting Summary */}
        <section className="panel">
          <div className="panel-header">
            <h2>Job Posting Summary</h2>
            <Link
              className="panel-link"
              href={`/careers/postings/${posting.id}`}
            >
              View posting
            </Link>
          </div>
          <div className="panel-body info-grid">
            <div className="field">
              <span className="field-label">Position</span>
              <p className="field-text">{position?.title ?? "—"}</p>
            </div>
            <div className="field">
              <span className="field-label">Posting</span>
              <p className="field-text">{postingTitle(posting)}</p>
            </div>
            <div className="field">
              <span className="field-label">Hiring Manager</span>
              <p className="field-text">
                {managerDisplay(posting.hiringManagerUserId)}
              </p>
            </div>
            <div className="field">
              <span className="field-label">Posting Status</span>
              <p className="field-text">
                <StatusBadge
                  label={POSTING_STATUS_LABELS[posting.status]}
                  tone={postingStatusTone(posting.status)}
                />
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Application Summary */}
      <section className="panel">
        <div className="panel-header">
          <h2>Application Summary</h2>
        </div>
        <div className="panel-body">
          <div className="info-grid">
            <div className="field">
              <span className="field-label">Current Status</span>
              <p className="field-text">
                <StatusBadge
                  label={APPLICATION_STATUS_LABELS[application.status]}
                  tone={applicationStatusTone(application.status)}
                />
              </p>
            </div>
            <div className="field">
              <span className="field-label">Applied</span>
              <p className="field-text">{formatDateTime(appliedAt(application))}</p>
            </div>
            <div className="field">
              <span className="field-label">Last Updated</span>
              <p className="field-text">
                {formatDateTime(application.updatedAt)}
              </p>
            </div>
            <div className="field">
              <span className="field-label">Source</span>
              <p className="field-text">
                {application.source ? SOURCE_LABELS[application.source] : "—"}
              </p>
            </div>
            <div className="field">
              <span className="field-label">Reviewed By</span>
              <p className="field-text">
                {managerDisplay(application.reviewedByUserId)}
              </p>
            </div>
            <div className="field">
              <span className="field-label">Reviewed At</span>
              <p className="field-text">
                {formatDateTime(application.reviewedAt)}
              </p>
            </div>
          </div>

          {/* Resume */}
          <div className="section-divider" />
          <div className="resume-row">
            <div>
              <span className="field-label">Resume</span>
              {application.resumeDocument ? (
                <p className="field-text">
                  {application.resumeDocument.fileName}
                </p>
              ) : (
                <p className="field-empty">No resume on file.</p>
              )}
            </div>
            {application.resumeDocument ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadResume}
                disabled={resumeBusy}
              >
                {resumeBusy ? "Preparing…" : "Download Resume"}
              </button>
            ) : null}
          </div>
          {resumeError ? <div className="inline-error">{resumeError}</div> : null}

          {/* Cover Note */}
          <div className="section-divider" />
          <div className="field">
            <span className="field-label">Cover Note</span>
            {application.coverNote ? (
              <p className="field-text prewrap">{application.coverNote}</p>
            ) : (
              <p className="field-empty">No cover note provided.</p>
            )}
          </div>

          {/* Review Note */}
          <div className="section-divider" />
          <div className="field">
            <span className="field-label">Review Note</span>
            {application.reviewNote ? (
              <p className="field-text prewrap">{application.reviewNote}</p>
            ) : (
              <p className="field-empty">
                No review note yet. Add one when changing status.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Activity Timeline (reserved space; not implemented in this phase) */}
      <div className="timeline-region">
        <WidgetPanel
          title="Activity Timeline"
          note="Coming soon"
          minHeight={140}
        >
          <div className="timeline-placeholder">
            Status history, review notes, communications, interviews, and AI
            summaries will appear here in a future release.
          </div>
        </WidgetPanel>
      </div>

      <StatusTransitionDialog
        key={toStatus ?? "none"}
        open={toStatus !== null}
        fromStatus={application.status}
        toStatus={toStatus}
        busy={transitionBusy}
        error={transitionError}
        onConfirm={handleConfirmTransition}
        onCancel={() => {
          if (!transitionBusy) setToStatus(null);
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
        .btn-primary:hover {
          background: #1d4ed8;
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
        .btn-danger:hover {
          background: #b91c1c;
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
          flex-shrink: 0;
        }
        .btn-secondary:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .terminal-note {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12.5px;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
        }
        .inline-error {
          margin-top: 10px;
          background: #fff1f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          font-size: 12.5px;
          border-radius: 6px;
          padding: 8px 10px;
        }
        .two-col {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 18px;
        }
        .panel {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 18px;
        }
        .two-col .panel {
          margin-bottom: 0;
        }
        .panel-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .panel-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        .panel-link {
          font-size: 12.5px;
          font-weight: 600;
          color: #2563eb;
          text-decoration: none;
          flex-shrink: 0;
        }
        .panel-link:hover {
          text-decoration: underline;
        }
        .panel-body {
          padding: 16px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
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
          word-break: break-word;
        }
        .prewrap {
          white-space: pre-wrap;
        }
        .field-empty {
          font-size: 13px;
          color: #9ca3af;
          font-style: italic;
          margin: 0;
        }
        .section-divider {
          height: 1px;
          background: #f1f5f9;
          margin: 16px 0;
        }
        .resume-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .timeline-region {
          margin-bottom: 8px;
        }
        .timeline-placeholder {
          font-size: 13px;
          color: #9ca3af;
          font-style: italic;
          line-height: 1.6;
        }
        @media (max-width: 900px) {
          .two-col {
            grid-template-columns: 1fr;
          }
          .info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .info-grid {
            grid-template-columns: 1fr;
          }
          .resume-row {
            flex-direction: column;
            align-items: flex-start;
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
