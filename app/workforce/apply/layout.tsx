"use client";

import type { ReactNode } from "react";
import { IdentityDraftProvider } from "@/components/workforce/IdentityDraftContext";

/**
 * Wraps the application flow so the Identity and Contact Information screens can share
 * one draft across a route change (the backend Identity stage saves atomically).
 */
export default function ApplyLayout({ children }: { children: ReactNode }) {
  return <IdentityDraftProvider>{children}</IdentityDraftProvider>;
}
