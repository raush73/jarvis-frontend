"use client";

/**
 * Phase 2 - reusable summary presentation.
 *
 * The counts an administrative surface leads with: outstanding work, packets held, modules
 * complete. Every figure here is one the server computed; the component lays them out and adds
 * nothing, so a summary and the detail behind it cannot disagree.
 */

import type { ReactNode } from "react";
import Link from "next/link";

export type OnboardingAdminSummaryFigure = {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
};

export function OnboardingAdminSummary({
  figures,
}: {
  figures: readonly OnboardingAdminSummaryFigure[];
}) {
  return (
    <div className="oba-summary">
      {figures.map((figure) => {
        const body = (
          <>
            <span className="oba-summary-value">{figure.value}</span>
            <span className="oba-summary-label">{figure.label}</span>
            {figure.hint ? <span className="oba-summary-hint">{figure.hint}</span> : null}
          </>
        );
        return figure.href ? (
          <Link key={figure.label} className="oba-summary-tile oba-summary-link" href={figure.href}>
            {body}
          </Link>
        ) : (
          <div key={figure.label} className="oba-summary-tile">
            {body}
          </div>
        );
      })}
    </div>
  );
}
