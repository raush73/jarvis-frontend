"use client";

/**
 * Phase 2 - administrative navigation.
 *
 * The workspace's own navigation, scoped by permission: a destination an operator holds no
 * grant for is ABSENT rather than shown and refused, which is the interface consequence of
 * authorization being per receiving administrative function.
 *
 * Navigation is by SECTION, not by module. Nothing here names an onboarding module, and
 * nothing here needs to: the queues an operator can open are discovered from the registry at
 * request time, so a module phase adds work to this workspace without adding a link to it.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/useSession";
import {
  ONBOARDING_ADMIN_PERMISSIONS,
  useOnboardingAdminPermissions,
} from "./adminPermissions";

type Section = {
  href: string;
  label: string;
  permission: string;
  /** Matched as a prefix so a detail page keeps its section highlighted. */
  match: string;
};

const SECTIONS: Section[] = [
  {
    href: "/onboarding",
    label: "Dashboard",
    permission: ONBOARDING_ADMIN_PERMISSIONS.access,
    match: "/onboarding",
  },
  {
    href: "/onboarding/queues",
    label: "Queues",
    permission: ONBOARDING_ADMIN_PERMISSIONS.access,
    match: "/onboarding/queues",
  },
  {
    href: "/onboarding/workers",
    label: "Workers",
    permission: ONBOARDING_ADMIN_PERMISSIONS.workerRead,
    match: "/onboarding/workers",
  },
  {
    href: "/onboarding/packets",
    label: "Packets",
    permission: ONBOARDING_ADMIN_PERMISSIONS.workerRead,
    match: "/onboarding/packets",
  },
];

export function OnboardingAdminNav() {
  const pathname = usePathname() ?? "/onboarding";
  const session = useSession();
  const { holds } = useOnboardingAdminPermissions(session);

  const visible = SECTIONS.filter((section) => holds(section.permission));
  if (visible.length === 0) return null;

  return (
    <nav className="oba-nav" aria-label="Workforce Onboarding administration">
      {visible.map((section) => {
        // Longest match wins, so /onboarding/queues does not also light up Dashboard.
        const current = visible
          .filter((candidate) => pathname.startsWith(candidate.match))
          .sort((a, b) => b.match.length - a.match.length)[0];
        return (
          <Link
            key={section.href}
            href={section.href}
            className={
              current?.href === section.href ? "oba-nav-link oba-nav-current" : "oba-nav-link"
            }
            aria-current={current?.href === section.href ? "page" : undefined}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
