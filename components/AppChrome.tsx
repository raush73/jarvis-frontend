"use client";

import { usePathname } from "next/navigation";
import GlobalTopNav from "./GlobalTopNav";
import ModuleTabs from "./ModuleTabs";

/**
 * Renders the internal Jarvis chrome (global top nav + module tabs). Suppressed
 * on public-facing surfaces such as the public Careers portal (`/jobs/*`) and the
 * public Workforce Application (`/workforce/*`), which are intended for external
 * applicants and must not display internal navigation.
 */
const CHROMELESS_PREFIXES = ["/jobs", "/workforce"];

export default function AppChrome() {
  const pathname = usePathname();
  if (CHROMELESS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return (
    <>
      <GlobalTopNav />
      <ModuleTabs />
    </>
  );
}
