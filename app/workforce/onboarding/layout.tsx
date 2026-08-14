"use client";

/**
 * Phase 1 - the onboarding runtime layout.
 *
 * Mounts the runtime state container once for every onboarding route, so navigating
 * between the dashboard, a packet, and a module step reuses one projection rather than
 * re-reading it per screen, and so an in-flight draft survives a step transition.
 *
 * The parent `app/workforce/layout.tsx` already supplies the worker page frame and
 * `workforce.css`; this layout adds only what onboarding itself needs. The Workforce
 * Application wizard's shell is not touched, extended, or repurposed.
 */

import type { ReactNode } from "react";
import { OnboardingRuntimeProvider } from "@/components/workforce/onboarding/runtime/OnboardingRuntimeContext";
import OnboardingSessionWatch from "@/components/workforce/onboarding/runtime/OnboardingSessionWatch";
// Module capsules register their own renderers here, for the side effect only. The runtime
// still holds no list of modules: this line says a capsule exists, and the capsule says what
// it renders and under which module key.
import "@/components/workforce/onboarding/modules/emergency-contacts/register.worker";
import "@/components/workforce/onboarding/modules/employment-eligibility/register.worker";
import "./onboarding.css";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <OnboardingRuntimeProvider>
      <div className="ob-page">
        <OnboardingSessionWatch />
        {children}
      </div>
    </OnboardingRuntimeProvider>
  );
}
