import { apiFetch } from "@/lib/api";
import type { BadgeTone } from "@/components/careers/StatusBadge";
import type { Applicant } from "./applicantsApi";
import type { JobPosting } from "./jobPostingsApi";

/**
 * Jarvis Careers - InternalApplication API client (Phase 6 backend:
 * /careers/applications). Internal-staff only; gated by careers.applications.*
 * permissions server-side.
 *
 * Lifecycle (backend transition matrix, internal-applications.service.ts):
 *   RECEIVED     -> UNDER_REVIEW | REJECTED | WITHDRAWN
 *   UNDER_REVIEW -> INTERVIEW    | REJECTED | WITHDRAWN
 *   INTERVIEW    -> HIRED        | REJECTED | WITHDRAWN
 *   HIRED        -> CONVERTED    | WITHDRAWN
 *   CONVERTED / REJECTED / WITHDRAWN are terminal.
 *
 * NOTE: `reviewNote` is only writable via the status-transition endpoint (the
 * PATCH update endpoint does not accept it). CONVERTED is a status-only marker;
 * this client performs NO employee-record creation.
 */

export type InternalApplicationStatus =
  | "RECEIVED"
  | "UNDER_REVIEW"
  | "INTERVIEW"
  | "HIRED"
  | "CONVERTED"
  | "REJECTED"
  | "WITHDRAWN";

export type InternalApplicationSource =
  | "PUBLIC_CAREERS"
  | "INTERNAL_REFERRAL"
  | "MANUAL"
  | "OTHER";

export type ResumeDocument = {
  id: string;
  category: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type Application = {
  id: string;
  internalApplicantId: string;
  jobPostingId: string;
  resumeDocumentId: string | null;
  status: InternalApplicationStatus;
  source: InternalApplicationSource | null;
  coverNote: string | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  internalApplicant: Applicant;
  jobPosting: JobPosting;
  resumeDocument: ResumeDocument | null;
};

export type ApplicationListResponse = {
  items: Application[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateApplicationInput = {
  jobPostingId: string;
  internalApplicantId?: string;
  applicantEmail?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  source?: InternalApplicationSource;
  coverNote?: string;
};

export type ResumeDownload = {
  documentId: string;
  fileName: string;
  mimeType: string;
  url: string;
  expiresIn: number;
};

export const APPLICATION_STATUSES: InternalApplicationStatus[] = [
  "RECEIVED",
  "UNDER_REVIEW",
  "INTERVIEW",
  "HIRED",
  "CONVERTED",
  "REJECTED",
  "WITHDRAWN",
];

export const APPLICATION_STATUS_LABELS: Record<
  InternalApplicationStatus,
  string
> = {
  RECEIVED: "Received",
  UNDER_REVIEW: "Under Review",
  INTERVIEW: "Interview",
  HIRED: "Hired",
  CONVERTED: "Converted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function applicationStatusTone(
  status: InternalApplicationStatus,
): BadgeTone {
  switch (status) {
    case "UNDER_REVIEW":
      return "info";
    case "INTERVIEW":
      return "warn";
    case "HIRED":
    case "CONVERTED":
      return "success";
    case "REJECTED":
      return "danger";
    case "RECEIVED":
    case "WITHDRAWN":
    default:
      return "neutral";
  }
}

/**
 * Mirror of the backend ALLOWED_TRANSITIONS matrix. The backend re-validates
 * every transition; this is only used to render the correct action buttons.
 */
export const ALLOWED_TRANSITIONS: Record<
  InternalApplicationStatus,
  InternalApplicationStatus[]
> = {
  RECEIVED: ["UNDER_REVIEW", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: ["INTERVIEW", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["HIRED", "REJECTED", "WITHDRAWN"],
  HIRED: ["CONVERTED", "WITHDRAWN"],
  CONVERTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const TRANSITION_ACTION_LABELS: Record<
  InternalApplicationStatus,
  string
> = {
  RECEIVED: "Received",
  UNDER_REVIEW: "Move to Under Review",
  INTERVIEW: "Advance to Interview",
  HIRED: "Mark Hired",
  CONVERTED: "Mark Converted",
  REJECTED: "Reject",
  WITHDRAWN: "Withdraw",
};

/** Transitions rendered as destructive (danger) actions. */
export function isDestructiveTransition(
  status: InternalApplicationStatus,
): boolean {
  return status === "REJECTED" || status === "WITHDRAWN";
}

export const SOURCE_LABELS: Record<InternalApplicationSource, string> = {
  PUBLIC_CAREERS: "Public Careers",
  INTERNAL_REFERRAL: "Internal Referral",
  MANUAL: "Manual",
  OTHER: "Other",
};

export const APPLICATION_SOURCES: InternalApplicationSource[] = [
  "MANUAL",
  "INTERNAL_REFERRAL",
  "PUBLIC_CAREERS",
  "OTHER",
];

/** Applied date for an application (submitted, falling back to created). */
export function appliedAt(a: Application): string {
  return a.submittedAt ?? a.createdAt;
}

export async function listApplications(params?: {
  jobPostingId?: string;
  internalApplicantId?: string;
  status?: InternalApplicationStatus;
  limit?: number;
  offset?: number;
}): Promise<ApplicationListResponse> {
  const search = new URLSearchParams();
  if (params?.jobPostingId) search.set("jobPostingId", params.jobPostingId);
  if (params?.internalApplicantId)
    search.set("internalApplicantId", params.internalApplicantId);
  if (params?.status) search.set("status", params.status);
  search.set("limit", String(params?.limit ?? 200));
  search.set("offset", String(params?.offset ?? 0));
  return apiFetch<ApplicationListResponse>(
    `/careers/applications?${search.toString()}`,
  );
}

export async function getApplication(id: string): Promise<Application> {
  return apiFetch<Application>(`/careers/applications/${id}`);
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<Application> {
  return apiFetch<Application>(`/careers/applications`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function transitionApplication(
  id: string,
  status: InternalApplicationStatus,
  reviewNote?: string,
): Promise<Application> {
  return apiFetch<Application>(`/careers/applications/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...(reviewNote ? { reviewNote } : {}) }),
  });
}

/** Fetch a short-lived presigned download URL for a resume Document. */
export async function getResumeDownload(
  documentId: string,
): Promise<ResumeDownload> {
  return apiFetch<ResumeDownload>(`/careers/documents/${documentId}/download`);
}
