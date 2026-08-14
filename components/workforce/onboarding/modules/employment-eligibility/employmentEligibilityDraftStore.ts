"use client";

/**
 * Module 4.1 - the capsule's own in-session answers.
 *
 * WHERE UNSAVED ANSWERS LIVE, AND WHERE THEY MUST NOT. This module's values are committed by an
 * EXPLICIT SAVE of a whole governed version through its own endpoint. Until that Save succeeds
 * they live HERE and nowhere else. In particular they never reach:
 *
 *  - the runtime's shared debounced draft, which is why the module declares no captured keys: a
 *    half-typed protected document number must never be persisted as though it were an answer;
 *  - `window.localStorage` or `window.sessionStorage`, which this file does not touch and may not,
 *    because a governed record kept in browser storage is a second copy of protected data with no
 *    supersession, no audit and no expiry.
 *
 * WHY IT IS NOT COMPONENT STATE. The runtime routes each declared step to its own URL, so the
 * module's component is unmounted and remounted as the worker moves between his three steps.
 * Answers held in that component would be lost on every transition. They are therefore held here,
 * beside the capsule rather than inside one of its screens, keyed by the packet being worked in.
 *
 * WHAT THAT MEANS HONESTLY. This is memory, not persistence. A reload or a closed tab loses
 * whatever has not been saved, which is the truthful consequence of not writing governed values
 * anywhere a worker could not see them - and the module tells him so rather than implying his
 * typing was kept.
 */

import { useCallback, useSyncExternalStore } from "react";
import type {
  EmploymentEligibilityDocumentList,
  EmploymentEligibilityRecord,
  EmploymentEligibilityStatus,
} from "@/lib/workforce/employmentEligibilityApi";

/**
 * Which governed combination the worker is presenting.
 *
 * The two the governed lists establish, and no third. `LIST_A` is one document that establishes
 * identity and authorization together; `LIST_B_AND_C` is one that establishes identity plus one
 * that establishes authorization.
 */
export const EMPLOYMENT_ELIGIBILITY_PRESENTATION_PATHS = [
  "LIST_A",
  "LIST_B_AND_C",
] as const;
export type EmploymentEligibilityPresentationPath =
  (typeof EMPLOYMENT_ELIGIBILITY_PRESENTATION_PATHS)[number];

/** The lists a path requires, in the order the worker states them. */
export function listsForPath(
  path: EmploymentEligibilityPresentationPath,
): readonly EmploymentEligibilityDocumentList[] {
  return path === "LIST_A" ? ["LIST_A"] : ["LIST_B", "LIST_C"];
}

/**
 * The worker's answer to the identity confirmation, including "not answered yet".
 *
 * Three states rather than a boolean, deliberately. The governed record carries a boolean, and a
 * worker who has not reached the question yet has not answered `false`: sending one would record
 * a governed statement he never made.
 */
export type EmploymentEligibilityIdentityAnswer = "" | "CONFIRMED" | "DISPUTED";

/**
 * One document as the worker is stating it.
 *
 * Every field is a string because that is what an input holds. `list` is the governed list this
 * one must be chosen from, which the presentation path decides.
 */
export type EmploymentEligibilityDocumentDraft = {
  list: EmploymentEligibilityDocumentList;
  documentTypeKey: string;
  /** Protected. Held in memory only, sent on Save, and never read back from the server. */
  documentNumber: string;
  issuingAuthority: string;
  expiresOn: string;
  /**
   * The binding the document foundation returned when it CONFIRMED a capture in this session.
   *
   * Null until then, and an upload that was never confirmed leaves it null - which is what stops
   * an unconfirmed object being presented to the governed Save as evidence.
   */
  evidenceId: string | null;
};

export type EmploymentEligibilityDraft = {
  identityAnswer: EmploymentEligibilityIdentityAnswer;
  status: "" | EmploymentEligibilityStatus;
  workAuthorizationExpiresOn: string;
  path: "" | EmploymentEligibilityPresentationPath;
  documents: EmploymentEligibilityDocumentDraft[];
  /** True once the worker has deliberately chosen to present his documents again. */
  restating: boolean;
};

const EMPTY_DRAFT: EmploymentEligibilityDraft = {
  identityAnswer: "",
  status: "",
  workAuthorizationExpiresOn: "",
  path: "",
  documents: [],
  restating: false,
};

/**
 * The drafts of the packets open in this browser session.
 *
 * Module scope, so it survives the step navigation that unmounts the screens, and one entry per
 * packet, so two packets can never be confused for each other.
 */
const drafts = new Map<string, EmploymentEligibilityDraft>();
/** The packets whose draft has already been offered the recorded answers. */
const seeded = new Set<string>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** The draft for one packet. The same object until something changes it. */
export function readEmploymentEligibilityDraft(
  invocationId: string,
): EmploymentEligibilityDraft {
  const existing = drafts.get(invocationId);
  if (existing) return existing;
  drafts.set(invocationId, EMPTY_DRAFT);
  return EMPTY_DRAFT;
}

/** Replace part of a packet's draft. Callers state what changed; nothing else moves. */
export function updateEmploymentEligibilityDraft(
  invocationId: string,
  change:
    | Partial<EmploymentEligibilityDraft>
    | ((current: EmploymentEligibilityDraft) => Partial<EmploymentEligibilityDraft>),
): void {
  const current = readEmploymentEligibilityDraft(invocationId);
  const patch = typeof change === "function" ? change(current) : change;
  drafts.set(invocationId, { ...current, ...patch });
  emit();
}

/** Change one document of a packet's draft, addressed by the list it is being chosen from. */
export function updateEmploymentEligibilityDocument(
  invocationId: string,
  list: EmploymentEligibilityDocumentList,
  patch: Partial<EmploymentEligibilityDocumentDraft>,
): void {
  updateEmploymentEligibilityDraft(invocationId, (current) => ({
    documents: current.documents.map((document) =>
      document.list === list ? { ...document, ...patch } : document,
    ),
  }));
}

/**
 * Put the documents the chosen path requires in front of the worker.
 *
 * Existing answers for a list the new path still requires are KEPT, so a worker who changes his
 * mind and changes it back has not silently lost what he typed. Anything belonging to a list the
 * path no longer requires is dropped, because it is no longer part of what he is presenting.
 */
export function chooseEmploymentEligibilityPath(
  invocationId: string,
  path: EmploymentEligibilityPresentationPath,
): void {
  updateEmploymentEligibilityDraft(invocationId, (current) => ({
    path,
    documents: listsForPath(path).map(
      (list) =>
        current.documents.find((document) => document.list === list) ??
        emptyDocumentDraft(list),
    ),
  }));
}

export function emptyDocumentDraft(
  list: EmploymentEligibilityDocumentList,
): EmploymentEligibilityDocumentDraft {
  return {
    list,
    documentTypeKey: "",
    documentNumber: "",
    issuingAuthority: "",
    expiresOn: "",
    evidenceId: null,
  };
}

/**
 * Offer the recorded answers to a draft that has none yet - ONCE per packet per session.
 *
 * A resuming worker should see what he recorded rather than an empty interview, and a worker who
 * has typed something must never have it overwritten by a read that arrived afterwards. Both are
 * satisfied by seeding exactly once, before he has touched anything.
 *
 * NOTE WHAT CANNOT BE SEEDED. The protected document number is never returned by any read, so it
 * is left empty: the worker who wants to change a recorded presentation states it again. That is
 * the governed consequence of a write-only identifier, not an oversight, and the screen says so.
 */
export function seedEmploymentEligibilityDraft(
  invocationId: string,
  record: EmploymentEligibilityRecord,
): void {
  if (seeded.has(invocationId)) return;
  seeded.add(invocationId);
  if (record.setVersion === null) return;

  const lists = record.documents.map((document) => document.list);
  const path: "" | EmploymentEligibilityPresentationPath = lists.includes("LIST_A")
    ? "LIST_A"
    : lists.includes("LIST_B") || lists.includes("LIST_C")
      ? "LIST_B_AND_C"
      : "";

  updateEmploymentEligibilityDraft(invocationId, {
    identityAnswer: record.identityConfirmed ? "CONFIRMED" : "DISPUTED",
    status: record.status ?? "",
    workAuthorizationExpiresOn: record.workAuthorizationExpiresOn ?? "",
    path,
    documents: record.documents.map((document) => ({
      ...emptyDocumentDraft(document.list),
      documentTypeKey: document.documentTypeKey,
      issuingAuthority: document.issuingAuthority,
      expiresOn: document.expiresOn ?? "",
    })),
  });
}

/** TEST SUPPORT. Clears the session's drafts so one suite cannot leak into another. */
export function resetEmploymentEligibilityDrafts(): void {
  drafts.clear();
  seeded.clear();
  emit();
}

/** The packet's draft, re-rendering the caller whenever it changes. */
export function useEmploymentEligibilityDraft(
  invocationId: string,
): EmploymentEligibilityDraft {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  const snapshot = useCallback(
    () => readEmploymentEligibilityDraft(invocationId),
    [invocationId],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
