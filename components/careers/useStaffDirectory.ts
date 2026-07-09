"use client";

import { useEffect, useMemo, useState } from "react";
import { StaffUser, listStaffUsers } from "@/lib/careers/staffApi";

export type StaffDirectoryStatus = "loading" | "ready" | "unavailable";

/**
 * Jarvis Careers - loads the staff (User) directory once for hiring-manager
 * name resolution and selection.
 *
 * `GET /users` requires the `users.read` permission (admins have it; the
 * `hiring_manager` role does not). When the call fails we surface
 * `status = "unavailable"` so callers can fall back to showing/entering raw
 * user IDs instead of crashing.
 */
export function useStaffDirectory() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [status, setStatus] = useState<StaffDirectoryStatus>("loading");

  useEffect(() => {
    let active = true;
    listStaffUsers()
      .then((list) => {
        if (!active) return;
        setUsers(list);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  const byId = useMemo(
    () => new Map(users.map((u) => [u.id, u] as const)),
    [users],
  );

  return { users, byId, status };
}
