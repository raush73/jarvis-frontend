/**
 * Workforce Application - browser step map.
 *
 * The backend owns a LOCKED eight-stage order that must not be reordered. These are
 * SCREENS, not stages: several screens present one backend stage, which is a
 * presentation split only. Nothing here changes application sequencing.
 *
 *   Identity + Contact Information  -> IDENTITY_INFORMATION (one atomic save)
 *   Tools + PPE                     -> TOOLS_PPE (already two endpoints)
 *   Military + Union + Legal        -> LEGAL_ACKNOWLEDGEMENTS
 *
 * REFERENCES is locked stage 6 with no backend implementation; it collects nothing and
 * its validator passes through, so it is not presented as a screen.
 */

import type { WorkforceApplicationStage } from "@/lib/workforce/workforceApi";

export type WizardStep = {
  /** Path segment under /workforce/apply. */
  slug: string;
  /** Short label for the progress rail. */
  label: string;
  /** Full heading shown on the screen. */
  title: string;
  /** The backend stage this screen writes into. */
  stage: WorkforceApplicationStage;
};

export const WIZARD_STEPS: WizardStep[] = [
  {
    slug: "identity",
    label: "Identity",
    title: "Identity",
    stage: "IDENTITY_INFORMATION",
  },
  {
    slug: "contact",
    label: "Contact",
    title: "Contact Information",
    stage: "IDENTITY_INFORMATION",
  },
  {
    slug: "trade",
    label: "Trade",
    title: "Trade Selection",
    stage: "PRIMARY_TRADE",
  },
  {
    slug: "work-history",
    label: "Work History",
    title: "Work History",
    stage: "WORK_HISTORY",
  },
  {
    slug: "certifications",
    label: "Certifications",
    title: "Certifications",
    stage: "CERTIFICATIONS_LICENSES",
  },
  { slug: "tools", label: "Tools", title: "Tools", stage: "TOOLS_PPE" },
  { slug: "ppe", label: "PPE", title: "Personal Protective Equipment", stage: "TOOLS_PPE" },
  {
    slug: "military",
    label: "Military",
    title: "Military Service",
    stage: "LEGAL_ACKNOWLEDGEMENTS",
  },
  {
    slug: "union",
    label: "Union",
    title: "Union Affiliation",
    stage: "LEGAL_ACKNOWLEDGEMENTS",
  },
  {
    slug: "legal",
    label: "Legal",
    title: "Legal Acknowledgments",
    stage: "LEGAL_ACKNOWLEDGEMENTS",
  },
  {
    slug: "review",
    label: "Review",
    title: "Application Review",
    stage: "REVIEW_SUBMIT",
  },
];

export const WIZARD_STEP_COUNT = WIZARD_STEPS.length;

export function stepIndex(slug: string): number {
  return WIZARD_STEPS.findIndex((s) => s.slug === slug);
}

export function stepPath(slug: string): string {
  return `/workforce/apply/${slug}`;
}

/** The screen before `slug`, or null at the first screen. */
export function previousStepPath(slug: string): string | null {
  const i = stepIndex(slug);
  return i > 0 ? stepPath(WIZARD_STEPS[i - 1].slug) : null;
}

/** The screen after `slug`, or null at the last screen. */
export function nextStepPath(slug: string): string | null {
  const i = stepIndex(slug);
  return i >= 0 && i < WIZARD_STEPS.length - 1
    ? stepPath(WIZARD_STEPS[i + 1].slug)
    : null;
}
