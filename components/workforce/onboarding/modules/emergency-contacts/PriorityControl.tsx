"use client";

/**
 * Module 4.7 - the priority control.
 *
 * Priority is the worker's intended ORDER OF CONTACT ATTEMPT (architecture 4.7.3), so it is
 * presented as exactly that: who we try first, second, and third. A slot another contact
 * already holds is offered but disabled, which shows the whole ordering at a glance and makes
 * the duplicate impossible to submit by accident rather than merely refused afterwards.
 *
 * The rule that a slot may not be occupied above an empty one is NOT enforced by hiding
 * options here. It is a rule about the SET, it is checked as one, and it is reported with the
 * other violations - a control that silently prevented the state could not explain it.
 */

import {
  EMERGENCY_CONTACT_PRIORITIES,
  type EmergencyContactPriority,
} from "@/lib/workforce/emergencyContactsApi";

const PRIORITY_LABELS: Record<EmergencyContactPriority, string> = {
  PRIMARY: "Call first",
  SECONDARY: "Call second",
  TERTIARY: "Call third",
};

/** The governed term, said in English. Exported so read-only surfaces agree with this one. */
export function priorityLabel(value: string): string {
  return PRIORITY_LABELS[value as EmergencyContactPriority] ?? value;
}

export function PriorityControl({
  id,
  value,
  takenBy,
  invalid,
  describedBy,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  /** The slots other contacts in this set already hold. */
  takenBy: readonly string[];
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  onChange: (value: EmergencyContactPriority) => void;
}) {
  return (
    <select
      id={id}
      className="wf-input ec-control"
      value={value}
      disabled={disabled}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value as EmergencyContactPriority)}
    >
      {EMERGENCY_CONTACT_PRIORITIES.map((priority) => (
        <option
          key={priority}
          value={priority}
          disabled={priority !== value && takenBy.includes(priority)}
        >
          {PRIORITY_LABELS[priority]}
        </option>
      ))}
    </select>
  );
}

export default PriorityControl;
