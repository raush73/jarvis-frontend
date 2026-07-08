"use client";

import { CareersShell } from "./CareersShell";

/**
 * Jarvis Careers - navigation placeholder (Phase 7B.1 foundation).
 *
 * Renders a consistent "coming soon" shell for Careers sections whose features
 * land in later phases (Positions, Job Postings, Applicants, Applications).
 * This is intentionally non-functional: it contains NO tables, forms, business
 * logic, or backend calls. It exists only so the navigation/IA is complete and
 * direct URLs do not 404.
 */
export function CareersComingSoon({
  title,
  subtitle,
  section,
}: {
  title: string;
  subtitle?: string;
  section: string;
}) {
  return (
    <CareersShell title={title} subtitle={subtitle}>
      <div className="coming-soon">
        <div className="coming-soon-icon" aria-hidden="true">
          &#9635;
        </div>
        <h2>{section} is coming soon</h2>
        <p>
          This area is part of Jarvis Careers. The navigation and layout are in
          place; the {section.toLowerCase()} experience is enabled in an upcoming
          release phase.
        </p>
      </div>

      <style jsx>{`
        .coming-soon {
          background: #ffffff;
          border: 1px dashed #d1d5db;
          border-radius: 12px;
          padding: 48px 32px;
          text-align: center;
          max-width: 560px;
          margin: 24px auto 0;
        }
        .coming-soon-icon {
          font-size: 28px;
          color: #9ca3af;
          margin-bottom: 12px;
        }
        .coming-soon h2 {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }
        .coming-soon p {
          font-size: 13px;
          color: #6b7280;
          line-height: 1.6;
          margin: 0;
        }
      `}</style>
    </CareersShell>
  );
}
