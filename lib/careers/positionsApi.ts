import { apiFetch } from "@/lib/api";
import { EmploymentType } from "./jobPostingsApi";

/**
 * Jarvis Careers - Position API client (Phase 3 backend: /careers/positions).
 * Internal-staff only; gated by careers.positions.* permissions server-side.
 */

export type Position = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  // Position Defaults (V2.1.1)
  standardResponsibilities: string | null;
  standardQualifications: string | null;
  defaultEmploymentType: EmploymentType | null;
  isActive: boolean;
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
  title: string;
  department?: string;
  description?: string;
  standardResponsibilities?: string | null;
  standardQualifications?: string | null;
  defaultEmploymentType?: EmploymentType | null;
  isActive?: boolean;
};

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
