"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import {
  StatusBadge,
  positionStatusTone,
} from "@/components/careers/StatusBadge";
import { PositionFormModal } from "@/components/careers/PositionFormModal";
import { JobPostingFormModal } from "@/components/careers/JobPostingFormModal";
import { ConfirmDialog } from "@/components/careers/ConfirmDialog";
import { formatDateTime } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import {
  Position,
  activatePosition,
  deactivatePosition,
  getPosition,
} from "@/lib/careers/positionsApi";
import { employmentTypeLabel } from "@/lib/careers/jobPostingsApi";

export default function CareersPositionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [postingOpen, setPostingOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPosition(id);
      setPosition(data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load position."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleActivate = async () => {
    if (!position) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await activatePosition(position.id);
      setPosition(updated);
    } catch (e) {
      setActionError(getApiErrorMessage(e, "Failed to activate position."));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!position) return;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      const updated = await deactivatePosition(position.id);
      setPosition(updated);
      setConfirmOpen(false);
    } catch (e) {
      setConfirmError(getApiErrorMessage(e, "Failed to deactivate position."));
    } finally {
      setConfirmBusy(false);
    }
  };

  // Loading / error shells
  if (loading) {
    return (
      <CareersShell
        title="Position"
        backHref="/careers/positions"
        backLabel="Positions"
      >
        <div className="state-block">Loading position…</div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  if (error || !position) {
    return (
      <CareersShell
        title="Position"
        backHref="/careers/positions"
        backLabel="Positions"
      >
        <div className="state-block state-error">
          {error ?? "Position not found."}
        </div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  return (
    <CareersShell
      title={position.title}
      subtitle={position.department ?? "Position"}
      backHref="/careers/positions"
      backLabel="Positions"
      actions={
        <>
          <StatusBadge
            label={position.isActive ? "Active" : "Inactive"}
            tone={positionStatusTone(position.isActive)}
          />
          {position.isActive ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setPostingOpen(true)}
            >
              Create Job Posting
            </button>
          ) : null}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditOpen(true)}
          >
            Edit
          </button>
          {position.isActive ? (
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => {
                setConfirmError(null);
                setConfirmOpen(true);
              }}
            >
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={handleActivate}
            >
              {busy ? "Working…" : "Activate"}
            </button>
          )}
        </>
      }
    >
      {actionError ? <div className="action-error">{actionError}</div> : null}

      {/* Summary cards */}
      <div className="summary-row">
        <div className="summary-card">
          <span className="summary-label">Status</span>
          <span className="summary-value">
            {position.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Department</span>
          <span className="summary-value">{position.department ?? "—"}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Created</span>
          <span className="summary-value">
            {formatDateTime(position.createdAt)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Last Updated</span>
          <span className="summary-value">
            {formatDateTime(position.updatedAt)}
          </span>
        </div>
      </div>

      {/* Details panel */}
      <section className="panel">
        <div className="panel-header">
          <h2>Details</h2>
        </div>
        <div className="panel-body">
          <div className="field">
            <span className="field-label">Description</span>
            {position.description ? (
              <p className="field-text">{position.description}</p>
            ) : (
              <p className="field-empty">No description provided.</p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Created By</span>
            <p className="field-text">
              {position.createdByUserId ? (
                <span className="mono" title={position.createdByUserId}>
                  {position.createdByUserId}
                </span>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Position Defaults panel */}
      <section className="panel panel-spaced">
        <div className="panel-header">
          <h2>Position Defaults</h2>
        </div>
        <div className="panel-body">
          <div className="field">
            <span className="field-label">Standard Responsibilities</span>
            {position.standardResponsibilities ? (
              <p className="field-text">{position.standardResponsibilities}</p>
            ) : (
              <p className="field-empty">
                No standard responsibilities provided.
              </p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Standard Qualifications</span>
            {position.standardQualifications ? (
              <p className="field-text">{position.standardQualifications}</p>
            ) : (
              <p className="field-empty">
                No standard qualifications provided.
              </p>
            )}
          </div>
          <div className="field">
            <span className="field-label">Default Employment Type</span>
            <p className="field-text">
              {employmentTypeLabel(position.defaultEmploymentType)}
            </p>
          </div>
        </div>
      </section>

      <PositionFormModal
        open={editOpen}
        mode="edit"
        position={position}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setPosition(saved);
          setEditOpen(false);
        }}
      />

      {/* V2.1.2b: create a Job Posting from this Position. The new posting takes
          a snapshot of the Position Defaults server-side at create. */}
      <JobPostingFormModal
        open={postingOpen}
        mode="create"
        fromPosition={position}
        onClose={() => setPostingOpen(false)}
        onSaved={(saved) => {
          setPostingOpen(false);
          router.push(`/careers/postings/${saved.id}`);
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate position"
        tone="danger"
        confirmLabel="Deactivate"
        busy={confirmBusy}
        error={confirmError}
        message={
          <>
            Deactivate <strong>{position.title}</strong>? It will be hidden from
            active role selection but preserved for history. You can reactivate
            it later.
          </>
        }
        onConfirm={handleConfirmDeactivate}
        onCancel={() => {
          if (!confirmBusy) setConfirmOpen(false);
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
        }
        .panel {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }
        .panel-spaced {
          margin-top: 18px;
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
          display: flex;
          flex-direction: column;
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
          .summary-row {
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
