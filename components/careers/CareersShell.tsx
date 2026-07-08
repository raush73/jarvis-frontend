"use client";

import { ReactNode } from "react";

/**
 * Jarvis Careers - shared page shell (Phase 7B.1 foundation).
 *
 * Establishes the Industrial Light V1 page surface (#f8fafc, centered max-width)
 * and the standard Jarvis page header (title + subtitle + optional actions),
 * matching the customers list/detail master pages. Reused by the Careers
 * Dashboard and every Careers section page.
 */
export function CareersShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="careers-shell">
      <header className="careers-header">
        <div className="careers-header-text">
          <h1>{title}</h1>
          {subtitle ? <p className="careers-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="careers-header-actions">{actions}</div> : null}
      </header>

      <div className="careers-body">{children}</div>

      <style jsx>{`
        .careers-shell {
          background: #f8fafc;
          min-height: 100vh;
          padding: 24px 40px 60px;
          max-width: 1500px;
          margin: 0 auto;
        }
        .careers-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }
        .careers-header-text h1 {
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.3px;
          margin: 0;
        }
        .careers-subtitle {
          margin: 6px 0 0;
          font-size: 13px;
          color: #6b7280;
        }
        .careers-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        @media (max-width: 900px) {
          .careers-shell {
            padding: 22px 20px 52px;
          }
        }
        @media (max-width: 640px) {
          .careers-shell {
            padding: 20px 16px 48px;
          }
          .careers-header {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
