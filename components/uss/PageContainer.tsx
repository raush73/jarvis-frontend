import React from "react";

/**
 * Industrial Light V1 — PageContainer
 *
 * Sets the light page background (#f8fafc via --color-bg-main) and
 * provides the outermost padding layer for page content.
 *
 * All Jarvis Prime pages that use the Industrial Light V1 system
 * should wrap their content in PageContainer. This ensures the
 * correct background is applied and content is properly padded.
 *
 * Note: For complex pages with custom max-width or side padding,
 * the inner container can override padding — but background must
 * remain --color-bg-main.
 */
export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-bg-main)", minHeight: "100vh", padding: "24px" }}>
      {children}
    </div>
  );
}
