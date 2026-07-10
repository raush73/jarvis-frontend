"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { ApplicantFormModal } from "@/components/careers/ApplicantFormModal";
import { WorkHistoryFormModal } from "@/components/careers/WorkHistoryFormModal";
import { EducationFormModal } from "@/components/careers/EducationFormModal";
import { CertificationFormModal } from "@/components/careers/CertificationFormModal";
import { MilitaryServiceFormModal } from "@/components/careers/MilitaryServiceFormModal";
import { MembershipFormModal } from "@/components/careers/MembershipFormModal";
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
import {
  CertificationEntry,
  EducationEntry,
  MILITARY_SERVICE_TYPE_LABELS,
  MembershipEntry,
  MilitaryServiceEntry,
  deleteCertification,
  deleteEducation,
  deleteMembership,
  deleteMilitaryService,
} from "@/lib/careers/credentialsApi";

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

  // Education dialogs (V2.1.5C)
  const [edModalOpen, setEdModalOpen] = useState(false);
  const [edMode, setEdMode] = useState<"create" | "edit">("create");
  const [edEditing, setEdEditing] = useState<EducationEntry | null>(null);

  // Certification dialogs (V2.1.5C)
  const [ceModalOpen, setCeModalOpen] = useState(false);
  const [ceMode, setCeMode] = useState<"create" | "edit">("create");
  const [ceEditing, setCeEditing] = useState<CertificationEntry | null>(null);

  // Military Service dialogs (V2.1.5C)
  const [milModalOpen, setMilModalOpen] = useState(false);
  const [milMode, setMilMode] = useState<"create" | "edit">("create");
  const [milEditing, setMilEditing] = useState<MilitaryServiceEntry | null>(
    null,
  );

  // Membership dialogs (V2.1.5C)
  const [memModalOpen, setMemModalOpen] = useState(false);
  const [memMode, setMemMode] = useState<"create" | "edit">("create");
  const [memEditing, setMemEditing] = useState<MembershipEntry | null>(null);

  // Unified credential delete confirmation (V2.1.5C)
  const [credDeleting, setCredDeleting] = useState<{
    kind: "education" | "certification" | "military" | "membership";
    id: string;
    label: string;
  } | null>(null);
  const [credDeleteBusy, setCredDeleteBusy] = useState(false);
  const [credDeleteError, setCredDeleteError] = useState<string | null>(null);

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

  async function handleDeleteCredential() {
    if (!credDeleting) return;
    setCredDeleteBusy(true);
    setCredDeleteError(null);
    try {
      switch (credDeleting.kind) {
        case "education":
          await deleteEducation(credDeleting.id);
          break;
        case "certification":
          await deleteCertification(credDeleting.id);
          break;
        case "military":
          await deleteMilitaryService(credDeleting.id);
          break;
        case "membership":
          await deleteMembership(credDeleting.id);
          break;
      }
      setCredDeleting(null);
      await load();
    } catch (e) {
      setCredDeleteError(getApiErrorMessage(e, "Failed to delete entry."));
    } finally {
      setCredDeleteBusy(false);
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
        <div className="panel-header panel-header-row">
          <h2>Education</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEdMode("create");
              setEdEditing(null);
              setEdModalOpen(true);
            }}
          >
            Add Education
          </button>
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
                          [ed.city, ed.state].filter(Boolean).join(", ") ||
                            null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="wh-actions">
                      <button
                        type="button"
                        className="btn-mini"
                        onClick={() => {
                          setEdMode("edit");
                          setEdEditing(ed);
                          setEdModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-mini btn-mini-danger"
                        onClick={() => {
                          setCredDeleteError(null);
                          setCredDeleting({
                            kind: "education",
                            id: ed.id,
                            label: ed.schoolName,
                          });
                        }}
                      >
                        Delete
                      </button>
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
            <p className="wh-empty">No education recorded yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header panel-header-row">
          <h2>Certifications</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setCeMode("create");
              setCeEditing(null);
              setCeModalOpen(true);
            }}
          >
            Add Certification
          </button>
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
                    <div className="wh-actions">
                      <button
                        type="button"
                        className="btn-mini"
                        onClick={() => {
                          setCeMode("edit");
                          setCeEditing(ce);
                          setCeModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-mini btn-mini-danger"
                        onClick={() => {
                          setCredDeleteError(null);
                          setCredDeleting({
                            kind: "certification",
                            id: ce.id,
                            label: ce.name,
                          });
                        }}
                      >
                        Delete
                      </button>
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
            <p className="wh-empty">No certifications recorded yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header panel-header-row">
          <h2>Military Service</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setMilMode("create");
              setMilEditing(null);
              setMilModalOpen(true);
            }}
          >
            Add Military Service
          </button>
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
                    <div className="wh-actions">
                      <button
                        type="button"
                        className="btn-mini"
                        onClick={() => {
                          setMilMode("edit");
                          setMilEditing(mil);
                          setMilModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-mini btn-mini-danger"
                        onClick={() => {
                          setCredDeleteError(null);
                          setCredDeleting({
                            kind: "military",
                            id: mil.id,
                            label: mil.branch || "Military Service",
                          });
                        }}
                      >
                        Delete
                      </button>
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
            <p className="wh-empty">No military service recorded yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header panel-header-row">
          <h2>Professional Memberships</h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setMemMode("create");
              setMemEditing(null);
              setMemModalOpen(true);
            }}
          >
            Add Membership
          </button>
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
                    <div className="wh-actions">
                      <button
                        type="button"
                        className="btn-mini"
                        onClick={() => {
                          setMemMode("edit");
                          setMemEditing(mem);
                          setMemModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-mini btn-mini-danger"
                        onClick={() => {
                          setCredDeleteError(null);
                          setCredDeleting({
                            kind: "membership",
                            id: mem.id,
                            label: mem.organization,
                          });
                        }}
                      >
                        Delete
                      </button>
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
            <p className="wh-empty">No professional memberships recorded yet.</p>
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

      <EducationFormModal
        open={edModalOpen}
        mode={edMode}
        applicantId={applicant.id}
        entry={edEditing}
        onClose={() => setEdModalOpen(false)}
        onSaved={() => {
          setEdModalOpen(false);
          load();
        }}
      />

      <CertificationFormModal
        open={ceModalOpen}
        mode={ceMode}
        applicantId={applicant.id}
        entry={ceEditing}
        onClose={() => setCeModalOpen(false)}
        onSaved={() => {
          setCeModalOpen(false);
          load();
        }}
      />

      <MilitaryServiceFormModal
        open={milModalOpen}
        mode={milMode}
        applicantId={applicant.id}
        entry={milEditing}
        onClose={() => setMilModalOpen(false)}
        onSaved={() => {
          setMilModalOpen(false);
          load();
        }}
      />

      <MembershipFormModal
        open={memModalOpen}
        mode={memMode}
        applicantId={applicant.id}
        entry={memEditing}
        onClose={() => setMemModalOpen(false)}
        onSaved={() => {
          setMemModalOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={credDeleting != null}
        title="Delete Entry"
        message={
          credDeleting
            ? `Delete "${credDeleting.label}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        busy={credDeleteBusy}
        error={credDeleteError}
        onConfirm={handleDeleteCredential}
        onCancel={() => setCredDeleting(null)}
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
