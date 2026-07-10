"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { ApplicantFormModal } from "@/components/careers/ApplicantFormModal";
import { formatDateTime } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import {
  Applicant,
  applicantName,
  getApplicant,
} from "@/lib/careers/applicantsApi";

export default function CareersApplicantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

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
        .panel-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
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
          .info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .summary-row,
          .info-grid {
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
