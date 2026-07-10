import { apiFetch } from "@/lib/api";

/**
 * Jarvis Careers - Application configuration API client (V2.1.5A).
 *
 * Admin-only read/write of the backend-authoritative required/optional
 * application rules (/careers/config). The public apply UI reads the required
 * flags from the separate unauthenticated /careers/public/config route.
 */

export type CareersApplicationConfig = {
  id: string;
  requirePhone: boolean;
  requireLocation: boolean;
  requireProfessionalSummary: boolean;
  requireCurrentProfession: boolean;
  requireDesiredProfession: boolean;
  requireLongTermGoals: boolean;
  requireFacebookUrl: boolean;
  requireLinkedinUrl: boolean;
  requireResume: boolean;
  collectCompensationHistory: boolean;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CareersApplicationConfigInput = {
  requirePhone?: boolean;
  requireLocation?: boolean;
  requireProfessionalSummary?: boolean;
  requireCurrentProfession?: boolean;
  requireDesiredProfession?: boolean;
  requireLongTermGoals?: boolean;
  requireFacebookUrl?: boolean;
  requireLinkedinUrl?: boolean;
  requireResume?: boolean;
  collectCompensationHistory?: boolean;
};

/** Public-safe subset returned by the unauthenticated /careers/public/config. */
export type PublicCareersApplicationConfig = {
  requirePhone: boolean;
  requireLocation: boolean;
  requireProfessionalSummary: boolean;
  requireCurrentProfession: boolean;
  requireDesiredProfession: boolean;
  requireLongTermGoals: boolean;
  requireFacebookUrl: boolean;
  requireLinkedinUrl: boolean;
  requireResume: boolean;
  collectCompensationHistory: boolean;
};

/** Ordered field descriptors for rendering the admin config UI. */
export const CAREERS_CONFIG_FIELDS: {
  key: keyof CareersApplicationConfigInput;
  label: string;
  hint: string;
}[] = [
  { key: "requirePhone", label: "Phone", hint: "Require a phone number." },
  {
    key: "requireLocation",
    label: "Location (City / State)",
    hint: "Require city and state.",
  },
  {
    key: "requireProfessionalSummary",
    label: "Professional Summary",
    hint: "Require a professional summary.",
  },
  {
    key: "requireCurrentProfession",
    label: "Current Profession",
    hint: "Require the applicant's current profession.",
  },
  {
    key: "requireDesiredProfession",
    label: "Desired Profession",
    hint: "Require the profession the applicant is pursuing.",
  },
  {
    key: "requireLongTermGoals",
    label: "Long-Term Career Goals",
    hint: "Require long-term career goals.",
  },
  {
    key: "requireFacebookUrl",
    label: "Facebook URL",
    hint: "Require a Facebook profile URL.",
  },
  {
    key: "requireLinkedinUrl",
    label: "LinkedIn URL",
    hint: "Require a LinkedIn profile URL.",
  },
  {
    key: "requireResume",
    label: "Resume",
    hint: "Require a resume attachment (always supplemental to the profile).",
  },
  {
    key: "collectCompensationHistory",
    label: "Collect Compensation History",
    hint: "Show compensation fields (starting/ending pay and type) on Work History.",
  },
];

export async function getCareersConfig(): Promise<CareersApplicationConfig> {
  return apiFetch<CareersApplicationConfig>(`/careers/config`);
}

/**
 * Reads the public-safe config (required flags + compensation visibility).
 * Usable by any authenticated staff screen without the admin role, since it hits
 * the unauthenticated /careers/public/config projection.
 */
export async function getPublicCareersConfig(): Promise<PublicCareersApplicationConfig> {
  return apiFetch<PublicCareersApplicationConfig>(`/careers/public/config`);
}

export async function updateCareersConfig(
  input: CareersApplicationConfigInput,
): Promise<CareersApplicationConfig> {
  return apiFetch<CareersApplicationConfig>(`/careers/config`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
