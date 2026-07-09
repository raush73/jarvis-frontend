"use client";

import { staffLabel } from "@/lib/careers/staffApi";
import { useStaffDirectory } from "./useStaffDirectory";

/**
 * Jarvis Careers - Hiring Manager picker.
 *
 * Renders a real dropdown of staff users when the staff directory is readable
 * (admins). When it is not (e.g. the `hiring_manager` role lacks `users.read`),
 * it degrades to a plain user-ID text input so the field is still usable and
 * backend validation (assertUserExists) still applies.
 */
export function StaffSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { users, status } = useStaffDirectory();

  if (status === "loading") {
    return (
      <>
        <select className="ss-control" disabled aria-label="Hiring manager">
          <option>Loading staff…</option>
        </select>
        <StaffSelectStyles />
      </>
    );
  }

  if (status === "unavailable") {
    return (
      <>
        <input
          className="ss-control"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Hiring manager user ID (optional)"
          aria-label="Hiring manager user ID"
        />
        <span className="ss-note">
          Staff list unavailable for your role &mdash; enter a user ID, or leave
          blank.
        </span>
        <StaffSelectStyles />
      </>
    );
  }

  const sorted = [...users].sort((a, b) =>
    staffLabel(a).localeCompare(staffLabel(b)),
  );

  return (
    <>
      <select
        className="ss-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="Hiring manager"
      >
        <option value="">Unassigned</option>
        {sorted.map((u) => (
          <option key={u.id} value={u.id}>
            {staffLabel(u)}
          </option>
        ))}
      </select>
      <StaffSelectStyles />
    </>
  );
}

function StaffSelectStyles() {
  return (
    <style jsx>{`
      .ss-control {
        font-size: 13px;
        color: #111827;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 7px;
        padding: 9px 11px;
        width: 100%;
        box-sizing: border-box;
        font-family: inherit;
      }
      .ss-control:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
      .ss-control:disabled {
        background: #f9fafb;
        color: #6b7280;
        cursor: not-allowed;
      }
      .ss-note {
        display: block;
        margin-top: 4px;
        font-size: 11.5px;
        color: #9ca3af;
      }
    `}</style>
  );
}
