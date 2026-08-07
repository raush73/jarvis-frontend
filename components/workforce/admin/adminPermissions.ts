"use client";

/**
 * Phase 2 - the workspace's permission vocabulary, client side.
 *
 * These strings mirror the backend's `PERMISSIONS.WORKFORCE_ONBOARDING_ADMIN_*` and the module
 * permissions each contributed queue and action declares for itself. They exist here so a
 * control can decide whether to RENDER; they are never the authorization itself, which is
 * enforced server-side on every request and re-enforced per administrative function.
 *
 * Two consequences follow, and both are deliberate:
 *
 *  - A control the operator holds no grant for is ABSENT, not disabled. A disabled control
 *    still tells him that other people act on this worker, and it invites a request the server
 *    will refuse.
 *  - A control being present is never treated as permission. The server refuses regardless, so
 *    a stale token or a hand-edited page yields a refusal rather than an action.
 */

import type { SessionInfo } from "@/lib/auth/useSession";

export const ONBOARDING_ADMIN_PERMISSIONS = {
  access: "workforce.onboarding.admin.access",
  workerRead: "workforce.onboarding.admin.worker.read",
  auditRead: "workforce.onboarding.admin.audit.read",
  /** Phase 4. Governed onboarding artifacts: the listing, and authorized retrieval. */
  documentRead: "workforce.onboarding.document.read",
  /** The delivered secure-identity grant. Never bypassed by a role. */
  ssnReveal: "workforce.ssn.reveal",
} as const;

export type OnboardingAdminPermissionState = {
  ready: boolean;
  authenticated: boolean;
  holds: (permission: string) => boolean;
  /** May open the workspace at all. */
  canOpenWorkspace: boolean;
  canReadWorkers: boolean;
  canReadAudit: boolean;
  /** May list a worker's governed artifacts and ask for an authorized retrieval. */
  canReadDocuments: boolean;
  /**
   * May reveal a full sensitive value.
   *
   * Checked against effective grants ONLY - the `admin` role is not a bypass here, exactly as
   * `SensitiveDataGuard` is not bypassed server-side. A workspace that offered the reveal to
   * an administrator who lacks the grant would be advertising a disclosure the server refuses.
   */
  canRevealSensitiveValues: boolean;
};

export function useOnboardingAdminPermissions(
  session: SessionInfo,
): OnboardingAdminPermissionState {
  const holds = (permission: string): boolean => session.hasPermission(permission);

  return {
    ready: session.ready,
    authenticated: session.authenticated,
    holds,
    canOpenWorkspace: holds(ONBOARDING_ADMIN_PERMISSIONS.access),
    canReadWorkers: holds(ONBOARDING_ADMIN_PERMISSIONS.workerRead),
    canReadAudit: holds(ONBOARDING_ADMIN_PERMISSIONS.auditRead),
    canReadDocuments: holds(ONBOARDING_ADMIN_PERMISSIONS.documentRead),
    canRevealSensitiveValues: session.permissions.includes(
      ONBOARDING_ADMIN_PERMISSIONS.ssnReveal,
    ),
  };
}
