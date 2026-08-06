/**
 * Phase 1 - the client-side module renderer registry.
 *
 * The browser counterpart of the server's governed module registry, and it works the same
 * way: a module capsule registers ITSELF, and the runtime learns modules exist only because
 * they registered. There is therefore no compile-time list of onboarding modules in the
 * runtime, no switch statement over module names, and no ordering array anywhere.
 *
 * This registry answers exactly one question - "what renders this module?" - and never
 * "which modules are there?" or "what order do they come in?". Those are SERVER answers,
 * supplied by the runtime projection. A registry that could enumerate modules would drift
 * into being a second answer to what onboarding requires.
 *
 * It is EMPTY in Phase 1 and stays empty until a business module phase registers a
 * renderer.
 */

import type { ReactNode } from "react";
import type {
  OnboardingRuntimeModule,
  OnboardingRuntimeStep,
} from "@/lib/workforce/onboardingRuntimeApi";

/** What the runtime hands a module renderer. */
export type OnboardingModuleRendererProps = {
  /** The packet this module is being performed within. */
  invocationId: string;
  /** The module as the server described it, including its own declared steps. */
  module: OnboardingRuntimeModule;
  /** The step being rendered, which the MODULE declared. */
  step: OnboardingRuntimeStep;
  /** The module's captured input. Opaque to the runtime; the module owns its meaning. */
  draft: Record<string, unknown>;
  /** Record one answer. Held locally and persisted by the runtime's own save cycle. */
  setValue: (key: string, value: unknown) => void;
  /** Persist now rather than waiting for the debounce. */
  save: () => Promise<void>;
  /**
   * Ask the server to complete this module. The module's own registered validator decides;
   * a refusal returns its validation codes and nothing is recorded. Provided by the runtime
   * so a module does not have to know how to refresh the projection afterwards.
   */
  complete: (options?: { confirmNoChange?: boolean }) => Promise<void>;
  /** True while a save or completion is in flight. */
  busy: boolean;
};

export type OnboardingModuleRenderer = (
  props: OnboardingModuleRendererProps,
) => ReactNode;

const renderers = new Map<string, OnboardingModuleRenderer>();

/**
 * Register the renderer for one module. Called by the module's own capsule, never by the
 * runtime. Re-registering the same key replaces the renderer, which is what makes module
 * capsules hot-reloadable in development and independently testable.
 */
export function registerOnboardingModuleRenderer(
  moduleKey: string,
  renderer: OnboardingModuleRenderer,
): void {
  renderers.set(moduleKey, renderer);
}

/** The renderer for a module, or undefined when no capsule has registered one. */
export function resolveOnboardingModuleRenderer(
  moduleKey: string,
): OnboardingModuleRenderer | undefined {
  return renderers.get(moduleKey);
}

/** TEST SUPPORT. Clears registrations so one suite cannot leak into another. */
export function resetOnboardingModuleRenderers(): void {
  renderers.clear();
}
