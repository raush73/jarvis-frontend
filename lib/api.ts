/**
 * API base strategy:
 * - ALWAYS use SAME-ORIGIN /api/* so Next can proxy to backend (avoids CORS)
 *
 * Optional override:
 *   NEXT_PUBLIC_API_BASE can force a full base URL if ever needed.
 */
export const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE ?? "/api")
    : (process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:3000");

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("jp_accessToken");
  } catch {
    return null;
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("jp_accessToken");
  } catch {
    // ignore
  }
}

function isPublicPath(path: string): boolean {
  // These endpoints must work without an access token
  return (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/dev/")
  );
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();

  // If this is not a public path, require a token before making the request.
  // This prevents unauthenticated fetches during hydration/race conditions.
  if (!token && !isPublicPath(path)) {
    throw new Error("API requires authentication, but no access token is present.");
  }

  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
    }
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}
