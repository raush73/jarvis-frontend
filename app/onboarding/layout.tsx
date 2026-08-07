"use client";

/**
 * Phase 2 - the administrative workspace layout.
 *
 * Mounted at `/onboarding`, deliberately apart from the worker runtime at
 * `/workforce/onboarding`. The two are different identities with different tokens and different
 * guards, and keeping them at separate roots is what makes that separation visible in the route
 * itself rather than only in a guard file.
 *
 * The layout applies workspace admission once, so no administrative page has to remember to,
 * and supplies the stylesheet every administrative surface shares.
 */

import type { ReactNode } from "react";
import { OnboardingAdminGate } from "@/components/workforce/admin/OnboardingAdminGate";
import "./onboarding-admin.css";

export default function OnboardingAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="oba-page">
      <OnboardingAdminGate>{children}</OnboardingAdminGate>
    </div>
  );
}
