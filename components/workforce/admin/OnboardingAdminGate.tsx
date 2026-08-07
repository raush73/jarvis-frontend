"use client";

/**
 * Phase 2 - workspace admission.
 *
 * The first of the two authorization layers, rendered: an operator without workspace access
 * sees nothing of the workspace, not an empty version of it. The second layer - whether THIS
 * administrative function is his - is enforced per request by the server and reported by each
 * surface.
 *
 * This gate is a courtesy, not a control. It exists so an unauthorized operator is told
 * plainly rather than shown a page of refusals; the actual protection is that every endpoint
 * behind it refuses him.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth/useSession";
import {
  ONBOARDING_ADMIN_PERMISSIONS,
  useOnboardingAdminPermissions,
} from "./adminPermissions";

export function OnboardingAdminGate({
  permission = ONBOARDING_ADMIN_PERMISSIONS.access,
  children,
}: {
  permission?: string;
  children: ReactNode;
}) {
  const session = useSession();
  const { ready, authenticated, holds } = useOnboardingAdminPermissions(session);

  if (!ready) {
    return (
      <p className="oba-loading" role="status">
        Checking your access…
      </p>
    );
  }

  if (!authenticated) {
    return (
      <div className="oba-notice oba-notice-error" role="alert">
        <p className="oba-notice-title">Sign in to continue.</p>
        <p className="oba-notice-detail">
          The Workforce Onboarding administrative workspace holds worker material and is
          available only to signed-in staff.
        </p>
        <Link className="oba-btn" href="/login">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (!holds(permission)) {
    return (
      <div className="oba-notice oba-notice-error" role="alert">
        <p className="oba-notice-title">You do not have access to this workspace.</p>
        <p className="oba-notice-detail">
          Workforce Onboarding administration is granted per administrative function. Ask an
          administrator for the {permission} grant.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
