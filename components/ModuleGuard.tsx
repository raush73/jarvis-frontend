"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/useSession";

const PUBLIC_PATHS = ["/login", "/register", "/auth"];

type GuardState = "allowed" | "denied" | "loading";

export default function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [guard, setGuard] = useState<GuardState>("allowed");

  useEffect(() => {
    if (!session.ready) {
      setGuard("loading");
      return;
    }

    if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      setGuard("allowed");
      return;
    }

    if (!session.authenticated) {
      setGuard("allowed");
      return;
    }

    const moduleKey = pathname.split("/").filter(Boolean)[0] || "";
    if (!moduleKey) {
      setGuard("allowed");
      return;
    }

    if (!session.canAccessModule(moduleKey)) {
      setGuard("denied");
      return;
    }

    setGuard("allowed");
  }, [pathname, session, router]);

  if (guard === "loading") {
    return null;
  }

  if (guard === "denied") {
    return <AccessDeniedView router={router} session={session} />;
  }

  return <>{children}</>;
}

function AccessDeniedView({
  router,
  session,
}: {
  router: ReturnType<typeof useRouter>;
  session: ReturnType<typeof useSession>;
}) {
  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      const fallback = session.canAccessModule("orders") ? "/orders" : "/kpi";
      router.push(fallback);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "55vh",
      padding: "24px",
      textAlign: "center",
    }}>
      <div style={{
        fontSize: 20,
        fontWeight: 700,
        color: "rgba(255,255,255,0.88)",
        marginBottom: 10,
      }}>
        Access Denied
      </div>
      <div style={{
        fontSize: 14,
        color: "rgba(255,255,255,0.55)",
        maxWidth: 380,
        lineHeight: 1.5,
        marginBottom: 20,
      }}>
        You do not have permission to access this area.
        Contact your administrator if you believe this is incorrect.
      </div>
      <button
        type="button"
        onClick={handleGoBack}
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.85)",
          padding: "8px 20px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Go Back
      </button>
    </div>
  );
}
