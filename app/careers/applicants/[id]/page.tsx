"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { ContactInfoModal } from "@/components/careers/ContactInfoModal";
import { formatDate, formatDateTime } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import {
  Applicant,
  ApplicantApplicationSummary,
  applicantName,
  getApplicant,
} from "@/lib/careers/applicantsApi";
import {
  APPLICATION_STATUS_LABELS,
  getResumeDownload,
  type InternalApplicationStatus,
} from "@/lib/careers/applicationsApi";
import { getPublicCareersConfig } from "@/lib/careers/careersConfigApi";
import {
  COMPENSATION_TYPE_LABELS,
  CONTACT_CONSENT_LABELS,
  WORK_HISTORY_EMPLOYMENT_TYPE_LABELS,
} from "@/lib/careers/workHistoryApi";
import { MILITARY_SERVICE_TYPE_LABELS } from "@/lib/careers/credentialsApi";
import { formatUsState } from "@/lib/careers/usStates";

/**
 * Applicant detail (V2.1.6C). A submitted application is a permanent historical
 * record: work history, education, credentials, resume, professional profile,
 * social profiles and application answers are READ-ONLY here. The only mutable
 * data is contact information, edited via "Update Contact Information". A
 * recruiting summary (most recent application) is shown directly below the name.
 */
export default function CareersApplicantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [showCompensation, setShowCompensation] = useState(true);
  const [resumeBusyId, setResumeBusyId] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

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

  // The recruiting summary reflects the most recent application (by submittedAt,
  // falling back to createdAt). An applicant may have multiple applications over
  // time; the full history lives in the Applications section elsewhere.
  const latestApplication: ApplicantApplicationSummary | null = useMemo(() => {
    const apps = applicant?.applications ?? [];
    if (apps.length === 0) return null;
    const key = (a: ApplicantApplicationSummary) =>
      new Date(a.submittedAt ?? a.createdAt).getTime();
    return [...apps].sort((a, b) => key(b) - key(a))[0];
  }, [applicant]);

  // Distinct resumes on file across the applicant's applications. A single
  // physical resume may back multiple applications, so we deduplicate by
  // documentId and record which position(s) each is attached to. Resume remains
  // optional: an empty list renders the "No resume on file" state.
  const resumeDocuments = useMemo(() => {
    const apps = applicant?.applications ?? [];
    const byDoc = new Map<
      string,
      { id: string; fileName: string; positions: string[] }
    >();
    for (const app of apps) {
      const doc = app.resumeDocument;
      if (!doc) continue;
      const positionTitle = app.jobPosting?.title ?? null;
      const existing = byDoc.get(doc.id);
      if (existing) {
        if (positionTitle && !existing.positions.includes(positionTitle)) {
          existing.positions.push(positionTitle);
        }
      } else {
        byDoc.set(doc.id, {
          id: doc.id,
          fileName: doc.fileName,
          positions: positionTitle ? [positionTitle] : [],
        });
      }
    }
    return Array.from(byDoc.values());
  }, [applicant]);

  // Securely open a resume via the existing authenticated download endpoint,
  // which returns a short-lived presigned S3 GET URL (the object stays private;
  // the app never proxies bytes). Reuses the same flow as the Application and
  // Review detail pages.
  const handleDownloadResume = useCallback(async (documentId: string) => {
    setResumeBusyId(documentId);
    setResumeError(null);
    try {
      const info = await getResumeDownload(documentId);
      window.open(info.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setResumeError(
        getApiErrorMessage(e, "Failed to prepare resume download."),
      );
    } finally {
      setResumeBusyId(null);
    }
  }, []);

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

  const statusLabel = latestApplication
    ? (APPLICATION_STATUS_LABELS[
        latestApplication.status as InternalApplicationStatus
      ] ?? latestApplication.status)
    : "—";
  const submittedDisplay = latestApplication
    ? (formatDate(
        latestApplication.submittedAt ?? latestApplication.createdAt,
      ) ?? "—")
    : "—";

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
          onClick={() => setContactOpen(true)}
        >
          Update Contact Information
        </button>
      }
    >
      {/* Recruiting summary (most recent application) */}
      <div className="rec-row">
        <div className="summary-card">
          <span className="summary-label">Position Applied For</span>
          <span className="summary-value">
            {latestApplication?.jobPosting?.title ?? "—"}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Application ID</span>
          <span className="summary-value mono">
            {latestApplication?.jobPosting?.publicCode ?? "—"}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Application Status</span>
          <span className="summary-value">{statusLabel}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Date Submitted</span>
          <span className="summary-value">{submittedDisplay}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Assigned Recruiter</span>
          <span className="summary-value">Unassigned</span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Documents</h2>
        </div>
        <div className="panel-body">
          {resumeDocuments.length > 0 ? (
            <div className="doc-list">
              {resumeDocuments.map((doc) => (
                <div key={doc.id} className="doc-row">
                  <div className="doc-info">
                    <span className="doc-name">{doc.fileName}</span>
                    <span className="doc-meta">
                      Resume
                      {doc.positions.length > 0
                        ? ` · ${doc.positions.join(", ")}`
                        : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDownloadResume(doc.id)}
                    disabled={resumeBusyId === doc.id}
                  >
                    {resumeBusyId === doc.id ? "Preparing…" : "Download Resume"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="wh-empty">No resume on file.</p>
          )}
          {resumeError ? <div className="doc-error">{resumeError}</div> : null}
        </div>
      </section>

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
            <span className="field-label">Street Address</span>
            <p className="field-text">{applicant.addressLine1 ?? "—"}</p>
          </div>
          <div className="field">
            <span className="field-label">City</span>
            <p className="field-text">{applicant.city ?? "—"}</p>
          </div>
          <div className="field">
            <span className="field-label">State</span>
            <p className="field-text">
              {formatUsState(applicant.state) || "—"}
            </p>
          </div>
          <div className="field">
            <span className="field-label">ZIP Code</span>
            <p className="field-text">{applicant.postalCode ?? "—"}</p>
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
          <h2>Work History</h2>
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
                            ? ` · ${[wh.employerCity, formatUsState(wh.employerState)].filter(Boolean).join(", ")}`
                            : ""}
                        </p>
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
            <p className="wh-empty">No work history recorded.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Education</h2>
        </div>
        <div className="panel-body">
          {applicant.education && applicant.education.length > 0 ? (
            <div className="wh-list">
              {applicant.education.map((ed) => (
                <div key={ed.id} className="wh-card">
                  <div className="wh-card-head">
                    <div>
                      <p className="wh-title">
                        {ed.schoolName}
                        {ed.degree ? (
                          <span className="wh-employer"> &middot; {ed.degree}</span>
                        ) : null}
                      </p>
                      <p className="wh-meta">
                        {[
                          ed.fieldOfStudy,
                          [ed.city, formatUsState(ed.state)]
                            .filter(Boolean)
                            .join(", ") || null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="wh-grid">
                    <div className="wh-field">
                      <span className="field-label">Graduation</span>
                      <p className="field-text">
                        {ed.isCurrent
                          ? "Currently Attending"
                          : (formatDate(ed.graduationDate) ?? "—")}
                      </p>
                    </div>
                    {ed.gpa ? (
                      <div className="wh-field">
                        <span className="field-label">GPA</span>
                        <p className="field-text">{ed.gpa}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="wh-empty">No education recorded.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Certifications</h2>
        </div>
        <div className="panel-body">
          {applicant.certifications && applicant.certifications.length > 0 ? (
            <div className="wh-list">
              {applicant.certifications.map((ce) => (
                <div key={ce.id} className="wh-card">
                  <div className="wh-card-head">
                    <div>
                      <p className="wh-title">
                        {ce.name}
                        {ce.issuingOrganization ? (
                          <span className="wh-employer">
                            {" "}
                            &middot; {ce.issuingOrganization}
                          </span>
                        ) : null}
                      </p>
                      <p className="wh-meta">
                        {ce.doesNotExpire
                          ? "Does not expire"
                          : ce.expirationDate
                            ? `Expires ${formatDate(ce.expirationDate)}`
                            : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="wh-grid">
                    {ce.certificationNumber ? (
                      <div className="wh-field">
                        <span className="field-label">Certification Number</span>
                        <p className="field-text">{ce.certificationNumber}</p>
                      </div>
                    ) : null}
                    <div className="wh-field">
                      <span className="field-label">Issued</span>
                      <p className="field-text">
                        {formatDate(ce.issueDate) ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="wh-empty">No certifications recorded.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Military Service</h2>
        </div>
        <div className="panel-body">
          {applicant.militaryService &&
          applicant.militaryService.length > 0 ? (
            <div className="wh-list">
              {applicant.militaryService.map((mil) => (
                <div key={mil.id} className="wh-card">
                  <div className="wh-card-head">
                    <div>
                      <p className="wh-title">
                        {mil.branch || "Military Service"}
                        {mil.isVeteran ? (
                          <span className="wh-badge">Veteran</span>
                        ) : null}
                      </p>
                      <p className="wh-meta">
                        {[
                          mil.rank,
                          mil.serviceType
                            ? MILITARY_SERVICE_TYPE_LABELS[mil.serviceType]
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="wh-grid">
                    <div className="wh-field">
                      <span className="field-label">Veteran</span>
                      <p className="field-text">
                        {mil.isVeteran ? "Yes" : "No"}
                      </p>
                    </div>
                    <div className="wh-field">
                      <span className="field-label">Service Period</span>
                      <p className="field-text">
                        {(formatDate(mil.serviceStartDate) ?? "—") +
                          " \u2013 " +
                          (mil.isCurrent
                            ? "Present"
                            : (formatDate(mil.serviceEndDate) ?? "—"))}
                      </p>
                    </div>
                    {mil.occupationalSpecialty ? (
                      <div className="wh-field">
                        <span className="field-label">
                          Occupational Specialty
                        </span>
                        <p className="field-text">
                          {mil.occupationalSpecialty}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="wh-empty">No military service recorded.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Professional Memberships</h2>
        </div>
        <div className="panel-body">
          {applicant.memberships && applicant.memberships.length > 0 ? (
            <div className="wh-list">
              {applicant.memberships.map((mem) => (
                <div key={mem.id} className="wh-card">
                  <div className="wh-card-head">
                    <div>
                      <p className="wh-title">
                        {mem.organization}
                        {mem.membershipType ? (
                          <span className="wh-employer">
                            {" "}
                            &middot; {mem.membershipType}
                          </span>
                        ) : null}
                      </p>
                      <p className="wh-meta">
                        {(formatDate(mem.startDate) ?? "—") +
                          " \u2013 " +
                          (mem.isCurrent
                            ? "Present"
                            : (formatDate(mem.endDate) ?? "—"))}
                      </p>
                    </div>
                  </div>
                  {mem.membershipNumber ? (
                    <div className="wh-grid">
                      <div className="wh-field">
                        <span className="field-label">Membership Number</span>
                        <p className="field-text">{mem.membershipNumber}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="wh-empty">No professional memberships recorded.</p>
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

      <ContactInfoModal
        open={contactOpen}
        applicant={applicant}
        onClose={() => setContactOpen(false)}
        onSaved={(saved) => {
          // The update endpoint returns the scalar applicant only (no included
          // relations). Merge the refreshed scalar fields while preserving the
          // already-loaded historical collections and applications.
          setApplicant((prev) =>
            prev
              ? {
                  ...saved,
                  applications: prev.applications,
                  workHistory: prev.workHistory,
                  education: prev.education,
                  certifications: prev.certifications,
                  militaryService: prev.militaryService,
                  memberships: prev.memberships,
                }
              : saved,
          );
          setContactOpen(false);
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
        .rec-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
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
        .summary-value.mono {
          font-family: var(--font-geist-mono, monospace);
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
        .wh-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 8px;
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          vertical-align: middle;
        }
        .wh-meta {
          margin: 4px 0 0;
          font-size: 12px;
          color: #6b7280;
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
        .doc-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .doc-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 12px 14px;
          background: #fcfcfd;
        }
        .doc-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .doc-name {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
          word-break: break-word;
        }
        .doc-meta {
          font-size: 12px;
          color: #6b7280;
        }
        .doc-error {
          margin-top: 10px;
          font-size: 12px;
          color: #991b1b;
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
        @media (max-width: 1100px) {
          .rec-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .info-grid,
          .wh-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .rec-row,
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
