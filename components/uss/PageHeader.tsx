import React from "react";

/**
 * Industrial Light V1 — PageHeader
 *
 * Renders the top title area for a Jarvis Prime page.
 *
 * Structure:
 *   [Title (h1-style)]          [Actions area]
 *   [Subtitle (optional)]
 *
 * Typography:
 *   Title:    26px, weight 700, --color-text-primary (#111827)
 *   Subtitle: 14px, weight 400, --color-text-muted (#4b5563)
 *
 * Actions slot: accepts any ReactNode — typically a primary Button
 * or a Link styled as a button for the page-level CTA.
 *
 * For pages that also show a back button, ID badge, or status badge,
 * implement those inline in the page (see /customers/[id]/page.tsx
 * .detail-header for the approved pattern).
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
      <div>
        <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.3px" }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: "14px", color: "var(--color-text-muted)", marginTop: "4px" }}>
            {subtitle}
          </div>
        )}
      </div>
      <div>{actions}</div>
    </div>
  );
}
