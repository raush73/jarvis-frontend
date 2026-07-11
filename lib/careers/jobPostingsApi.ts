import { apiFetch } from "@/lib/api";
import type { BadgeTone } from "@/components/careers/StatusBadge";
import type {
  FlsaClassification,
  PayType,
  TravelRequirement,
  WorkLocation,
} from "./positionsApi";

/**
 * Jarvis Careers - JobPosting API client (Phase 4 backend: /careers/postings).
 * Internal-staff only; gated by careers.postings.* permissions server-side.
 *
 * Lifecycle (backend transition matrix, job-postings.service.ts):
 *   DRAFT     -> PUBLISHED (publish) | CLOSED (close)
 *   PUBLISHED -> PAUSED (pause) | FILLED (fill) | CLOSED (close)
 *   PAUSED    -> PUBLISHED (republish) | CLOSED (close)
 *   FILLED    -> CLOSED (close) | ARCHIVED (archive)
 *   CLOSED    -> ARCHIVED (archive)
 *   ARCHIVED  is terminal. Only PUBLISHED postings are publicly visible.
 */

export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "TEMPORARY"
  | "INTERNSHIP";

export type PostingVisibility = "PUBLIC" | "INTERNAL";

export type PostingStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "PAUSED"
  | "FILLED"
  | "CLOSED"
  | "ARCHIVED";

export type JobPostingPosition = {
  id: string;
  title: string;
  department: string | null;
};

export type JobPostingCertificationRef = {
  id: string;
  name: string;
};

export type JobPosting = {
  id: string;
  positionId: string;
  // Posting Information (V2.1.6B)
  postingCode: string | null;
  title: string | null;
  slug: string;
  numberOfOpenings: number;
  postingDate: string | null;
  closingDate: string | null;
  expectedStartDate: string | null;
  // Inherited Position Profile snapshot (V2.1.2b + V2.1.6B): copied from the
  // Position at creation; overridable on the posting without touching the Position.
  description: string | null;
  department: string | null;
  responsibilities: string | null;
  qualifications: string | null;
  location: string | null;
  employmentType: EmploymentType | null;
  payType: PayType | null;
  flsaClassification: FlsaClassification | null;
  workLocation: WorkLocation | null;
  travelRequirement: TravelRequirement | null;
  standardWorkDays: string | null;
  standardStartTime: string | null; // "HH:mm" 24h
  standardEndTime: string | null; // "HH:mm" 24h
  standardLunchMinutes: number | null;
  standardHoursPerWeek: number | null;
  drugScreenRequired: boolean;
  backgroundCheckRequired: boolean;
  driversLicenseRequired: boolean;
  motorVehicleRecordRequired: boolean;
  liftRequirements: boolean;
  climbingRequirements: boolean;
  outdoorWork: boolean;
  overnightTravel: boolean;
  additionalPhysicalRequirements: string | null;
  certifications: JobPostingCertificationRef[];
  // Compensation (V2.1.6B)
  startingPay: number | null;
  maximumPay: number | null;
  signOnBonus: number | null;
  commissionPlan: string | null;
  benefitsSummaryOverride: string | null;
  // Application Settings (V2.1.6B)
  resumeRequired: boolean;
  coverLetterRequired: boolean;
  internalApplicantsOnly: boolean;
  externalApplicantsAllowed: boolean;
  autoCloseWhenFilled: boolean;
  visibility: PostingVisibility;
  status: PostingStatus;
  hiringManagerUserId: string | null;
  createdByUserId: string | null;
  publicCode: string | null;
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
  // Posting Information
  postingCode?: string;
  title?: string;
  hiringManagerUserId?: string;
  department?: string;
  visibility?: PostingVisibility;
  numberOfOpenings?: number;
  postingDate?: string | null;
  closingDate?: string | null;
  expectedStartDate?: string | null;
  // Inherited Position Profile snapshot overrides
  description?: string;
  responsibilities?: string;
  qualifications?: string;
  location?: string;
  employmentType?: EmploymentType | null;
  payType?: PayType | null;
  flsaClassification?: FlsaClassification | null;
  workLocation?: WorkLocation | null;
  travelRequirement?: TravelRequirement | null;
  standardWorkDays?: string;
  standardStartTime?: string | null;
  standardEndTime?: string | null;
  standardLunchMinutes?: number | null;
  standardHoursPerWeek?: number | null;
  drugScreenRequired?: boolean;
  backgroundCheckRequired?: boolean;
  driversLicenseRequired?: boolean;
  motorVehicleRecordRequired?: boolean;
  liftRequirements?: boolean;
  climbingRequirements?: boolean;
  outdoorWork?: boolean;
  overnightTravel?: boolean;
  additionalPhysicalRequirements?: string;
  certifications?: string[];
  // Compensation
  startingPay?: number | null;
  maximumPay?: number | null;
  signOnBonus?: number | null;
  commissionPlan?: string;
  benefitsSummaryOverride?: string;
  // Application Settings
  resumeRequired?: boolean;
  coverLetterRequired?: boolean;
  internalApplicantsOnly?: boolean;
  externalApplicantsAllowed?: boolean;
  autoCloseWhenFilled?: boolean;
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
  "PUBLISHED",
  "PAUSED",
  "FILLED",
  "CLOSED",
  "ARCHIVED",
];

export const POSTING_STATUS_LABELS: Record<PostingStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  PAUSED: "Paused",
  FILLED: "Filled",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

export function postingStatusTone(status: PostingStatus): BadgeTone {
  switch (status) {
    case "PUBLISHED":
      return "success";
    case "PAUSED":
      return "warn";
    case "FILLED":
      return "info";
    case "CLOSED":
      return "warn";
    case "ARCHIVED":
      return "neutral";
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

/**
 * Base URL of the public Careers portal. The canonical public application URL
 * for a published posting is `${base}/jobs/{publicCode}`. Configurable via
 * NEXT_PUBLIC_CAREERS_PORTAL_URL; defaults to the approved careers.mw4h.com
 * domain (see governance/JARVIS_CAREERS.md). The portal itself is a later phase
 * (V2.1.4) — this only renders the canonical identity for a published posting.
 */
export const CAREERS_PUBLIC_BASE_URL = (
  process.env.NEXT_PUBLIC_CAREERS_PORTAL_URL ?? "https://careers.mw4h.com"
).replace(/\/+$/, "");

/**
 * Canonical public application URL for a posting, or null until it is published
 * (a draft has no publicCode). The URL is stable and immutable once assigned.
 */
export function publicApplicationUrl(p: JobPosting): string | null {
  return p.publicCode ? `${CAREERS_PUBLIC_BASE_URL}/jobs/${p.publicCode}` : null;
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

export async function pauseJobPosting(id: string): Promise<JobPosting> {
  return apiFetch<JobPosting>(`/careers/postings/${id}/pause`, {
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

export async function archiveJobPosting(id: string): Promise<JobPosting> {
  return apiFetch<JobPosting>(`/careers/postings/${id}/archive`, {
    method: "POST",
  });
}
