"use client";

/**
 * Module 4.1 Employment Eligibility - the worker's screens.
 *
 * The worker's own part of a regulated module, rendered by the DELIVERED onboarding runtime at the
 * canonical worker URL. It reaches him the way every module does - the capsule registered a
 * renderer under its module key - and nothing in the runtime, the navigation, the status layer, the
 * document foundation or the execution foundation was changed to admit it.
 *
 * WHAT THE WORKER DOES HERE, and it is the whole of what he does anywhere in this module:
 * confirms who he is, states his permission to work, chooses the documents he is showing, gives
 * what the catalogue asks about each, photographs them, reads his own record back, and signs one
 * governed statement about it. Then his part is finished and MW4H has work to do.
 *
 * FOUR PROPERTIES THIS FILE EXISTS TO KEEP:
 *
 *  1. EXPLICIT SAVE OF A WHOLE VERSION. Nothing is persisted by typing. A Save states the entire
 *     governed version - the answers together with the documents - because that is what the server
 *     records: one immutable effective record superseding the one before it. `setValue`, the
 *     runtime's shared draft recorder, is deliberately never called, and the module declares no
 *     captured keys for it to write into, so no protected document number can reach the draft.
 *  2. A CONFIRMED CAPTURE, THEN IMMEDIATELY A SAVE. An upload is not evidence. The binding this
 *     module puts on a version is the one the document foundation returned when the SERVER
 *     confirmed the object exists, and the version carrying it is saved at once rather than left to
 *     a later press that might never come.
 *  3. NO SILENT LOSS OF EVIDENCE. No read returns a document binding, so a worker restating his
 *     record cannot inherit the old one - and a Save that omitted it would quietly take his
 *     evidence off his record. He is asked for a fresh picture instead, and told why.
 *  4. THE MODULE IS NEVER COMPLETED FROM HERE. `complete` is not called anywhere below. Finishing
 *     his own part is not completing this module: an employer phase is required, the platform
 *     enforces it, and this screen must not imply otherwise.
 *
 * WHERE UNSAVED ANSWERS LIVE. In the capsule's own in-session store, not in this component, because
 * the runtime gives each declared step its own URL and unmounts this component between them. Not in
 * browser storage either - see the store's own file for why that is a prohibition rather than a
 * preference.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OnboardingModuleRendererProps } from "@/components/workforce/onboarding/runtime/moduleRegistry";
import OnboardingErrorNotice from "@/components/workforce/onboarding/runtime/OnboardingErrorNotice";
import type { ExecutionAct } from "@/components/workforce/onboarding/execution/ExecutionFormControl";
import { useExecutionSubmission } from "@/components/workforce/onboarding/execution/useExecutionSubmission";
import {
  getOnboardingDocumentSlots,
  type OnboardingDocumentSlot,
} from "@/lib/workforce/onboardingDocumentApi";
import {
  getOnboardingExecutionSubjects,
  type OnboardingExecutionSubject,
} from "@/lib/workforce/onboardingExecutionApi";
import {
  EMPLOYMENT_ELIGIBILITY_ATTESTATION_SUBJECT_KEY,
  EMPLOYMENT_ELIGIBILITY_EVIDENCE_SLOT_KEY,
  EMPLOYMENT_ELIGIBILITY_MODULE_KEY,
  EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE,
  EMPLOYMENT_ELIGIBILITY_STEP_SLUGS,
  employmentEligibilityRefusalCode,
  getOwnEmploymentEligibility,
  saveOwnEmploymentEligibility,
  type EmploymentEligibilityCatalogueEntry,
  type EmploymentEligibilityDocumentField,
  type EmploymentEligibilityDocumentList,
  type EmploymentEligibilityRecord,
  type EmploymentEligibilityRefusalCode,
  type EmploymentEligibilityState,
  type EmploymentEligibilityStatus,
  type SaveEmploymentEligibilityInput,
} from "@/lib/workforce/employmentEligibilityApi";
import {
  getWorkerPortalIdentity,
  type WorkerPortalIdentity,
} from "@/lib/workforce/workerPortalApi";
import {
  chooseEmploymentEligibilityPath,
  readEmploymentEligibilityDraft,
  seedEmploymentEligibilityDraft,
  updateEmploymentEligibilityDocument,
  updateEmploymentEligibilityDraft,
  useEmploymentEligibilityDraft,
  type EmploymentEligibilityDocumentDraft,
  type EmploymentEligibilityDraft,
  type EmploymentEligibilityPresentationPath,
} from "./employmentEligibilityDraftStore";
import {
  NO_VIOLATIONS,
  unansweredSteps,
  validateProposedVersion,
  type EmploymentEligibilityViolation,
} from "./employmentEligibilityValidation";
import IdentityConfirmation from "./IdentityConfirmation";
import WorkAuthorizationChoice, { statusLabel } from "./WorkAuthorizationChoice";
import PresentationPathChoice from "./PresentationPathChoice";
import DocumentTypeSelect from "./DocumentTypeSelect";
import DocumentFields from "./DocumentFields";
import DocumentEvidence from "./DocumentEvidence";
import ReviewAndSign, { EmploymentEligibilityReview } from "./ReviewAndSign";
import WorkerPhaseComplete from "./WorkerPhaseComplete";
import "./employment-eligibility.css";

const [IDENTITY_STEP, WORK_AUTHORIZATION_STEP, DOCUMENTS_STEP] =
  EMPLOYMENT_ELIGIBILITY_STEP_SLUGS;

/**
 * What each governed refusal means, in the worker's own words.
 *
 * Keyed by CODE so an unknown one cannot slip through as a raw identifier, and the same table
 * answers for a rule this client checked and a rule the server refused - they are the same rules,
 * so a worker must not be told them two different ways.
 */
const REFUSAL_MESSAGES: Record<EmploymentEligibilityRefusalCode, string> = {
  STATUS_NOT_GOVERNED: "Choose one of the answers about your permission to work.",
  AUTHORIZATION_END_DATE_REQUIRED:
    "Tell us the date your permission to work runs out.",
  AUTHORIZATION_END_DATE_NOT_PERMITTED:
    "The answer you chose does not have an end date, so leave that date empty.",
  IDENTITY_CONFIRMATION_REQUIRED: "Tell us whether the name we have is yours.",
  DOCUMENTS_REQUIRED: "Tell us which documents you are showing us.",
  DOCUMENT_TYPE_NOT_GOVERNED: "Choose one of the documents in the list.",
  DOCUMENT_COMBINATION_INVALID:
    "Show us either one document that covers both, or two documents: one that shows who you are and one that shows you may work.",
  DOCUMENT_TYPE_DUPLICATED: "Choose two different documents.",
  DOCUMENT_FIELD_REQUIRED: "Some details we have to have are still missing.",
  DOCUMENT_FIELD_NOT_CAPTURED:
    "We do not need that for the document you chose. Clear it and carry on.",
  DATE_INVALID: "Enter the date the way it appears on your document.",
  CATALOGUE_VERSION_UNKNOWN:
    "The documents we can accept have changed. Choose your documents again.",
  NO_EFFECTIVE_RECORD: "We do not have your answers yet.",
};

/** What the worker is asked to choose, per governed list. Never a list name, never a form line. */
const LIST_PROMPTS: Record<EmploymentEligibilityDocumentList, string> = {
  LIST_A: "Choose the document you are showing us",
  LIST_B: "Choose the document that shows who you are",
  LIST_C: "Choose the document that shows you may work",
};

/** The question each declared step asks, for telling a worker what is still outstanding. */
const STEP_QUESTIONS: Record<string, string> = {
  [IDENTITY_STEP]: "Is this you?",
  [WORK_AUTHORIZATION_STEP]: "Your permission to work",
  [DOCUMENTS_STEP]: "The documents you are showing us",
};

export function EmploymentEligibilityModule({
  invocationId,
  module,
  step,
  busy,
}: OnboardingModuleRendererProps) {
  const draft = useEmploymentEligibilityDraft(invocationId);

  const [state, setState] = useState<EmploymentEligibilityState | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [identity, setIdentity] = useState<WorkerPortalIdentity | null>(null);
  const [identityError, setIdentityError] = useState<unknown>(null);
  const [slot, setSlot] = useState<OnboardingDocumentSlot | null>(null);
  const [slotError, setSlotError] = useState<unknown>(null);
  const [subjects, setSubjects] = useState<OnboardingExecutionSubject[] | null>(null);
  const [subjectsError, setSubjectsError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [packetError, setPacketError] = useState<unknown>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  /** Broken rules are shown once the worker has tried to save, not while he is still typing. */
  const [attempted, setAttempted] = useState(false);
  /** Bumped by each refused attempt, so the worker is taken to what is wrong every time. */
  const [refusedAttempts, setRefusedAttempts] = useState(0);
  /** Bumped to ask the server for everything again. */
  const [reloads, setReloads] = useState(0);

  const summary = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    setReloads((count) => count + 1);
  }, []);

  /* ------------------------------------------------------------------ reads */

  useEffect(() => {
    // `live` guards a response arriving after the worker moved on, which would otherwise show
    // one packet's record under another's screen.
    let live = true;
    getOwnEmploymentEligibility(invocationId)
      .then((value) => {
        if (!live) return;
        // Offered to the draft ONCE per packet, before the worker has touched anything, so a
        // resuming worker sees what he recorded and a typing worker is never overwritten.
        seedEmploymentEligibilityDraft(invocationId, value.record);
        setState(value);
        setLoadError(null);
      })
      .catch((failure: unknown) => {
        if (live) setLoadError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId, reloads]);

  useEffect(() => {
    if (step.slug !== IDENTITY_STEP) return;
    let live = true;
    getWorkerPortalIdentity()
      .then((value) => {
        if (!live) return;
        setIdentity(value);
        setIdentityError(null);
      })
      .catch((failure: unknown) => {
        if (live) setIdentityError(failure);
      });
    return () => {
      live = false;
    };
  }, [reloads, step.slug]);

  /*
    The capture target and the subject are read only on the step that uses them, and separately,
    so a failure to read one does not take the other down with it.
  */
  useEffect(() => {
    if (step.slug !== DOCUMENTS_STEP) return;
    let live = true;
    getOnboardingDocumentSlots(invocationId)
      .then((value) => {
        if (!live) return;
        setSlot(
          value.find(
            (candidate) =>
              candidate.moduleKey === EMPLOYMENT_ELIGIBILITY_MODULE_KEY &&
              candidate.slotKey === EMPLOYMENT_ELIGIBILITY_EVIDENCE_SLOT_KEY,
          ) ?? null,
        );
        setSlotError(null);
      })
      .catch((failure: unknown) => {
        if (live) setSlotError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId, reloads, step.slug]);

  useEffect(() => {
    if (step.slug !== DOCUMENTS_STEP) return;
    let live = true;
    getOnboardingExecutionSubjects(invocationId)
      .then((value) => {
        if (!live) return;
        setSubjects(value);
        setSubjectsError(null);
      })
      .catch((failure: unknown) => {
        if (live) setSubjectsError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId, reloads, step.slug]);

  /* ------------------------------------------------------------- what we have */

  const record = state?.record ?? null;
  const catalogue = useMemo(() => state?.offeredDocuments ?? [], [state]);
  const hasRecord = record !== null && record.setVersion !== null;
  const sectionClosed =
    module.status === "COMPLETE" || module.status === "ALREADY_COMPLETE";

  /** True while any presented document is still without its confirmed picture. */
  const evidenceOutstanding =
    !record ||
    record.documents.length === 0 ||
    record.documents.some((document) => !document.evidenceCaptured);

  /**
   * Whether the interview is open.
   *
   * Open until there is a record whose every document carries evidence, and open again whenever
   * the worker deliberately says he needs to change something. A worker who is mid-way through -
   * one document photographed, one not - is still working, and must not be shown a read-only
   * summary of an unfinished record.
   */
  const editing =
    !sectionClosed && (!hasRecord || draft.restating || evidenceOutstanding);

  const entryFor = useCallback(
    (documentTypeKey: string): EmploymentEligibilityCatalogueEntry | null =>
      catalogue.find((entry) => entry.documentTypeKey === documentTypeKey) ?? null,
    [catalogue],
  );

  const evidenceOnRecord = useCallback(
    (documentTypeKey: string): boolean =>
      Boolean(
        record?.documents.some(
          (document) =>
            document.documentTypeKey === documentTypeKey && document.evidenceCaptured,
        ),
      ),
    [record],
  );

  /**
   * A document whose recorded evidence this session cannot restate.
   *
   * The recorded projection carries WHETHER evidence was captured and never WHICH artifact it
   * was, so a session that did not capture it holds no binding for it. Saving would therefore
   * write a version without one and take his evidence off his record. He is asked for a fresh
   * picture instead - which is the governed answer rather than a workaround, because presenting
   * a document is an act and cannot be inherited from a read.
   */
  const needsFreshCapture = useCallback(
    (document: EmploymentEligibilityDocumentDraft): boolean =>
      document.evidenceId === null && evidenceOnRecord(document.documentTypeKey),
    [evidenceOnRecord],
  );

  const recaptureBlocked = draft.documents.some(needsFreshCapture);

  /* ------------------------------------------------------------- what changed */

  const changed = useMemo(
    () => hasChanged(draft, record),
    [draft, record],
  );
  const anythingStated =
    draft.identityAnswer !== "" || draft.status !== "" || draft.documents.length > 0;
  const dirty = hasRecord ? changed : anythingStated;

  useEffect(() => {
    if (!dirty) return;
    // A reload or a closed tab is the one way unsaved answers are actually lost, because they
    // live in memory and deliberately nowhere else. The browser's own prompt is the only
    // protection that reaches it, and it is registered only while there is something to lose.
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* -------------------------------------------------------------- the rules */

  const violations = useMemo(
    () => validateProposedVersion({ draft, catalogue }),
    [catalogue, draft],
  );
  const outstanding = useMemo(() => unansweredSteps(draft), [draft]);
  const shown = attempted ? violations : NO_VIOLATIONS;
  const shownOutstanding = attempted ? outstanding : [];

  /** Everything the worker has stated is admissible, so a capture can be saved at once. */
  const versionStatable = violations.length === 0 && outstanding.length === 0;

  useEffect(() => {
    if (refusedAttempts === 0) return;
    // Focus follows the refusal. A worker on a phone has the button under his thumb and the
    // reason above the fold; moving him to the reason is the whole point of reporting it.
    summary.current?.focus();
  }, [refusedAttempts]);

  /* ----------------------------------------------------------------- edits */

  const answerIdentity = useCallback(
    (identityAnswer: EmploymentEligibilityDraft["identityAnswer"]) => {
      updateEmploymentEligibilityDraft(invocationId, { identityAnswer });
    },
    [invocationId],
  );

  const chooseStatus = useCallback(
    (status: EmploymentEligibilityStatus) => {
      updateEmploymentEligibilityDraft(invocationId, (current) => ({
        status,
        // A category whose authorization carries no end date must not keep one the worker
        // stated for a different answer: the server refuses such a date rather than ignoring it.
        workAuthorizationExpiresOn: carriesEndDate(status)
          ? current.workAuthorizationExpiresOn
          : "",
      }));
    },
    [invocationId],
  );

  const stateEndDate = useCallback(
    (workAuthorizationExpiresOn: string) => {
      updateEmploymentEligibilityDraft(invocationId, { workAuthorizationExpiresOn });
    },
    [invocationId],
  );

  const choosePath = useCallback(
    (path: EmploymentEligibilityPresentationPath) => {
      chooseEmploymentEligibilityPath(invocationId, path);
    },
    [invocationId],
  );

  /**
   * A different document is a different presentation.
   *
   * Its details and its picture belong to the document that was chosen, so choosing another
   * clears both rather than carrying them across. That is also what keeps a value the new
   * catalogue entry does not capture from being sent for it.
   */
  const chooseType = useCallback(
    (list: EmploymentEligibilityDocumentList, documentTypeKey: string) => {
      const current = readEmploymentEligibilityDraft(invocationId).documents.find(
        (document) => document.list === list,
      );
      if (current?.documentTypeKey === documentTypeKey) return;
      updateEmploymentEligibilityDocument(invocationId, list, {
        documentTypeKey,
        documentNumber: "",
        issuingAuthority: "",
        expiresOn: "",
        evidenceId: null,
      });
    },
    [invocationId],
  );

  const stateField = useCallback(
    (
      list: EmploymentEligibilityDocumentList,
      field: EmploymentEligibilityDocumentField,
      value: string,
    ) => {
      updateEmploymentEligibilityDocument(invocationId, list, { [field]: value });
    },
    [invocationId],
  );

  const restate = useCallback(() => {
    updateEmploymentEligibilityDraft(invocationId, { restating: true });
    setAttempted(false);
    setSaveError(null);
  }, [invocationId]);

  /* ------------------------------------------------------------------ save */

  /**
   * THE explicit save: the whole version, in one deliberate act, or nothing.
   *
   * The draft is read from the store rather than from this render, because the save that follows
   * a confirmed capture runs in the same turn as the binding it must carry.
   *
   * Returns whether the version is now on the record, for a caller that must not proceed without
   * confirmed persistence.
   */
  const save = useCallback(async (): Promise<boolean> => {
    const current = readEmploymentEligibilityDraft(invocationId);
    setAttempted(true);
    setPacketError(null);

    const refuse = (): false => {
      setSaveError(null);
      setRefusedAttempts((count) => count + 1);
      return false;
    };

    if (
      validateProposedVersion({ draft: current, catalogue }).length > 0 ||
      unansweredSteps(current).length > 0
    ) {
      return refuse();
    }
    if (current.documents.some(needsFreshCapture)) return refuse();

    setSaving(true);
    try {
      const value = await saveOwnEmploymentEligibility(
        invocationId,
        toVersion(current, entryFor),
      );
      setState(value);
      setSavedVersion(value.record.setVersion);
      setSaveError(null);
      setAttempted(false);
      updateEmploymentEligibilityDraft(invocationId, { restating: false });
      /*
        Re-read everything. The record is new, so what the worker must sign may be outstanding
        again - that is the server's determination, made from the record his act was performed
        against, and it is read rather than inferred here.
      */
      setReloads((count) => count + 1);
      return true;
    } catch (failure: unknown) {
      // The worker's answers stay exactly where they are. A refused save is not a reason to
      // lose them, and nothing was recorded.
      setSaveError(failure);
      setRefusedAttempts((count) => count + 1);
      return false;
    } finally {
      setSaving(false);
    }
  }, [catalogue, entryFor, invocationId, needsFreshCapture]);

  /**
   * A CONFIRMED capture, and then at once the version that carries it.
   *
   * The binding comes from the document foundation's confirmation and from nowhere else: an
   * upload that was never confirmed produces none, so there is nothing here that could bind a
   * version to an object the server has not proven exists.
   */
  const bindEvidence = useCallback(
    (list: EmploymentEligibilityDocumentList, onboardingDocumentId: string) => {
      updateEmploymentEligibilityDocument(invocationId, list, {
        evidenceId: onboardingDocumentId,
      });
      void save();
    },
    [invocationId, save],
  );

  /* -------------------------------------------------------------- execution */

  const { submitting, refusal, submit, clearRefusal } = useExecutionSubmission(
    invocationId,
    reload,
    setPacketError,
  );

  /**
   * Perform the act, with the content identity the SERVER supplied.
   *
   * Every value travelling with it is copied from the subject that produced what is on screen:
   * the act it requires, the version, the hash, the rule revision. Nothing here is computed,
   * refreshed or re-derived, and nothing identifies which governed record it is about - the
   * server resolves that from the worker's own effective record, which is what lets it decide
   * that an earlier act no longer answers for a record he has since changed.
   */
  const perform = useCallback(
    (subject: OnboardingExecutionSubject, act: ExecutionAct): Promise<boolean> => {
      clearRefusal();
      return submit({
        moduleKey: subject.moduleKey,
        subjectKey: subject.subjectKey,
        performedForm: subject.requiredForm,
        presented: {
          revision: subject.content.revision,
          contentHash: subject.content.contentHash,
          ruleRevision: subject.content.ruleRevision,
        },
        ...(act.kind === "ATTESTATION"
          ? { acknowledged: true as const }
          : { capture: act.capture }),
      });
    },
    [clearRefusal, submit],
  );

  const attestation =
    subjects?.find(
      (subject) =>
        subject.moduleKey === EMPLOYMENT_ELIGIBILITY_MODULE_KEY &&
        subject.subjectKey === EMPLOYMENT_ELIGIBILITY_ATTESTATION_SUBJECT_KEY,
    ) ?? null;
  /** His part is done when nothing about the CURRENT record is still asked of him. */
  const workerPhaseComplete =
    hasRecord && !evidenceOutstanding && attestation !== null && !attestation.requiresExecution;

  /* ---------------------------------------------------------------- render */

  if (loadError) {
    return (
      <section className="ee-module" data-ee-state="ERROR">
        <OnboardingErrorNotice error={loadError} onRetry={() => void reload()} />
      </section>
    );
  }

  if (!state || !record) {
    return (
      <section className="ee-module" data-ee-state="LOADING">
        <p className="wf-loading">Loading your answers.</p>
      </section>
    );
  }

  const disabled = saving || busy;
  const stale =
    record.catalogueVersion !== null &&
    record.catalogueVersion !== state.catalogueVersion;

  const messages = (
    <>
      {packetError ? (
        <OnboardingErrorNotice error={packetError} onRetry={() => void reload()} />
      ) : null}
      {saveError ? (
        <RefusalNotice error={saveError} heading="We could not save your answers." />
      ) : null}
      {shown.length > 0 || shownOutstanding.length > 0 || recaptureBlocked ? (
        <div
          className="wf-error ee-summary"
          role="alert"
          tabIndex={-1}
          ref={summary}
          data-ee-violations="true"
        >
          <p className="wf-error-title">Check the following before saving.</p>
          <ul className="wf-list">
            {shownOutstanding.map((slug) => (
              <li key={slug}>{STEP_QUESTIONS[slug]} has not been answered yet.</li>
            ))}
            {[...new Set(shown.map((violation) => violation.code))].map((code) => (
              <li key={code}>{REFUSAL_MESSAGES[code]}</li>
            ))}
            {recaptureBlocked ? (
              <li data-ee-recapture-blocked>
                We need a new picture of each document you are showing us before we can save
                this.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </>
  );

  /* ------------------------------------------------------------ step one */

  if (step.slug === IDENTITY_STEP) {
    return (
      <section className="ee-module" data-ee-state={editing ? "EDITING" : "RECORDED"}>
        {messages}
        {editing ? (
          <>
            {identityError ? (
              <OnboardingErrorNotice
                error={identityError}
                onRetry={() => void reload()}
              />
            ) : identity === null ? (
              <p className="wf-loading">Loading your details.</p>
            ) : (
              <IdentityConfirmation
                displayName={identity.displayName}
                answer={draft.identityAnswer}
                onAnswer={answerIdentity}
                disabled={disabled}
                recorded={hasRecord}
                error={
                  shownOutstanding.includes(IDENTITY_STEP)
                    ? "Choose one of the two answers."
                    : null
                }
              />
            )}
            <UnsavedNotice dirty={dirty} />
          </>
        ) : (
          <RecordedAnswer
            question="Is this you?"
            answer={
              record.identityConfirmed
                ? "Yes, you told us this is you."
                : "You told us something is not correct, and MW4H will review it with you."
            }
            onRestate={restate}
            closed={sectionClosed}
          />
        )}
      </section>
    );
  }

  /* ------------------------------------------------------------ step two */

  if (step.slug === WORK_AUTHORIZATION_STEP) {
    return (
      <section className="ee-module" data-ee-state={editing ? "EDITING" : "RECORDED"}>
        {messages}
        {editing ? (
          <>
            <WorkAuthorizationChoice
              status={draft.status}
              endDate={draft.workAuthorizationExpiresOn}
              onStatus={chooseStatus}
              onEndDate={stateEndDate}
              disabled={disabled}
              recorded={hasRecord}
              error={
                shownOutstanding.includes(WORK_AUTHORIZATION_STEP)
                  ? "Choose the one that is true for you."
                  : null
              }
              endDateError={messageFor(shown, "workAuthorizationExpiresOn")}
            />
            <UnsavedNotice dirty={dirty} />
          </>
        ) : (
          <RecordedAnswer
            question="Your permission to work"
            answer={`${statusLabel(record.status)}${
              record.workAuthorizationExpiresOn
                ? ` It runs out on ${record.workAuthorizationExpiresOn}.`
                : ""
            }`}
            onRestate={restate}
            closed={sectionClosed}
          />
        )}
      </section>
    );
  }

  /* ---------------------------------------------------------- step three */

  return (
    <section
      className="ee-module"
      data-ee-state={editing ? "EDITING" : "RECORDED"}
      data-ee-dirty={dirty ? "true" : "false"}
    >
      {messages}

      {stale ? (
        <p className="ee-note" data-ee-catalogue-changed>
          The documents we can accept have been updated since you filled this in. If you change
          your answers, choose your documents again.
        </p>
      ) : null}

      {editing ? (
        <>
          <p className="ee-intro">
            Now tell us what you are showing us to prove you may work in the United States. You
            will take a picture of each document. Nothing here is saved until you press Save.
          </p>

          {recaptureBlocked ? (
            <p className="ee-note" role="status" data-ee-recapture-note>
              Because you are changing what you showed us, we need a new picture of each document
              before we can save it.
            </p>
          ) : null}

          <PresentationPathChoice
            catalogue={catalogue}
            path={draft.path}
            onPath={choosePath}
            disabled={disabled}
            error={
              shownOutstanding.includes(DOCUMENTS_STEP) && draft.path === ""
                ? "Choose one of the two."
                : null
            }
          />

          {draft.documents.map((document) => {
            const entry = entryFor(document.documentTypeKey);
            return (
              <div
                className="wf-card ee-document"
                key={document.list}
                data-ee-document={document.list}
              >
                <DocumentTypeSelect
                  list={document.list}
                  options={catalogue.filter((option) => option.list === document.list)}
                  documentTypeKey={document.documentTypeKey}
                  onSelect={(documentTypeKey) =>
                    chooseType(document.list, documentTypeKey)
                  }
                  legend={LIST_PROMPTS[document.list]}
                  disabled={disabled}
                  error={
                    shownOutstanding.includes(DOCUMENTS_STEP) &&
                    document.documentTypeKey === ""
                      ? "Choose one of these."
                      : null
                  }
                />

                {entry ? (
                  <>
                    <DocumentFields
                      entry={entry}
                      document={document}
                      onChange={(field, value) =>
                        stateField(document.list, field, value)
                      }
                      disabled={disabled}
                      errors={fieldErrors(shown, entry.documentTypeKey)}
                    />

                    {slotError ? (
                      <OnboardingErrorNotice
                        error={slotError}
                        onRetry={() => void reload()}
                      />
                    ) : slot ? (
                      <DocumentEvidence
                        invocationId={invocationId}
                        slot={slot}
                        documentTypeKey={entry.documentTypeKey}
                        prompt={`Take or choose a picture of this document`}
                        ready={versionStatable}
                        recorded={evidenceOnRecord(entry.documentTypeKey)}
                        recaptureRequired={needsFreshCapture(document)}
                        onConfirmed={(onboardingDocumentId) =>
                          bindEvidence(document.list, onboardingDocumentId)
                        }
                        disabled={disabled}
                      />
                    ) : (
                      <p className="wf-loading">Getting ready for your picture.</p>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}

          <UnsavedNotice dirty={dirty} />
          {!dirty && savedVersion !== null ? (
            <p className="ee-saved" role="status" data-ee-saved-version={savedVersion}>
              Your answers are saved.
            </p>
          ) : null}

          <div className="wf-btn-row ee-actions">
            <button
              type="button"
              className="wf-btn wf-btn-primary"
              disabled={disabled || (hasRecord && !changed)}
              onClick={() => void save()}
            >
              {saving ? "Saving." : "Save"}
            </button>
          </div>
        </>
      ) : (
        <>
          {subjectsError ? (
            <OnboardingErrorNotice error={subjectsError} onRetry={() => void reload()} />
          ) : subjects === null ? (
            <>
              <p className="wf-loading">Loading what you still need to do.</p>
              <EmploymentEligibilityReview record={record} catalogue={catalogue} />
            </>
          ) : workerPhaseComplete ? (
            <>
              <WorkerPhaseComplete
                onRestate={restate}
                closed={sectionClosed}
              />
              <EmploymentEligibilityReview record={record} catalogue={catalogue} />
            </>
          ) : (
            <>
              <ReviewAndSign
                record={record}
                catalogue={catalogue}
                subject={attestation}
                submitting={submitting}
                refusal={refusal}
                onSubmit={perform}
              />
              {sectionClosed ? null : (
                <div className="wf-btn-row">
                  <button
                    type="button"
                    className="wf-btn wf-btn-secondary"
                    onClick={restate}
                    data-ee-restate
                  >
                    I need to change something
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function UnsavedNotice({ dirty }: { dirty: boolean }) {
  if (!dirty) return null;
  return (
    <p className="ee-dirty" role="status" data-ee-unsaved="true">
      You have answers that are not saved yet. Press Save before you close this page.
    </p>
  );
}

/** One recorded answer, read back plainly, with the one way to change it. */
function RecordedAnswer({
  question,
  answer,
  onRestate,
  closed,
}: {
  question: string;
  answer: string;
  onRestate: () => void;
  closed: boolean;
}) {
  return (
    <div className="ee-recorded">
      <p className="wf-label">{question}</p>
      <p className="wf-card ee-recorded-answer" data-ee-recorded-answer>
        {answer}
      </p>
      {closed ? null : (
        <div className="wf-btn-row">
          <button
            type="button"
            className="wf-btn wf-btn-secondary"
            onClick={onRestate}
            data-ee-restate
          >
            I need to change something
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A refusal, said in this module's own words.
 *
 * Keyed by the governed CODE it carries. Where the code is one of this module's, the worker is
 * told which rule was broken; where it is not, the server's own message stands rather than being
 * paraphrased into something it did not say.
 */
function RefusalNotice({ error, heading }: { error: unknown; heading: string }) {
  const code = employmentEligibilityRefusalCode(error);
  const message =
    code !== null
      ? REFUSAL_MESSAGES[code]
      : (((error as { message?: unknown })?.message as string | undefined) ??
        "Something went wrong. Nothing was changed.");

  return (
    <div className="wf-error" role="alert" data-ee-refusal={code ?? "UNCLASSIFIED"}>
      <p className="wf-error-title">{heading}</p>
      <p>{message}</p>
      <p className="ee-note">
        Your answers are still on this screen. Nothing was recorded.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Derivations                                                                */
/* -------------------------------------------------------------------------- */

function carriesEndDate(status: "" | EmploymentEligibilityStatus): boolean {
  return (
    status !== "" && EMPLOYMENT_ELIGIBILITY_STATUSES_WITH_END_DATE.includes(status)
  );
}

/** The one broken rule to show beside a field of the attestation, if any. */
function messageFor(
  violations: readonly EmploymentEligibilityViolation[],
  field: "status" | "workAuthorizationExpiresOn",
): string | null {
  const violation = violations.find(
    (candidate) => candidate.documentTypeKey === null && candidate.field === field,
  );
  return violation ? REFUSAL_MESSAGES[violation.code] : null;
}

/** The broken rules to show beside one document's fields, keyed by the governed field. */
function fieldErrors(
  violations: readonly EmploymentEligibilityViolation[],
  documentTypeKey: string,
): Partial<Record<EmploymentEligibilityDocumentField, string>> {
  const errors: Partial<Record<EmploymentEligibilityDocumentField, string>> = {};
  for (const violation of violations) {
    if (violation.documentTypeKey !== documentTypeKey || violation.field === null) continue;
    if (violation.field === "status" || violation.field === "workAuthorizationExpiresOn") {
      continue;
    }
    errors[violation.field] = REFUSAL_MESSAGES[violation.code];
  }
  return errors;
}

/**
 * Whether what the worker is proposing differs from the record he is proposing it against.
 *
 * Compared over what a READ can return, plus the two things a read never returns and whose
 * presence therefore IS a change: a document number stated in this session for a document
 * already recorded, and a capture confirmed in this session for a document whose record does not
 * carry evidence yet.
 */
function hasChanged(
  draft: EmploymentEligibilityDraft,
  record: EmploymentEligibilityRecord | null,
): boolean {
  if (!record || record.setVersion === null) return false;

  const recorded = JSON.stringify({
    identityConfirmed: record.identityConfirmed,
    status: record.status ?? "",
    endDate: record.workAuthorizationExpiresOn ?? "",
    documents: record.documents.map((document) => ({
      documentTypeKey: document.documentTypeKey,
      issuingAuthority: document.issuingAuthority,
      expiresOn: document.expiresOn ?? "",
    })),
  });
  const proposed = JSON.stringify({
    identityConfirmed: draft.identityAnswer === "CONFIRMED",
    status: draft.status,
    endDate: draft.workAuthorizationExpiresOn.trim(),
    documents: draft.documents.map((document) => ({
      documentTypeKey: document.documentTypeKey,
      issuingAuthority: document.issuingAuthority.trim(),
      expiresOn: document.expiresOn.trim(),
    })),
  });
  if (recorded !== proposed) return true;

  return draft.documents.some((document) => {
    const stated = record.documents.find(
      (candidate) => candidate.documentTypeKey === document.documentTypeKey,
    );
    if (!stated) return true;
    if (document.documentNumber.trim().length > 0) return true;
    return document.evidenceId !== null && !stated.evidenceCaptured;
  });
}

/**
 * The whole version, as the worker is stating it.
 *
 * A fact the chosen catalogue entry does not capture is not sent at all. That is what keeps the
 * one acceptable document whose printed number is a Social Security Number free of a number: the
 * entry captures none, so none is rendered, none is held, and none is submitted.
 */
function toVersion(
  draft: EmploymentEligibilityDraft,
  entryFor: (documentTypeKey: string) => EmploymentEligibilityCatalogueEntry | null,
): SaveEmploymentEligibilityInput {
  return {
    attestation: {
      status: draft.status as EmploymentEligibilityStatus,
      identityConfirmed: draft.identityAnswer === "CONFIRMED",
      workAuthorizationExpiresOn: carriesEndDate(draft.status)
        ? draft.workAuthorizationExpiresOn
        : null,
    },
    documents: draft.documents.map((document) => {
      const captures = entryFor(document.documentTypeKey)?.captures ?? [];
      const stated = (field: EmploymentEligibilityDocumentField): string | null =>
        captures.includes(field) ? document[field] : null;
      return {
        documentTypeKey: document.documentTypeKey,
        documentNumber: stated("documentNumber"),
        issuingAuthority: stated("issuingAuthority"),
        expiresOn: stated("expiresOn"),
        onboardingDocumentId: document.evidenceId,
      };
    }),
  };
}

export default EmploymentEligibilityModule;
