import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./workforce.css";

export const metadata: Metadata = {
  title: "Workforce Application",
  description:
    "Apply to join the workforce. Complete your application online and a recruiter will review it.",
};

/**
 * Public Workforce Application surface.
 *
 * Chromeless by design: internal navigation is suppressed for `/workforce/*` in
 * AppChrome because this surface is used by external applicants arriving from job
 * boards, the company website, and recruiter-issued links.
 */
export default function WorkforceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="wf-page">{children}</div>;
}
