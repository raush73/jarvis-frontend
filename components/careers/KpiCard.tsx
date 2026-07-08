"use client";

import { ReactNode } from "react";
import { Skeleton } from "./Skeleton";

/**
 * Jarvis Careers - KPI summary card (Phase 7B.1 foundation).
 *
 * Industrial Light V1 summary-card treatment. In Phase 7B.1 these render as
 * reserved placeholders (loading skeleton value); live values are wired in a
 * later phase. `value` is intentionally optional so the card is data-agnostic.
 */
export function KpiCard({
  label,
  value,
  hint,
  loading = false,
}: {
  label: string;
  value?: ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  const showSkeleton = loading || value === undefined;

  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <div className="kpi-value">
        {showSkeleton ? <Skeleton width={64} height={26} radius={6} /> : value}
      </div>
      {hint ? <span className="kpi-hint">{hint}</span> : null}

      <style jsx>{`
        .kpi-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }
        .kpi-label {
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .kpi-value {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          line-height: 1.1;
          min-height: 26px;
          display: flex;
          align-items: center;
        }
        .kpi-hint {
          font-size: 11px;
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}
