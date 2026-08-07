"use client";

/**
 * Phase 2 - the one page shell for the administrative workspace.
 *
 * Every administrative surface, including every module's future administrative panel, renders
 * inside this shell: workspace navigation, a title, an optional worker context header, a
 * permission-aware action bar, and a content region. A module phase mounts a panel into the
 * content region; it does not build a page.
 *
 * The shell decides nothing about authorization. It renders the action bar it is given, and
 * the controls in that bar are themselves absent unless the operator holds their grants -
 * which is why an unpermitted control cannot appear here even by accident.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { OnboardingAdminNav } from "./OnboardingAdminNav";

export function OnboardingAdminShell({
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
  context,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  /** The permission-aware action bar. Controls absent unless granted. */
  actions?: ReactNode;
  /** Worker or packet context, rendered above the content region. */
  context?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="oba-shell">
      <OnboardingAdminNav />

      {backHref ? (
        <Link className="oba-back" href={backHref}>
          &larr; {backLabel ?? "Back"}
        </Link>
      ) : null}

      <header className="oba-header">
        <div>
          <h1 className="oba-title">{title}</h1>
          {subtitle ? <p className="oba-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="oba-actions">{actions}</div> : null}
      </header>

      {context ? <div className="oba-context">{context}</div> : null}

      <div className="oba-body">{children}</div>
    </div>
  );
}
