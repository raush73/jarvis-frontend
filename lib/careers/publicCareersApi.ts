import { API_BASE } from "@/lib/api";
import { EmploymentType } from "@/lib/careers/jobPostingsApi";

/**
 * Jarvis Careers - PUBLIC portal API client (V2.1.4).
 *
 * Unauthenticated, read-only access to the public Job Posting snapshot, resolved
 * by the immutable canonical publicCode. Backed by the public backend endpoint
 * GET /careers/public/postings/:publicCode (see PUBLIC_ENDPOINT_SECURITY.md).
 *
 * This intentionally does NOT use the authenticated `apiFetch` helper (which
 * requires an access token). Public visitors have no session; requests are made
 * directly and send no Authorization header.
 */

/** Public-safe Job Posting snapshot. Contains no internal identifiers. */
export type PublicJobPosting = {
  publicCode: string;
  title: string | null;
  department: string | null;
  employmentType: EmploymentType | null;
  location: string | null;
  description: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  publishedAt: string | null;
};

/**
 * Fetch a public job by its canonical publicCode. Returns null when the posting
 * does not exist or is not publicly available (draft / closed / filled /
 * internal-visibility), i.e. a 404 from the backend.
 */
export async function getPublicJob(
  publicCode: string,
): Promise<PublicJobPosting | null> {
  const res = await fetch(
    `${API_BASE}/careers/public/postings/${encodeURIComponent(publicCode)}`,
    { headers: { Accept: "application/json" } },
  );
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Failed to load job posting (${res.status})`);
  }
  return (await res.json()) as PublicJobPosting;
}
