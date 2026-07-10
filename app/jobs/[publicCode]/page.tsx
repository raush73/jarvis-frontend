"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { employmentTypeLabel } from "@/lib/careers/jobPostingsApi";
import { formatDate } from "@/lib/careers/format";
import {
  PublicJobPosting,
  getPublicJob,
} from "@/lib/careers/publicCareersApi";

type LoadState = "loading" | "ready" | "notfound" | "error";

export default function PublicJobPage() {
  const params = useParams<{ publicCode: string }>();
  const publicCode = params?.publicCode ?? "";

  const [job, setJob] = useState<PublicJobPosting | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    if (!publicCode) return;
    setState("loading");
    try {
      const data = await getPublicJob(publicCode);
      if (!data) {
        setState("notfound");
        return;
      }
      setJob(data);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [publicCode]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="pj-root">
      <header className="pj-topbar">
        <div className="pj-topbar-inner">
          <span className="pj-brand">MW4H Careers</span>
        </div>
      </header>

      <main className="pj-main">
        {state === "loading" ? (
          <div className="pj-state">Loading position…</div>
        ) : state === "notfound" ? (
          <div className="pj-state">
            <h1 className="pj-state-title">Position unavailable</h1>
            <p className="pj-state-text">
              This job posting is no longer available or the link is invalid.
            </p>
          </div>
        ) : state === "error" ? (
          <div className="pj-state">
            <h1 className="pj-state-title">Something went wrong</h1>
            <p className="pj-state-text">
              We couldn&rsquo;t load this position. Please try again later.
            </p>
          </div>
        ) : job ? (
          <article className="pj-card">
            <div className="pj-header">
              <h1 className="pj-title">{job.title ?? "Open Position"}</h1>
              <div className="pj-meta">
                {job.department ? (
                  <span className="pj-chip">{job.department}</span>
                ) : null}
                {job.employmentType ? (
                  <span className="pj-chip">
                    {employmentTypeLabel(job.employmentType)}
                  </span>
                ) : null}
                {job.location ? (
                  <span className="pj-chip">{job.location}</span>
                ) : null}
              </div>
              {job.publishedAt ? (
                <p className="pj-posted">Posted {formatDate(job.publishedAt)}</p>
              ) : null}
            </div>

            <div className="pj-apply">
              <button
                type="button"
                className="pj-apply-btn"
                disabled
                aria-disabled="true"
                title="Online applications are opening soon"
              >
                Apply Now
              </button>
              <span className="pj-apply-note">
                Online applications are opening soon.
              </span>
            </div>

            {job.description ? (
              <section className="pj-section">
                <h2 className="pj-section-title">About this role</h2>
                <p className="pj-body">{job.description}</p>
              </section>
            ) : null}

            {job.responsibilities ? (
              <section className="pj-section">
                <h2 className="pj-section-title">Responsibilities</h2>
                <p className="pj-body">{job.responsibilities}</p>
              </section>
            ) : null}

            {job.qualifications ? (
              <section className="pj-section">
                <h2 className="pj-section-title">Qualifications</h2>
                <p className="pj-body">{job.qualifications}</p>
              </section>
            ) : null}

            <div className="pj-footer">
              <span className="pj-ref">Reference: {job.publicCode}</span>
            </div>
          </article>
        ) : null}
      </main>

      <style jsx>{`
        .pj-root {
          min-height: 100vh;
          background: #f1f5f9;
          color: #111827;
        }
        .pj-topbar {
          background: #0f172a;
          color: #ffffff;
        }
        .pj-topbar-inner {
          max-width: 820px;
          margin: 0 auto;
          padding: 16px 20px;
        }
        .pj-brand {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.3px;
        }
        .pj-main {
          max-width: 820px;
          margin: 0 auto;
          padding: 28px 20px 64px;
        }
        .pj-state {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 48px 24px;
          text-align: center;
        }
        .pj-state-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 8px;
        }
        .pj-state-text {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }
        .pj-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 28px;
        }
        .pj-header {
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 20px;
        }
        .pj-title {
          font-size: 26px;
          font-weight: 800;
          margin: 0 0 12px;
          line-height: 1.2;
        }
        .pj-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .pj-chip {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #dbeafe;
          border-radius: 999px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
        }
        .pj-posted {
          margin: 12px 0 0;
          font-size: 12px;
          color: #9ca3af;
        }
        .pj-apply {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          padding: 20px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .pj-apply-btn {
          background: #2563eb;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 12px 28px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }
        .pj-apply-btn:disabled {
          background: #93b4f5;
          cursor: not-allowed;
        }
        .pj-apply-note {
          font-size: 13px;
          color: #6b7280;
        }
        .pj-section {
          padding-top: 22px;
        }
        .pj-section-title {
          font-size: 15px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #374151;
          margin: 0 0 10px;
        }
        .pj-body {
          font-size: 14px;
          line-height: 1.7;
          color: #1f2937;
          margin: 0;
          white-space: pre-wrap;
        }
        .pj-footer {
          margin-top: 26px;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }
        .pj-ref {
          font-family: var(--font-geist-mono, monospace);
          font-size: 12px;
          color: #9ca3af;
        }
        @media (max-width: 560px) {
          .pj-card {
            padding: 20px;
          }
          .pj-title {
            font-size: 22px;
          }
        }
      `}</style>
    </div>
  );
}
