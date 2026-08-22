import { BACKEND_ORIGIN } from "@/lib/backendOrigin";

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_BASE ?? '/api')
    : (process.env.NEXT_PUBLIC_API_BASE ?? BACKEND_ORIGIN);

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('jp_accessToken');
  } catch {
    return null;
  }
}

export type FridayResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error: string; data?: any };

/**
 * Fetch wrapper that does NOT throw on HTTP errors.
 * Returns structured result so callers can handle 409 Conflict
 * and other error codes explicitly.
 */
export async function fridayFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<FridayResult<T>> {
  const token = getToken();
  if (!token) {
    return { ok: false, status: 0, error: 'Not authenticated' };
  }

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const text = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (res.ok) {
      return { ok: true, data: parsed as T, status: res.status };
    }

    const errorMsg = parsed?.message ?? (typeof parsed === 'string' ? parsed : `Request failed (${res.status})`);
    console.error(`[fridayFetch] ${init.method ?? 'GET'} ${path} failed (${res.status}):`, errorMsg);
    return {
      ok: false,
      status: res.status,
      error: errorMsg,
      data: parsed,
    };
  } catch (err: any) {
    const errorMsg = err?.message ?? 'Network error';
    console.error(`[fridayFetch] ${init.method ?? 'GET'} ${path} network error:`, errorMsg);
    return {
      ok: false,
      status: 0,
      error: errorMsg,
    };
  }
}
