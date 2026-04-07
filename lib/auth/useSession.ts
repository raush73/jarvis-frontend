"use client";

import { useEffect, useState } from "react";

type JwtPayload = {
  sub: string;
  email: string;
  fullName?: string | null;
  roles: string[];
  permissions: string[];
  scopes?: Record<string, string>;
  exp?: number;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(payload);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

const BROAD_ACCESS_ROLES = ["admin"];

const MODULE_ACCESS: Record<string, string[]> = {
  admin:        ["admin"],
  accounting:   ["admin", "accounting"],
  kpi:          ["admin", "accounting", "sales"],
  friday:       ["admin", "sales", "recruiting"],
  orders:       ["admin", "sales", "recruiting", "accounting"],
  customers:    ["admin", "sales", "recruiting", "accounting"],
  employees:    ["admin", "recruiting"],
  "time-entry": ["admin", "accounting", "recruiting"],
};

export type SessionInfo = {
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  roles: string[];
  permissions: string[];
  scopes: Record<string, string>;
  hasRole: (role: string) => boolean;
  hasPermission: (perm: string) => boolean;
  getScope: (resource: string) => string;
  canAccessModule: (moduleKey: string) => boolean;
  isAdmin: boolean;
  isSalesOnly: boolean;
};

/**
 * Returns the same "loading" state for SSR and first client render
 * (no localStorage access during render). Real session is set only
 * inside a useEffect after mount so hydration is always stable.
 */
export function useSession(): SessionInfo {
  const [session, setSession] = useState<SessionInfo>(loadingSession);

  useEffect(() => {
    const token = localStorage.getItem("jp_accessToken");
    if (!token) {
      setSession(emptySession());
      return;
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      setSession(emptySession());
      return;
    }

    const roles = (payload.roles ?? []).map((r) => r.toLowerCase());
    const permissions = payload.permissions ?? [];
    const scopes: Record<string, string> = payload.scopes ?? {};
    const isAdmin = roles.includes("admin");
    const hasBroadAccess = roles.some((r) => BROAD_ACCESS_ROLES.includes(r));
    const isSalesOnly =
      roles.includes("sales") && !hasBroadAccess &&
      !roles.includes("recruiting") && !roles.includes("accounting");

    setSession({
      ready: true,
      authenticated: true,
      userId: payload.sub,
      email: payload.email,
      fullName: payload.fullName ?? null,
      roles,
      permissions,
      scopes,
      hasRole: (role: string) => roles.includes(role.toLowerCase()),
      hasPermission: (perm: string) => {
        if (isAdmin) return true;
        return permissions.includes(perm);
      },
      getScope: (resource: string) => {
        if (isAdmin) return "COMPANY";
        return scopes[resource] ?? "NONE";
      },
      canAccessModule: (moduleKey: string) => {
        if (isAdmin) return true;
        const allowed = MODULE_ACCESS[moduleKey];
        if (!allowed) return true;
        return roles.some((r) => allowed.includes(r));
      },
      isAdmin,
      isSalesOnly,
    });
  }, []);

  return session;
}

function loadingSession(): SessionInfo {
  return {
    ready: false,
    authenticated: false,
    userId: null,
    email: null,
    fullName: null,
    roles: [],
    permissions: [],
    scopes: {},
    hasRole: () => false,
    hasPermission: () => false,
    getScope: () => "NONE",
    canAccessModule: () => true,
    isAdmin: false,
    isSalesOnly: false,
  };
}

function emptySession(): SessionInfo {
  return {
    ready: true,
    authenticated: false,
    userId: null,
    email: null,
    fullName: null,
    roles: [],
    permissions: [],
    scopes: {},
    hasRole: () => false,
    hasPermission: () => false,
    getScope: () => "NONE",
    canAccessModule: () => false,
    isAdmin: false,
    isSalesOnly: false,
  };
}
