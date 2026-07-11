import { apiFetch } from "@/lib/api";
import { EmploymentType } from "./jobPostingsApi";

/**
 * Jarvis Careers - Position API client (/careers/positions).
 * Internal-staff only; gated by careers.positions.* permissions server-side.
 *
 * V2.1.6A adds the LOCKED Position Profile (Employment Defaults, Standard
 * Schedule, Reporting Structure, Hiring Requirements, Physical Requirements,
 * Certifications). Job Posting inheritance is unchanged (deferred to V2.1.6B).
 */

// --- Position Profile enums (mirror the backend Prisma enums) ---
export const PAY_TYPES = [
  "HOURLY",
  "SALARY",
  "COMMISSION",
  "SALARY_PLUS_COMMISSION",
] as const;
export type PayType = (typeof PAY_TYPES)[number];
export const PAY_TYPE_LABELS: Record<PayType, string> = {
  HOURLY: "Hourly",
  SALARY: "Salary",
  COMMISSION: "Commission",
  SALARY_PLUS_COMMISSION: "Salary + Commission",
};

export const FLSA_CLASSIFICATIONS = ["EXEMPT", "NON_EXEMPT"] as const;
export type FlsaClassification = (typeof FLSA_CLASSIFICATIONS)[number];
export const FLSA_CLASSIFICATION_LABELS: Record<FlsaClassification, string> = {
  EXEMPT: "Exempt",
  NON_EXEMPT: "Non-Exempt",
};

export const WORK_LOCATIONS = ["IN_OFFICE", "HYBRID", "REMOTE", "FIELD"] as const;
export type WorkLocation = (typeof WORK_LOCATIONS)[number];
export const WORK_LOCATION_LABELS: Record<WorkLocation, string> = {
  IN_OFFICE: "In Office",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
  FIELD: "Field",
};

export const TRAVEL_REQUIREMENTS = [
  "NONE",
  "OCCASIONAL",
  "UP_TO_25",
  "UP_TO_50",
  "UP_TO_75",
  "EXTENSIVE",
] as const;
export type TravelRequirement = (typeof TRAVEL_REQUIREMENTS)[number];
export const TRAVEL_REQUIREMENT_LABELS: Record<TravelRequirement, string> = {
  NONE: "None",
  OCCASIONAL: "Occasional",
  UP_TO_25: "Up to 25%",
  UP_TO_50: "Up to 50%",
  UP_TO_75: "Up to 75%",
  EXTENSIVE: "Extensive",
};

export const LUNCH_DURATIONS = [30, 45, 60, 90] as const;
export type LunchDuration = (typeof LUNCH_DURATIONS)[number];

export type PositionCertificationRef = {
  id: string;
  name: string;
};

export type PositionReportsToRef = {
  id: string;
  reportsToPositionId: string;
  reportsTo: {
    id: string;
    title: string;
    isActive: boolean;
  };
};

export type Position = {
  id: string;
  // Position Information
  positionCode: string | null;
  title: string;
  department: string | null;
  description: string | null;
  isActive: boolean;
  // Position Defaults (V2.1.1)
  standardResponsibilities: string | null;
  standardQualifications: string | null;
  defaultEmploymentType: EmploymentType | null;
  // Employment Defaults (V2.1.6A)
  payType: PayType | null;
  flsaClassification: FlsaClassification | null;
  workLocation: WorkLocation | null;
  travelRequirement: TravelRequirement | null;
  // Standard Schedule (V2.1.6A)
  standardWorkDays: string | null;
  standardStartTime: string | null; // "HH:mm" 24h
  standardEndTime: string | null; // "HH:mm" 24h
  standardLunchMinutes: number | null;
  standardHoursPerWeek: number | null;
  // Hiring Requirements (V2.1.6A)
  drugScreenRequired: boolean;
  backgroundCheckRequired: boolean;
  driversLicenseRequired: boolean;
  motorVehicleRecordRequired: boolean;
  // Physical Requirements (V2.1.6A)
  liftRequirements: boolean;
  climbingRequirements: boolean;
  outdoorWork: boolean;
  overnightTravel: boolean;
  additionalPhysicalRequirements: string | null;
  // Relations
  reportsTo: PositionReportsToRef[];
  certifications: PositionCertificationRef[];
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PositionListResponse = {
  items: Position[];
  total: number;
  limit: number;
  offset: number;
};

export type PositionInput = {
  positionCode?: string | null;
  title: string;
  department?: string | null;
  description?: string | null;
  isActive?: boolean;
  standardResponsibilities?: string | null;
  standardQualifications?: string | null;
  defaultEmploymentType?: EmploymentType | null;
  payType?: PayType | null;
  flsaClassification?: FlsaClassification | null;
  workLocation?: WorkLocation | null;
  travelRequirement?: TravelRequirement | null;
  standardWorkDays?: string | null;
  standardStartTime?: string | null;
  standardEndTime?: string | null;
  standardLunchMinutes?: number | null;
  standardHoursPerWeek?: number | null;
  reportsToPositionIds?: string[];
  drugScreenRequired?: boolean;
  backgroundCheckRequired?: boolean;
  driversLicenseRequired?: boolean;
  motorVehicleRecordRequired?: boolean;
  liftRequirements?: boolean;
  climbingRequirements?: boolean;
  outdoorWork?: boolean;
  overnightTravel?: boolean;
  additionalPhysicalRequirements?: string | null;
  certifications?: string[];
};

// Format a canonical "HH:mm" (24h) time as 12-hour AM/PM for display.
export function formatTime12h(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return hhmm;
  let hour = parseInt(m[1], 10);
  const minute = m[2];
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${period}`;
}

export async function listPositions(params?: {
  isActive?: boolean;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<PositionListResponse> {
  const search = new URLSearchParams();
  if (params?.isActive !== undefined) {
    search.set("isActive", String(params.isActive));
  }
  if (params?.q) search.set("q", params.q);
  search.set("limit", String(params?.limit ?? 200));
  search.set("offset", String(params?.offset ?? 0));
  return apiFetch<PositionListResponse>(
    `/careers/positions?${search.toString()}`,
  );
}

export async function getPosition(id: string): Promise<Position> {
  return apiFetch<Position>(`/careers/positions/${id}`);
}

export async function createPosition(input: PositionInput): Promise<Position> {
  return apiFetch<Position>(`/careers/positions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePosition(
  id: string,
  input: PositionInput,
): Promise<Position> {
  return apiFetch<Position>(`/careers/positions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function activatePosition(id: string): Promise<Position> {
  return apiFetch<Position>(`/careers/positions/${id}/activate`, {
    method: "POST",
  });
}

export async function deactivatePosition(id: string): Promise<Position> {
  return apiFetch<Position>(`/careers/positions/${id}/deactivate`, {
    method: "POST",
  });
}
