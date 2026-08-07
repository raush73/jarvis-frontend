"use client";

/**
 * Phase 2 - the reusable review panel.
 *
 * The content region a module's administrative panel mounts into, with the review furniture
 * around it: what is being reviewed, its governed citation, its recorded status, and the
 * processing controls that act on it.
 *
 * When no module has registered a panel - which is every module in Phase 2, because no business
 * module exists - the region states that plainly and names the module whose phase will supply
 * it. That is the governed placeholder this phase is permitted to display: the workspace shows
 * WHAT it does not yet have rather than inventing a stand-in for it.
 */

import type { ReactNode } from "react";
import type {
  OnboardingAdminAction,
  OnboardingAdminActionResult,
  OnboardingAdminModule,
  OnboardingAdminModuleHistory,
  OnboardingAdminPacket,
  OnboardingAdminWorker,
} from "@/lib/workforce/onboardingAdminApi";
import { resolveOnboardingAdminPanel } from "../adminPanelRegistry";
import { OnboardingAdminPanel } from "./DetailPanel";
import { OnboardingAdminProcessingControls } from "./ProcessingControls";

export function OnboardingAdminReviewPanel({
  worker,
  packet,
  module,
  history,
  actions,
  onExecuted,
  children,
}: {
  worker: OnboardingAdminWorker;
  packet: OnboardingAdminPacket | null;
  module: OnboardingAdminModule | null;
  history?: OnboardingAdminModuleHistory | null;
  /** Already permission-scoped by the server, and scoped to this module. */
  actions?: readonly OnboardingAdminAction[];
  onExecuted?: (result: OnboardingAdminActionResult) => void;
  /** Additional review furniture the surface supplies, above the module's panel. */
  children?: ReactNode;
}) {
  const moduleKey = module?.moduleKey ?? history?.moduleKey ?? null;
  const renderer = moduleKey ? resolveOnboardingAdminPanel(moduleKey) : undefined;
  const title = module?.title ?? history?.title ?? "Review";
  const governance = module?.governanceSection ?? history?.governanceSection ?? null;
  const moduleActions = (actions ?? []).filter(
    (action) => !moduleKey || action.moduleKey === moduleKey,
  );

  return (
    <OnboardingAdminPanel
      title={title}
      description={governance ? `Governed by ${governance}` : undefined}
    >
      {children}

      <div className="oba-review-region">
        {renderer ? (
          renderer({ worker, packet, module, history: history ?? null })
        ) : (
          <p className="oba-review-placeholder">
            No administrative panel has been registered for
            {moduleKey ? ` ${moduleKey}` : " this module"}. Its own module phase supplies the
            recorded values and the review it requires; this workspace supplies the surface it
            mounts into.
          </p>
        )}
      </div>

      {moduleActions.length > 0 ? (
        <OnboardingAdminProcessingControls
          actions={moduleActions}
          candidateId={worker.candidateId}
          packetId={packet?.packetId ?? null}
          onExecuted={onExecuted}
        />
      ) : null}
    </OnboardingAdminPanel>
  );
}
