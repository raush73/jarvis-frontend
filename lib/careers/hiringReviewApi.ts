import { apiFetch } from "@/lib/api";
import type { BadgeTone } from "@/components/careers/StatusBadge";
import type { Applicant } from "./applicantsApi";
import type { JobPosting } from "./jobPostingsApi";
import type {
  InternalApplicationSource,
  InternalApplicationStatus,
  ResumeDocument,
} from "./applicationsApi";

/**
 * Jarvis Careers V2.1.5E - Hiring Manager Experience API client
 * (/careers/review). Internal-staff only; gated by careers.applications.*
 * permissions server-side.
 *
 * `hiringPipelineStage` and `hiringRecommendation` are ADDITIVE, independent of the core
 * InternalApplicationStatus lifecycle. Hiring stages are set manually with no
 * transition validation; recommendations are advisory only. Hiring notes are
 * internal-only and never exposed to applicants.
 */

// ------------------------------------------------------------- Hiring stage
export const HIRING_PIPELINE_STAGES = [
  "APPLIED",
  "UNDER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "REFERENCE_CHECK",
  "OFFER_PENDING",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type HiringPipelineStage = (typeof HIRING_PIPELINE_STAGES)[number];

export const HIRING_PIPELINE_STAGE_LABELS: Record<HiringPipelineStage, string> = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Under Review",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  REFERENCE_CHECK: "Reference Check",
  OFFER_PENDING: "Offer Pending",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_DECLINED: "Offer Declined",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function hiringPipelineStageTone(stage: HiringPipelineStage): BadgeTone {
  switch (stage) {
    case "UNDER_REVIEW":
    case "REFERENCE_CHECK":
      return "info";
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEW_COMPLETED":
    case "OFFER_PENDING":
      return "warn";
    case "OFFER_ACCEPTED":
      return "success";
    case "REJECTED":
    case "OFFER_DECLINED":
      return "danger";
    case "APPLIED":
    case "WITHDRAWN":
    default:
      return "neutral";
  }
}

// -------------------------------------------------------- Recommendation
export const HIRING_RECOMMENDATIONS = [
  "RECOMMEND_INTERVIEW",
  "HOLD",
  "NEEDS_REVIEW",
  "RECOMMEND_HIRE",
  "DO_NOT_PROCEED",
] as const;
export type HiringRecommendation = (typeof HIRING_RECOMMENDATIONS)[number];

export const HIRING_RECOMMENDATION_LABELS: Record<HiringRecommendation, string> =
  {
    RECOMMEND_INTERVIEW: "Recommend Interview",
    HOLD: "Hold",
    NEEDS_REVIEW: "Needs Review",
    RECOMMEND_HIRE: "Recommend Hire",
    DO_NOT_PROCEED: "Do Not Proceed",
  };

export function hiringRecommendationTone(
  rec: HiringRecommendation,
): BadgeTone {
  switch (rec) {
    case "RECOMMEND_HIRE":
      return "success";
    case "RECOMMEND_INTERVIEW":
      return "info";
    case "NEEDS_REVIEW":
    case "HOLD":
      return "warn";
    case "DO_NOT_PROCEED":
      return "danger";
    default:
      return "neutral";
  }
}

// ------------------------------------------------------------- Interviews
export const INTERVIEW_TYPES = [
  "PHONE",
  "VIDEO",
  "ONSITE",
  "PANEL",
  "OTHER",
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE: "Phone",
  VIDEO: "Video",
  ONSITE: "On-Site",
  PANEL: "Panel",
  OTHER: "Other",
};

export type HiringNote = {
  id: string;
  internalApplicationId: string;
  body: string;
  authorUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Interview = {
  id: string;
  internalApplicationId: string;
  scheduledAt: string | null;
  interviewType: InterviewType | null;
  interviewer: string | null;
  notes: string | null;
  completedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------- Timeline
export type TimelineEventType =
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

export const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  APPLICATION_SUBMITTED: "Application Submitted",
  RESUME_UPLOADED: "Resume Uploaded",
  STATUS_CHANGED: "Status Changed",
  RECOMMENDATION_CHANGED: "Recommendation Updated",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  NOTE_ADDED: "Hiring Note Added",
  REFERENCE_VERIFICATION: "Reference Verification",
  OFFER_GENERATED: "Offer Generated",
  ACTIVITY_LOGGED: "Activity",
};

// V2.1.7: manually logged activity categories carried on timeline entries where
// type === "ACTIVITY_LOGGED". EMAIL / TEXT_MESSAGE / INTERVIEW are legacy
// (display-only) values retained for older rows.
export type TimelineActivityType =
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
  | "EMAIL"
  | "TEXT_MESSAGE"
  | "INTERVIEW";

export const TIMELINE_ACTIVITY_TYPE_LABELS: Record<
  TimelineActivityType,
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

export type TimelineEvent = {
  type: TimelineEventType;
  activityType: TimelineActivityType | null;
  detail: string | null;
  note: string | null;
  at: string;
  actorUserId: string | null;
  derived: boolean;
};

/** Display label for a timeline entry (manual category, else event type). */
export function timelineEventLabel(ev: TimelineEvent): string {
  if (ev.activityType) {
    return TIMELINE_ACTIVITY_TYPE_LABELS[ev.activityType];
  }
  return TIMELINE_EVENT_LABELS[ev.type] ?? ev.type;
}

export type ProfileCompletion = {
  percent: number;
  completed: number;
  total: number;
};

// -------------------------------------------------------------- Dashboard
export type ReviewDashboardItem = {
  id: string;
  status: InternalApplicationStatus;
  hiringPipelineStage: HiringPipelineStage;
  hiringRecommendation: HiringRecommendation | null;
  source: InternalApplicationSource | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedByUserId: string | null;
  hasResume: boolean;
  isVeteran: boolean;
  profileCompletionPercent: number;
  profileCompletedAt: string | null;
  internalApplicant: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    state: string | null;
  };
  jobPosting: JobPosting;
};

export type ReviewDashboardResponse = {
  items: ReviewDashboardItem[];
  total: number;
  limit: number;
  offset: number;
};

// --------------------------------------------------------- Review detail
export type ReviewApplication = {
  id: string;
  internalApplicantId: string;
  jobPostingId: string;
  resumeDocumentId: string | null;
  status: InternalApplicationStatus;
  source: InternalApplicationSource | null;
  coverNote: string | null;
  hiringPipelineStage: HiringPipelineStage;
  hiringRecommendation: HiringRecommendation | null;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  internalApplicant: Applicant;
  jobPosting: JobPosting;
  resumeDocument: ResumeDocument | null;
  notes: HiringNote[];
  interviews: Interview[];
  profileCompletion: ProfileCompletion;
  timeline: TimelineEvent[];
};

export type InterviewInput = {
  scheduledAt?: string | null;
  interviewType?: InterviewType | null;
  interviewer?: string | null;
  notes?: string | null;
  completedAt?: string | null;
};

// --------------------------------------------------------------- Requests
export async function listReviewApplications(params?: {
  limit?: number;
  offset?: number;
}): Promise<ReviewDashboardResponse> {
  const search = new URLSearchParams();
  search.set("limit", String(params?.limit ?? 200));
  search.set("offset", String(params?.offset ?? 0));
  return apiFetch<ReviewDashboardResponse>(
    `/careers/review/applications?${search.toString()}`,
  );
}

export async function getReviewApplication(
  id: string,
): Promise<ReviewApplication> {
  return apiFetch<ReviewApplication>(`/careers/review/applications/${id}`);
}

export async function setHiringPipelineStage(
  id: string,
  hiringPipelineStage: HiringPipelineStage,
): Promise<ReviewApplication> {
  return apiFetch<ReviewApplication>(
    `/careers/review/applications/${id}/stage`,
    { method: "PATCH", body: JSON.stringify({ hiringPipelineStage }) },
  );
}

export async function setHiringRecommendation(
  id: string,
  hiringRecommendation: HiringRecommendation | null,
): Promise<ReviewApplication> {
  return apiFetch<ReviewApplication>(
    `/careers/review/applications/${id}/recommendation`,
    { method: "PATCH", body: JSON.stringify({ hiringRecommendation }) },
  );
}

export async function addHiringNote(
  id: string,
  body: string,
): Promise<ReviewApplication> {
  return apiFetch<ReviewApplication>(
    `/careers/review/applications/${id}/notes`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
}

export async function updateHiringNote(
  noteId: string,
  body: string,
): Promise<ReviewApplication> {
  return apiFetch<ReviewApplication>(`/careers/review/notes/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify({ body }),
  });
}

export async function addInterview(
  id: string,
  input: InterviewInput,
): Promise<ReviewApplication> {
  return apiFetch<ReviewApplication>(
    `/careers/review/applications/${id}/interviews`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateInterview(
  interviewId: string,
  input: InterviewInput,
): Promise<ReviewApplication> {
  return apiFetch<ReviewApplication>(
    `/careers/review/interviews/${interviewId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
