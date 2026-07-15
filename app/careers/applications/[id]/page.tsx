"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { StatusBadge } from "@/components/careers/StatusBadge";
import { StatusTransitionDialog } from "@/components/careers/StatusTransitionDialog";
import { ApplicationActivityModal } from "@/components/careers/ApplicationActivityModal";
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
  ApplicationActivity,
  InternalApplicationStatus,
  SOURCE_LABELS,
  TRANSITION_ACTION_LABELS,
  activityLabel,
  appliedAt,
  applicationStatusTone,
  getApplication,
  getResumeDownload,
  isDestructiveTransition,
  isSystemActivity,
  listApplicationActivities,
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

  const [activities, setActivities] = useState<ApplicationActivity[]>([]);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const loadActivities = useCallback(async () => {
    if (!id) return;
    setActivitiesError(null);
    try {
      const res = await listApplicationActivities(id);
      setActivities(res.items);
    } catch (e) {
      setActivitiesError(getApiErrorMessage(e, "Failed to load activity."));
    }
  }, [id]);

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
    loadActivities();
  }, [load, loadActivities]);

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
      // A status transition writes an automatic Status Change activity (and,
      // when a note was entered, a following Internal Note activity). Refresh
      // the Application Activity log so both appear immediately.
      loadActivities();
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

  // Group the (newest-first) activity stream under calendar-date headings. The
  // groups preserve incoming order, so the newest date appears first and entries
  // within each date stay newest-first. Presentation only.
  const activityGroups = useMemo(() => {
    const groups: {
      key: string;
      label: string;
      items: ApplicationActivity[];
    }[] = [];
    const byKey = new Map<string, (typeof groups)[number]>();
    for (const a of activities) {
      const d = new Date(a.at);
      const valid = !Number.isNaN(d.getTime());
      const key = valid
        ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        : "unknown";
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          label: valid
            ? d.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "Unknown date",
          items: [],
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.items.push(a);
    }
    return groups;
  }, [activities]);

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
        </div>
      </section>

      {/* Application Activity: permanent, append-only chronological history. */}
      <section className="panel">
        <div className="panel-header">
          <h2>Application Activity</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setActivityModalOpen(true)}
          >
            + Add Activity
          </button>
        </div>
        <div className="panel-body">
          {activitiesError ? (
            <div className="inline-error">{activitiesError}</div>
          ) : null}
          {activities.length === 0 ? (
            <p className="field-empty">No activity recorded yet.</p>
          ) : (
            <div className="activity-log">
              {activityGroups.map((g) => (
                <div className="act-group" key={g.key}>
                  <div className="act-date">{g.label}</div>
                  <ol className="act-items">
                    {g.items.map((a, i) => {
                      const system = isSystemActivity(a);
                      return (
                        <li
                          className={`act-item ${system ? "act-system" : "act-user"}`}
                          key={a.id ?? `${a.type}-${a.at}-${i}`}
                        >
                          <span className="act-dot" />
                          <div className="act-body">
                            <div className="act-head">
                              <span className="act-label">
                                {activityLabel(a)}
                              </span>
                              {system ? (
                                <span className="act-tag">System</span>
                              ) : null}
                            </div>
                            {a.detail ? (
                              <p className="act-detail">{a.detail}</p>
                            ) : null}
                            {a.note ? (
                              <p className="act-note prewrap">{a.note}</p>
                            ) : null}
                            <span className="act-meta">
                              {formatActivityTime(a.at)}
                              {a.actorUserId
                                ? ` · ${managerDisplay(a.actorUserId)}`
                                : system
                                  ? " · System"
                                  : ""}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <ApplicationActivityModal
        open={activityModalOpen}
        applicationId={application.id}
        onClose={() => setActivityModalOpen(false)}
        onSaved={(items) => {
          setActivities(items);
          setActivityModalOpen(false);
        }}
      />

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
        .activity-log {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .act-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .act-date {
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          letter-spacing: 0.3px;
          padding-bottom: 7px;
          border-bottom: 1px solid #eef2f7;
        }
        .act-items {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
        }
        .act-item {
          display: flex;
          gap: 12px;
          padding-bottom: 16px;
          position: relative;
        }
        .act-item:not(:last-child)::before {
          content: "";
          position: absolute;
          left: 4px;
          top: 14px;
          bottom: 0;
          width: 1px;
          background: #e5e7eb;
        }
        .act-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          margin-top: 4px;
          flex-shrink: 0;
          z-index: 1;
        }
        .act-user .act-dot {
          background: #2563eb;
        }
        .act-system .act-dot {
          background: #94a3b8;
        }
        .act-body {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }
        .act-head {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .act-label {
          font-size: 13.5px;
          font-weight: 700;
          color: #111827;
        }
        .act-system .act-label {
          color: #475569;
        }
        .act-tag {
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          color: #64748b;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 1px 7px;
        }
        .act-detail {
          font-size: 12.5px;
          color: #4b5563;
          margin: 0;
          word-break: break-word;
        }
        .act-note {
          font-size: 13px;
          color: #111827;
          line-height: 1.55;
          margin: 0;
          word-break: break-word;
        }
        .act-meta {
          font-size: 11.5px;
          color: #9ca3af;
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

/** Time-only label for an activity entry (the date lives in the group heading). */
function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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
