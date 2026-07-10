"use client";

import Link from "next/link";
import { CareersShell } from "@/components/careers/CareersShell";
import { KpiCard } from "@/components/careers/KpiCard";
import { WidgetPanel } from "@/components/careers/WidgetPanel";
import { Skeleton } from "@/components/careers/Skeleton";
import { useSession } from "@/lib/auth/useSession";

/**
 * Jarvis Careers - Dashboard (Phase 7B.1 foundation SHELL only).
 *
 * This is intentionally NOT wired to backend data. It reserves the four widget
 * regions from the LOCKED UI Architecture plan so they can be populated in a
 * later phase without re-layout:
 *   1) KPI Cards
 *   2) Applications Needing Review
 *   3) Open Job Postings
 *   4) Recent Activity
 * All regions render Industrial Light V1 placeholders/skeletons.
 */

const KPI_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "openPostings", label: "Open Postings" },
  { key: "draftPostings", label: "Draft Postings" },
  { key: "activeApplications", label: "Active Applications" },
  { key: "newThisWeek", label: "New This Week" },
  { key: "inInterview", label: "In Interview" },
  { key: "hired", label: "Hired / Converted" },
];

const RESERVED_NOTE = "Reserved \u2014 data wired in a later phase";

export default function CareersDashboardPage() {
  const session = useSession();
  return (
    <CareersShell
      title="Careers"
      subtitle="Internal hiring command center"
      actions={
        session.ready && session.isAdmin ? (
          <Link href="/careers/settings" className="settings-link">
            Application Settings
          </Link>
        ) : null
      }
    >
      {/* Region 1: KPI Cards (reserved placeholders) */}
      <div className="kpi-grid">
        {KPI_PLACEHOLDERS.map((kpi) => (
          <KpiCard key={kpi.key} label={kpi.label} loading hint="Awaiting data" />
        ))}
      </div>

      {/* Regions 2 + 3: Review queue and open postings */}
      <div className="widget-grid">
        <WidgetPanel title="Applications Needing Review" note={RESERVED_NOTE}>
          <PlaceholderRows rows={4} />
        </WidgetPanel>
        <WidgetPanel title="Open Job Postings" note={RESERVED_NOTE}>
          <PlaceholderRows rows={4} />
        </WidgetPanel>
      </div>

      {/* Region 4: Recent Activity */}
      <div className="widget-full">
        <WidgetPanel title="Recent Activity" note={RESERVED_NOTE} minHeight={150}>
          <PlaceholderRows rows={3} />
        </WidgetPanel>
      </div>

      <style jsx>{`
        .settings-link {
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
        .settings-link:hover {
          background: #f1f5f9;
          border-color: #d1d5db;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }
        .widget-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }
        .widget-full {
          display: block;
        }
        @media (max-width: 1200px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .widget-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </CareersShell>
  );
}

/**
 * Placeholder rows for a reserved widget region. Renders skeleton lines plus a
 * muted caption so the empty region reads as intentional (not broken).
 */
function PlaceholderRows({ rows }: { rows: number }) {
  return (
    <div className="placeholder-rows">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="placeholder-row">
          <Skeleton width="38%" height={12} />
          <Skeleton width="22%" height={12} />
          <Skeleton width={72} height={20} radius={999} />
        </div>
      ))}
      <div className="placeholder-caption">
        No data yet — this widget populates in a later phase.
      </div>

      <style jsx>{`
        .placeholder-rows {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .placeholder-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        .placeholder-row:last-of-type {
          border-bottom: none;
          padding-bottom: 0;
        }
        .placeholder-caption {
          margin-top: 6px;
          font-size: 12px;
          color: #9ca3af;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
