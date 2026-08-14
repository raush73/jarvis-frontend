/**
 * Module 4.1 Employment Eligibility - browser API client.
 *
 * The client half of the worker capsule, and nothing more than that. It adds no endpoint, no
 * transport and no session handling of its own: the two certified worker routes go through the
 * delivered `onboardingWorkerFetch`, exactly as the Phase 4 document, Phase 5 execution and
 * first-module clients do. A second copy of that transport would be a second place for expiry,
 * renewal and refusal classification to drift.
 *
 * The types mirror `modules/employment-eligibility/employment-eligibility.view.ts` and the
 * module's own DTO exactly.
 *
 * WHAT IS DELIBERATELY ABSENT, and none of it may be added here:
 *
 *  - THERE IS NO SOCIAL SECURITY NUMBER, in any shape. No field, no accessor, no parameter. The
 *    one acceptable document whose printed number is a Social Security Number captures no number
 *    at all, so this client has nothing to send for it and nothing to render back.
 *  - There is no examination or certification call. Whether presented documents satisfy the
 *    employer is an authorized MW4H act performed through a separate surface; the worker cannot
 *    reach it, and this file could not call it if it tried.
 *  - There is no completion call. Finishing his own part does not complete this module, and the
 *    module's completion authority additionally requires the employer's phase.
 *  - There is no per-field update. A Save states the WHOLE version, because the server records
 *    the whole version as one immutable effective record.
 *  - There is no evidence upload of any kind. Bytes belong to the delivered document
 *    foundation; this client carries only the binding that foundation hands back.
 *
 * ON REFUSALS. The shared worker transport keeps `details.errors` and drops `details.violations`,
 * so what reaches a caller from a refused Save is the governed CODE and a message. That is
 * respected rather than worked around: widening the shared transport for this module would
 * change a contract several certified phases depend on. The code is enough to say plainly what
 * the server refused, and per-field marking comes from the module's own mirrored client rules.
 */

import { onboardingWorkerFetch } from "./onboardingApi";

/* -------------------------------------------------------------------------- */
/*  Governed vocabulary (mirror of employment-eligibility.constants.ts)        */
/* -------------------------------------------------------------------------- */

/** The registry key the platform knows this module by. */
export const EMPLOYMENT_ELIGIBILITY_MODULE_KEY = "EMPLOYMENT_ELIGIBILITY";

/** The module's own declared interview steps, in the order it presents them. */
export const EMPLOYMENT_ELIGIBILITY_STEP_SLUGS = [
  "identity",
  "work-authorization",
  "documents",
] as const;
export type EmploymentEligibilityStepSlug =
  (typeof EMPLOYMENT_ELIGIBILITY_STEP_SLUGS)[number];

/**
 * The worker's attested employment-authorization category. A CLOSED vocabulary: a value outside
 * it is refused by the server rather than stored.
 */
export const EMPLOYMENT_ELIGIBILITY_STATUSES = [
  "US_CITIZEN",
  "NONCITIZEN_NATIONAL",
  "LAWFUL_PERMANENT_RESIDENT",
  "AUTHORIZED_TO_WORK",
] as const;
export type EmploymentEligibilityStatus =
  (typeof EMPLOYMENT_ELIGIBILITY_STATUSES)[number];

/**
 * The categories whose authorization carries an end date.
 *
 * Data capture and nothing else: no reminder, no escalation and no expiry behaviour exists
 * anywhere in this module, on either side of the wire.
 */
export const EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE: readonly EmploymentEligibilityStatus[] =
  ["AUTHORIZED_TO_WORK"];

/** Which governed list a document belongs to. */
export const EMPLOYMENT_ELIGIBILITY_DOCUMENT_LISTS = [
  "LIST_A",
  "LIST_B",
  "LIST_C",
] as const;
export type EmploymentEligibilityDocumentList =
  (typeof EMPLOYMENT_ELIGIBILITY_DOCUMENT_LISTS)[number];

/** The per-document facts a catalogue entry may capture from the worker. */
export const EMPLOYMENT_ELIGIBILITY_DOCUMENT_FIELDS = [
  "documentNumber",
  "issuingAuthority",
  "expiresOn",
] as const;
export type EmploymentEligibilityDocumentField =
  (typeof EMPLOYMENT_ELIGIBILITY_DOCUMENT_FIELDS)[number];

/** The worker-phase state of a recorded version. Neither state completes the module. */
export const EMPLOYMENT_ELIGIBILITY_WORKER_PHASE_STATES = [
  "RECORDED",
  "ATTESTED",
] as const;
export type EmploymentEligibilityWorkerPhaseState =
  (typeof EMPLOYMENT_ELIGIBILITY_WORKER_PHASE_STATES)[number];

/**
 * Why employer certification is currently impossible, as the server computes it on every read.
 *
 * Observations, never stored state. A surface may act on the ones that are the worker's to act
 * on and must not present the others as something he can fix himself.
 */
export const EMPLOYMENT_ELIGIBILITY_CERTIFICATION_BLOCKS = [
  "WORKER_PHASE_OUTSTANDING",
  "WORKER_ATTESTATION_OUTSTANDING",
  "CANONICAL_IDENTITY_INCOMPLETE",
  "IDENTITY_NOT_CONFIRMED_BY_WORKER",
] as const;
export type EmploymentEligibilityCertificationBlock =
  (typeof EMPLOYMENT_ELIGIBILITY_CERTIFICATION_BLOCKS)[number];

/**
 * The governed capture target the worker's evidence is captured into.
 *
 * ONE target, declared by the module on the server and reused here so the surface asks the
 * delivered document foundation for the module's own governed target rather than inventing a
 * place to put bytes. It is replaceable: a worker who photographed the wrong side supersedes
 * what he captured, and the foundation retains what was replaced.
 */
export const EMPLOYMENT_ELIGIBILITY_EVIDENCE_SLOT_KEY =
  "EMPLOYMENT_AUTHORIZATION_EVIDENCE";

/**
 * The execution subject for the worker's own governed attestation.
 *
 * The worker is the only execution actor in this module: there is no preparer subject, no
 * translator subject and no third-party actor anywhere in this capsule.
 */
export const EMPLOYMENT_ELIGIBILITY_ATTESTATION_SUBJECT_KEY = "WORKER_ATTESTATION";

/* -------------------------------------------------------------------------- */
/*  Contract types (mirror of the backend wire contract)                       */
/* -------------------------------------------------------------------------- */

/** One acceptable document, as the interview offers it. */
export type EmploymentEligibilityCatalogueEntry = {
  documentTypeKey: string;
  list: EmploymentEligibilityDocumentList;
  /** What the worker is asked, in the catalogue's own plain language. */
  prompt: string;
  /** What the worker is told the issuing authority means for this document. */
  issuingAuthorityPrompt: string;
  /** The fields this entry captures. A field absent from here is REFUSED if sent. */
  captures: EmploymentEligibilityDocumentField[];
  /** The fields the worker must supply. Always a subset of `captures`. */
  requires: EmploymentEligibilityDocumentField[];
  /**
   * The governed rules an authorized MW4H examiner must apply to this type.
   *
   * A RULE, NEVER A RESULT, and never a question for the worker. A surface may say plainly that
   * MW4H will look at the document; it may not ask the worker to reach the conclusion.
   */
  examinationRules: string[];
};

/** One presented document, as the worker's own surface may present it back. */
export type EmploymentEligibilityDocument = {
  documentTypeKey: string;
  list: EmploymentEligibilityDocumentList;
  issuingAuthority: string;
  expiresOn: string | null;
  /**
   * The masked tail of the protected identifier, never the identifier itself, and null for a
   * type whose number this module does not capture at all.
   */
  identifierLast4: string | null;
  /** Whether captured evidence is bound to this document. The server's answer, not a guess. */
  evidenceCaptured: boolean;
  recordedAt: string;
};

/** The worker's own record. Every field is null before he has recorded a version. */
export type EmploymentEligibilityRecord = {
  setVersion: number | null;
  effectiveFrom: string | null;
  status: EmploymentEligibilityStatus | null;
  workAuthorizationExpiresOn: string | null;
  identityConfirmed: boolean;
  workerPhaseState: EmploymentEligibilityWorkerPhaseState | null;
  catalogueVersion: string | null;
  documents: EmploymentEligibilityDocument[];
};

/** The worker's governed state, plus the documents he may present. */
export type EmploymentEligibilityState = {
  moduleKey: string;
  moduleNumber: string;
  record: EmploymentEligibilityRecord;
  offeredDocuments: EmploymentEligibilityCatalogueEntry[];
  catalogueVersion: string;
  certificationBlocks: EmploymentEligibilityCertificationBlock[];
  /** Two separate facts, deliberately: examination is not certification. */
  examinationRecorded: boolean;
  certificationRecorded: boolean;
};

/**
 * One presented document, as the worker submits it.
 *
 * Note what is absent, matching the backend DTO: no candidate, worker, actor or packet
 * identifier, no set version, no effective-from and no catalogue version. Every one of those is
 * derived server-side, and a field that does not exist here cannot be smuggled through it.
 */
export type EmploymentEligibilityDocumentInput = {
  documentTypeKey: string;
  /** Sent only where the catalogue entry captures it. Write-only: no read returns it. */
  documentNumber?: string | null;
  issuingAuthority?: string | null;
  expiresOn?: string | null;
  /**
   * The binding the delivered document foundation returned when it CONFIRMED a capture.
   *
   * A reference to an artifact that foundation owns, never a file and never a storage key. An
   * unconfirmed upload has no binding, which is what stops one being presented as evidence.
   */
  onboardingDocumentId?: string | null;
};

/** One explicit Save: the complete version the worker wants to be effective. */
export type SaveEmploymentEligibilityInput = {
  attestation: {
    status: EmploymentEligibilityStatus;
    workAuthorizationExpiresOn?: string | null;
    /** A confirmation of canonical identity, never a correction to it. */
    identityConfirmed: boolean;
  };
  documents: readonly EmploymentEligibilityDocumentInput[];
};

/* -------------------------------------------------------------------------- */
/*  Refusal codes the surface distinguishes                                    */
/* -------------------------------------------------------------------------- */

/**
 * The module's governed refusal vocabulary, as the surface must be able to speak about it.
 *
 * Codes only. Each names a governed rule, and none can carry a worker value.
 */
export const EMPLOYMENT_ELIGIBILITY_REFUSAL_CODES = [
  "STATUS_NOT_GOVERNED",
  "AUTHORIZATION_END_DATE_REQUIRED",
  "AUTHORIZATION_END_DATE_NOT_PERMITTED",
  "IDENTITY_CONFIRMATION_REQUIRED",
  "DOCUMENTS_REQUIRED",
  "DOCUMENT_TYPE_NOT_GOVERNED",
  "DOCUMENT_COMBINATION_INVALID",
  "DOCUMENT_TYPE_DUPLICATED",
  "DOCUMENT_FIELD_REQUIRED",
  "DOCUMENT_FIELD_NOT_CAPTURED",
  "DATE_INVALID",
  "CATALOGUE_VERSION_UNKNOWN",
  "NO_EFFECTIVE_RECORD",
] as const;
export type EmploymentEligibilityRefusalCode =
  (typeof EMPLOYMENT_ELIGIBILITY_REFUSAL_CODES)[number];

/** The governed code a refusal carries, or null when the failure was not one of them. */
export function employmentEligibilityRefusalCode(
  error: unknown,
): EmploymentEligibilityRefusalCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return (EMPLOYMENT_ELIGIBILITY_REFUSAL_CODES as readonly string[]).includes(
    code as string,
  )
    ? (code as EmploymentEligibilityRefusalCode)
    : null;
}

/* -------------------------------------------------------------------------- */
/*  Worker surface                                                             */
/* -------------------------------------------------------------------------- */

function workerBase(invocationId: string): string {
  return `/workforce/onboarding/runtime/packets/${encodeURIComponent(
    invocationId,
  )}/employment-eligibility`;
}

/**
 * This worker's own record, the documents he may present, and what is currently outstanding.
 *
 * The authoritative read. Everything a surface displays about what has been recorded comes from
 * here rather than from what the surface believes it just sent.
 */
export async function getOwnEmploymentEligibility(
  invocationId: string,
): Promise<EmploymentEligibilityState> {
  return onboardingWorkerFetch<EmploymentEligibilityState>(workerBase(invocationId));
}

/**
 * EXPLICIT SAVE. Commit the whole version the worker deliberately submitted.
 *
 * The whole version goes in one request because the server records the whole version as one
 * immutable effective record: stating one document does not add a document, it states that this
 * worker's record is now that answer set and those documents.
 *
 * Optional attributes are OMITTED rather than sent as null or as an empty string, which is what
 * lets a catalogue entry that captures no document number be submitted with no document number
 * at all. That is not a convenience: sending one for such an entry is refused, and it is that
 * refusal which keeps a Social Security Number out of this module.
 */
export async function saveOwnEmploymentEligibility(
  invocationId: string,
  version: SaveEmploymentEligibilityInput,
): Promise<EmploymentEligibilityState> {
  const attestation: Record<string, unknown> = {
    status: version.attestation.status,
    identityConfirmed: version.attestation.identityConfirmed,
  };
  const endDate = text(version.attestation.workAuthorizationExpiresOn);
  // Omitted for every category whose authorization carries no end date, because the server
  // refuses a date it does not govern rather than ignoring it.
  if (endDate) attestation.workAuthorizationExpiresOn = endDate;

  return onboardingWorkerFetch<EmploymentEligibilityState>(workerBase(invocationId), {
    method: "POST",
    body: {
      attestation,
      documents: version.documents.map(toWireDocument),
    },
  });
}

function toWireDocument(
  document: EmploymentEligibilityDocumentInput,
): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    documentTypeKey: document.documentTypeKey,
  };
  const optional = [
    "documentNumber",
    "issuingAuthority",
    "expiresOn",
    "onboardingDocumentId",
  ] as const;
  for (const field of optional) {
    const value = text(document[field]);
    if (value) wire[field] = value;
  }
  return wire;
}

function text(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}
