import { apiFetch } from "@/lib/api";

/**
 * Jarvis Careers - InternalApplicant API client (Phase 6 backend:
 * /careers/applicants). Internal-staff only; gated by careers.applicants.*
 * permissions server-side.
 *
 * An InternalApplicant is a PRE-STAFF identity (governance/JARVIS_CAREERS.md):
 * NOT a User and NEVER a Workforce Candidate.
 *
 * NOTE: backend `q` search matches email/firstName/lastName/phone only (not
 * city/state). The Applicants Hub therefore fetches a page and performs all
 * search/sort/pagination client-side, consistent with the Positions and Job
 * Postings hubs.
 */

export type Applicant = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  // Structured professional profile (V2.1.5A)
  professionalSummary: string | null;
  currentProfession: string | null;
  desiredProfession: string | null;
  longTermGoals: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicantListResponse = {
  items: Applicant[];
  total: number;
  limit: number;
  offset: number;
};

export type ApplicantInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  // Structured profile fields (V2.1.5A). Null explicitly clears the value.
  professionalSummary?: string | null;
  currentProfession?: string | null;
  desiredProfession?: string | null;
  longTermGoals?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
};

/** Display name for an applicant (falls back to email, then a placeholder). */
export function applicantName(a: Applicant): string {
  const full = [a.firstName, a.lastName]
    .filter((p) => p && p.trim())
    .join(" ")
    .trim();
  return full || a.email || "(no name)";
}

export async function listApplicants(params?: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<ApplicantListResponse> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  search.set("limit", String(params?.limit ?? 200));
  search.set("offset", String(params?.offset ?? 0));
  return apiFetch<ApplicantListResponse>(
    `/careers/applicants?${search.toString()}`,
  );
}

export async function getApplicant(id: string): Promise<Applicant> {
  return apiFetch<Applicant>(`/careers/applicants/${id}`);
}

export async function createApplicant(
  input: ApplicantInput,
): Promise<Applicant> {
  return apiFetch<Applicant>(`/careers/applicants`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateApplicant(
  id: string,
  input: ApplicantInput,
): Promise<Applicant> {
  return apiFetch<Applicant>(`/careers/applicants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
