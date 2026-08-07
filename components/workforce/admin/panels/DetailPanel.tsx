"use client";

/**
 * Phase 2 - reusable detail presentation.
 *
 * Labelled value groups and the card that holds them. Every administrative surface, and every
 * module's future administrative panel, presents recorded facts through these, so a value's
 * label, its empty state, and its emphasis are decided once.
 *
 * `value === null` renders an explicit "not recorded" rather than an empty cell: on an
 * administrative surface the difference between "recorded as nothing" and "never recorded"
 * is the difference between a complete record and an incomplete one.
 */

import type { ReactNode } from "react";

export function OnboardingAdminPanel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="oba-panel">
      <div className="oba-panel-head">
        <div>
          <h2 className="oba-panel-title">{title}</h2>
          {description ? <p className="oba-panel-description">{description}</p> : null}
        </div>
        {actions ? <div className="oba-panel-actions">{actions}</div> : null}
      </div>
      <div className="oba-panel-body">{children}</div>
    </section>
  );
}

export function OnboardingAdminFieldList({ children }: { children: ReactNode }) {
  return <dl className="oba-fields">{children}</dl>;
}

export function OnboardingAdminField({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode | null;
  hint?: string;
}) {
  return (
    <div className="oba-field">
      <dt className="oba-field-label">{label}</dt>
      <dd className="oba-field-value">
        {value === null || value === undefined || value === "" ? (
          <span className="oba-field-absent">Not recorded</span>
        ) : (
          value
        )}
        {hint ? <span className="oba-field-hint">{hint}</span> : null}
      </dd>
    </div>
  );
}

/** A timestamp as an administrative surface shows one: absolute, and never invented. */
export function OnboardingAdminTimestamp({ value }: { value: string | null }) {
  if (!value) return <span className="oba-field-absent">Not recorded</span>;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return <span>{value}</span>;
  return <time dateTime={value}>{parsed.toLocaleString()}</time>;
}
