"use client";

/**
 * Phase 2 - the evidence slot, as an architectural location only.
 *
 * Implementation plan Section 10 lists an evidence viewer among the reusable review
 * components this phase owns, and Section 7.10 gives the components that actually RETRIEVE
 * and DISPLAY a document to Phase 4, which mounts its authorized retrieval affordance
 * "inside the Phase 2 review components". Those two statements are only compatible if what
 * Phase 2 owns is the SLOT and Phase 4 owns what fills it.
 *
 * So this is the slot and nothing else. It retrieves nothing, displays no document, holds no
 * document identifier, issues no request, and knows no storage. It declares that a module's
 * administrative panel expects evidence at a named place, labels it, and renders whatever
 * affordance has been supplied - which, until Phase 4, is nothing.
 *
 * HOW PHASE 4 INTEGRATES, WITHOUT A WORKSPACE CHANGE. The affordance is REGISTERED once,
 * exactly as a module's administrative panel is, rather than passed down by each panel that
 * declares a slot. Phase 4 therefore calls `registerOnboardingAdminEvidenceAffordance` in
 * its own capsule and every slot already declared by every module gains retrieval at once -
 * with no module panel edited and no file here changed. Passing a slot its own affordance
 * remains possible for a surface that needs a local one, and overrides the registration.
 */

import type { ReactNode } from "react";

export type OnboardingAdminEvidenceSlotDescriptor = {
  /** Stable identifier for the evidence this slot expects. */
  slotKey: string;
  label: string;
  /** Why this evidence is expected. Never the evidence itself. */
  description?: string;
};

export type OnboardingAdminEvidenceAffordance = (
  slot: OnboardingAdminEvidenceSlotDescriptor,
) => ReactNode;

let registeredAffordance: OnboardingAdminEvidenceAffordance | null = null;

/**
 * Register the affordance that fills every evidence slot.
 *
 * Owned by the phase that owns document retrieval. Phase 2 registers nothing, so every slot
 * renders its unavailable state.
 */
export function registerOnboardingAdminEvidenceAffordance(
  affordance: OnboardingAdminEvidenceAffordance,
): void {
  registeredAffordance = affordance;
}

/** TEST SUPPORT. Clears the registration so one suite cannot leak into another. */
export function resetOnboardingAdminEvidenceAffordance(): void {
  registeredAffordance = null;
}

/**
 * One named place evidence will be shown.
 *
 * With no affordance registered the slot states plainly that document retrieval is not
 * available, rather than rendering a control that would do nothing: an administrative
 * surface appearing to offer a document it cannot produce is worse than one that says so.
 */
export function OnboardingAdminEvidenceSlot({
  slot,
  affordance,
}: {
  slot: OnboardingAdminEvidenceSlotDescriptor;
  /** Overrides the registered affordance for this slot only. */
  affordance?: ReactNode;
}) {
  const filled = affordance ?? registeredAffordance?.(slot) ?? null;

  return (
    <div className="oba-evidence-slot" data-evidence-slot={slot.slotKey}>
      <div className="oba-evidence-head">
        <span className="oba-evidence-label">{slot.label}</span>
        {slot.description ? (
          <span className="oba-evidence-description">{slot.description}</span>
        ) : null}
      </div>
      <div className="oba-evidence-body">
        {filled ?? (
          <span className="oba-field-absent">
            Document retrieval is not available in this phase
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The group of slots a module's administrative panel declares.
 *
 * Renders an explicit empty state rather than nothing, because a review panel that expects
 * evidence and shows an unexplained gap reads as a defect.
 */
export function OnboardingAdminEvidencePanel({
  slots,
}: {
  slots: readonly OnboardingAdminEvidenceSlotDescriptor[];
}) {
  if (slots.length === 0) {
    return (
      <p className="oba-notice oba-notice-empty">
        This module declares no supporting evidence.
      </p>
    );
  }

  return (
    <div className="oba-evidence">
      {slots.map((slot) => (
        <OnboardingAdminEvidenceSlot key={slot.slotKey} slot={slot} />
      ))}
    </div>
  );
}
