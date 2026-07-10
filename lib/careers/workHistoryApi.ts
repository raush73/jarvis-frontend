import { apiFetch } from "@/lib/api";

/**
 * Jarvis Careers - Work History API client (V2.1.5B).
 *
 * Work History entries are owned directly by an InternalApplicant. Internal
 * staff only; gated by careers.applicants.* permissions server-side. The
 * three-state contactConsent ("May Contact Employer") preserves the deferred
 * V2.2 Reference Verification Framework data model; no reference workflow exists.
 */

export const WORK_HISTORY_EMPLOYMENT_TYPES = [
  "FULL_TIME",
  "PART_TIME",
  "TEMPORARY",
  "CONTRACT",
  "SEASONAL",
  "OTHER",
] as const;
export type WorkHistoryEmploymentType =
  (typeof WORK_HISTORY_EMPLOYMENT_TYPES)[number];

export const WORK_HISTORY_EMPLOYMENT_TYPE_LABELS: Record<
  WorkHistoryEmploymentType,
  string
> = {
  FULL_TIME: "Full-Time",
  PART_TIME: "Part-Time",
  TEMPORARY: "Temporary",
  CONTRACT: "Contract",
  SEASONAL: "Seasonal",
  OTHER: "Other",
};

export const COMPENSATION_TYPES = [
  "HOURLY",
  "SALARY",
  "COMMISSION",
  "PIECEWORK",
  "OTHER",
] as const;
export type CompensationType = (typeof COMPENSATION_TYPES)[number];

export const COMPENSATION_TYPE_LABELS: Record<CompensationType, string> = {
  HOURLY: "Hourly",
  SALARY: "Salary",
  COMMISSION: "Commission",
  PIECEWORK: "Piecework",
  OTHER: "Other",
};

export const CONTACT_CONSENTS = [
  "AUTHORIZED",
  "NOT_AUTHORIZED",
  "CONDITIONAL_OFFER_ONLY",
] as const;
export type WorkHistoryContactConsent = (typeof CONTACT_CONSENTS)[number];

export const CONTACT_CONSENT_LABELS: Record<WorkHistoryContactConsent, string> =
  {
    AUTHORIZED: "Yes",
    NOT_AUTHORIZED: "No",
    CONDITIONAL_OFFER_ONLY: "After Conditional Offer",
  };

export type WorkHistoryEntry = {
  id: string;
  internalApplicantId: string;
  employerName: string;
  employerCity: string | null;
  employerState: string | null;
  jobTitle: string;
  employmentType: WorkHistoryEmploymentType | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  // Prisma Decimal serializes to string over JSON.
  startingCompensation: string | null;
  endingCompensation: string | null;
  compensationType: CompensationType | null;
  supervisorName: string | null;
  supervisorTitle: string | null;
  supervisorPhone: string | null;
  supervisorEmail: string | null;
  contactConsent: WorkHistoryContactConsent;
  reasonForLeaving: string | null;
  skillsUsed: string | null;
  accomplishments: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkHistoryInput = {
  employerName: string;
  employerCity?: string | null;
  employerState?: string | null;
  jobTitle: string;
  employmentType?: WorkHistoryEmploymentType | null;
  startDate: string;
  endDate?: string | null;
  isCurrent?: boolean;
  startingCompensation?: number | null;
  endingCompensation?: number | null;
  compensationType?: CompensationType | null;
  supervisorName?: string | null;
  supervisorTitle?: string | null;
  supervisorPhone?: string | null;
  supervisorEmail?: string | null;
  contactConsent?: WorkHistoryContactConsent;
  reasonForLeaving?: string | null;
  skillsUsed?: string | null;
  accomplishments?: string | null;
};

export async function createWorkHistory(
  applicantId: string,
  input: WorkHistoryInput,
): Promise<WorkHistoryEntry> {
  return apiFetch<WorkHistoryEntry>(
    `/careers/applicants/${applicantId}/work-history`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateWorkHistory(
  id: string,
  input: Partial<WorkHistoryInput>,
): Promise<WorkHistoryEntry> {
  return apiFetch<WorkHistoryEntry>(`/careers/work-history/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteWorkHistory(
  id: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/careers/work-history/${id}`, {
    method: "DELETE",
  });
}
