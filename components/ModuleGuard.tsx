"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/useSession";

const PUBLIC_PATHS = ["/login", "/register", "/auth"];

export default function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    if (!session.ready) return;

    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      setAllowed(true);
      return;
    }

    if (!session.authenticated) {
      setAllowed(true);
      return;
    }

    const moduleKey = pathname.split("/").filter(Boolean)[0] || "";
    if (!moduleKey) {
      setAllowed(true);
      return;
    }

    if (!session.canAccessModule(moduleKey)) {
      setAllowed(false);
      const fallback = session.canAccessModule("orders") ? "/orders" : "/login";
      router.replace(fallback);
      return;
    }

    setAllowed(true);
  }, [pathname, session, router]);

  if (!allowed) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "60vh",
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
      }}>
        Redirecting...
      </div>
    );
  }

  return <>{children}</>;
}
