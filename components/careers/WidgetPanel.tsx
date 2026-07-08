"use client";

import { ReactNode } from "react";

/**
 * Jarvis Careers - dashboard widget panel (Phase 7B.1 foundation).
 *
 * White bordered card with a panel header (title + note) and a padded body,
 * following the Industrial Light V1 content-card / panel-header pattern. Used
 * to reserve the dashboard widget regions (Recent Activity, Open Job Postings,
 * Applications Needing Review) with placeholder bodies until data is wired.
 */
export function WidgetPanel({
  title,
  note,
  children,
  minHeight = 180,
}: {
  title: string;
  note?: string;
  children?: ReactNode;
  minHeight?: number;
}) {
  return (
    <section className="widget-panel">
      <div className="widget-header">
        <h2>{title}</h2>
        {note ? <span className="widget-note">{note}</span> : null}
      </div>
      <div className="widget-body" style={{ minHeight }}>
        {children}
      </div>

      <style jsx>{`
        .widget-panel {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .widget-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
        }
        .widget-header h2 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        .widget-note {
          font-size: 12px;
          color: #6b7280;
          flex-shrink: 0;
        }
        .widget-body {
          padding: 16px;
        }
      `}</style>
    </section>
  );
}
