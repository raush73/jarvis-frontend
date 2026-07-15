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
 * NOTE (V2.1.7): the `reviewNote` field is DEPRECATED. Comments entered during a
 * status transition are recorded as an Internal Note activity on the Application
 * Activity log (immediately following the automatic Status Change activity); the
 * standalone reviewNote column is no longer written. CONVERTED is a status-only
 * marker; this client performs NO employee-record creation.
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
  /** @deprecated V2.1.7 - review comments are now Internal Note activities. */
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

/* ------------------------------------------------------------------ *
 * V2.1.7 Application Activity                                          *
 *                                                                     *
 * The permanent, append-only chronological history for an application. *
 * Combines automatic system events (status changes, resume upload,     *
 * submission) with manually logged recruiter / hiring-manager          *
 * activities. Entries are immutable: there is no edit or delete path.  *
 * ------------------------------------------------------------------ */

// Manually selectable activity categories (Status Change is deliberately
// excluded - it is always generated automatically by the system). EMAIL /
// TEXT_MESSAGE / INTERVIEW are legacy (pre-refinement) values kept for
// display of older rows; they are not offered in the picker.
export type ApplicationActivityType =
  | "PHONE_CALL"
  | "VOICEMAIL_LEFT"
  | "EMAIL_SENT"
  | "EMAIL_RECEIVED"
  | "TEXT_SENT"
  | "TEXT_RECEIVED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "MEETING"
  | "BACKGROUND_CHECK"
  | "DRUG_SCREEN"
  | "REFERENCE_CHECK"
  | "OFFER_SENT"
  | "OFFER_ACCEPTED"
  | "OFFER_DECLINED"
  | "INTERNAL_NOTE"
  | "DOCUMENT_UPLOADED"
  | "OTHER"
  // Legacy (display-only)
  | "EMAIL"
  | "TEXT_MESSAGE"
  | "INTERVIEW";

// Order shown in the Add Activity picker (legacy values intentionally omitted).
export const APPLICATION_ACTIVITY_TYPES: ApplicationActivityType[] = [
  "PHONE_CALL",
  "VOICEMAIL_LEFT",
  "EMAIL_SENT",
  "EMAIL_RECEIVED",
  "TEXT_SENT",
  "TEXT_RECEIVED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "MEETING",
  "BACKGROUND_CHECK",
  "DRUG_SCREEN",
  "REFERENCE_CHECK",
  "OFFER_SENT",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "INTERNAL_NOTE",
  "DOCUMENT_UPLOADED",
  "OTHER",
];

export const APPLICATION_ACTIVITY_TYPE_LABELS: Record<
  ApplicationActivityType,
  string
> = {
  PHONE_CALL: "Phone Call",
  VOICEMAIL_LEFT: "Voicemail Left",
  EMAIL_SENT: "Email Sent",
  EMAIL_RECEIVED: "Email Received",
  TEXT_SENT: "Text Sent",
  TEXT_RECEIVED: "Text Received",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  MEETING: "Meeting",
  BACKGROUND_CHECK: "Background Check",
  DRUG_SCREEN: "Drug Screen",
  REFERENCE_CHECK: "Reference Check",
  OFFER_SENT: "Offer Sent",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_DECLINED: "Offer Declined",
  INTERNAL_NOTE: "Internal Note",
  DOCUMENT_UPLOADED: "Document Uploaded",
  OTHER: "Other",
  // Legacy (display-only)
  EMAIL: "Email",
  TEXT_MESSAGE: "Text Message",
  INTERVIEW: "Interview",
};

// All event types that can appear in the activity log (system + umbrella).
export type ApplicationEventType =
  | "APPLICATION_SUBMITTED"
  | "RESUME_UPLOADED"
  | "STATUS_CHANGED"
  | "RECOMMENDATION_CHANGED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "NOTE_ADDED"
  | "REFERENCE_VERIFICATION"
  | "OFFER_GENERATED"
  | "ACTIVITY_LOGGED";

export const APPLICATION_EVENT_TYPE_LABELS: Record<
  ApplicationEventType,
  string
> = {
  APPLICATION_SUBMITTED: "Application Submitted",
  RESUME_UPLOADED: "Resume Uploaded",
  STATUS_CHANGED: "Status Changed",
  RECOMMENDATION_CHANGED: "Recommendation Updated",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  NOTE_ADDED: "Note Added",
  REFERENCE_VERIFICATION: "Reference Verification",
  OFFER_GENERATED: "Offer Generated",
  ACTIVITY_LOGGED: "Activity",
};

export type ApplicationActivity = {
  id: string | null;
  type: ApplicationEventType;
  activityType: ApplicationActivityType | null;
  detail: string | null;
  note: string | null;
  at: string;
  actorUserId: string | null;
  derived: boolean;
};

export type ApplicationActivityResponse = { items: ApplicationActivity[] };

export type CreateApplicationActivityInput = {
  activityType: ApplicationActivityType;
  occurredAt?: string;
  note?: string;
};

/**
 * System-generated activities (status changes, submission, resume upload, and
 * automated hiring-review events) carry no manual activityType. These are
 * visually distinguished from user-created activities in the UI.
 */
export function isSystemActivity(a: ApplicationActivity): boolean {
  return a.activityType === null;
}

/** Display label for any activity entry (manual category, else event type). */
export function activityLabel(a: ApplicationActivity): string {
  if (a.activityType) {
    return APPLICATION_ACTIVITY_TYPE_LABELS[a.activityType];
  }
  return APPLICATION_EVENT_TYPE_LABELS[a.type] ?? a.type;
}

export async function listApplicationActivities(
  id: string,
): Promise<ApplicationActivityResponse> {
  return apiFetch<ApplicationActivityResponse>(
    `/careers/applications/${id}/activities`,
  );
}

export async function addApplicationActivity(
  id: string,
  input: CreateApplicationActivityInput,
): Promise<ApplicationActivityResponse> {
  return apiFetch<ApplicationActivityResponse>(
    `/careers/applications/${id}/activities`,
    { method: "POST", body: JSON.stringify(input) },
  );
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
