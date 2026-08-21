/** Customer Detail shows Promote to Prospect only for LEAD records. */
export function isPromoteToProspectActionVisible(
  lifecycleStatus: unknown,
): boolean {
  return lifecycleStatus === "LEAD";
}

export function parseJarvisApiError(error: unknown, fallback: string): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const idx = raw.indexOf(": ");
  const body = idx >= 0 ? raw.slice(idx + 2) : raw;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
    if (Array.isArray(parsed?.message) && parsed.message.length > 0) {
      return parsed.message.map(String).join(" ");
    }
  } catch {
    // body is not JSON
  }
  return body.trim() || fallback;
}
