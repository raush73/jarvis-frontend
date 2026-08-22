/**
 * Authoritative Nest origin for server-side Next proxies and rewrites.
 *
 * Browser traffic stays same-origin `/api/*` (see API_BASE in lib/api.ts).
 * Server route handlers and next.config rewrites must use this origin so
 * Node fetch() cannot land on a different process bound to 127.0.0.1:3000.
 *
 * Override with BACKEND_URL (or NEXT_PUBLIC_API_BASE_URL for legacy proxies).
 * Default is IPv6 loopback, which is the Jarvis Nest bind on this host.
 */
export const BACKEND_ORIGIN = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://[::1]:3000"
).replace(/\/$/, "");
