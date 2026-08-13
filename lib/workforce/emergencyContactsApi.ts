/**
 * Module 4.7 Emergency Contacts - browser API client.
 *
 * The client half of the Gate 6A capsule, and nothing more than that. It adds no endpoint, no
 * transport, and no session handling of its own: the worker routes go through the delivered
 * `onboardingWorkerFetch` and the authorized staff route through `onboardingAdminFetch`,
 * exactly as the Phase 4 document and Phase 5 execution clients do. A second copy of either
 * transport would be a second place for expiry, renewal, and refusal classification to drift.
 *
 * The types mirror `modules/emergency-contacts/emergency-contacts.view.ts` exactly.
 *
 * TWO THINGS ARE DELIBERATELY ABSENT.
 *
 *  - There is no confirm-unchanged call here. Confirming that a re-presented record needs no
 *    change is the DELIVERED Phase 0 completion capability with `confirmNoChange`, and the
 *    module reaches it through the runtime's own `complete`. A module-owned confirmation call
 *    would be a second confirmation subsystem for a capability that already exists.
 *  - There is no staff write of any kind. The capsule's staff surface is a read, its service
 *    exposes no administrative write to anybody, and this file could not call one if it tried.
 *
 * ON REFUSALS. The shared worker transport keeps `details.errors` and drops
 * `details.violations`, so what reaches a caller from a refused Save is the governed CODE and
 * a message. That is respected here rather than worked around: widening the shared transport
 * for this module's convenience would change a contract three certified phases depend on. The
 * code is enough to say plainly what the server refused, and per-field marking comes from the
 * module's own client-side rules, which are the same rules the server applies.
 */

import { onboardingWorkerFetch } from "./onboardingApi";
import { onboardingAdminFetch } from "./onboardingAdminApi";

/* -------------------------------------------------------------------------- */
/*  Governed vocabulary (mirror of emergency-contacts.constants.ts)            */
/* -------------------------------------------------------------------------- */

/** The worker's intended order of contact attempt. The array order IS the ordering. */
export const EMERGENCY_CONTACT_PRIORITIES = [
  "PRIMARY",
  "SECONDARY",
  "TERTIARY",
] as const;
export type EmergencyContactPriority = (typeof EMERGENCY_CONTACT_PRIORITIES)[number];

/** Inactive is the governed alternative to deletion. There is no third state. */
export const EMERGENCY_CONTACT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type EmergencyContactStatus = (typeof EMERGENCY_CONTACT_STATUSES)[number];

/** The worker-selected communication designation. Recorded, never interpreted. */
export const EMERGENCY_CONTACT_DESIGNATIONS = [
  "AUTHORIZED_TO_RECEIVE",
  "NOTIFICATION_ONLY",
] as const;
export type EmergencyContactDesignation =
  (typeof EMERGENCY_CONTACT_DESIGNATIONS)[number];

/** The closed relationship vocabulary of owner decision 6-2. */
export const EMERGENCY_CONTACT_RELATIONSHIPS = [
  "SPOUSE",
  "DOMESTIC_PARTNER",
  "PARENT",
  "CHILD",
  "SIBLING",
  "OTHER_FAMILY_MEMBER",
  "FRIEND",
  "OTHER",
] as const;
export type EmergencyContactRelationship =
  (typeof EMERGENCY_CONTACT_RELATIONSHIPS)[number];

/** The one relationship value that obliges the worker to say what the relationship is. */
export const EMERGENCY_CONTACT_RELATIONSHIP_OTHER: EmergencyContactRelationship = "OTHER";

/** At least one contact is required; up to three are supported. */
export const EMERGENCY_CONTACT_MIN_CONTACTS = 1;
export const EMERGENCY_CONTACT_MAX_CONTACTS = EMERGENCY_CONTACT_PRIORITIES.length;

/* -------------------------------------------------------------------------- */
/*  Contract types (mirror of the backend wire contract)                       */
/* -------------------------------------------------------------------------- */

/** One emergency contact, as any authorized reader receives it. */
export type EmergencyContact = {
  id: string;
  setVersion: number;
  priority: EmergencyContactPriority;
  status: EmergencyContactStatus;
  designation: EmergencyContactDesignation;
  fullName: string;
  relationship: EmergencyContactRelationship;
  relationshipDetail: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  preferredLanguage: string | null;
  effectiveFrom: string;
  /** Null while this contact is part of the currently effective profile. */
  supersededAt: string | null;
  recordedByType: string;
};

/** One version of a worker's profile. `setVersion` is null before he has recorded one. */
export type EmergencyContactProfile = {
  candidateId: string;
  setVersion: number | null;
  effectiveFrom: string | null;
  contacts: EmergencyContact[];
  /** The server's own count. Never recomputed here, so every surface agrees. */
  activeContactCount: number;
};

/** What the authorized staff read returns: what is effective now, and everything before it. */
export type EmergencyContactStaffView = {
  current: EmergencyContactProfile;
  /** The complete non-destructive history, newest version first. */
  history: EmergencyContact[];
};

/**
 * One contact as the worker submits it.
 *
 * Note what is absent, matching the backend DTO: no candidate, worker, actor, or packet
 * identifier, and no identifier for the contact itself. A Save states the whole SET, and the
 * server writes a new immutable version of it; there is no per-contact update to address.
 */
export type EmergencyContactInput = {
  priority: EmergencyContactPriority;
  status: EmergencyContactStatus;
  designation: EmergencyContactDesignation;
  fullName: string;
  relationship: EmergencyContactRelationship;
  relationshipDetail?: string | null;
  primaryPhone: string;
  secondaryPhone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  preferredLanguage?: string | null;
};

/* -------------------------------------------------------------------------- */
/*  Refusal codes the surface distinguishes                                    */
/* -------------------------------------------------------------------------- */

/**
 * The module's governed refusal vocabulary, as the surface must be able to speak about it.
 *
 * Codes only. Each one names a rule of architecture 4.7.3 - 4.7.6, and none of them can carry
 * a worker value.
 */
export const EMERGENCY_CONTACT_REFUSAL_CODES = [
  "CONTACTS_REQUIRED",
  "TOO_MANY_CONTACTS",
  "DUPLICATE_PRIORITY",
  "PRIORITY_ORDER_INVALID",
  "VALUE_NOT_GOVERNED",
  "CONTACT_FIELD_REQUIRED",
  "RELATIONSHIP_DETAIL_REQUIRED",
  "ACTIVE_CONTACT_REQUIRED",
  "NO_EFFECTIVE_CONTACTS",
] as const;
export type EmergencyContactRefusalCode =
  (typeof EMERGENCY_CONTACT_REFUSAL_CODES)[number];

/** The governed code a refusal carries, or null when the failure was not one of them. */
export function emergencyContactRefusalCode(
  error: unknown,
): EmergencyContactRefusalCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return (EMERGENCY_CONTACT_REFUSAL_CODES as readonly string[]).includes(code as string)
    ? (code as EmergencyContactRefusalCode)
    : null;
}

/* -------------------------------------------------------------------------- */
/*  Worker surface                                                             */
/* -------------------------------------------------------------------------- */

function workerBase(invocationId: string): string {
  return `/workforce/onboarding/runtime/packets/${encodeURIComponent(
    invocationId,
  )}/emergency-contacts`;
}

/** This worker's currently effective emergency contacts, in the packet he is working in. */
export async function getOwnEmergencyContacts(
  invocationId: string,
): Promise<EmergencyContactProfile> {
  return onboardingWorkerFetch<EmergencyContactProfile>(workerBase(invocationId));
}

/**
 * EXPLICIT SAVE. Commit the set the worker deliberately submitted.
 *
 * The whole set goes in one request because the server records the whole set as one immutable
 * version. Optional attributes are omitted rather than sent as `undefined`, so a contact that
 * states nothing about an address sends no address fields at all.
 */
export async function saveOwnEmergencyContacts(
  invocationId: string,
  contacts: readonly EmergencyContactInput[],
): Promise<EmergencyContactProfile> {
  return onboardingWorkerFetch<EmergencyContactProfile>(workerBase(invocationId), {
    method: "POST",
    body: { contacts: contacts.map(toWireContact) },
  });
}

function toWireContact(contact: EmergencyContactInput): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    priority: contact.priority,
    status: contact.status,
    designation: contact.designation,
    fullName: contact.fullName,
    relationship: contact.relationship,
    primaryPhone: contact.primaryPhone,
  };
  const optional = [
    "relationshipDetail",
    "secondaryPhone",
    "email",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postalCode",
    "preferredLanguage",
  ] as const;
  for (const field of optional) {
    const value = contact[field];
    if (value !== undefined && value !== null && value !== "") wire[field] = value;
  }
  return wire;
}

/* -------------------------------------------------------------------------- */
/*  Authorized staff surface                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A worker's emergency contacts for an authorized staff reader: current and history together.
 *
 * READ ONLY, and there is no companion write in this file because there is none on the server.
 * The read is audited server-side; this client neither knows nor asserts anything about that.
 */
export async function getStaffEmergencyContacts(
  candidateId: string,
): Promise<EmergencyContactStaffView> {
  return onboardingAdminFetch<EmergencyContactStaffView>(
    `/workforce/onboarding/modules/emergency-contacts/workers/${encodeURIComponent(
      candidateId,
    )}`,
  );
}
