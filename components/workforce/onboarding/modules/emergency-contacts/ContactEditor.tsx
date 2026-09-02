"use client";

/**
 * Module 4.7 - one contact, as the worker edits it.
 *
 * A CONTROLLED component holding nothing. Every value comes down as a prop and every change
 * goes back up, so the only copy of what the worker has typed lives in the module's own state
 * and is committed by the module's own explicit Save. Nothing here writes a draft, and nothing
 * here reaches storage of any kind: values a worker has not saved yet exist in this component
 * tree and nowhere else (owner decision 6-5).
 *
 * The shape of one editable contact is defined here, beside the fields that edit it, and the
 * module composes a SET of them.
 *
 * WHAT LISTING SOMEONE MEANS, and why there is no call/no-call control. A person the worker
 * lists here IS an emergency contact and may be called in an emergency. Asking him separately
 * whether we may call someone he has just listed is a question with no defensible answer: it
 * invites a listed contact nobody is allowed to telephone. The worker's control over WHO we
 * call is the set itself - he adds a person, or he removes one.
 *
 * WHAT REMOVAL MEANS. Removing takes the person out of the worker's CURRENT effective set and
 * destroys nothing. The set is committed as one immutable version, so the version that listed
 * that person remains in history exactly as it was recorded, superseded rather than deleted.
 * The stored ACTIVE / INACTIVE status is untouched by this and remains what it always was -
 * an internal, historical and administrative mechanic, no longer a question the worker is
 * asked to operate.
 */

import type { ReactNode } from "react";
import type {
  EmergencyContact,
  EmergencyContactDesignation,
  EmergencyContactInput,
  EmergencyContactPriority,
  EmergencyContactRelationship,
  EmergencyContactStatus,
} from "@/lib/workforce/emergencyContactsApi";
import { EMERGENCY_CONTACT_RELATIONSHIP_OTHER } from "@/lib/workforce/emergencyContactsApi";
import DesignationSelect from "./DesignationSelect";
import LanguageSelect from "./LanguageSelect";
import PriorityControl, { contactOrdinalLabel } from "./PriorityControl";
import RelationshipSelect from "./RelationshipSelect";

/**
 * One contact being edited.
 *
 * Every attribute is a string, including the ones the wire carries as null, because that is
 * what an input holds. `key` is local identity for rendering only - it is never sent, and it
 * is not the record's id, which the worker's edits have no business carrying.
 */
export type ContactDraft = {
  key: string;
  /** True for a contact the worker added that has never been recorded. */
  isNew: boolean;
  priority: string;
  designation: string;
  fullName: string;
  relationship: string;
  relationshipDetail: string;
  primaryPhone: string;
  secondaryPhone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  preferredLanguage: string;
};

export type ContactField = keyof Omit<ContactDraft, "key" | "isNew">;

/** A recorded contact, opened for editing. */
export function contactFromRecord(record: EmergencyContact): ContactDraft {
  return {
    key: record.id,
    isNew: false,
    priority: record.priority,
    designation: record.designation,
    fullName: record.fullName,
    relationship: record.relationship,
    relationshipDetail: record.relationshipDetail ?? "",
    primaryPhone: record.primaryPhone,
    secondaryPhone: record.secondaryPhone ?? "",
    email: record.email ?? "",
    addressLine1: record.addressLine1 ?? "",
    addressLine2: record.addressLine2 ?? "",
    city: record.city ?? "",
    state: record.state ?? "",
    postalCode: record.postalCode ?? "",
    preferredLanguage: record.preferredLanguage ?? "",
  };
}

/** A contact the worker has just added, in the next free slot. */
export function emptyContact(priority: string, key: string): ContactDraft {
  return {
    key,
    isNew: true,
    priority,
    designation: "",
    fullName: "",
    relationship: "",
    relationshipDetail: "",
    primaryPhone: "",
    secondaryPhone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    preferredLanguage: "",
  };
}

/**
 * What this contact states, as the API client takes it. Trimmed; never reinterpreted.
 *
 * `status` is stated as ACTIVE for every contact the worker is listing, and it is stated
 * rather than omitted because the field is part of the governed record and remains so. It is
 * no longer a worker DECISION: being in the set the worker submits is what makes a person an
 * emergency contact, so a contact that reaches here is by definition one we may call. Taking
 * someone out of the set is how the worker says otherwise, and the server records that as a
 * new effective version without disturbing the one before it.
 */
export function toContactInput(draft: ContactDraft): EmergencyContactInput {
  const text = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  return {
    priority: draft.priority as EmergencyContactPriority,
    status: "ACTIVE" as EmergencyContactStatus,
    designation: draft.designation as EmergencyContactDesignation,
    fullName: draft.fullName.trim(),
    relationship: draft.relationship as EmergencyContactRelationship,
    relationshipDetail: text(draft.relationshipDetail),
    primaryPhone: draft.primaryPhone.trim(),
    secondaryPhone: text(draft.secondaryPhone),
    email: text(draft.email),
    addressLine1: text(draft.addressLine1),
    addressLine2: text(draft.addressLine2),
    city: text(draft.city),
    state: text(draft.state),
    postalCode: text(draft.postalCode),
    preferredLanguage: text(draft.preferredLanguage),
  };
}

type Props = {
  contact: ContactDraft;
  /** The slots the other contacts in this set hold. */
  takenPriorities: readonly string[];
  /** This contact's broken rules, in plain language, by field. */
  fieldErrors: Partial<Record<ContactField, string>>;
  disabled: boolean;
  onChange: (field: ContactField, value: string) => void;
  /** Take this person out of the set the worker is proposing. */
  onRemove: () => void;
};

export function ContactEditor({
  contact,
  takenPriorities,
  fieldErrors,
  disabled,
  onChange,
  onRemove,
}: Props) {
  const id = (field: string): string => `ec-${contact.key}-${field}`;
  const errorId = (field: ContactField): string | undefined =>
    fieldErrors[field] ? `${id(field)}-error` : undefined;

  return (
    <li
      className="wf-card ec-contact"
      data-contact-priority={contact.priority}
    >
      {/*
        WHO THIS CARD IS, in three words. The number is the governed order of contact attempt,
        which is also the only thing about a contact that is not already obvious from the fields
        under it - so it is the identification, and nothing here explains what an emergency
        contact is.
      */}
      <h3 className="ec-contact-title" data-contact-ordinal={contact.priority}>
        {contactOrdinalLabel(contact.priority)}
      </h3>

      <div className="ec-contact-head">
        <div className="ec-field ec-field-priority">
          <label className="wf-label" htmlFor={id("priority")}>
            When we should call this person
          </label>
          <PriorityControl
            id={id("priority")}
            value={contact.priority}
            takenBy={takenPriorities}
            invalid={Boolean(fieldErrors.priority)}
            describedBy={errorId("priority")}
            disabled={disabled}
            onChange={(value) => onChange("priority", value)}
          />
          <FieldError id={errorId("priority")}>{fieldErrors.priority}</FieldError>
        </div>
      </div>

      <div className="ec-grid">
        <div className="ec-field">
          <label className="wf-label" htmlFor={id("fullName")}>
            Full name
          </label>
          <input
            id={id("fullName")}
            className="wf-input ec-control"
            type="text"
            autoComplete="off"
            value={contact.fullName}
            disabled={disabled}
            aria-invalid={fieldErrors.fullName ? true : undefined}
            aria-describedby={errorId("fullName")}
            onChange={(event) => onChange("fullName", event.target.value)}
          />
          <FieldError id={errorId("fullName")}>{fieldErrors.fullName}</FieldError>
        </div>

        <div className="ec-field">
          <label className="wf-label" htmlFor={id("relationship")}>
            Their relationship to you
          </label>
          <RelationshipSelect
            id={id("relationship")}
            value={contact.relationship}
            invalid={Boolean(fieldErrors.relationship)}
            describedBy={errorId("relationship")}
            disabled={disabled}
            onChange={(value) => onChange("relationship", value)}
          />
          <FieldError id={errorId("relationship")}>{fieldErrors.relationship}</FieldError>
        </div>

        {contact.relationship === EMERGENCY_CONTACT_RELATIONSHIP_OTHER ? (
          <div className="ec-field">
            <label className="wf-label" htmlFor={id("relationshipDetail")}>
              Tell us how you know them
            </label>
            <input
              id={id("relationshipDetail")}
              className="wf-input ec-control"
              type="text"
              value={contact.relationshipDetail}
              disabled={disabled}
              aria-invalid={fieldErrors.relationshipDetail ? true : undefined}
              aria-describedby={errorId("relationshipDetail")}
              onChange={(event) => onChange("relationshipDetail", event.target.value)}
            />
            <FieldError id={errorId("relationshipDetail")}>
              {fieldErrors.relationshipDetail}
            </FieldError>
          </div>
        ) : null}

        <div className="ec-field">
          <label className="wf-label" htmlFor={id("primaryPhone")}>
            Phone number
          </label>
          <input
            id={id("primaryPhone")}
            className="wf-input ec-control"
            type="tel"
            inputMode="tel"
            value={contact.primaryPhone}
            disabled={disabled}
            aria-invalid={fieldErrors.primaryPhone ? true : undefined}
            aria-describedby={errorId("primaryPhone")}
            onChange={(event) => onChange("primaryPhone", event.target.value)}
          />
          <FieldError id={errorId("primaryPhone")}>{fieldErrors.primaryPhone}</FieldError>
        </div>

        <div className="ec-field">
          <label className="wf-label" htmlFor={id("secondaryPhone")}>
            Another phone number <span className="ec-optional">(optional)</span>
          </label>
          <input
            id={id("secondaryPhone")}
            className="wf-input ec-control"
            type="tel"
            inputMode="tel"
            value={contact.secondaryPhone}
            disabled={disabled}
            onChange={(event) => onChange("secondaryPhone", event.target.value)}
          />
        </div>

        <div className="ec-field">
          <label className="wf-label" htmlFor={id("email")}>
            Email <span className="ec-optional">(optional)</span>
          </label>
          <input
            id={id("email")}
            className="wf-input ec-control"
            type="email"
            value={contact.email}
            disabled={disabled}
            onChange={(event) => onChange("email", event.target.value)}
          />
        </div>

        <div className="ec-field">
          <label className="wf-label" htmlFor={id("preferredLanguage")}>
            Language they prefer <span className="ec-optional">(optional)</span>
          </label>
          <LanguageSelect
            id={id("preferredLanguage")}
            value={contact.preferredLanguage}
            disabled={disabled}
            onChange={(value) => onChange("preferredLanguage", value)}
          />
        </div>

        <div className="ec-field ec-field-wide">
          <label className="wf-label" htmlFor={id("addressLine1")}>
            Address <span className="ec-optional">(optional)</span>
          </label>
          <input
            id={id("addressLine1")}
            className="wf-input ec-control"
            type="text"
            value={contact.addressLine1}
            disabled={disabled}
            onChange={(event) => onChange("addressLine1", event.target.value)}
          />
          <input
            id={id("addressLine2")}
            className="wf-input ec-control"
            type="text"
            aria-label="Address line two"
            value={contact.addressLine2}
            disabled={disabled}
            onChange={(event) => onChange("addressLine2", event.target.value)}
          />
        </div>

        <div className="ec-field">
          <label className="wf-label" htmlFor={id("city")}>
            City <span className="ec-optional">(optional)</span>
          </label>
          <input
            id={id("city")}
            className="wf-input ec-control"
            type="text"
            value={contact.city}
            disabled={disabled}
            onChange={(event) => onChange("city", event.target.value)}
          />
        </div>

        <div className="ec-field">
          <label className="wf-label" htmlFor={id("state")}>
            State <span className="ec-optional">(optional)</span>
          </label>
          <input
            id={id("state")}
            className="wf-input ec-control"
            type="text"
            value={contact.state}
            disabled={disabled}
            onChange={(event) => onChange("state", event.target.value)}
          />
        </div>

        <div className="ec-field">
          <label className="wf-label" htmlFor={id("postalCode")}>
            ZIP code <span className="ec-optional">(optional)</span>
          </label>
          <input
            id={id("postalCode")}
            className="wf-input ec-control"
            type="text"
            inputMode="numeric"
            value={contact.postalCode}
            disabled={disabled}
            onChange={(event) => onChange("postalCode", event.target.value)}
          />
        </div>
      </div>

      <div className="ec-field ec-field-wide">
        <DesignationSelect
          name={id("designation")}
          value={contact.designation}
          invalid={Boolean(fieldErrors.designation)}
          describedBy={errorId("designation")}
          disabled={disabled}
          onChange={(value) => onChange("designation", value)}
        />
        <FieldError id={errorId("designation")}>{fieldErrors.designation}</FieldError>
      </div>

      {/*
        Offered for EVERY contact, recorded or not. What it does is the same in both cases -
        it takes the person out of the set the worker is proposing - and what the worker
        means by it is the same too. Nothing is deleted: the set is saved as a whole new
        version, so the version that listed this person survives it untouched.
      */}
      <div className="ec-contact-foot">
        <button
          type="button"
          className="wf-btn wf-btn-ghost wf-btn-sm"
          data-ec-remove={contact.priority}
          disabled={disabled}
          onClick={onRemove}
        >
          Remove this contact
        </button>
      </div>
    </li>
  );
}

/**
 * One broken rule, beside the field it is about.
 *
 * Words, not colour. The message is text, it is associated with the input by id, and the
 * styling only reinforces what is already readable.
 */
function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!id || !children) return null;
  return (
    <p className="ec-field-error" id={id}>
      {children}
    </p>
  );
}

export default ContactEditor;
