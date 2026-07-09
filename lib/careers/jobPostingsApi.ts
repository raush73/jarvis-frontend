import { apiFetch } from "@/lib/api";
import type { BadgeTone } from "@/components/careers/StatusBadge";

/**
 * Jarvis Careers - JobPosting API client (Phase 4 backend: /careers/postings).
 * Internal-staff only; gated by careers.postings.* permissions server-side.
 *
 * Lifecycle (backend transition matrix, job-postings.service.ts):
 *   DRAFT  -> OPEN (publish) | CLOSED (close)
 *   OPEN   -> CLOSED (close) | FILLED (fill)
 *   CLOSED / FILLED are terminal (no reopen / archive endpoints exist).
 */

export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "TEMPORARY"
  | "INTERNSHIP";

export type PostingVisibility = "PUBLIC" | "INTERNAL";

export type PostingStatus = "DRAFT" | "OPEN" | "CLOSED" | "FILLED";

export type JobPostingPosition = {
  id: string;
  title: string;
  department: string | null;
};

export type JobPosting = {
  id: string;
  positionId: string;
  title: string | null;
  slug: string;
  description: string | null;
  location: string | null;
  employmentType: EmploymentType | null;
  visibility: PostingVisibility;
  status: PostingStatus;
  hiringManagerUserId: string | null;
  createdByUserId: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  position?: JobPostingPosition | null;
};

export type JobPostingListResponse = {
  items: JobPosting[];
  total: number;
  limit: number;
  offset: number;
};

export type JobPostingInput = {
  positionId: string;
  title?: string;
  description?: string;
  location?: string;
  employmentType?: EmploymentType;
  visibility?: PostingVisibility;
  hiringManagerUserId?: string;
};

export const EMPLOYMENT_TYPES: EmploymentType[] = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  INTERNSHIP: "Internship",
};

export const VISIBILITIES: PostingVisibility[] = ["INTERNAL", "PUBLIC"];

export const VISIBILITY_LABELS: Record<PostingVisibility, string> = {
  INTERNAL: "Internal",
  PUBLIC: "Public",
};

export const POSTING_STATUSES: PostingStatus[] = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "FILLED",
];

export const POSTING_STATUS_LABELS: Record<PostingStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  FILLED: "Filled",
};

export function postingStatusTone(status: PostingStatus): BadgeTone {
  switch (status) {
    case "OPEN":
      return "success";
    case "FILLED":
      return "info";
    case "CLOSED":
      return "warn";
    case "DRAFT":
    default:
      return "neutral";
  }
}

export function employmentTypeLabel(t: EmploymentType | null): string {
  return t ? EMPLOYMENT_TYPE_LABELS[t] : "\u2014";
}

/** Display title for a posting (falls back to its position title). */
export function postingTitle(p: JobPosting): string {
  return (p.title && p.title.trim()) || p.position?.title || "Untitled posting";
}

export async function listJobPostings(params?: {
  status?: PostingStatus;
  visibility?: PostingVisibility;
  positionId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<JobPostingListResponse> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.visibility) search.set("visibility", params.visibility);
  if (params?.positionId) search.set("positionId", params.positionId);
  if (params?.q) search.set("q", params.q);
  search.set("limit", String(params?.limit ?? 200));
  search.set("offset", String(params?.offset ?? 0));
  return apiFetch<JobPostingListResponse>(
    `/careers/postings?${search.toString()}`,
  );
}

export async function getJobPosting(id: string): Promise<JobPosting> {
  return apiFetch<JobPosting>(`/careers/postings/${id}`);
}

export async function createJobPosting(
  input: JobPostingInput,
): Promise<JobPosting> {
  return apiFetch<JobPosting>(`/careers/postings`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateJobPosting(
  id: string,
  input: JobPostingInput,
): Promise<JobPosting> {
  return apiFetch<JobPosting>(`/careers/postings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function publishJobPosting(id: string): Promise<JobPosting> {
  return apiFetch<JobPosting>(`/careers/postings/${id}/publish`, {
    method: "POST",
  });
}

export async function closeJobPosting(id: string): Promise<JobPosting> {
  return apiFetch<JobPosting>(`/careers/postings/${id}/close`, {
    method: "POST",
  });
}

export async function fillJobPosting(id: string): Promise<JobPosting> {
  return apiFetch<JobPosting>(`/careers/postings/${id}/fill`, {
    method: "POST",
  });
}
