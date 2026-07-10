"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CareersShell } from "@/components/careers/CareersShell";
import { StatusBadge } from "@/components/careers/StatusBadge";
import { useStaffDirectory } from "@/components/careers/useStaffDirectory";
import { formatDate, formatDateTime } from "@/lib/careers/format";
import { getApiErrorMessage } from "@/lib/careers/errors";
import { staffLabel } from "@/lib/careers/staffApi";
import { applicantName } from "@/lib/careers/applicantsApi";
import { postingTitle } from "@/lib/careers/jobPostingsApi";
import {
  SOURCE_LABELS,
  getResumeDownload,
} from "@/lib/careers/applicationsApi";
import {
  WORK_HISTORY_EMPLOYMENT_TYPE_LABELS,
  COMPENSATION_TYPE_LABELS,
  CONTACT_CONSENT_LABELS,
} from "@/lib/careers/workHistoryApi";
import { MILITARY_SERVICE_TYPE_LABELS } from "@/lib/careers/credentialsApi";
import {
  HIRING_RECOMMENDATIONS,
  HIRING_RECOMMENDATION_LABELS,
  HIRING_PIPELINE_STAGES,
  HIRING_PIPELINE_STAGE_LABELS,
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  HiringPipelineStage,
  HiringRecommendation,
  InterviewType,
  InterviewInput,
  ReviewApplication,
  TIMELINE_EVENT_LABELS,
  addHiringNote,
  addInterview,
  getReviewApplication,
  hiringRecommendationTone,
  hiringPipelineStageTone,
  setHiringRecommendation,
  setHiringPipelineStage,
  updateHiringNote,
  updateInterview,
} from "@/lib/careers/hiringReviewApi";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type InterviewFormState = {
  id: string | null;
  scheduledAt: string;
  interviewType: "" | InterviewType;
  interviewer: string;
  notes: string;
  completed: boolean;
  completedAt: string;
};

const EMPTY_INTERVIEW: InterviewFormState = {
  id: null,
  scheduledAt: "",
  interviewType: "",
  interviewer: "",
  notes: "",
  completed: false,
  completedAt: "",
};

export default function CareersReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { byId: staffById } = useStaffDirectory();

  const [review, setReview] = useState<ReviewApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stageBusy, setStageBusy] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const [mutError, setMutError] = useState<string | null>(null);

  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const [newNote, setNewNote] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [editNoteBody, setEditNoteBody] = useState("");

  const [ivForm, setIvForm] = useState<InterviewFormState | null>(null);
  const [ivBusy, setIvBusy] = useState(false);
  const [ivError, setIvError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setReview(await getReviewApplication(id));
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load application."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const staffName = useCallback(
    (uid: string | null): string => {
      if (!uid) return "\u2014";
      const user = staffById.get(uid);
      return user ? staffLabel(user) : uid.slice(0, 8);
    },
    [staffById],
  );

  const handleStage = async (stage: HiringPipelineStage) => {
    if (!review || stage === review.hiringPipelineStage) return;
    setStageBusy(true);
    setMutError(null);
    try {
      setReview(await setHiringPipelineStage(review.id, stage));
    } catch (e) {
      setMutError(getApiErrorMessage(e, "Failed to update status."));
    } finally {
      setStageBusy(false);
    }
  };

  const handleRecommendation = async (rec: HiringRecommendation | "") => {
    if (!review) return;
    setRecBusy(true);
    setMutError(null);
    try {
      setReview(
        await setHiringRecommendation(review.id, rec === "" ? null : rec),
      );
    } catch (e) {
      setMutError(getApiErrorMessage(e, "Failed to update recommendation."));
    } finally {
      setRecBusy(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!review?.resumeDocumentId) return;
    setResumeBusy(true);
    setResumeError(null);
    try {
      const info = await getResumeDownload(review.resumeDocumentId);
      window.open(info.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setResumeError(getApiErrorMessage(e, "Failed to prepare download."));
    } finally {
      setResumeBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!review || !newNote.trim()) return;
    setNoteBusy(true);
    setMutError(null);
    try {
      setReview(await addHiringNote(review.id, newNote.trim()));
      setNewNote("");
    } catch (e) {
      setMutError(getApiErrorMessage(e, "Failed to add note."));
    } finally {
      setNoteBusy(false);
    }
  };

  const handleSaveNoteEdit = async () => {
    if (!editNoteId || !editNoteBody.trim()) return;
    setNoteBusy(true);
    setMutError(null);
    try {
      setReview(await updateHiringNote(editNoteId, editNoteBody.trim()));
      setEditNoteId(null);
      setEditNoteBody("");
    } catch (e) {
      setMutError(getApiErrorMessage(e, "Failed to update note."));
    } finally {
      setNoteBusy(false);
    }
  };

  const handleSubmitInterview = async () => {
    if (!review || !ivForm) return;
    setIvBusy(true);
    setIvError(null);
    const input: InterviewInput = {
      scheduledAt: fromLocalInput(ivForm.scheduledAt),
      interviewType: ivForm.interviewType === "" ? null : ivForm.interviewType,
      interviewer: ivForm.interviewer.trim() || null,
      notes: ivForm.notes.trim() || null,
      completedAt: ivForm.completed
        ? fromLocalInput(ivForm.completedAt) ?? new Date().toISOString()
        : null,
    };
    try {
      const updated = ivForm.id
        ? await updateInterview(ivForm.id, input)
        : await addInterview(review.id, input);
      setReview(updated);
      setIvForm(null);
    } catch (e) {
      setIvError(getApiErrorMessage(e, "Failed to save interview."));
    } finally {
      setIvBusy(false);
    }
  };

  const timeline = review?.timeline ?? [];

  const profile = useMemo(() => review?.internalApplicant ?? null, [review]);

  if (loading) {
    return (
      <CareersShell
        title="Applicant Review"
        backHref="/careers/review"
        backLabel="Review"
      >
        <div className="state-block">Loading application…</div>
        <style jsx>{stateStyles}</style>
      </CareersShell>
    );
  }

  if (error || !review || !profile) {
    return (
      <CareersShell
        title="Applicant Review"
        backHref="/careers/review"
        backLabel="Review"
      >
        <div className="state-block state-error">
          {error ?? "Application not found."}
        </div>
        <style jsx>{stateStyles}</style>
      </CareersShell>
    );
  }

  const posting = review.jobPosting;

  return (
    <CareersShell
      title={applicantName(profile)}
      subtitle={postingTitle(posting)}
      backHref="/careers/review"
      backLabel="Review"
      actions={
        <>
          <StatusBadge
            label={HIRING_PIPELINE_STAGE_LABELS[review.hiringPipelineStage]}
            tone={hiringPipelineStageTone(review.hiringPipelineStage)}
          />
          {review.hiringRecommendation ? (
            <StatusBadge
              label={HIRING_RECOMMENDATION_LABELS[review.hiringRecommendation]}
              tone={hiringRecommendationTone(review.hiringRecommendation)}
            />
          ) : null}
          <Link
            href={`/careers/applicants/${profile.id}`}
            className="ghost-link"
          >
            Edit applicant
          </Link>
        </>
      }
    >
      {mutError ? <div className="banner-error">{mutError}</div> : null}

      {/* Summary header */}
      <section className="summary-card">
        <div className="summary-grid">
          <Info label="Email" value={profile.email} />
          <Info label="Phone" value={profile.phone} />
          <Info
            label="Location"
            value={[profile.city, profile.state].filter(Boolean).join(", ")}
          />
          <Info label="Applied" value={formatDate(review.submittedAt ?? review.createdAt)} />
          <Info
            label="Source"
            value={review.source ? SOURCE_LABELS[review.source] : null}
          />
          <div className="info">
            <span className="info-label">Indicators</span>
            <div className="chips">
              {review.internalApplicant.militaryService?.some(
                (m) => m.isVeteran,
              ) ? (
                <span className="chip chip-vet">Veteran</span>
              ) : null}
              <span className={`chip ${review.resumeDocument ? "chip-ok" : "chip-off"}`}>
                {review.resumeDocument ? "Resume on file" : "No resume"}
              </span>
              <span className="chip chip-muted">
                Profile {review.profileCompletion.percent}%
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="layout">
        {/* Main column */}
        <div className="main-col">
          <Panel title="Professional Profile">
            <Field label="Professional Summary" text={profile.professionalSummary} wide />
            <div className="field-grid">
              <Field label="Current Profession" text={profile.currentProfession} />
              <Field label="Desired Profession" text={profile.desiredProfession} />
            </div>
            <Field label="Long-Term Career Goals" text={profile.longTermGoals} wide />
            <div className="field-grid">
              <Field label="LinkedIn" text={profile.linkedinUrl} link />
              <Field label="Facebook" text={profile.facebookUrl} link />
            </div>
          </Panel>

          <Panel
            title="Work History"
            count={profile.workHistory?.length ?? 0}
          >
            {(profile.workHistory ?? []).length === 0 ? (
              <Empty text="No work history provided." />
            ) : (
              (profile.workHistory ?? []).map((w) => (
                <div className="entry" key={w.id}>
                  <div className="entry-head">
                    <strong>{w.jobTitle}</strong>
                    <span className="entry-dates">
                      {formatDate(w.startDate)} –{" "}
                      {w.isCurrent ? "Present" : w.endDate ? formatDate(w.endDate) : "—"}
                    </span>
                  </div>
                  <div className="entry-sub">
                    {w.employerName}
                    {[w.employerCity, w.employerState].filter(Boolean).length
                      ? ` · ${[w.employerCity, w.employerState].filter(Boolean).join(", ")}`
                      : ""}
                    {w.employmentType
                      ? ` · ${WORK_HISTORY_EMPLOYMENT_TYPE_LABELS[w.employmentType]}`
                      : ""}
                  </div>
                  <div className="entry-meta">
                    {w.supervisorName ? (
                      <span>
                        Supervisor: {w.supervisorName}
                        {w.supervisorTitle ? ` (${w.supervisorTitle})` : ""}
                      </span>
                    ) : null}
                    <span>May contact: {CONTACT_CONSENT_LABELS[w.contactConsent]}</span>
                    {w.compensationType ? (
                      <span>
                        Compensation: {COMPENSATION_TYPE_LABELS[w.compensationType]}
                        {w.startingCompensation ? ` (from ${w.startingCompensation}` : ""}
                        {w.endingCompensation ? ` to ${w.endingCompensation})` : w.startingCompensation ? ")" : ""}
                      </span>
                    ) : null}
                  </div>
                  {w.reasonForLeaving ? (
                    <p className="entry-note">Reason for leaving: {w.reasonForLeaving}</p>
                  ) : null}
                  {w.skillsUsed ? (
                    <p className="entry-note">Skills: {w.skillsUsed}</p>
                  ) : null}
                  {w.accomplishments ? (
                    <p className="entry-note">Accomplishments: {w.accomplishments}</p>
                  ) : null}
                </div>
              ))
            )}
          </Panel>

          <Panel title="Education" count={profile.education?.length ?? 0}>
            {(profile.education ?? []).length === 0 ? (
              <Empty text="No education provided." />
            ) : (
              (profile.education ?? []).map((e) => (
                <div className="entry" key={e.id}>
                  <div className="entry-head">
                    <strong>{e.schoolName}</strong>
                    <span className="entry-dates">
                      {e.isCurrent
                        ? "In progress"
                        : e.graduationDate
                          ? formatDate(e.graduationDate)
                          : "—"}
                    </span>
                  </div>
                  <div className="entry-sub">
                    {[e.degree, e.fieldOfStudy].filter(Boolean).join(", ") || "—"}
                    {[e.city, e.state].filter(Boolean).length
                      ? ` · ${[e.city, e.state].filter(Boolean).join(", ")}`
                      : ""}
                    {e.gpa ? ` · GPA ${e.gpa}` : ""}
                  </div>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Certifications" count={profile.certifications?.length ?? 0}>
            {(profile.certifications ?? []).length === 0 ? (
              <Empty text="No certifications provided." />
            ) : (
              (profile.certifications ?? []).map((c) => (
                <div className="entry" key={c.id}>
                  <div className="entry-head">
                    <strong>{c.name}</strong>
                    <span className="entry-dates">
                      {c.doesNotExpire
                        ? "No expiration"
                        : c.expirationDate
                          ? `Expires ${formatDate(c.expirationDate)}`
                          : "—"}
                    </span>
                  </div>
                  <div className="entry-sub">
                    {c.issuingOrganization ?? "—"}
                    {c.certificationNumber ? ` · #${c.certificationNumber}` : ""}
                    {c.issueDate ? ` · Issued ${formatDate(c.issueDate)}` : ""}
                  </div>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Military Service" count={profile.militaryService?.length ?? 0}>
            {(profile.militaryService ?? []).length === 0 ? (
              <Empty text="No military service provided." />
            ) : (
              (profile.militaryService ?? []).map((m) => (
                <div className="entry" key={m.id}>
                  <div className="entry-head">
                    <strong>{m.branch ?? "Military Service"}</strong>
                    <span className="entry-dates">
                      {m.serviceStartDate ? formatDate(m.serviceStartDate) : "—"}
                      {" – "}
                      {m.isCurrent
                        ? "Present"
                        : m.serviceEndDate
                          ? formatDate(m.serviceEndDate)
                          : "—"}
                    </span>
                  </div>
                  <div className="entry-sub">
                    {m.isVeteran ? "Veteran" : "Non-veteran"}
                    {m.serviceType
                      ? ` · ${MILITARY_SERVICE_TYPE_LABELS[m.serviceType]}`
                      : ""}
                    {m.rank ? ` · ${m.rank}` : ""}
                    {m.occupationalSpecialty ? ` · ${m.occupationalSpecialty}` : ""}
                  </div>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Professional Memberships" count={profile.memberships?.length ?? 0}>
            {(profile.memberships ?? []).length === 0 ? (
              <Empty text="No memberships provided." />
            ) : (
              (profile.memberships ?? []).map((m) => (
                <div className="entry" key={m.id}>
                  <div className="entry-head">
                    <strong>{m.organization}</strong>
                    <span className="entry-dates">
                      {m.startDate ? formatDate(m.startDate) : "—"}
                      {m.isCurrent
                        ? " – Present"
                        : m.endDate
                          ? ` – ${formatDate(m.endDate)}`
                          : ""}
                    </span>
                  </div>
                  <div className="entry-sub">
                    {[m.membershipType, m.membershipNumber ? `#${m.membershipNumber}` : ""]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Resume & Application">
            <div className="resume-row">
              <div>
                <span className="info-label">Resume</span>
                {review.resumeDocument ? (
                  <p className="info-value">{review.resumeDocument.fileName}</p>
                ) : (
                  <p className="empty-text">No resume on file.</p>
                )}
              </div>
              {review.resumeDocument ? (
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
            <div className="divider" />
            <Field
              label="Why they are interested (Cover Note)"
              text={review.coverNote}
              wide
            />
          </Panel>
        </div>

        {/* Sidebar */}
        <div className="side-col">
          <Panel title="Application Status">
            <label className="control-label">Hiring Status</label>
            <select
              className="side-select"
              value={review.hiringPipelineStage}
              disabled={stageBusy}
              onChange={(e) => handleStage(e.target.value as HiringPipelineStage)}
            >
              {HIRING_PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {HIRING_PIPELINE_STAGE_LABELS[s]}
                </option>
              ))}
            </select>
            <p className="control-hint">
              Manually set; independent of the core application lifecycle. No
              automation is triggered.
            </p>
          </Panel>

          <Panel title="Hiring Recommendation">
            <label className="control-label">Recommendation</label>
            <select
              className="side-select"
              value={review.hiringRecommendation ?? ""}
              disabled={recBusy}
              onChange={(e) =>
                handleRecommendation(e.target.value as HiringRecommendation | "")
              }
            >
              <option value="">— No recommendation —</option>
              {HIRING_RECOMMENDATIONS.map((r) => (
                <option key={r} value={r}>
                  {HIRING_RECOMMENDATION_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="control-hint">Advisory only. No workflow is enforced.</p>
          </Panel>

          <Panel title="Hiring Notes" count={review.notes.length}>
            <p className="notes-privacy">Internal only — never shown to applicants.</p>
            <textarea
              className="note-input"
              placeholder="Add an internal hiring note…"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
            />
            <div className="note-actions">
              <button
                type="button"
                className="btn-primary sm"
                onClick={handleAddNote}
                disabled={noteBusy || !newNote.trim()}
              >
                {noteBusy ? "Saving…" : "Add Note"}
              </button>
            </div>
            <div className="notes-list">
              {review.notes.length === 0 ? (
                <Empty text="No notes yet." />
              ) : (
                review.notes.map((n) => (
                  <div className="note-card" key={n.id}>
                    {editNoteId === n.id ? (
                      <>
                        <textarea
                          className="note-input"
                          value={editNoteBody}
                          onChange={(e) => setEditNoteBody(e.target.value)}
                          rows={3}
                        />
                        <div className="note-actions">
                          <button
                            type="button"
                            className="btn-primary sm"
                            onClick={handleSaveNoteEdit}
                            disabled={noteBusy || !editNoteBody.trim()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-ghost sm"
                            onClick={() => {
                              setEditNoteId(null);
                              setEditNoteBody("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="note-body">{n.body}</p>
                        <div className="note-foot">
                          <span>
                            {staffName(n.authorUserId)} ·{" "}
                            {formatDateTime(n.createdAt)}
                            {n.updatedAt !== n.createdAt ? " (edited)" : ""}
                          </span>
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => {
                              setEditNoteId(n.id);
                              setEditNoteBody(n.body);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Interviews" count={review.interviews.length}>
            {ivForm ? (
              <div className="iv-form">
                <label className="control-label">Date &amp; Time</label>
                <input
                  type="datetime-local"
                  className="side-input"
                  value={ivForm.scheduledAt}
                  onChange={(e) =>
                    setIvForm({ ...ivForm, scheduledAt: e.target.value })
                  }
                />
                <label className="control-label">Type</label>
                <select
                  className="side-select"
                  value={ivForm.interviewType}
                  onChange={(e) =>
                    setIvForm({
                      ...ivForm,
                      interviewType: e.target.value as "" | InterviewType,
                    })
                  }
                >
                  <option value="">— Select —</option>
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {INTERVIEW_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <label className="control-label">Interviewer</label>
                <input
                  type="text"
                  className="side-input"
                  placeholder="Name"
                  value={ivForm.interviewer}
                  onChange={(e) =>
                    setIvForm({ ...ivForm, interviewer: e.target.value })
                  }
                />
                <label className="control-label">Internal Notes</label>
                <textarea
                  className="note-input"
                  rows={3}
                  value={ivForm.notes}
                  onChange={(e) => setIvForm({ ...ivForm, notes: e.target.value })}
                />
                <label className="iv-check">
                  <input
                    type="checkbox"
                    checked={ivForm.completed}
                    onChange={(e) =>
                      setIvForm({
                        ...ivForm,
                        completed: e.target.checked,
                        completedAt:
                          e.target.checked && !ivForm.completedAt
                            ? toLocalInput(new Date().toISOString())
                            : ivForm.completedAt,
                      })
                    }
                  />
                  Mark completed
                </label>
                {ivForm.completed ? (
                  <input
                    type="datetime-local"
                    className="side-input"
                    value={ivForm.completedAt}
                    onChange={(e) =>
                      setIvForm({ ...ivForm, completedAt: e.target.value })
                    }
                  />
                ) : null}
                {ivError ? <div className="inline-error">{ivError}</div> : null}
                <div className="note-actions">
                  <button
                    type="button"
                    className="btn-primary sm"
                    onClick={handleSubmitInterview}
                    disabled={ivBusy}
                  >
                    {ivBusy ? "Saving…" : ivForm.id ? "Save" : "Add Interview"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost sm"
                    onClick={() => setIvForm(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-secondary full"
                onClick={() => {
                  setIvError(null);
                  setIvForm({ ...EMPTY_INTERVIEW });
                }}
              >
                + Log Interview
              </button>
            )}

            <div className="iv-list">
              {review.interviews.length === 0 ? (
                <Empty text="No interviews recorded." />
              ) : (
                review.interviews.map((iv) => (
                  <div className="iv-card" key={iv.id}>
                    <div className="iv-head">
                      <strong>
                        {iv.interviewType
                          ? INTERVIEW_TYPE_LABELS[iv.interviewType]
                          : "Interview"}
                      </strong>
                      <span
                        className={`iv-tag ${iv.completedAt ? "done" : "sched"}`}
                      >
                        {iv.completedAt ? "Completed" : "Scheduled"}
                      </span>
                    </div>
                    <div className="iv-sub">
                      {iv.scheduledAt ? formatDateTime(iv.scheduledAt) : "No date"}
                      {iv.interviewer ? ` · ${iv.interviewer}` : ""}
                    </div>
                    {iv.notes ? <p className="iv-notes">{iv.notes}</p> : null}
                    <div className="iv-foot">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => {
                          setIvError(null);
                          setIvForm({
                            id: iv.id,
                            scheduledAt: toLocalInput(iv.scheduledAt),
                            interviewType: iv.interviewType ?? "",
                            interviewer: iv.interviewer ?? "",
                            notes: iv.notes ?? "",
                            completed: !!iv.completedAt,
                            completedAt: toLocalInput(iv.completedAt),
                          });
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel title="Hiring Timeline">
            <div className="timeline">
              {timeline.length === 0 ? (
                <Empty text="No timeline events yet." />
              ) : (
                timeline.map((ev, i) => (
                  <div className="tl-item" key={`${ev.type}-${ev.at}-${i}`}>
                    <span className="tl-dot" />
                    <div className="tl-body">
                      <span className="tl-label">
                        {TIMELINE_EVENT_LABELS[ev.type]}
                      </span>
                      {ev.detail ? (
                        <span className="tl-detail">{ev.detail}</span>
                      ) : null}
                      <span className="tl-meta">
                        {formatDateTime(ev.at)}
                        {ev.actorUserId ? ` · ${staffName(ev.actorUserId)}` : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      <StyleBlock />
    </CareersShell>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="info">
      <span className="info-label">{label}</span>
      <span className="info-value">{value && value.trim() ? value : "—"}</span>
    </div>
  );
}

function Field({
  label,
  text,
  wide,
  link,
}: {
  label: string;
  text: string | null;
  wide?: boolean;
  link?: boolean;
}) {
  return (
    <div className={`field ${wide ? "wide" : ""}`}>
      <span className="info-label">{label}</span>
      {text && text.trim() ? (
        link ? (
          <a
            className="field-link"
            href={text}
            target="_blank"
            rel="noopener noreferrer"
          >
            {text}
          </a>
        ) : (
          <p className="field-text">{text}</p>
        )
      ) : (
        <p className="empty-text">—</p>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="empty-text">{text}</p>;
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {count !== undefined ? <span className="panel-count">{count}</span> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

const stateStyles = `
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

function StyleBlock() {
  return (
    <style jsx global>{`
      .ghost-link {
        display: inline-block;
        background: #ffffff;
        color: #374151;
        border: 1px solid #e5e7eb;
        border-radius: 7px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        text-decoration: none;
      }
      .ghost-link:hover {
        background: #f1f5f9;
      }
      .banner-error {
        background: #fff1f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        font-size: 13px;
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 16px;
      }
      .summary-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 18px;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }
      .info {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .info-label {
        font-size: 11px;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }
      .info-value {
        font-size: 13px;
        color: #111827;
        word-break: break-word;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        font-size: 11px;
        font-weight: 700;
        border-radius: 999px;
        padding: 2px 9px;
      }
      .chip-vet {
        background: #eef2ff;
        color: #3730a3;
        border: 1px solid #c7d2fe;
      }
      .chip-ok {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }
      .chip-off {
        background: #f8fafc;
        color: #6b7280;
        border: 1px solid #e5e7eb;
      }
      .chip-muted {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 18px;
        align-items: start;
      }
      .main-col,
      .side-col {
        display: flex;
        flex-direction: column;
        gap: 18px;
        min-width: 0;
      }
      .panel {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        overflow: hidden;
      }
      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
      }
      .panel-header h2 {
        font-size: 15px;
        font-weight: 700;
        color: #111827;
        margin: 0;
      }
      .panel-count {
        font-size: 12px;
        font-weight: 700;
        color: #6b7280;
        background: #f1f5f9;
        border-radius: 999px;
        padding: 1px 9px;
      }
      .panel-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .field-text {
        font-size: 13px;
        color: #111827;
        line-height: 1.6;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .field-link {
        font-size: 13px;
        color: #2563eb;
        text-decoration: none;
        word-break: break-all;
      }
      .field-link:hover {
        text-decoration: underline;
      }
      .empty-text {
        font-size: 13px;
        color: #9ca3af;
        font-style: italic;
        margin: 0;
      }
      .entry {
        border: 1px solid #eef2f7;
        border-radius: 8px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .entry-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
      }
      .entry-head strong {
        font-size: 13.5px;
        color: #111827;
      }
      .entry-dates {
        font-size: 12px;
        color: #6b7280;
        white-space: nowrap;
      }
      .entry-sub {
        font-size: 12.5px;
        color: #374151;
      }
      .entry-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        font-size: 12px;
        color: #6b7280;
      }
      .entry-note {
        font-size: 12.5px;
        color: #374151;
        margin: 2px 0 0;
        line-height: 1.5;
      }
      .resume-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .divider {
        height: 1px;
        background: #f1f5f9;
      }
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
        opacity: 0.55;
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
      }
      .btn-secondary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-secondary.full {
        width: 100%;
      }
      .btn-ghost {
        background: transparent;
        color: #6b7280;
        border: 1px solid #e5e7eb;
        border-radius: 7px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-ghost:hover {
        background: #f8fafc;
      }
      .sm {
        padding: 6px 12px;
        font-size: 12.5px;
      }
      .inline-error {
        background: #fff1f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        font-size: 12.5px;
        border-radius: 6px;
        padding: 8px 10px;
      }
      .control-label {
        font-size: 11px;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }
      .control-hint {
        font-size: 11.5px;
        color: #9ca3af;
        margin: 0;
        line-height: 1.5;
      }
      .side-select,
      .side-input {
        width: 100%;
        height: 36px;
        padding: 0 10px;
        font-size: 13px;
        color: #111827;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 7px;
      }
      .side-select:focus,
      .side-input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
      .notes-privacy {
        font-size: 11.5px;
        color: #b45309;
        background: #fffbeb;
        border: 1px solid #fde68a;
        border-radius: 6px;
        padding: 6px 9px;
        margin: 0;
      }
      .note-input {
        width: 100%;
        padding: 8px 10px;
        font-size: 13px;
        color: #111827;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 7px;
        resize: vertical;
        font-family: inherit;
      }
      .note-input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
      .note-actions {
        display: flex;
        gap: 8px;
      }
      .notes-list,
      .iv-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .note-card,
      .iv-card {
        border: 1px solid #eef2f7;
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .note-body {
        font-size: 13px;
        color: #111827;
        line-height: 1.55;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .note-foot,
      .iv-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 11.5px;
        color: #9ca3af;
      }
      .link-btn {
        background: none;
        border: none;
        color: #2563eb;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
      }
      .link-btn:hover {
        text-decoration: underline;
      }
      .iv-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .iv-check {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 12.5px;
        color: #374151;
        cursor: pointer;
      }
      .iv-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .iv-head strong {
        font-size: 13px;
        color: #111827;
      }
      .iv-tag {
        font-size: 10.5px;
        font-weight: 700;
        border-radius: 999px;
        padding: 1px 8px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .iv-tag.done {
        background: #ecfdf5;
        color: #065f46;
      }
      .iv-tag.sched {
        background: #eff6ff;
        color: #1d4ed8;
      }
      .iv-sub {
        font-size: 12.5px;
        color: #374151;
      }
      .iv-notes {
        font-size: 12.5px;
        color: #4b5563;
        margin: 0;
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .timeline {
        display: flex;
        flex-direction: column;
      }
      .tl-item {
        display: flex;
        gap: 10px;
        padding-bottom: 14px;
        position: relative;
      }
      .tl-item:not(:last-child)::before {
        content: "";
        position: absolute;
        left: 4px;
        top: 12px;
        bottom: 0;
        width: 1px;
        background: #e5e7eb;
      }
      .tl-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #2563eb;
        margin-top: 3px;
        flex-shrink: 0;
        z-index: 1;
      }
      .tl-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tl-label {
        font-size: 13px;
        font-weight: 600;
        color: #111827;
      }
      .tl-detail {
        font-size: 12px;
        color: #4b5563;
        word-break: break-word;
      }
      .tl-meta {
        font-size: 11.5px;
        color: #9ca3af;
      }
      @media (max-width: 1080px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 560px) {
        .summary-grid,
        .field-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}
