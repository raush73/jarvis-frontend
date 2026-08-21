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
// Module capsules register their own administrative panels here, for the side effect only.
// The workspace itself still holds no list of modules: this line says a capsule exists, and
// the capsule says what it renders and under which module key.
import "@/components/workforce/onboarding/modules/emergency-contacts/register.admin";
import "@/components/workforce/onboarding/modules/employment-eligibility/register.admin";
import "@/components/workforce/onboarding/modules/federal-tax/register.admin";
import "./onboarding-admin.css";

export default function OnboardingAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="oba-page">
      <OnboardingAdminGate>{children}</OnboardingAdminGate>
    </div>
  );
}
