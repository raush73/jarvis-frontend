import { apiFetch } from "@/lib/api";

/**
 * Jarvis Careers - minimal staff (User) directory client.
 *
 * Used only to resolve/select the Hiring Manager (a Jarvis User) on a job
 * posting. The backend `GET /users` endpoint is guarded by `users.read`, which
 * admins have but the `hiring_manager` role does not. Callers must therefore
 * tolerate a failure (403) and degrade gracefully - see `useStaffDirectory`
 * and `StaffSelect`.
 */

export type StaffUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  isActive?: boolean;
};

export async function listStaffUsers(): Promise<StaffUser[]> {
  return apiFetch<StaffUser[]>(`/users`);
}

/** Human label for a staff user (name, then email, then id). */
export function staffLabel(user: StaffUser): string {
  return (
    (user.fullName && user.fullName.trim()) ||
    (user.email && user.email.trim()) ||
    user.id
  );
}
