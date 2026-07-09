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
  closeJobPosting,
  employmentTypeLabel,
  fillJobPosting,
  getJobPosting,
  postingStatusTone,
  postingTitle,
  publishJobPosting,
} from "@/lib/careers/jobPostingsApi";

type LifecycleAction = "close" | "fill";

export default function CareersPostingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { byId: staffById } = useStaffDirectory();

  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const handlePublish = async () => {
    if (!posting) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await publishJobPosting(posting.id);
      setPosting(updated);
    } catch (e) {
      setActionError(getApiErrorMessage(e, "Failed to publish posting."));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmLifecycle = async () => {
    if (!posting || !confirmAction) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      const updated =
        confirmAction === "close"
          ? await closeJobPosting(posting.id)
          : await fillJobPosting(posting.id);
      setPosting(updated);
      setConfirmAction(null);
    } catch (e) {
      setConfirmError(
        getApiErrorMessage(
          e,
          `Failed to ${confirmAction === "close" ? "close" : "fill"} posting.`,
        ),
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

  const isTerminal = posting.status === "CLOSED" || posting.status === "FILLED";

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
          {posting.status === "DRAFT" ? (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={handlePublish}
            >
              {busy ? "Working…" : "Publish"}
            </button>
          ) : null}
          {posting.status === "OPEN" ? (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => {
                setConfirmError(null);
                setConfirmAction("fill");
              }}
            >
              Mark Filled
            </button>
          ) : null}
          {!isTerminal ? (
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => {
                setConfirmError(null);
                setConfirmAction("close");
              }}
            >
              Close
            </button>
          ) : null}
        </>
      }
    >
      {actionError ? <div className="action-error">{actionError}</div> : null}

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
          <span className="summary-label">Published</span>
          <span className="summary-value">
            {formatDateTime(posting.publishedAt)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Closing / Closed</span>
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
          confirmAction === "fill" ? "Mark posting as filled" : "Close posting"
        }
        tone={confirmAction === "fill" ? "primary" : "danger"}
        confirmLabel={confirmAction === "fill" ? "Mark Filled" : "Close"}
        busy={confirmBusy}
        error={confirmError}
        message={
          confirmAction === "fill" ? (
            <>
              Mark <strong>{postingTitle(posting)}</strong> as filled? This
              closes the posting to further hiring. This action is final.
            </>
          ) : (
            <>
              Close <strong>{postingTitle(posting)}</strong>? A closed posting
              can no longer be published or reopened.
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
