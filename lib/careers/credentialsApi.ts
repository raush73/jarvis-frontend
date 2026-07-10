import { apiFetch } from "@/lib/api";

/**
 * Jarvis Careers - Applicant Credentials API client (V2.1.5C).
 *
 * Four normalized collections owned directly by an InternalApplicant: Education,
 * Certification, Military Service, and Professional Membership. Internal staff
 * only; gated by careers.applicants.* permissions server-side. No verification,
 * background-check, resume-parsing, or AI logic exists in this version.
 */

// ------------------------------------------------------------------ Education
export type EducationEntry = {
  id: string;
  internalApplicantId: string;
  schoolName: string;
  city: string | null;
  state: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  graduationDate: string | null;
  isCurrent: boolean;
  // Prisma Decimal serializes to string over JSON.
  gpa: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EducationInput = {
  schoolName: string;
  city?: string | null;
  state?: string | null;
  degree?: string | null;
  fieldOfStudy?: string | null;
  graduationDate?: string | null;
  isCurrent?: boolean;
  gpa?: number | null;
};

export async function createEducation(
  applicantId: string,
  input: EducationInput,
): Promise<EducationEntry> {
  return apiFetch<EducationEntry>(
    `/careers/applicants/${applicantId}/education`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateEducation(
  id: string,
  input: Partial<EducationInput>,
): Promise<EducationEntry> {
  return apiFetch<EducationEntry>(`/careers/education/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteEducation(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/careers/education/${id}`, {
    method: "DELETE",
  });
}

// -------------------------------------------------------------- Certification
export type CertificationEntry = {
  id: string;
  internalApplicantId: string;
  name: string;
  issuingOrganization: string | null;
  certificationNumber: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  doesNotExpire: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CertificationInput = {
  name: string;
  issuingOrganization?: string | null;
  certificationNumber?: string | null;
  issueDate?: string | null;
  expirationDate?: string | null;
  doesNotExpire?: boolean;
};

export async function createCertification(
  applicantId: string,
  input: CertificationInput,
): Promise<CertificationEntry> {
  return apiFetch<CertificationEntry>(
    `/careers/applicants/${applicantId}/certifications`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateCertification(
  id: string,
  input: Partial<CertificationInput>,
): Promise<CertificationEntry> {
  return apiFetch<CertificationEntry>(`/careers/certifications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteCertification(
  id: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/careers/certifications/${id}`, {
    method: "DELETE",
  });
}

// ----------------------------------------------------------- Military Service
export const MILITARY_SERVICE_TYPES = [
  "ACTIVE_DUTY",
  "NATIONAL_GUARD",
  "RESERVE",
] as const;
export type MilitaryServiceType = (typeof MILITARY_SERVICE_TYPES)[number];

export const MILITARY_SERVICE_TYPE_LABELS: Record<MilitaryServiceType, string> =
  {
    ACTIVE_DUTY: "Active Duty",
    NATIONAL_GUARD: "National Guard",
    RESERVE: "Reserve",
  };

export type MilitaryServiceEntry = {
  id: string;
  internalApplicantId: string;
  isVeteran: boolean;
  serviceType: MilitaryServiceType | null;
  branch: string | null;
  rank: string | null;
  occupationalSpecialty: string | null;
  serviceStartDate: string | null;
  serviceEndDate: string | null;
  isCurrent: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MilitaryServiceInput = {
  isVeteran?: boolean;
  serviceType?: MilitaryServiceType | null;
  branch?: string | null;
  rank?: string | null;
  occupationalSpecialty?: string | null;
  serviceStartDate?: string | null;
  serviceEndDate?: string | null;
  isCurrent?: boolean;
};

export async function createMilitaryService(
  applicantId: string,
  input: MilitaryServiceInput,
): Promise<MilitaryServiceEntry> {
  return apiFetch<MilitaryServiceEntry>(
    `/careers/applicants/${applicantId}/military-service`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateMilitaryService(
  id: string,
  input: Partial<MilitaryServiceInput>,
): Promise<MilitaryServiceEntry> {
  return apiFetch<MilitaryServiceEntry>(`/careers/military-service/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteMilitaryService(
  id: string,
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/careers/military-service/${id}`, {
    method: "DELETE",
  });
}

// --------------------------------------------------------------- Memberships
export type MembershipEntry = {
  id: string;
  internalApplicantId: string;
  organization: string;
  membershipType: string | null;
  membershipNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MembershipInput = {
  organization: string;
  membershipType?: string | null;
  membershipNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
};

export async function createMembership(
  applicantId: string,
  input: MembershipInput,
): Promise<MembershipEntry> {
  return apiFetch<MembershipEntry>(
    `/careers/applicants/${applicantId}/memberships`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateMembership(
  id: string,
  input: Partial<MembershipInput>,
): Promise<MembershipEntry> {
  return apiFetch<MembershipEntry>(`/careers/memberships/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteMembership(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/careers/memberships/${id}`, {
    method: "DELETE",
  });
}
