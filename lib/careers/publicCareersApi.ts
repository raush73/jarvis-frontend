import { API_BASE } from "@/lib/api";
import { EmploymentType } from "@/lib/careers/jobPostingsApi";
import type { WorkHistoryInput } from "@/lib/careers/workHistoryApi";
import type {
  CertificationInput,
  EducationInput,
  MembershipInput,
  MilitaryServiceInput,
} from "@/lib/careers/credentialsApi";

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

/**
 * Public-safe application configuration (V2.1.5D). Drives which fields the
 * wizard marks required and whether compensation history is collected. The
 * backend remains the authoritative validator at submit.
 */
export type PublicApplyConfig = {
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

export async function getPublicApplyConfig(): Promise<PublicApplyConfig> {
  const res = await fetch(`${API_BASE}/careers/public/config`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to load application configuration (${res.status})`);
  }
  return (await res.json()) as PublicApplyConfig;
}

/** Presigned upload descriptor returned by the public resume-upload endpoint. */
export type PublicResumeUpload = {
  documentId: string;
  fileName: string;
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
    expiresIn: number;
  };
};

/** Request a presigned resume upload (V2.1.5D). Unauthenticated. */
export async function createPublicResumeUpload(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<PublicResumeUpload> {
  const res = await fetch(`${API_BASE}/careers/public/resume-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(await extractError(res, "Failed to prepare resume upload."));
  }
  return (await res.json()) as PublicResumeUpload;
}

/** Upload the file bytes directly to S3 using the presigned PUT descriptor. */
export async function uploadResumeBytes(
  upload: PublicResumeUpload["upload"],
  file: File,
): Promise<void> {
  const res = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Resume upload failed (${res.status}).`);
  }
}

/** Full public application submission payload (V2.1.5D). */
export type PublicApplicationInput = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  professionalSummary?: string | null;
  currentProfession?: string | null;
  desiredProfession?: string | null;
  longTermGoals?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  workHistory?: WorkHistoryInput[];
  education?: EducationInput[];
  certifications?: CertificationInput[];
  militaryService?: MilitaryServiceInput[];
  memberships?: MembershipInput[];
  interestReason?: string | null;
  resumeDocumentId?: string | null;
};

export type PublicApplicationResult = {
  submitted: boolean;
  reference: string;
  submittedAt: string;
};

/** A structured submission error, including any missing required fields. */
export class PublicApplyError extends Error {
  status: number;
  missing?: { field: string; label: string }[];
  constructor(
    message: string,
    status: number,
    missing?: { field: string; label: string }[],
  ) {
    super(message);
    this.name = "PublicApplyError";
    this.status = status;
    this.missing = missing;
  }
}

/** Submit a complete public application for the PUBLISHED + PUBLIC posting. */
export async function submitPublicApplication(
  publicCode: string,
  input: PublicApplicationInput,
): Promise<PublicApplicationResult> {
  const res = await fetch(
    `${API_BASE}/careers/public/postings/${encodeURIComponent(publicCode)}/apply`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    let message = "Failed to submit application.";
    let missing: { field: string; label: string }[] | undefined;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
      else if (Array.isArray(body?.message)) message = body.message.join(", ");
      if (Array.isArray(body?.missing)) missing = body.missing;
    } catch {
      // Non-JSON error body; keep default message.
    }
    throw new PublicApplyError(message, res.status, missing);
  }
  return (await res.json()) as PublicApplicationResult;
}

async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.message === "string") return body.message;
    if (Array.isArray(body?.message)) return body.message.join(", ");
  } catch {
    // ignore
  }
  return fallback;
}
