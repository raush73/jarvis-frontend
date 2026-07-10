"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { ApplicantFormModal } from "@/components/careers/ApplicantFormModal";
import { WorkHistoryFormModal } from "@/components/careers/WorkHistoryFormModal";
import { ConfirmDialog } from "@/components/careers/ConfirmDialog";
import { formatDate, formatDateTime } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import {
  Applicant,
  applicantName,
  getApplicant,
} from "@/lib/careers/applicantsApi";
import { getPublicCareersConfig } from "@/lib/careers/careersConfigApi";
import {
  COMPENSATION_TYPE_LABELS,
  CONTACT_CONSENT_LABELS,
  WORK_HISTORY_EMPLOYMENT_TYPE_LABELS,
  WorkHistoryEntry,
  deleteWorkHistory,
} from "@/lib/careers/workHistoryApi";

export default function CareersApplicantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [showCompensation, setShowCompensation] = useState(true);

  // Work History dialogs
  const [whModalOpen, setWhModalOpen] = useState(false);
  const [whMode, setWhMode] = useState<"create" | "edit">("create");
  const [whEditing, setWhEditing] = useState<WorkHistoryEntry | null>(null);
  const [whDeleting, setWhDeleting] = useState<WorkHistoryEntry | null>(null);
  const [whDeleteBusy, setWhDeleteBusy] = useState(false);
  const [whDeleteError, setWhDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getApplicant(id);
      setApplicant(data);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load applicant."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    getPublicCareersConfig()
      .then((cfg) => {
        if (active) setShowCompensation(cfg.collectCompensationHistory);
      })
      .catch(() => {
        // Non-fatal: default to showing compensation.
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleDeleteWorkHistory() {
    if (!whDeleting) return;
    setWhDeleteBusy(true);
    setWhDeleteError(null);
    try {
      await deleteWorkHistory(whDeleting.id);
      setWhDeleting(null);
      await load();
    } catch (e) {
      setWhDeleteError(getApiErrorMessage(e, "Failed to delete entry."));
    } finally {
      setWhDeleteBusy(false);
    }
  }

  function formatMoney(raw: string | null): string | null {
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  }

  if (loading) {
    return (
      <CareersShell
        title="Applicant"
        backHref="/careers/applicants"
        backLabel="Applicants"
      >
        <div className="state-block">Loading applicant…</div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  if (error || !applicant) {
    return (
      <CareersShell
        title="Applicant"
        backHref="/careers/applicants"
        backLabel="Applicants"
      >
        <div className="state-block state-error">
          {error ?? "Applicant not found."}
        </div>
        <style jsx>{blockStyles}</style>
      </CareersShell>
    );
  }

  return (
    <CareersShell
      title={applicantName(applicant)}
      subtitle="Applicant"
      backHref="/careers/applicants"
      backLabel="Applicants"
      actions={
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setEditOpen(true)}
        >
          Edit Applicant
        </button>
      }
    >
      <div className="summary-row">
        <div className="summary-card">
          <span className="summary-label">Email</span>
          <span className="summary-value">{applicant.email}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Phone</span>
          <span className="summary-value">{applicant.phone ?? "—"}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">City</span>
          <span className="summary-value">{applicant.city ?? "—"}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">State</span>
          <span className="summary-value">{applicant.state ?? "—"}</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Contact Information</h2>
        </div>
        <div className="panel-body info-grid">
          <div className="field">
            <span className="field-label">First Name</span>
            <p className="field-text">{applicant.firstName ?? "—"}</p>
          </div>
          <div className="field">
            <span className="field-label">Last Name</span>
            <p className="field-text">{applicant.lastName ?? "—"}</p>
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

      <section className="panel">
        <div className="panel-header">
          <h2>Professional Profile</h2>
        </div>
        <div className="panel-body">
          <div className="field">
            <span className="field-label">Professional Summary</span>
            <p className="field-text multiline">
              {applicant.professionalSummary ?? "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Career Goals</h2>
        </div>
        <div className="panel-body info-grid">
          <div className="field">
            <span className="field-label">Current Profession</span>
            <p className="field-text">{applicant.currentProfession ?? "—"}</p>
          </div>
          <div className="field">
            <span className="field-label">Desired Profession</span>
            <p className="field-text">{applicant.desiredProfession ?? "—"}</p>
          </div>
          <div className="field field-wide">
            <span className="field-label">Long-Term Career Goals</span>
            <p className="field-text multiline">
              {applicant.longTermGoals ?? "—"}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Social Profiles</h2>
        </div>
        <div className="panel-body info-grid">
          <div className="field">
            <span className="field-label">Facebook</span>
            {applicant.facebookUrl ? (
              <a
                className="field-link"
                href={applicant.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {applicant.facebookUrl}
              </a>
            ) : (
              <p className="field-text">—</p>
            )}
          </div>
          <div className="field">
            <span className="field-label">LinkedIn</span>
            {applicant.linkedinUrl ? (
              <a
                className="field-link"
                href={applicant.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {applicant.linkedinUrl}
              </a>
            ) : (
              <p className="field-text">—</p>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header panel-header-row">
          <h2>Work History</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setWhMode("create");
              setWhEditing(null);
              setWhModalOpen(true);
            }}
          >
            Add Work History
          </button>
        </div>
        <div className="panel-body">
          {applicant.workHistory && applicant.workHistory.length > 0 ? (
            <div className="wh-list">
              {applicant.workHistory.map((wh) => {
                const start = formatDate(wh.startDate);
                const end = wh.isCurrent ? "Present" : formatDate(wh.endDate);
                const startComp = showCompensation
                  ? formatMoney(wh.startingCompensation)
                  : null;
                const endComp = showCompensation
                  ? formatMoney(wh.endingCompensation)
                  : null;
                return (
                  <div key={wh.id} className="wh-card">
                    <div className="wh-card-head">
                      <div>
                        <p className="wh-title">
                          {wh.jobTitle}
                          <span className="wh-employer">
                            {" "}
                            &middot; {wh.employerName}
                          </span>
                        </p>
                        <p className="wh-meta">
                          {start} &ndash; {end}
                          {wh.employmentType
                            ? ` · ${WORK_HISTORY_EMPLOYMENT_TYPE_LABELS[wh.employmentType]}`
                            : ""}
                          {wh.employerCity || wh.employerState
                            ? ` · ${[wh.employerCity, wh.employerState].filter(Boolean).join(", ")}`
                            : ""}
                        </p>
                      </div>
                      <div className="wh-actions">
                        <button
                          type="button"
                          className="btn-mini"
                          onClick={() => {
                            setWhMode("edit");
                            setWhEditing(wh);
                            setWhModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-mini btn-mini-danger"
                          onClick={() => {
                            setWhDeleteError(null);
                            setWhDeleting(wh);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="wh-grid">
                      {showCompensation && (startComp || endComp) ? (
                        <div className="wh-field">
                          <span className="field-label">Compensation</span>
                          <p className="field-text">
                            {[startComp, endComp].filter(Boolean).join(" \u2192 ")}
                            {wh.compensationType
                              ? ` (${COMPENSATION_TYPE_LABELS[wh.compensationType]})`
                              : ""}
                          </p>
                        </div>
                      ) : null}
                      {wh.supervisorName ? (
                        <div className="wh-field">
                          <span className="field-label">Supervisor</span>
                          <p className="field-text">
                            {wh.supervisorName}
                            {wh.supervisorTitle ? `, ${wh.supervisorTitle}` : ""}
                          </p>
                        </div>
                      ) : null}
                      <div className="wh-field">
                        <span className="field-label">May Contact Employer</span>
                        <p className="field-text">
                          {CONTACT_CONSENT_LABELS[wh.contactConsent]}
                        </p>
                      </div>
                    </div>

                    {wh.reasonForLeaving ? (
                      <div className="wh-field wh-block">
                        <span className="field-label">Reason For Leaving</span>
                        <p className="field-text multiline">
                          {wh.reasonForLeaving}
                        </p>
                      </div>
                    ) : null}
                    {wh.skillsUsed ? (
                      <div className="wh-field wh-block">
                        <span className="field-label">Skills Used</span>
                        <p className="field-text multiline">{wh.skillsUsed}</p>
                      </div>
                    ) : null}
                    {wh.accomplishments ? (
                      <div className="wh-field wh-block">
                        <span className="field-label">Accomplishments</span>
                        <p className="field-text multiline">
                          {wh.accomplishments}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="wh-empty">No work history recorded yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Metadata</h2>
        </div>
        <div className="panel-body info-grid">
          <div className="field">
            <span className="field-label">Created</span>
            <p className="field-text">{formatDateTime(applicant.createdAt)}</p>
          </div>
          <div className="field">
            <span className="field-label">Last Updated</span>
            <p className="field-text">{formatDateTime(applicant.updatedAt)}</p>
          </div>
        </div>
      </section>

      <ApplicantFormModal
        open={editOpen}
        mode="edit"
        applicant={applicant}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setApplicant(saved);
          setEditOpen(false);
        }}
      />

      <WorkHistoryFormModal
        open={whModalOpen}
        mode={whMode}
        applicantId={applicant.id}
        entry={whEditing}
        showCompensation={showCompensation}
        onClose={() => setWhModalOpen(false)}
        onSaved={() => {
          setWhModalOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={whDeleting != null}
        title="Delete Work History"
        message={
          whDeleting
            ? `Delete the entry for "${whDeleting.jobTitle} · ${whDeleting.employerName}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        busy={whDeleteBusy}
        error={whDeleteError}
        onConfirm={handleDeleteWorkHistory}
        onCancel={() => setWhDeleting(null)}
      />

      <style jsx>{`
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
        .btn-secondary:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
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
        .panel-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .panel-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        .btn-mini {
          background: #ffffff;
          color: #374151;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-mini:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .btn-mini-danger {
          color: #b91c1c;
          border-color: #fecaca;
        }
        .btn-mini-danger:hover {
          background: #fff1f2;
          border-color: #fca5a5;
        }
        .wh-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .wh-card {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #fcfcfd;
        }
        .wh-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .wh-title {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        .wh-employer {
          font-weight: 500;
          color: #4b5563;
        }
        .wh-meta {
          margin: 4px 0 0;
          font-size: 12px;
          color: #6b7280;
        }
        .wh-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .wh-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        .wh-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .wh-block {
          margin-top: 2px;
        }
        .wh-empty {
          font-size: 13px;
          color: #9ca3af;
          margin: 0;
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
        .field-text.multiline {
          white-space: pre-wrap;
        }
        .field-wide {
          grid-column: 1 / -1;
        }
        .field-link {
          font-size: 13px;
          color: #2563eb;
          line-height: 1.6;
          word-break: break-all;
          text-decoration: none;
        }
        .field-link:hover {
          text-decoration: underline;
        }
        @media (max-width: 900px) {
          .summary-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .info-grid,
          .wh-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .summary-row,
          .info-grid,
          .wh-grid {
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
