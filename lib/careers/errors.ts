/**
 * Jarvis Careers - normalize errors thrown by apiFetch into a friendly message.
 *
 * apiFetch throws Error("API <status> <statusText>: <body>"), where <body> is
 * typically a NestJS JSON error payload ({ message, statusCode, error }).
 */
export function getApiErrorMessage(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  if (!raw) return fallback;

  if (raw.includes("no access token")) {
    return "Your session has expired. Please sign in again.";
  }

  const sep = raw.indexOf(": ");
  const body = sep >= 0 ? raw.slice(sep + 2) : raw;

  try {
    const parsed = JSON.parse(body) as {
      message?: string | string[];
    };
    if (Array.isArray(parsed.message)) return parsed.message.join(", ");
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
  } catch {
    // body was not JSON; fall through
  }

  return raw || fallback;
}
