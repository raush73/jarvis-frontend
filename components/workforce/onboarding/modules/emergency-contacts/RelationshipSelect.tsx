"use client";

/**
 * Module 4.7 - the relationship control.
 *
 * The vocabulary is CLOSED (owner decision 6-2), so this is a select over the governed list
 * and never a text box. The worker who needs a word the list does not contain chooses "Other"
 * and says what it is, which is the one case where a detail is required and the only place a
 * relationship is described in the worker's own words.
 *
 * The plain-language labels are presentation of the governed terms. The VALUE submitted is
 * always the governed term itself.
 */

import {
  EMERGENCY_CONTACT_RELATIONSHIPS,
  type EmergencyContactRelationship,
} from "@/lib/workforce/emergencyContactsApi";

const RELATIONSHIP_LABELS: Record<EmergencyContactRelationship, string> = {
  SPOUSE: "Spouse",
  DOMESTIC_PARTNER: "Domestic partner",
  PARENT: "Parent",
  CHILD: "Child",
  SIBLING: "Sibling",
  OTHER_FAMILY_MEMBER: "Other family member",
  FRIEND: "Friend",
  OTHER: "Other",
};

/** The governed term, said in English. Exported so read-only surfaces agree with this one. */
export function relationshipLabel(value: string): string {
  return RELATIONSHIP_LABELS[value as EmergencyContactRelationship] ?? value;
}

export function RelationshipSelect({
  id,
  value,
  invalid,
  describedBy,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  onChange: (value: EmergencyContactRelationship) => void;
}) {
  return (
    <select
      id={id}
      className="wf-input ec-control"
      value={value}
      disabled={disabled}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      onChange={(event) =>
        onChange(event.target.value as EmergencyContactRelationship)
      }
    >
      <option value="">Select a relationship</option>
      {EMERGENCY_CONTACT_RELATIONSHIPS.map((relationship) => (
        <option key={relationship} value={relationship}>
          {RELATIONSHIP_LABELS[relationship]}
        </option>
      ))}
    </select>
  );
}

export default RelationshipSelect;
