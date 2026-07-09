"use client";

import { useEffect, useState } from "react";
import {
  Application,
  APPLICATION_SOURCES,
  CreateApplicationInput,
  InternalApplicationSource,
  SOURCE_LABELS,
  createApplication,
} from "@/lib/careers/applicationsApi";
import {
  JobPosting,
  listJobPostings,
  postingTitle,
} from "@/lib/careers/jobPostingsApi";
import {
  Applicant,
  applicantName,
  listApplicants,
} from "@/lib/careers/applicantsApi";
import { getApiErrorMessage } from "@/lib/careers/errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ApplicantMode = "email" | "existing";

/**
 * Jarvis Careers - Create Application dialog.
 *
 * A new component: no existing modal fits. It combines an OPEN job-posting
 * picker with two applicant paths - find-or-create by email, or select an
 * existing applicant - and surfaces duplicate / posting-not-open backend errors.
 * Resume upload is intentionally NOT part of this flow.
 */
export function ApplicationCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: Application) => void;
}) {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [postingsLoading, setPostingsLoading] = useState(false);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);

  const [jobPostingId, setJobPostingId] = useState("");
  const [mode, setMode] = useState<ApplicantMode>("email");
  const [internalApplicantId, setInternalApplicantId] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [source, setSource] = useState<InternalApplicationSource>("MANUAL");
  const [coverNote, setCoverNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setJobPostingId("");
    setMode("email");
    setInternalApplicantId("");
    setEmail("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setCity("");
    setState("");
    setSource("MANUAL");
    setCoverNote("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setPostingsLoading(true);
    listJobPostings({ status: "OPEN", limit: 200 })
      .then((res) => active && setPostings(res.items))
      .catch(() => active && setPostings([]))
      .finally(() => active && setPostingsLoading(false));
    setApplicantsLoading(true);
    listApplicants({ limit: 200 })
      .then((res) => active && setApplicants(res.items))
      .catch(() => active && setApplicants([]))
      .finally(() => active && setApplicantsLoading(false));
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  const emailValid = EMAIL_RE.test(email.trim());
  const applicantValid =
    mode === "email" ? emailValid : internalApplicantId.length > 0;
  const canSave = jobPostingId.length > 0 && applicantValid && !saving;

  async function handleSubmit() {
    if (!jobPostingId) {
      setError("A job posting is required.");
      return;
    }
    if (mode === "email" && !emailValid) {
      setError("A valid applicant email is required.");
      return;
    }
    if (mode === "existing" && !internalApplicantId) {
      setError("Select an existing applicant.");
      return;
    }

    setSaving(true);
    setError(null);
    const input: CreateApplicationInput = {
      jobPostingId,
      source,
      coverNote: coverNote.trim() || undefined,
    };
    if (mode === "existing") {
      input.internalApplicantId = internalApplicantId;
    } else {
      input.applicantEmail = email.trim();
      if (firstName.trim()) input.firstName = firstName.trim();
      if (lastName.trim()) input.lastName = lastName.trim();
      if (phone.trim()) input.phone = phone.trim();
      if (city.trim()) input.city = city.trim();
      if (state.trim()) input.state = state.trim();
    }

    try {
      const created = await createApplication(input);
      onCreated(created);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to create application."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pf-overlay" onClick={saving ? undefined : onClose}>
      <div
        className="pf-modal"
        role="dialog"
        aria-modal="true"
        aria-label="New Application"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pf-header">
          <h3>New Application</h3>
          <button
            type="button"
            className="pf-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="pf-body">
          {error ? <div className="pf-error">{error}</div> : null}

          <label className="pf-field">
            <span className="pf-label">
              Job Posting <span className="pf-req">*</span>
            </span>
            <select
              className="pf-input"
              value={jobPostingId}
              onChange={(e) => setJobPostingId(e.target.value)}
              disabled={postingsLoading}
            >
              <option value="">
                {postingsLoading
                  ? "Loading open postings…"
                  : postings.length === 0
                    ? "No open postings available"
                    : "Select an open posting…"}
              </option>
              {postings.map((p) => (
                <option key={p.id} value={p.id}>
                  {postingTitle(p)}
                  {p.location ? ` — ${p.location}` : ""}
                </option>
              ))}
            </select>
            <span className="pf-hint">
              Only OPEN postings accept new applications.
            </span>
          </label>

          <div className="pf-field">
            <span className="pf-label">Applicant</span>
            <div className="pf-modes">
              <label className="pf-radio">
                <input
                  type="radio"
                  name="applicant-mode"
                  checked={mode === "email"}
                  onChange={() => setMode("email")}
                />
                <span>By email (find or create)</span>
              </label>
              <label className="pf-radio">
                <input
                  type="radio"
                  name="applicant-mode"
                  checked={mode === "existing"}
                  onChange={() => setMode("existing")}
                />
                <span>Select existing</span>
              </label>
            </div>
          </div>

          {mode === "email" ? (
            <>
              <label className="pf-field">
                <span className="pf-label">
                  Email <span className="pf-req">*</span>
                </span>
                <input
                  className="pf-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  placeholder="e.g. jane.doe@example.com"
                />
                <span className="pf-hint">
                  If an applicant with this email exists they are reused;
                  otherwise a new applicant is created. Name/contact fields below
                  are used only when creating a new applicant.
                </span>
              </label>
              <div className="pf-grid">
                <label className="pf-field">
                  <span className="pf-label">First Name</span>
                  <input
                    className="pf-input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={120}
                    placeholder="Jane"
                  />
                </label>
                <label className="pf-field">
                  <span className="pf-label">Last Name</span>
                  <input
                    className="pf-input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={120}
                    placeholder="Doe"
                  />
                </label>
              </div>
              <div className="pf-grid">
                <label className="pf-field">
                  <span className="pf-label">Phone</span>
                  <input
                    className="pf-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={50}
                    placeholder="(555) 123-4567"
                  />
                </label>
                <label className="pf-field">
                  <span className="pf-label">City / State</span>
                  <div className="pf-inline">
                    <input
                      className="pf-input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      maxLength={120}
                      placeholder="City"
                    />
                    <input
                      className="pf-input pf-state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      maxLength={120}
                      placeholder="State"
                    />
                  </div>
                </label>
              </div>
            </>
          ) : (
            <label className="pf-field">
              <span className="pf-label">
                Existing Applicant <span className="pf-req">*</span>
              </span>
              <select
                className="pf-input"
                value={internalApplicantId}
                onChange={(e) => setInternalApplicantId(e.target.value)}
                disabled={applicantsLoading}
              >
                <option value="">
                  {applicantsLoading
                    ? "Loading applicants…"
                    : "Select an applicant…"}
                </option>
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {applicantName(a)} — {a.email}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="pf-grid">
            <label className="pf-field">
              <span className="pf-label">Source</span>
              <select
                className="pf-input"
                value={source}
                onChange={(e) =>
                  setSource(e.target.value as InternalApplicationSource)
                }
              >
                {APPLICATION_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <div className="pf-field" />
          </div>

          <label className="pf-field">
            <span className="pf-label">Cover Note</span>
            <textarea
              className="pf-textarea"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder={"Optional note from or about the applicant\u2026"}
            />
          </label>
        </div>

        <div className="pf-footer">
          <button
            type="button"
            className="pf-btn pf-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pf-btn pf-save"
            onClick={handleSubmit}
            disabled={!canSave}
          >
            {saving ? "Creating\u2026" : "Create Application"}
          </button>
        </div>

        <style jsx>{`
          .pf-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 1000;
          }
          .pf-modal {
            width: 100%;
            max-width: 620px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.18);
            max-height: 90vh;
            display: flex;
            flex-direction: column;
          }
          .pf-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 22px;
            border-bottom: 1px solid #f1f5f9;
          }
          .pf-header h3 {
            font-size: 17px;
            font-weight: 700;
            color: #111827;
            margin: 0;
          }
          .pf-close {
            background: transparent;
            border: none;
            font-size: 22px;
            line-height: 1;
            color: #6b7280;
            cursor: pointer;
            padding: 0 4px;
          }
          .pf-close:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }
          .pf-body {
            padding: 18px 22px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .pf-error {
            background: #fff1f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            font-size: 12.5px;
            border-radius: 6px;
            padding: 8px 10px;
          }
          .pf-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          .pf-inline {
            display: flex;
            gap: 8px;
          }
          .pf-state {
            max-width: 110px;
          }
          .pf-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .pf-label {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
          }
          .pf-req {
            color: #dc2626;
          }
          .pf-hint {
            font-size: 11.5px;
            color: #9ca3af;
          }
          .pf-modes {
            display: flex;
            gap: 18px;
            flex-wrap: wrap;
          }
          .pf-radio {
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 13px;
            color: #374151;
          }
          .pf-radio input {
            accent-color: #2563eb;
          }
          .pf-input,
          .pf-textarea {
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
          .pf-textarea {
            resize: vertical;
          }
          .pf-input:focus,
          .pf-textarea:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }
          .pf-input:disabled {
            background: #f9fafb;
            color: #6b7280;
            cursor: not-allowed;
          }
          .pf-input::placeholder,
          .pf-textarea::placeholder {
            color: #9ca3af;
          }
          .pf-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 16px 22px;
            border-top: 1px solid #f1f5f9;
          }
          .pf-btn {
            font-size: 13px;
            font-weight: 700;
            border-radius: 7px;
            padding: 9px 16px;
            cursor: pointer;
            border: 1px solid transparent;
          }
          .pf-btn:disabled {
            cursor: not-allowed;
          }
          .pf-cancel {
            background: #ffffff;
            color: #374151;
            border-color: #e5e7eb;
            font-weight: 600;
          }
          .pf-cancel:hover:not(:disabled) {
            background: #f1f5f9;
            border-color: #d1d5db;
          }
          .pf-save {
            background: #2563eb;
            color: #ffffff;
          }
          .pf-save:hover:not(:disabled) {
            background: #1d4ed8;
          }
          .pf-save:disabled {
            background: #93c5fd;
          }
          @media (max-width: 560px) {
            .pf-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
