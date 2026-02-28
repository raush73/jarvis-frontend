"use client";

import { useEffect, useState } from "react";

export type AuthState = {
  isAuthenticated: boolean;
  demoTitle: string;
};

const TOKEN_KEY = "jp_accessToken";

/**
 * Lightweight auth hook for the frontend.
 * Source of truth for "authenticated" is presence of the access token in localStorage.
 */
export function useAuth(): AuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      setIsAuthenticated(Boolean(token));
    } catch {
      // If localStorage is unavailable, treat as unauthenticated.
      setIsAuthenticated(false);
    }
  }, []);

  return {
    isAuthenticated,
    demoTitle: isAuthenticated ? "Demo mode" : "Demo mode - sign in required",
  };
}
