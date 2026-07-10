"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  WORK_HISTORY_EMPLOYMENT_TYPES,
  WORK_HISTORY_EMPLOYMENT_TYPE_LABELS,
  COMPENSATION_TYPES,
  COMPENSATION_TYPE_LABELS,
  CONTACT_CONSENTS,
  CONTACT_CONSENT_LABELS,
  type CompensationType,
  type WorkHistoryContactConsent,
  type WorkHistoryEmploymentType,
} from "@/lib/careers/workHistoryApi";
import {
  MILITARY_SERVICE_TYPES,
  MILITARY_SERVICE_TYPE_LABELS,
  type MilitaryServiceType,
} from "@/lib/careers/credentialsApi";
import {
  PublicApplyConfig,
  PublicApplyError,
  PublicApplicationInput,
  PublicJobPosting,
  createPublicResumeUpload,
  getPublicApplyConfig,
  getPublicJob,
  submitPublicApplication,
  uploadResumeBytes,
} from "@/lib/careers/publicCareersApi";

// Local draft shapes: all text inputs are strings; converted at submit.
type WHDraft = {
  _key: string;
  employerName: string;
  employerCity: string;
  employerState: string;
  jobTitle: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  startingCompensation: string;
  endingCompensation: string;
  compensationType: string;
  supervisorName: string;
  supervisorTitle: string;
  supervisorPhone: string;
  supervisorEmail: string;
  contactConsent: string;
  reasonForLeaving: string;
  skillsUsed: string;
  accomplishments: string;
};
type EdDraft = {
  _key: string;
  schoolName: string;
  city: string;
  state: string;
  degree: string;
  fieldOfStudy: string;
  graduationDate: string;
  isCurrent: boolean;
  gpa: string;
};
type CeDraft = {
  _key: string;
  name: string;
  issuingOrganization: string;
  certificationNumber: string;
  issueDate: string;
  expirationDate: string;
  doesNotExpire: boolean;
};
type MilDraft = {
  _key: string;
  isVeteran: boolean;
  serviceType: string;
  branch: string;
  rank: string;
  occupationalSpecialty: string;
  serviceStartDate: string;
  serviceEndDate: string;
  isCurrent: boolean;
};
type MemDraft = {
  _key: string;
  organization: string;
  membershipType: string;
  membershipNumber: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const newWH = (): WHDraft => ({
  _key: uid(),
  employerName: "",
  employerCity: "",
  employerState: "",
  jobTitle: "",
  employmentType: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  startingCompensation: "",
  endingCompensation: "",
  compensationType: "",
  supervisorName: "",
  supervisorTitle: "",
  supervisorPhone: "",
  supervisorEmail: "",
  contactConsent: "NOT_AUTHORIZED",
  reasonForLeaving: "",
  skillsUsed: "",
  accomplishments: "",
});
const newEd = (): EdDraft => ({
  _key: uid(),
  schoolName: "",
  city: "",
  state: "",
  degree: "",
  fieldOfStudy: "",
  graduationDate: "",
  isCurrent: false,
  gpa: "",
});
const newCe = (): CeDraft => ({
  _key: uid(),
  name: "",
  issuingOrganization: "",
  certificationNumber: "",
  issueDate: "",
  expirationDate: "",
  doesNotExpire: false,
});
const newMil = (): MilDraft => ({
  _key: uid(),
  isVeteran: false,
  serviceType: "",
  branch: "",
  rank: "",
  occupationalSpecialty: "",
  serviceStartDate: "",
  serviceEndDate: "",
  isCurrent: false,
});
const newMem = (): MemDraft => ({
  _key: uid(),
  organization: "",
  membershipType: "",
  membershipNumber: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
});

const strOrNull = (s: string): string | null => s.trim() || null;
const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const STEP_TITLES = [
  "Identity",
  "Work History",
  "Education",
  "Credentials",
  "Resume",
  "Questions",
  "Review",
];

type LoadState = "loading" | "ready" | "notfound" | "error";

export default function PublicApplyPage() {
  const params = useParams<{ publicCode: string }>();
  const publicCode = params?.publicCode ?? "";

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [job, setJob] = useState<PublicJobPosting | null>(null);
  const [config, setConfig] = useState<PublicApplyConfig | null>(null);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ field: string; label: string }[]>(
    [],
  );
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // Identity / profile
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [professionalSummary, setProfessionalSummary] = useState("");
  const [currentProfession, setCurrentProfession] = useState("");
  const [desiredProfession, setDesiredProfession] = useState("");
  const [longTermGoals, setLongTermGoals] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // Collections
  const [workHistory, setWorkHistory] = useState<WHDraft[]>([]);
  const [education, setEducation] = useState<EdDraft[]>([]);
  const [certifications, setCertifications] = useState<CeDraft[]>([]);
  const [military, setMilitary] = useState<MilDraft[]>([]);
  const [memberships, setMemberships] = useState<MemDraft[]>([]);

  // Resume
  const [resumeDoc, setResumeDoc] = useState<{
    documentId: string;
    fileName: string;
  } | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Questions
  const [interestReason, setInterestReason] = useState("");

  const load = useCallback(async () => {
    if (!publicCode) return;
    setLoadState("loading");
    try {
      const [j, c] = await Promise.all([
        getPublicJob(publicCode),
        getPublicApplyConfig(),
      ]);
      if (!j) {
        setLoadState("notfound");
        return;
      }
      setJob(j);
      setConfig(c);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [publicCode]);

  useEffect(() => {
    load();
  }, [load]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const step1Valid = useMemo(() => {
    if (!emailValid) return false;
    if (!config) return true;
    if (config.requirePhone && !phone.trim()) return false;
    if (config.requireLocation && (!city.trim() || !state.trim())) return false;
    if (config.requireProfessionalSummary && !professionalSummary.trim())
      return false;
    if (config.requireCurrentProfession && !currentProfession.trim())
      return false;
    if (config.requireDesiredProfession && !desiredProfession.trim())
      return false;
    if (config.requireLongTermGoals && !longTermGoals.trim()) return false;
    if (config.requireFacebookUrl && !facebookUrl.trim()) return false;
    if (config.requireLinkedinUrl && !linkedinUrl.trim()) return false;
    return true;
  }, [
    emailValid,
    config,
    phone,
    city,
    state,
    professionalSummary,
    currentProfession,
    desiredProfession,
    longTermGoals,
    facebookUrl,
    linkedinUrl,
  ]);

  const resumeStepValid = !config?.requireResume || !!resumeDoc;

  const collectComp = config?.collectCompensationHistory ?? true;

  const canProceed =
    step === 1 ? step1Valid : step === 5 ? resumeStepValid : true;

  function req(on: boolean | undefined) {
    return on ? <span className="wz-req"> *</span> : null;
  }

  async function handleResumeSelect(file: File | null) {
    if (!file) return;
    setResumeError(null);
    setResumeUploading(true);
    try {
      const presigned = await createPublicResumeUpload({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      await uploadResumeBytes(presigned.upload, file);
      setResumeDoc({
        documentId: presigned.documentId,
        fileName: presigned.fileName,
      });
    } catch (e) {
      setResumeError(
        e instanceof Error ? e.message : "Failed to upload resume.",
      );
      setResumeDoc(null);
    } finally {
      setResumeUploading(false);
    }
  }

  function buildPayload(): PublicApplicationInput {
    return {
      email: email.trim(),
      firstName: strOrNull(firstName),
      lastName: strOrNull(lastName),
      phone: strOrNull(phone),
      city: strOrNull(city),
      state: strOrNull(state),
      professionalSummary: strOrNull(professionalSummary),
      currentProfession: strOrNull(currentProfession),
      desiredProfession: strOrNull(desiredProfession),
      longTermGoals: strOrNull(longTermGoals),
      facebookUrl: strOrNull(facebookUrl),
      linkedinUrl: strOrNull(linkedinUrl),
      workHistory: workHistory
        .filter(
          (e) => e.employerName.trim() && e.jobTitle.trim() && e.startDate,
        )
        .map((e) => ({
          employerName: e.employerName.trim(),
          employerCity: strOrNull(e.employerCity),
          employerState: strOrNull(e.employerState),
          jobTitle: e.jobTitle.trim(),
          employmentType: (e.employmentType ||
            null) as WorkHistoryEmploymentType | null,
          startDate: e.startDate,
          endDate: e.isCurrent ? null : e.endDate || null,
          isCurrent: e.isCurrent,
          startingCompensation: collectComp
            ? numOrNull(e.startingCompensation)
            : null,
          endingCompensation: collectComp
            ? numOrNull(e.endingCompensation)
            : null,
          compensationType: collectComp
            ? ((e.compensationType || null) as CompensationType | null)
            : null,
          supervisorName: strOrNull(e.supervisorName),
          supervisorTitle: strOrNull(e.supervisorTitle),
          supervisorPhone: strOrNull(e.supervisorPhone),
          supervisorEmail: strOrNull(e.supervisorEmail),
          contactConsent: (e.contactConsent ||
            "NOT_AUTHORIZED") as WorkHistoryContactConsent,
          reasonForLeaving: strOrNull(e.reasonForLeaving),
          skillsUsed: strOrNull(e.skillsUsed),
          accomplishments: strOrNull(e.accomplishments),
        })),
      education: education
        .filter((e) => e.schoolName.trim())
        .map((e) => ({
          schoolName: e.schoolName.trim(),
          city: strOrNull(e.city),
          state: strOrNull(e.state),
          degree: strOrNull(e.degree),
          fieldOfStudy: strOrNull(e.fieldOfStudy),
          graduationDate: e.graduationDate || null,
          isCurrent: e.isCurrent,
          gpa: numOrNull(e.gpa),
        })),
      certifications: certifications
        .filter((e) => e.name.trim())
        .map((e) => ({
          name: e.name.trim(),
          issuingOrganization: strOrNull(e.issuingOrganization),
          certificationNumber: strOrNull(e.certificationNumber),
          issueDate: e.issueDate || null,
          expirationDate: e.doesNotExpire ? null : e.expirationDate || null,
          doesNotExpire: e.doesNotExpire,
        })),
      militaryService: military
        .filter(
          (e) =>
            e.isVeteran ||
            e.serviceType ||
            e.branch.trim() ||
            e.rank.trim() ||
            e.occupationalSpecialty.trim() ||
            e.serviceStartDate ||
            e.serviceEndDate ||
            e.isCurrent,
        )
        .map((e) => ({
          isVeteran: e.isVeteran,
          serviceType: (e.serviceType || null) as MilitaryServiceType | null,
          branch: strOrNull(e.branch),
          rank: strOrNull(e.rank),
          occupationalSpecialty: strOrNull(e.occupationalSpecialty),
          serviceStartDate: e.serviceStartDate || null,
          serviceEndDate: e.isCurrent ? null : e.serviceEndDate || null,
          isCurrent: e.isCurrent,
        })),
      memberships: memberships
        .filter((e) => e.organization.trim())
        .map((e) => ({
          organization: e.organization.trim(),
          membershipType: strOrNull(e.membershipType),
          membershipNumber: strOrNull(e.membershipNumber),
          startDate: e.startDate || null,
          endDate: e.isCurrent ? null : e.endDate || null,
          isCurrent: e.isCurrent,
        })),
      interestReason: strOrNull(interestReason),
      resumeDocumentId: resumeDoc?.documentId ?? null,
    };
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    setMissing([]);
    try {
      const result = await submitPublicApplication(publicCode, buildPayload());
      setSubmittedAt(result.submittedAt);
    } catch (e) {
      if (e instanceof PublicApplyError) {
        setSubmitError(e.message);
        if (e.missing && e.missing.length > 0) {
          setMissing(e.missing);
          // Missing profile fields live on step 1; guide the applicant back.
          setStep(1);
        }
      } else {
        setSubmitError(
          e instanceof Error ? e.message : "Failed to submit application.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Rendering ----------------------------------------------------------
  if (loadState === "loading") {
    return (
      <Shell>
        <div className="wz-state">Loading application…</div>
      </Shell>
    );
  }
  if (loadState === "notfound") {
    return (
      <Shell>
        <div className="wz-state">
          <h1 className="wz-state-title">Position unavailable</h1>
          <p className="wz-state-text">
            This job posting is no longer accepting applications.
          </p>
        </div>
      </Shell>
    );
  }
  if (loadState === "error") {
    return (
      <Shell>
        <div className="wz-state">
          <h1 className="wz-state-title">Something went wrong</h1>
          <p className="wz-state-text">Please try again later.</p>
        </div>
      </Shell>
    );
  }

  if (submittedAt) {
    return (
      <Shell>
        <div className="wz-state">
          <div className="wz-check">✓</div>
          <h1 className="wz-state-title">Application submitted</h1>
          <p className="wz-state-text">
            Thank you for applying to {job?.title ?? "this position"}. We have
            received your application and will be in touch.
          </p>
          <p className="wz-ref">Reference: {publicCode}</p>
          <a className="wz-link" href={`/jobs/${encodeURIComponent(publicCode)}`}>
            Back to posting
          </a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="wz-head">
        <h1 className="wz-title">Apply: {job?.title ?? "Open Position"}</h1>
        <p className="wz-sub">Reference: {publicCode}</p>
      </div>

      <ol className="wz-steps">
        {STEP_TITLES.map((t, i) => {
          const n = i + 1;
          const cls =
            n === step ? "current" : n < step ? "done" : "upcoming";
          return (
            <li key={t} className={`wz-step ${cls}`}>
              <span className="wz-step-num">{n}</span>
              <span className="wz-step-label">{t}</span>
            </li>
          );
        })}
      </ol>

      <div className="wz-card">
        {step === 1 ? (
          <section className="wz-sec">
            <h2 className="wz-sec-title">Your Information</h2>
            {missing.length > 0 ? (
              <div className="wz-error">
                Please complete the required fields:{" "}
                {missing.map((m) => m.label).join(", ")}.
              </div>
            ) : null}
            <div className="wz-grid">
              <label className="wz-field">
                <span className="wz-label">
                  First Name
                </span>
                <input
                  className="wz-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={120}
                />
              </label>
              <label className="wz-field">
                <span className="wz-label">Last Name</span>
                <input
                  className="wz-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={120}
                />
              </label>
            </div>
            <label className="wz-field">
              <span className="wz-label">
                Email<span className="wz-req"> *</span>
              </span>
              <input
                className="wz-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                placeholder="you@example.com"
              />
            </label>
            <div className="wz-grid">
              <label className="wz-field">
                <span className="wz-label">
                  Phone{req(config?.requirePhone)}
                </span>
                <input
                  className="wz-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={50}
                />
              </label>
              <div className="wz-grid wz-grid-tight">
                <label className="wz-field">
                  <span className="wz-label">
                    City{req(config?.requireLocation)}
                  </span>
                  <input
                    className="wz-input"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={120}
                  />
                </label>
                <label className="wz-field">
                  <span className="wz-label">
                    State{req(config?.requireLocation)}
                  </span>
                  <input
                    className="wz-input"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    maxLength={120}
                  />
                </label>
              </div>
            </div>
            <label className="wz-field">
              <span className="wz-label">
                Professional Summary
                {req(config?.requireProfessionalSummary)}
              </span>
              <textarea
                className="wz-textarea"
                value={professionalSummary}
                onChange={(e) => setProfessionalSummary(e.target.value)}
                maxLength={5000}
                rows={4}
              />
            </label>
            <h3 className="wz-subhead">Career Goals</h3>
            <div className="wz-grid">
              <label className="wz-field">
                <span className="wz-label">
                  Current Profession
                  {req(config?.requireCurrentProfession)}
                </span>
                <input
                  className="wz-input"
                  value={currentProfession}
                  onChange={(e) => setCurrentProfession(e.target.value)}
                  maxLength={200}
                />
              </label>
              <label className="wz-field">
                <span className="wz-label">
                  Desired Profession
                  {req(config?.requireDesiredProfession)}
                </span>
                <input
                  className="wz-input"
                  value={desiredProfession}
                  onChange={(e) => setDesiredProfession(e.target.value)}
                  maxLength={200}
                />
              </label>
            </div>
            <label className="wz-field">
              <span className="wz-label">
                Long-Term Career Goals
                {req(config?.requireLongTermGoals)}
              </span>
              <textarea
                className="wz-textarea"
                value={longTermGoals}
                onChange={(e) => setLongTermGoals(e.target.value)}
                maxLength={5000}
                rows={3}
              />
            </label>
            <h3 className="wz-subhead">Social Profiles</h3>
            <div className="wz-grid">
              <label className="wz-field">
                <span className="wz-label">
                  Facebook{req(config?.requireFacebookUrl)}
                </span>
                <input
                  className="wz-input"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  maxLength={500}
                />
              </label>
              <label className="wz-field">
                <span className="wz-label">
                  LinkedIn{req(config?.requireLinkedinUrl)}
                </span>
                <input
                  className="wz-input"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  maxLength={500}
                />
              </label>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="wz-sec">
            <div className="wz-sec-head">
              <h2 className="wz-sec-title">Work History</h2>
              <button
                type="button"
                className="wz-add"
                onClick={() => setWorkHistory((p) => [...p, newWH()])}
              >
                + Add Employer
              </button>
            </div>
            {workHistory.length === 0 ? (
              <p className="wz-empty">
                Add your previous employers. This section is optional.
              </p>
            ) : null}
            {workHistory.map((e, idx) => (
              <div key={e._key} className="wz-entry">
                <div className="wz-entry-head">
                  <span className="wz-entry-title">Employer {idx + 1}</span>
                  <button
                    type="button"
                    className="wz-remove"
                    onClick={() =>
                      setWorkHistory((p) =>
                        p.filter((x) => x._key !== e._key),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">
                      Employer Name<span className="wz-req"> *</span>
                    </span>
                    <input
                      className="wz-input"
                      value={e.employerName}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, employerName: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">
                      Job Title<span className="wz-req"> *</span>
                    </span>
                    <input
                      className="wz-input"
                      value={e.jobTitle}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, jobTitle: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                </div>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">City</span>
                    <input
                      className="wz-input"
                      value={e.employerCity}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, employerCity: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={120}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">State</span>
                    <input
                      className="wz-input"
                      value={e.employerState}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, employerState: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={120}
                    />
                  </label>
                </div>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">Employment Type</span>
                    <select
                      className="wz-input"
                      value={e.employmentType}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, employmentType: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      <option value="">Not specified</option>
                      {WORK_HISTORY_EMPLOYMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {WORK_HISTORY_EMPLOYMENT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="wz-check">
                    <input
                      type="checkbox"
                      checked={e.isCurrent}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, isCurrent: ev.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    <span>Currently Employed</span>
                  </label>
                </div>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">
                      Start Date<span className="wz-req"> *</span>
                    </span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.startDate}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, startDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">End Date</span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.endDate}
                      disabled={e.isCurrent}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, endDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                {collectComp ? (
                  <div className="wz-grid wz-grid-3">
                    <label className="wz-field">
                      <span className="wz-label">Starting Pay</span>
                      <input
                        className="wz-input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={e.startingCompensation}
                        onChange={(ev) =>
                          setWorkHistory((p) =>
                            p.map((x) =>
                              x._key === e._key
                                ? {
                                    ...x,
                                    startingCompensation: ev.target.value,
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="wz-field">
                      <span className="wz-label">Ending Pay</span>
                      <input
                        className="wz-input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={e.endingCompensation}
                        onChange={(ev) =>
                          setWorkHistory((p) =>
                            p.map((x) =>
                              x._key === e._key
                                ? { ...x, endingCompensation: ev.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="wz-field">
                      <span className="wz-label">Pay Type</span>
                      <select
                        className="wz-input"
                        value={e.compensationType}
                        onChange={(ev) =>
                          setWorkHistory((p) =>
                            p.map((x) =>
                              x._key === e._key
                                ? { ...x, compensationType: ev.target.value }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="">Not specified</option>
                        {COMPENSATION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {COMPENSATION_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">Supervisor Name</span>
                    <input
                      className="wz-input"
                      value={e.supervisorName}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, supervisorName: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">May We Contact?</span>
                    <select
                      className="wz-input"
                      value={e.contactConsent}
                      onChange={(ev) =>
                        setWorkHistory((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, contactConsent: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      {CONTACT_CONSENTS.map((c) => (
                        <option key={c} value={c}>
                          {CONTACT_CONSENT_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="wz-field">
                  <span className="wz-label">Reason For Leaving</span>
                  <textarea
                    className="wz-textarea"
                    value={e.reasonForLeaving}
                    onChange={(ev) =>
                      setWorkHistory((p) =>
                        p.map((x) =>
                          x._key === e._key
                            ? { ...x, reasonForLeaving: ev.target.value }
                            : x,
                        ),
                      )
                    }
                    maxLength={2000}
                    rows={2}
                  />
                </label>
              </div>
            ))}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="wz-sec">
            <div className="wz-sec-head">
              <h2 className="wz-sec-title">Education</h2>
              <button
                type="button"
                className="wz-add"
                onClick={() => setEducation((p) => [...p, newEd()])}
              >
                + Add Education
              </button>
            </div>
            {education.length === 0 ? (
              <p className="wz-empty">
                Add your schools and degrees. This section is optional.
              </p>
            ) : null}
            {education.map((e, idx) => (
              <div key={e._key} className="wz-entry">
                <div className="wz-entry-head">
                  <span className="wz-entry-title">Education {idx + 1}</span>
                  <button
                    type="button"
                    className="wz-remove"
                    onClick={() =>
                      setEducation((p) => p.filter((x) => x._key !== e._key))
                    }
                  >
                    Remove
                  </button>
                </div>
                <label className="wz-field">
                  <span className="wz-label">
                    School Name<span className="wz-req"> *</span>
                  </span>
                  <input
                    className="wz-input"
                    value={e.schoolName}
                    onChange={(ev) =>
                      setEducation((p) =>
                        p.map((x) =>
                          x._key === e._key
                            ? { ...x, schoolName: ev.target.value }
                            : x,
                        ),
                      )
                    }
                    maxLength={200}
                  />
                </label>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">Degree</span>
                    <input
                      className="wz-input"
                      value={e.degree}
                      onChange={(ev) =>
                        setEducation((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, degree: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Field of Study</span>
                    <input
                      className="wz-input"
                      value={e.fieldOfStudy}
                      onChange={(ev) =>
                        setEducation((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, fieldOfStudy: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                </div>
                <div className="wz-grid wz-grid-3">
                  <label className="wz-field">
                    <span className="wz-label">City</span>
                    <input
                      className="wz-input"
                      value={e.city}
                      onChange={(ev) =>
                        setEducation((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, city: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={120}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">State</span>
                    <input
                      className="wz-input"
                      value={e.state}
                      onChange={(ev) =>
                        setEducation((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, state: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={120}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">GPA</span>
                    <input
                      className="wz-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={e.gpa}
                      onChange={(ev) =>
                        setEducation((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, gpa: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">Graduation Date</span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.graduationDate}
                      onChange={(ev) =>
                        setEducation((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, graduationDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="wz-check">
                    <input
                      type="checkbox"
                      checked={e.isCurrent}
                      onChange={(ev) =>
                        setEducation((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, isCurrent: ev.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    <span>Currently Attending</span>
                  </label>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="wz-sec">
            <div className="wz-sec-head">
              <h2 className="wz-sec-title">Certifications</h2>
              <button
                type="button"
                className="wz-add"
                onClick={() => setCertifications((p) => [...p, newCe()])}
              >
                + Add Certification
              </button>
            </div>
            {certifications.length === 0 ? (
              <p className="wz-empty">Optional.</p>
            ) : null}
            {certifications.map((e, idx) => (
              <div key={e._key} className="wz-entry">
                <div className="wz-entry-head">
                  <span className="wz-entry-title">
                    Certification {idx + 1}
                  </span>
                  <button
                    type="button"
                    className="wz-remove"
                    onClick={() =>
                      setCertifications((p) =>
                        p.filter((x) => x._key !== e._key),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">
                      Name<span className="wz-req"> *</span>
                    </span>
                    <input
                      className="wz-input"
                      value={e.name}
                      onChange={(ev) =>
                        setCertifications((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, name: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Issuing Organization</span>
                    <input
                      className="wz-input"
                      value={e.issuingOrganization}
                      onChange={(ev) =>
                        setCertifications((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, issuingOrganization: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                </div>
                <div className="wz-grid wz-grid-3">
                  <label className="wz-field">
                    <span className="wz-label">Number</span>
                    <input
                      className="wz-input"
                      value={e.certificationNumber}
                      onChange={(ev) =>
                        setCertifications((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, certificationNumber: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={120}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Issue Date</span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.issueDate}
                      onChange={(ev) =>
                        setCertifications((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, issueDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Expiration Date</span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.expirationDate}
                      disabled={e.doesNotExpire}
                      onChange={(ev) =>
                        setCertifications((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, expirationDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <label className="wz-check">
                  <input
                    type="checkbox"
                    checked={e.doesNotExpire}
                    onChange={(ev) =>
                      setCertifications((p) =>
                        p.map((x) =>
                          x._key === e._key
                            ? { ...x, doesNotExpire: ev.target.checked }
                            : x,
                        ),
                      )
                    }
                  />
                  <span>Does Not Expire</span>
                </label>
              </div>
            ))}

            <div className="wz-sec-head wz-sec-head-mt">
              <h2 className="wz-sec-title">Military Service</h2>
              <button
                type="button"
                className="wz-add"
                onClick={() => setMilitary((p) => [...p, newMil()])}
              >
                + Add Military Service
              </button>
            </div>
            {military.length === 0 ? (
              <p className="wz-empty">Optional.</p>
            ) : null}
            {military.map((e, idx) => (
              <div key={e._key} className="wz-entry">
                <div className="wz-entry-head">
                  <span className="wz-entry-title">Service {idx + 1}</span>
                  <button
                    type="button"
                    className="wz-remove"
                    onClick={() =>
                      setMilitary((p) => p.filter((x) => x._key !== e._key))
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="wz-grid">
                  <label className="wz-check">
                    <input
                      type="checkbox"
                      checked={e.isVeteran}
                      onChange={(ev) =>
                        setMilitary((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, isVeteran: ev.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    <span>Veteran</span>
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Service Component</span>
                    <select
                      className="wz-input"
                      value={e.serviceType}
                      onChange={(ev) =>
                        setMilitary((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, serviceType: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      <option value="">Not specified</option>
                      {MILITARY_SERVICE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {MILITARY_SERVICE_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">Branch</span>
                    <input
                      className="wz-input"
                      value={e.branch}
                      onChange={(ev) =>
                        setMilitary((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, branch: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={120}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Rank</span>
                    <input
                      className="wz-input"
                      value={e.rank}
                      onChange={(ev) =>
                        setMilitary((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, rank: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={120}
                    />
                  </label>
                </div>
                <label className="wz-field">
                  <span className="wz-label">Occupational Specialty</span>
                  <input
                    className="wz-input"
                    value={e.occupationalSpecialty}
                    onChange={(ev) =>
                      setMilitary((p) =>
                        p.map((x) =>
                          x._key === e._key
                            ? { ...x, occupationalSpecialty: ev.target.value }
                            : x,
                        ),
                      )
                    }
                    maxLength={200}
                  />
                </label>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">Service Start</span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.serviceStartDate}
                      onChange={(ev) =>
                        setMilitary((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, serviceStartDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Service End</span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.serviceEndDate}
                      disabled={e.isCurrent}
                      onChange={(ev) =>
                        setMilitary((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, serviceEndDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <label className="wz-check">
                  <input
                    type="checkbox"
                    checked={e.isCurrent}
                    onChange={(ev) =>
                      setMilitary((p) =>
                        p.map((x) =>
                          x._key === e._key
                            ? { ...x, isCurrent: ev.target.checked }
                            : x,
                        ),
                      )
                    }
                  />
                  <span>Currently Serving</span>
                </label>
              </div>
            ))}

            <div className="wz-sec-head wz-sec-head-mt">
              <h2 className="wz-sec-title">Professional Memberships</h2>
              <button
                type="button"
                className="wz-add"
                onClick={() => setMemberships((p) => [...p, newMem()])}
              >
                + Add Membership
              </button>
            </div>
            {memberships.length === 0 ? (
              <p className="wz-empty">Optional.</p>
            ) : null}
            {memberships.map((e, idx) => (
              <div key={e._key} className="wz-entry">
                <div className="wz-entry-head">
                  <span className="wz-entry-title">Membership {idx + 1}</span>
                  <button
                    type="button"
                    className="wz-remove"
                    onClick={() =>
                      setMemberships((p) =>
                        p.filter((x) => x._key !== e._key),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="wz-grid">
                  <label className="wz-field">
                    <span className="wz-label">
                      Organization<span className="wz-req"> *</span>
                    </span>
                    <input
                      className="wz-input"
                      value={e.organization}
                      onChange={(ev) =>
                        setMemberships((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, organization: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Membership Type</span>
                    <input
                      className="wz-input"
                      value={e.membershipType}
                      onChange={(ev) =>
                        setMemberships((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, membershipType: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                  </label>
                </div>
                <div className="wz-grid wz-grid-3">
                  <label className="wz-field">
                    <span className="wz-label">Number</span>
                    <input
                      className="wz-input"
                      value={e.membershipNumber}
                      onChange={(ev) =>
                        setMemberships((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, membershipNumber: ev.target.value }
                              : x,
                          ),
                        )
                      }
                      maxLength={120}
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">Start Date</span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.startDate}
                      onChange={(ev) =>
                        setMemberships((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, startDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="wz-field">
                    <span className="wz-label">End Date</span>
                    <input
                      className="wz-input"
                      type="date"
                      value={e.endDate}
                      disabled={e.isCurrent}
                      onChange={(ev) =>
                        setMemberships((p) =>
                          p.map((x) =>
                            x._key === e._key
                              ? { ...x, endDate: ev.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <label className="wz-check">
                  <input
                    type="checkbox"
                    checked={e.isCurrent}
                    onChange={(ev) =>
                      setMemberships((p) =>
                        p.map((x) =>
                          x._key === e._key
                            ? { ...x, isCurrent: ev.target.checked }
                            : x,
                        ),
                      )
                    }
                  />
                  <span>Currently Active</span>
                </label>
              </div>
            ))}
          </section>
        ) : null}

        {step === 5 ? (
          <section className="wz-sec">
            <h2 className="wz-sec-title">
              Resume{req(config?.requireResume)}
            </h2>
            <p className="wz-empty">
              {config?.requireResume
                ? "A resume is required for this application."
                : "Attach a resume (optional). Accepted: PDF, DOC, DOCX."}
            </p>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={resumeUploading}
              onChange={(e) =>
                handleResumeSelect(e.target.files?.[0] ?? null)
              }
            />
            {resumeUploading ? (
              <p className="wz-empty">Uploading…</p>
            ) : resumeDoc ? (
              <div className="wz-resume-ok">
                Uploaded: {resumeDoc.fileName}{" "}
                <button
                  type="button"
                  className="wz-remove"
                  onClick={() => setResumeDoc(null)}
                >
                  Remove
                </button>
              </div>
            ) : null}
            {resumeError ? <div className="wz-error">{resumeError}</div> : null}
          </section>
        ) : null}

        {step === 6 ? (
          <section className="wz-sec">
            <h2 className="wz-sec-title">Application Questions</h2>
            <label className="wz-field">
              <span className="wz-label">
                Why are you interested in this position?
              </span>
              <textarea
                className="wz-textarea"
                value={interestReason}
                onChange={(e) => setInterestReason(e.target.value)}
                maxLength={5000}
                rows={6}
                placeholder="Tell us what draws you to this role…"
              />
            </label>
          </section>
        ) : null}

        {step === 7 ? (
          <section className="wz-sec">
            <h2 className="wz-sec-title">Review &amp; Submit</h2>
            {submitError ? (
              <div className="wz-error">{submitError}</div>
            ) : null}
            <div className="wz-review">
              <div className="wz-review-row">
                <span className="wz-review-k">Name</span>
                <span className="wz-review-v">
                  {[firstName, lastName].filter(Boolean).join(" ") || "—"}
                </span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Email</span>
                <span className="wz-review-v">{email || "—"}</span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Phone</span>
                <span className="wz-review-v">{phone || "—"}</span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Location</span>
                <span className="wz-review-v">
                  {[city, state].filter(Boolean).join(", ") || "—"}
                </span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Work History</span>
                <span className="wz-review-v">
                  {
                    workHistory.filter(
                      (e) =>
                        e.employerName.trim() &&
                        e.jobTitle.trim() &&
                        e.startDate,
                    ).length
                  }{" "}
                  entr(ies)
                </span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Education</span>
                <span className="wz-review-v">
                  {education.filter((e) => e.schoolName.trim()).length}{" "}
                  entr(ies)
                </span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Certifications</span>
                <span className="wz-review-v">
                  {certifications.filter((e) => e.name.trim()).length}{" "}
                  entr(ies)
                </span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Military Service</span>
                <span className="wz-review-v">
                  {
                    military.filter(
                      (e) =>
                        e.isVeteran ||
                        e.serviceType ||
                        e.branch.trim() ||
                        e.rank.trim(),
                    ).length
                  }{" "}
                  entr(ies)
                </span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Memberships</span>
                <span className="wz-review-v">
                  {memberships.filter((e) => e.organization.trim()).length}{" "}
                  entr(ies)
                </span>
              </div>
              <div className="wz-review-row">
                <span className="wz-review-k">Resume</span>
                <span className="wz-review-v">
                  {resumeDoc ? resumeDoc.fileName : "None"}
                </span>
              </div>
            </div>
          </section>
        ) : null}

        <div className="wz-nav">
          <button
            type="button"
            className="wz-btn wz-secondary"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || submitting}
          >
            Back
          </button>
          {step < 7 ? (
            <button
              type="button"
              className="wz-btn wz-primary"
              onClick={() => setStep((s) => Math.min(7, s + 1))}
              disabled={!canProceed}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="wz-btn wz-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wz-root">
      <header className="wz-topbar">
        <div className="wz-topbar-inner">
          <span className="wz-brand">MW4H Careers</span>
        </div>
      </header>
      <main className="wz-main">{children}</main>
      <StyleBlock />
    </div>
  );
}

function StyleBlock() {
  return (
    <style jsx global>{`
      .wz-root {
        min-height: 100vh;
        background: #f1f5f9;
        color: #111827;
      }
      .wz-topbar {
        background: #0f172a;
        color: #ffffff;
      }
      .wz-topbar-inner {
        max-width: 820px;
        margin: 0 auto;
        padding: 16px 20px;
      }
      .wz-brand {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.3px;
      }
      .wz-main {
        max-width: 820px;
        margin: 0 auto;
        padding: 28px 20px 64px;
      }
      .wz-state {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 48px 24px;
        text-align: center;
      }
      .wz-state-title {
        font-size: 20px;
        font-weight: 700;
        margin: 8px 0 8px;
      }
      .wz-state-text {
        font-size: 14px;
        color: #6b7280;
        margin: 0 0 12px;
      }
      .wz-check {
        width: 56px;
        height: 56px;
        border-radius: 999px;
        background: #dcfce7;
        color: #15803d;
        font-size: 28px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }
      .wz-ref {
        font-family: var(--font-geist-mono, monospace);
        font-size: 12px;
        color: #9ca3af;
        margin: 0 0 16px;
      }
      .wz-link {
        color: #2563eb;
        font-weight: 700;
        text-decoration: none;
        font-size: 14px;
      }
      .wz-head {
        margin-bottom: 16px;
      }
      .wz-title {
        font-size: 24px;
        font-weight: 800;
        margin: 0 0 4px;
      }
      .wz-sub {
        font-size: 12px;
        color: #6b7280;
        font-family: var(--font-geist-mono, monospace);
        margin: 0;
      }
      .wz-steps {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        list-style: none;
        padding: 0;
        margin: 0 0 16px;
      }
      .wz-step {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #6b7280;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        padding: 5px 10px;
      }
      .wz-step.current {
        border-color: #2563eb;
        color: #1d4ed8;
        font-weight: 700;
      }
      .wz-step.done {
        color: #15803d;
        border-color: #bbf7d0;
      }
      .wz-step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 999px;
        background: #eef2ff;
        font-size: 11px;
        font-weight: 700;
      }
      .wz-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 24px;
      }
      .wz-sec {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .wz-sec-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .wz-sec-head-mt {
        margin-top: 10px;
        padding-top: 16px;
        border-top: 1px solid #f1f5f9;
      }
      .wz-sec-title {
        font-size: 18px;
        font-weight: 700;
        margin: 0;
      }
      .wz-subhead {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #6b7280;
        margin: 6px 0 0;
      }
      .wz-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      .wz-grid-3 {
        grid-template-columns: 1fr 1fr 1fr;
      }
      .wz-grid-tight {
        gap: 10px;
      }
      .wz-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .wz-label {
        font-size: 12px;
        font-weight: 600;
        color: #374151;
      }
      .wz-req {
        color: #dc2626;
      }
      .wz-hint {
        font-size: 11.5px;
        color: #9ca3af;
      }
      .wz-input,
      .wz-textarea {
        font-size: 13px;
        color: #111827;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 7px;
        padding: 9px 11px;
        width: 100%;
        box-sizing: border-box;
        font-family: inherit;
      }
      .wz-textarea {
        resize: vertical;
      }
      .wz-input:focus,
      .wz-textarea:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
      .wz-input:disabled {
        background: #f3f4f6;
        color: #9ca3af;
      }
      .wz-check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #374151;
        align-self: end;
        padding-bottom: 9px;
      }
      .wz-check input {
        accent-color: #2563eb;
        width: 15px;
        height: 15px;
      }
      .wz-entry {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #fcfcfd;
      }
      .wz-entry-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .wz-entry-title {
        font-size: 13px;
        font-weight: 700;
        color: #111827;
      }
      .wz-add {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        border-radius: 7px;
        padding: 7px 12px;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .wz-add:hover {
        background: #dbeafe;
      }
      .wz-remove {
        background: transparent;
        color: #b91c1c;
        border: none;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
      }
      .wz-remove:hover {
        text-decoration: underline;
      }
      .wz-empty {
        font-size: 13px;
        color: #9ca3af;
        margin: 0;
      }
      .wz-error {
        background: #fff1f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        font-size: 12.5px;
        border-radius: 6px;
        padding: 8px 10px;
      }
      .wz-resume-ok {
        font-size: 13px;
        color: #15803d;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .wz-review {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .wz-review-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 8px;
      }
      .wz-review-k {
        font-size: 12px;
        font-weight: 700;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .wz-review-v {
        font-size: 13px;
        color: #111827;
        text-align: right;
        word-break: break-word;
      }
      .wz-nav {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-top: 22px;
        padding-top: 16px;
        border-top: 1px solid #f1f5f9;
      }
      .wz-btn {
        font-size: 14px;
        font-weight: 700;
        border-radius: 8px;
        padding: 10px 22px;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .wz-btn:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      .wz-secondary {
        background: #ffffff;
        color: #374151;
        border-color: #e5e7eb;
      }
      .wz-secondary:hover:not(:disabled) {
        background: #f1f5f9;
      }
      .wz-primary {
        background: #2563eb;
        color: #ffffff;
      }
      .wz-primary:hover:not(:disabled) {
        background: #1d4ed8;
      }
      @media (max-width: 560px) {
        .wz-grid,
        .wz-grid-3 {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}
