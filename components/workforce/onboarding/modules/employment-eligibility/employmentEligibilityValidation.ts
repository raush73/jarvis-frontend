/**
 * Module 4.1 - the governed rules, said in the browser.
 *
 * A MIRROR of `employment-eligibility.validation.ts`, written in the same order and reporting the
 * same codes, so what the worker is told beside a field and what the server would refuse are the
 * same statement. It is a COURTESY AND NOT AN AUTHORITY: the server validates every one of these
 * rules again, and its refusal is what decides.
 *
 * The mirror is held to two obligations, and they are the reason this file is small and dull:
 *
 *  - it must not PERMIT what the server refuses, or a worker is walked into a refusal;
 *  - it must not REFUSE what the server permits, or a worker is stopped from recording something
 *    governance allows him to record.
 *
 * The second obligation is why "the worker has not answered this yet" is NOT expressed as a
 * governed refusal code here. The server accepts a saved version in which the worker declined to
 * confirm his identity - a decline is a governed answer - so an unanswered question is a question
 * about whether the interview is FINISHED, not about whether the version is admissible. The two
 * are answered separately below, and only the second speaks in refusal codes.
 *
 * THE CATALOGUE IS THE AUTHORITY FOR FIELDS. Which facts a document type captures and which it
 * requires are read from the catalogue entry the SERVER published. Nothing here has an opinion
 * about any particular document, which is what lets a new catalogue version change what is asked
 * without changing this file.
 */

import {
  EMPLOYMENT_ELIGIBILITY_DOCUMENT_FIELDS,
  EMPLOYMENT_ELIGIBILITY_STATUSES,
  EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE,
  type EmploymentEligibilityCatalogueEntry,
  type EmploymentEligibilityDocumentField,
  type EmploymentEligibilityRefusalCode,
  type EmploymentEligibilityStatus,
  type EmploymentEligibilityStepSlug,
} from "@/lib/workforce/employmentEligibilityApi";
import type {
  EmploymentEligibilityDocumentDraft,
  EmploymentEligibilityDraft,
} from "./employmentEligibilityDraftStore";

/**
 * One broken rule.
 *
 * The same shape the server reports, so the two can be read together. `documentTypeKey` is the
 * governed type at fault and `field` the governed attribute; neither ever carries a worker value.
 * `list` is added for the screen alone: it says which of the two document positions the worker is
 * looking at, which the server has no reason to know.
 */
export type EmploymentEligibilityViolation = {
  code: EmploymentEligibilityRefusalCode;
  documentTypeKey: string | null;
  field: EmploymentEligibilityDocumentField | "status" | "workAuthorizationExpiresOn" | null;
  list: string | null;
};

/** One list, so an unattempted version never presents a new empty array to a dependency check. */
export const NO_VIOLATIONS: readonly EmploymentEligibilityViolation[] = [];

/**
 * Every governed rule the server would apply to this proposed version.
 *
 * Returns EVERY violation rather than the first, so a worker correcting his answers is not walked
 * through one error per attempt.
 */
export function validateProposedVersion(input: {
  readonly draft: EmploymentEligibilityDraft;
  readonly catalogue: readonly EmploymentEligibilityCatalogueEntry[];
}): EmploymentEligibilityViolation[] {
  const violations: EmploymentEligibilityViolation[] = [];
  const fail = (
    code: EmploymentEligibilityRefusalCode,
    documentTypeKey: string | null = null,
    field: EmploymentEligibilityViolation["field"] = null,
    list: string | null = null,
  ): void => {
    violations.push({ code, documentTypeKey, field, list });
  };

  validateAttestation(input.draft, fail);
  validateDocuments(input.draft.documents, input.catalogue, fail);
  return violations;
}

type Fail = (
  code: EmploymentEligibilityRefusalCode,
  documentTypeKey?: string | null,
  field?: EmploymentEligibilityViolation["field"],
  list?: string | null,
) => void;

function validateAttestation(draft: EmploymentEligibilityDraft, fail: Fail): void {
  const status = draft.status;
  if (!(EMPLOYMENT_ELIGIBILITY_STATUSES as readonly string[]).includes(status)) {
    fail("STATUS_NOT_GOVERNED", null, "status");
    return;
  }

  const carriesEndDate = EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE.includes(
    status as EmploymentEligibilityStatus,
  );
  const supplied = text(draft.workAuthorizationExpiresOn);

  if (carriesEndDate && !supplied) {
    fail("AUTHORIZATION_END_DATE_REQUIRED", null, "workAuthorizationExpiresOn");
  }
  // A category whose authorization carries no end date must not appear to have one. The client
  // does not send such a date either, so this reports a state the worker can see and correct
  // rather than one that could reach the server.
  if (!carriesEndDate && supplied) {
    fail("AUTHORIZATION_END_DATE_NOT_PERMITTED", null, "workAuthorizationExpiresOn");
  }
  if (supplied && !isIsoDate(supplied)) {
    fail("DATE_INVALID", null, "workAuthorizationExpiresOn");
  }
}

/**
 * The governed combination rule.
 *
 * ONE List A document establishes identity and authorization together. Otherwise ONE List B
 * document establishes identity and ONE List C document establishes authorization, and both are
 * required. Anything else is refused, because it is not a combination the governed lists
 * establish.
 */
function validateDocuments(
  documents: readonly EmploymentEligibilityDocumentDraft[],
  catalogue: readonly EmploymentEligibilityCatalogueEntry[],
  fail: Fail,
): void {
  const stated = documents.filter(
    (document) => text(document.documentTypeKey) !== null,
  );
  if (stated.length === 0) {
    fail("DOCUMENTS_REQUIRED");
    return;
  }

  const seen = new Set<string>();
  const entries: EmploymentEligibilityCatalogueEntry[] = [];

  for (const document of stated) {
    const entry = catalogue.find(
      (candidate) => candidate.documentTypeKey === document.documentTypeKey,
    );
    if (!entry) {
      fail(
        "DOCUMENT_TYPE_NOT_GOVERNED",
        document.documentTypeKey,
        "documentNumber",
        document.list,
      );
      continue;
    }
    if (seen.has(entry.documentTypeKey)) {
      fail("DOCUMENT_TYPE_DUPLICATED", entry.documentTypeKey, null, document.list);
      continue;
    }
    seen.add(entry.documentTypeKey);
    entries.push(entry);
    validateDocumentFields(document, entry, fail);
  }

  if (entries.length === 0) return;

  const counted = (list: string): number =>
    entries.filter((entry) => entry.list === list).length;
  const listA = counted("LIST_A") === 1 && counted("LIST_B") === 0 && counted("LIST_C") === 0;
  const listBAndC =
    counted("LIST_A") === 0 && counted("LIST_B") === 1 && counted("LIST_C") === 1;
  if (!listA && !listBAndC) fail("DOCUMENT_COMBINATION_INVALID");
}

function validateDocumentFields(
  document: EmploymentEligibilityDocumentDraft,
  entry: EmploymentEligibilityCatalogueEntry,
  fail: Fail,
): void {
  const supplied: Record<EmploymentEligibilityDocumentField, string | null> = {
    documentNumber: text(document.documentNumber),
    issuingAuthority: text(document.issuingAuthority),
    expiresOn: text(document.expiresOn),
  };

  for (const field of EMPLOYMENT_ELIGIBILITY_DOCUMENT_FIELDS) {
    const present = supplied[field] !== null;
    // Stating a fact the entry does not capture is REFUSED by the server rather than dropped,
    // so it is reported here too. For the one entry that captures no document number, that
    // refusal is what keeps a Social Security Number out of this module altogether.
    if (present && !entry.captures.includes(field)) {
      fail("DOCUMENT_FIELD_NOT_CAPTURED", entry.documentTypeKey, field, document.list);
    }
    if (!present && entry.requires.includes(field)) {
      fail("DOCUMENT_FIELD_REQUIRED", entry.documentTypeKey, field, document.list);
    }
  }

  if (supplied.expiresOn && !isIsoDate(supplied.expiresOn)) {
    fail("DATE_INVALID", entry.documentTypeKey, "expiresOn", document.list);
  }
}

/**
 * Which of the module's own declared steps the worker has not answered yet.
 *
 * NOT a refusal, and deliberately not spoken in refusal codes: the server would accept a version
 * carrying a declined identity confirmation, so "not answered" is a fact about the interview
 * rather than about admissibility. It is what a Save button reads to know the interview is
 * finished, and what tells the worker which screen still wants something from him.
 */
export function unansweredSteps(
  draft: EmploymentEligibilityDraft,
): readonly EmploymentEligibilityStepSlug[] {
  const outstanding: EmploymentEligibilityStepSlug[] = [];
  if (draft.identityAnswer === "") outstanding.push("identity");
  if (draft.status === "") outstanding.push("work-authorization");
  if (
    draft.path === "" ||
    draft.documents.length === 0 ||
    draft.documents.some((document) => text(document.documentTypeKey) === null)
  ) {
    outstanding.push("documents");
  }
  return outstanding;
}

/** An ISO calendar date, and a real one. `2026-02-31` is refused rather than rolled over. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  );
}

function text(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}
