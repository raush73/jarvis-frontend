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
 * TWO SURFACES, TWO TRANSPORTS, ONE FILE. The worker's calls below go through the delivered
 * `onboardingWorkerFetch` and the authorized MW4H calls at the end of this file go through the
 * delivered `onboardingAdminFetch`. They are kept together because they speak about the same
 * governed record with the same types, and they are kept on separate transports because they are
 * separate identities: a staff route reached with a worker's token is refused by the server's own
 * strategy, and nothing here can blur that.
 *
 * WHAT IS DELIBERATELY ABSENT, and none of it may be added here:
 *
 *  - THERE IS NO SOCIAL SECURITY NUMBER, in any shape. No field, no accessor, no parameter. The
 *    one acceptable document whose printed number is a Social Security Number captures no number
 *    at all, so this client has nothing to send for it and nothing to render back.
 *  - There is no certification call. Whether the employer certifies is a consequential act taken
 *    through the delivered administrative ACTION surface, and its outcome is DERIVED by the server
 *    from governed state - so no caller anywhere, including this one, can ask for a result.
 *  - There is no completion call. Finishing his own part does not complete this module, and the
 *    module's completion authority additionally requires the employer's phase.
 *  - There is no per-field update. A Save states the WHOLE version, because the server records
 *    the whole version as one immutable effective record.
 *  - There is no evidence upload of any kind, and no evidence RETRIEVAL either. Bytes belong to the
 *    delivered document foundation: this client carries the binding that foundation hands back, and
 *    the reviewer opens the artifact through the delivered administrative retrieval.
 *  - There is no artifact call and no correction call. Both belong to a later gate.
 *
 * ON REFUSALS. The shared worker transport keeps `details.errors` and drops `details.violations`,
 * so what reaches a caller from a refused Save is the governed CODE and a message. That is
 * respected rather than worked around: widening the shared transport for this module would
 * change a contract several certified phases depend on. The code is enough to say plainly what
 * the server refused, and per-field marking comes from the module's own mirrored client rules.
 */

import { onboardingWorkerFetch } from "./onboardingApi";
import { onboardingAdminFetch } from "./onboardingAdminApi";

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
  // The employer-side observations. They reach the AUTHORIZED REVIEW SURFACE only: what an examiner
  // concluded about a worker's documents is an employer determination, and the worker's own screens
  // are told what is his to act on rather than shown a verdict.
  "EXAMINATION_OUTSTANDING",
  "EXAMINATION_STALE",
  "EXAMINATION_CATALOGUE_DRIFTED",
  "EXAMINATION_COVERAGE_INCOMPLETE",
  "DOCUMENT_EXAMINATION_REJECTED",
  "EVIDENCE_NOT_CONFIRMED",
  "CERTIFICATION_ALREADY_RECORDED",
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
/**
 * The codes a WORKER can be refused with.
 *
 * Separated from the employer's set below, and the separation is what lets the worker's surface be
 * required to have plain words for every refusal HE can receive without also being made to speak
 * about acts he can never perform.
 */
export const EMPLOYMENT_ELIGIBILITY_WORKER_REFUSAL_CODES = [
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
export type EmploymentEligibilityWorkerRefusalCode =
  (typeof EMPLOYMENT_ELIGIBILITY_WORKER_REFUSAL_CODES)[number];

/**
 * The codes an authorized REVIEWER can be refused with.
 *
 * Every one of them refuses an employer act - an examination, a certification, a disclosure - and
 * no worker surface can reach a path that raises any of them.
 */
export const EMPLOYMENT_ELIGIBILITY_EMPLOYER_REFUSAL_CODES = [
  "EXAMINATION_METHOD_NOT_GOVERNED",
  "EXAMINATION_OUTCOME_NOT_GOVERNED",
  "EXAMINATION_COVERAGE_INVALID",
  "EXAMINATION_RECORD_STALE",
  "EXAMINATION_CATALOGUE_STALE",
  "EXAMINATION_EVIDENCE_NOT_CONFIRMED",
  "EXAMINATION_PACKET_REQUIRED",
  "CERTIFICATION_BLOCKED",
  "DOCUMENT_NOT_IN_EFFECTIVE_RECORD",
  "IDENTIFIER_NOT_PROTECTED",
  "IDENTIFIER_REVEAL_PURPOSE_REQUIRED",
] as const;
export type EmploymentEligibilityEmployerRefusalCode =
  (typeof EMPLOYMENT_ELIGIBILITY_EMPLOYER_REFUSAL_CODES)[number];

export const EMPLOYMENT_ELIGIBILITY_REFUSAL_CODES = [
  ...EMPLOYMENT_ELIGIBILITY_WORKER_REFUSAL_CODES,
  ...EMPLOYMENT_ELIGIBILITY_EMPLOYER_REFUSAL_CODES,
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

/* -------------------------------------------------------------------------- */
/*  Authorized MW4H surface                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The staff half, added beside the worker half in ONE client because both speak about the same
 * governed record and the types are the same types.
 *
 * IT IS A DIFFERENT TRANSPORT, and deliberately so: these calls go through the delivered
 * `onboardingAdminFetch`, which carries the STAFF session, while every worker call above goes
 * through `onboardingWorkerFetch`, which carries the worker's. A staff route reached with a
 * worker's token is refused by the server's own strategy, and nothing here can blur that.
 *
 * WHAT IS STILL ABSENT, exactly as it is absent from the worker half. There is no Social Security
 * Number in any shape. There is no certification call: the affirmative employer certification is
 * taken through the delivered administrative ACTION surface, whose outcome the server derives from
 * governed state rather than accepting from a caller - so this client cannot ask for a result. And
 * there is no completion call, no artifact call, and no correction call.
 */

/** The governed method by which a reviewer examined what the worker presented. */
export const EMPLOYMENT_ELIGIBILITY_EXAMINATION_METHODS = [
  "REMOTE_EXAMINATION_OF_UPLOADED_EVIDENCE",
  "IN_PERSON_EXAMINATION",
] as const;
export type EmploymentEligibilityExaminationMethod =
  (typeof EMPLOYMENT_ELIGIBILITY_EXAMINATION_METHODS)[number];

/** The governed conclusion a reviewer may record for one presented document. */
export const EMPLOYMENT_ELIGIBILITY_DOCUMENT_OUTCOMES = [
  "ACCEPTED",
  "REJECTED",
] as const;
export type EmploymentEligibilityDocumentOutcome =
  (typeof EMPLOYMENT_ELIGIBILITY_DOCUMENT_OUTCOMES)[number];

/** One presented document, as the review surface sees it. */
export type EmploymentEligibilityStaffDocument = {
  /** The stored row. What the examination and the disclosure are addressed by. */
  documentRecordId: string;
  documentTypeKey: string;
  list: EmploymentEligibilityDocumentList;
  /** The catalogue's plain-language name, or null when the type is not in that version. */
  prompt: string | null;
  issuingAuthority: string;
  expiresOn: string | null;
  /** The masked tail. Never the identifier, and null where none was captured. */
  identifierLast4: string | null;
  hasProtectedIdentifier: boolean;
  /** The Phase 4 binding, for retrieval through the delivered administrative route. */
  onboardingDocumentId: string | null;
  /** Whether that binding is a CONFIRMED capture. An unconfirmed upload is not evidence. */
  evidenceConfirmed: boolean;
  recordedAt: string;
  /** The governed rules to apply. Rules, never results, and never a question for the worker. */
  examinationRules: string[];
  examinationOutcome: EmploymentEligibilityDocumentOutcome | null;
};

export type EmploymentEligibilityStaffExamination = {
  examinationId: string;
  attestationSetVersion: number;
  catalogueVersion: string;
  method: EmploymentEligibilityExaminationMethod;
  documentOutcomes: {
    documentTypeKey: string;
    outcome: EmploymentEligibilityDocumentOutcome;
  }[];
  examinedById: string;
  examinedAt: string;
  supersededAt: string | null;
};

export type EmploymentEligibilityStaffCertification = {
  certificationId: string;
  attestationSetVersion: number;
  catalogueVersion: string;
  examinationId: string | null;
  certifiedById: string;
  certifiedAt: string;
  firstDayOfEmployment: string | null;
  /** Whether a finalized governed artifact is bound. False until a later gate generates one. */
  artifactRecorded: boolean;
  supersededAt: string | null;
};

/** The derived timeliness display. Computed by the server on read and stored nowhere. */
export type EmploymentEligibilityTimeliness = {
  state: "NOT_ESTABLISHED" | "ESTABLISHED";
  firstDayOfEmployment: string | null;
  daysSinceFirstDay: number | null;
};

/** Everything the reviewer needs in order to examine, in one response. */
export type EmploymentEligibilityStaffReview = {
  candidateId: string;
  moduleKey: string;
  moduleNumber: string;
  packetId: string | null;
  setVersion: number | null;
  effectiveFrom: string | null;
  catalogueVersion: string | null;
  currentCatalogueVersion: string;
  status: EmploymentEligibilityStatus | null;
  workAuthorizationExpiresOn: string | null;
  workerPhaseState: EmploymentEligibilityWorkerPhaseState | null;
  canonicalIdentityComplete: boolean;
  identityConfirmedByWorker: boolean;
  workerAttestationOutstanding: boolean;
  documents: EmploymentEligibilityStaffDocument[];
  timeliness: EmploymentEligibilityTimeliness;
  /**
   * Why certification is currently impossible. SERVER-AUTHORITATIVE: the surface renders these and
   * never decides them, so it can neither offer a certification the server refuses nor withhold one
   * it would allow.
   */
  certificationBlocks: string[];
  certifiable: boolean;
  examination: EmploymentEligibilityStaffExamination | null;
  examinationHistory: EmploymentEligibilityStaffExamination[];
  certification: EmploymentEligibilityStaffCertification | null;
  certificationHistory: EmploymentEligibilityStaffCertification[];
  examinationMethods: EmploymentEligibilityExaminationMethod[];
  documentOutcomeVocabulary: EmploymentEligibilityDocumentOutcome[];
};

/** One structured examination, as the reviewer submits it. */
export type RecordEmploymentEligibilityExaminationInput = {
  /** What he examined. The server refuses it if the worker has since saved a newer version. */
  attestationSetVersion: number;
  catalogueVersion: string;
  method: EmploymentEligibilityExaminationMethod;
  documentOutcomes: readonly {
    documentTypeKey: string;
    outcome: EmploymentEligibilityDocumentOutcome;
  }[];
};

/** ONE authorized disclosure. The value is returned once and held nowhere. */
export type EmploymentEligibilityIdentifierReveal = {
  documentRecordId: string;
  documentTypeKey: string;
  identifier: string;
  revealedAt: string;
};

function staffBase(candidateId: string): string {
  return `/workforce/onboarding/modules/employment-eligibility/workers/${encodeURIComponent(
    candidateId,
  )}`;
}

/** The authorized review. Masked, and audited server-side as a staff read of another person. */
export async function getStaffEmploymentEligibility(
  candidateId: string,
): Promise<EmploymentEligibilityStaffReview> {
  return onboardingAdminFetch<EmploymentEligibilityStaffReview>(
    staffBase(candidateId),
  );
}

/** Record the reviewer's structured examination through the module-owned endpoint. */
export async function recordEmploymentEligibilityExamination(
  candidateId: string,
  examination: RecordEmploymentEligibilityExaminationInput,
): Promise<EmploymentEligibilityStaffExamination> {
  return onboardingAdminFetch<EmploymentEligibilityStaffExamination>(
    `${staffBase(candidateId)}/examination`,
    {
      method: "POST",
      body: {
        attestationSetVersion: examination.attestationSetVersion,
        catalogueVersion: examination.catalogueVersion,
        method: examination.method,
        documentOutcomes: examination.documentOutcomes.map((outcome) => ({
          documentTypeKey: outcome.documentTypeKey,
          outcome: outcome.outcome,
        })),
      },
    },
  );
}

/**
 * Reveal ONE protected document identifier, with a stated business purpose.
 *
 * A POST with a body, never a URL that a history or a proxy log could retain. The purpose is
 * mandatory and the server refuses without one; the value that comes back belongs in component
 * state for as long as the reviewer is looking at it and nowhere else.
 */
export async function revealEmploymentEligibilityIdentifier(
  candidateId: string,
  documentRecordId: string,
  purpose: string,
): Promise<EmploymentEligibilityIdentifierReveal> {
  return onboardingAdminFetch<EmploymentEligibilityIdentifierReveal>(
    `${staffBase(candidateId)}/documents/${encodeURIComponent(
      documentRecordId,
    )}/identifier`,
    { method: "POST", body: { purpose } },
  );
}
