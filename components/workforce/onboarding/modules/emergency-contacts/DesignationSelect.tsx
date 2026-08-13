"use client";

/**
 * Module 4.7 - the communication designation control.
 *
 * The worker's recorded CHOICE about what this contact may be told (architecture 4.7.5). It is
 * recorded and never interpreted: what may lawfully be disclosed, by whom, and when is governed
 * by law and by MW4H's approved practices, so the wording below describes the worker's
 * instruction rather than promising an outcome.
 *
 * Two values, presented as radios rather than a select, because it is a deliberate choice
 * between two meanings rather than a value picked from a list - and because both options being
 * visible is what makes the difference between them readable.
 */

import {
  EMERGENCY_CONTACT_DESIGNATIONS,
  type EmergencyContactDesignation,
} from "@/lib/workforce/emergencyContactsApi";

const DESIGNATION_LABELS: Record<EmergencyContactDesignation, string> = {
  AUTHORIZED_TO_RECEIVE: "May be given information about me",
  NOTIFICATION_ONLY: "Should only be told to contact us",
};

const DESIGNATION_DETAIL: Record<EmergencyContactDesignation, string> = {
  AUTHORIZED_TO_RECEIVE:
    "You are authorising this person to be told about your situation, so far as the law and our practices allow.",
  NOTIFICATION_ONLY:
    "This person will be contacted, but will not be given details about you.",
};

/** The governed term, said in English. Exported so read-only surfaces agree with this one. */
export function designationLabel(value: string): string {
  return DESIGNATION_LABELS[value as EmergencyContactDesignation] ?? value;
}

export function DesignationSelect({
  name,
  value,
  invalid,
  describedBy,
  disabled,
  onChange,
}: {
  /** Unique per contact, so two contacts' radio groups are genuinely separate. */
  name: string;
  value: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  onChange: (value: EmergencyContactDesignation) => void;
}) {
  return (
    <fieldset
      className="ec-fieldset"
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
    >
      <legend className="ec-legend">What this person may be told</legend>
      {EMERGENCY_CONTACT_DESIGNATIONS.map((designation) => (
        <label className="ec-choice" key={designation} htmlFor={`${name}-${designation}`}>
          <input
            type="radio"
            id={`${name}-${designation}`}
            name={name}
            value={designation}
            checked={value === designation}
            disabled={disabled}
            onChange={() => onChange(designation)}
          />
          <span>
            <span className="ec-choice-label">{DESIGNATION_LABELS[designation]}</span>
            <span className="ec-choice-detail">{DESIGNATION_DETAIL[designation]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export default DesignationSelect;
