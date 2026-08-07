/**
 * Phase 2 - the client-side administrative panel registry.
 *
 * The staff counterpart of the worker runtime's renderer registry, and it works the same way: a
 * module capsule registers ITSELF, and the workspace learns a module has an administrative panel
 * only because that panel registered. There is therefore no compile-time list of modules in this
 * workspace and no switch statement over module names.
 *
 * This is the mechanism behind the phase's central promise - that "future onboarding modules
 * shall register into this workspace rather than modifying it". A module phase writes its panel,
 * registers it under its module key, and it appears in the worker workspace, the packet
 * workspace, and the investigation drill-down without any workspace file changing.
 *
 * It is EMPTY in Phase 2 and stays empty until a business module phase registers a panel.
 */

import type { ReactNode } from "react";
import type {
  OnboardingAdminModule,
  OnboardingAdminModuleHistory,
  OnboardingAdminPacket,
  OnboardingAdminWorker,
} from "@/lib/workforce/onboardingAdminApi";

/**
 * What the workspace hands a module's administrative panel.
 *
 * Note what is NOT here: no write capability of any kind. A module's administrative decisions
 * are taken through the registered processing actions the workspace executes and audits
 * uniformly, so a panel is a presentation of its own records and nothing more.
 */
export type OnboardingAdminPanelProps = {
  /** Masked worker context. The panel never receives an unmasked value. */
  worker: OnboardingAdminWorker;
  /** The packet in view, when the panel is mounted inside one. */
  packet: OnboardingAdminPacket | null;
  /** The module as the packet recorded it, when mounted inside a packet. */
  module: OnboardingAdminModule | null;
  /** The module's completion version chain, when mounted in an investigation. */
  history: OnboardingAdminModuleHistory | null;
};

export type OnboardingAdminPanelRenderer = (
  props: OnboardingAdminPanelProps,
) => ReactNode;

const panels = new Map<string, OnboardingAdminPanelRenderer>();

/** Register one module's administrative panel. Called by the module's own capsule. */
export function registerOnboardingAdminPanel(
  moduleKey: string,
  renderer: OnboardingAdminPanelRenderer,
): void {
  panels.set(moduleKey, renderer);
}

/** The panel for a module, or undefined when no capsule has registered one. */
export function resolveOnboardingAdminPanel(
  moduleKey: string,
): OnboardingAdminPanelRenderer | undefined {
  return panels.get(moduleKey);
}

/** TEST SUPPORT. Clears registrations so one suite cannot leak into another. */
export function resetOnboardingAdminPanels(): void {
  panels.clear();
}
