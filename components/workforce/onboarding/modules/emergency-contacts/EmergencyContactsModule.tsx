"use client";

/**
 * Module 4.7 Emergency Contacts - the worker's screen.
 *
 * The FIRST business module rendered by the Phase 1 runtime, and it reaches the worker exactly
 * the way the runtime always said a module would: by registering a renderer under its module
 * key. There is no second onboarding application here, no route of its own, no shell, and no
 * change to the runtime to accommodate it.
 *
 * THE ONE RULE THIS FILE EXISTS TO KEEP (owner decision 6-5). Emergency contact values are
 * EXPLICIT-SAVE data. They do not flow through the runtime's shared draft, they are not
 * debounced, they are never written to local or session storage, and nothing is persisted as a
 * consequence of typing. What the worker has entered lives in this component's state and
 * nowhere else until he presses Save, at which point the whole SET is committed as one
 * immutable version or not at all. `setValue` - the runtime's draft recorder - is deliberately
 * not called anywhere below, and the module declares no captured keys for it to write into.
 *
 * The corollary is that leaving would silently discard work, so the module registers a leave
 * guard with the runtime and presents the worker the save/discard/stay decision itself. The
 * runtime holds the navigation; the module owns the decision.
 *
 * The rules enforced here are the GOVERNED rules of architecture 4.7.3 - 4.7.6, mirrored from
 * `emergency-contacts.validation.ts` so a worker is told what is wrong beside the field rather
 * than after a round trip. They are a courtesy, not the authority: the server validates the
 * same rules again and its refusal is what decides.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { packetPath } from "@/lib/workforce/onboardingRuntimeApi";
import type { OnboardingModuleRendererProps } from "@/components/workforce/onboarding/runtime/moduleRegistry";
import { useOnboardingRuntime } from "@/components/workforce/onboarding/runtime/OnboardingRuntimeContext";
import OnboardingErrorNotice from "@/components/workforce/onboarding/runtime/OnboardingErrorNotice";
import {
  EMERGENCY_CONTACT_DESIGNATIONS,
  EMERGENCY_CONTACT_MAX_CONTACTS,
  EMERGENCY_CONTACT_PRIORITIES,
  EMERGENCY_CONTACT_RELATIONSHIPS,
  EMERGENCY_CONTACT_RELATIONSHIP_OTHER,
  emergencyContactRefusalCode,
  getOwnEmergencyContacts,
  saveOwnEmergencyContacts,
  type EmergencyContactProfile,
  type EmergencyContactRefusalCode,
} from "@/lib/workforce/emergencyContactsApi";
import ContactEditor, {
  contactFromRecord,
  emptyContact,
  toContactInput,
  type ContactDraft,
  type ContactField,
} from "./ContactEditor";
import ConfirmUnchanged from "./ConfirmUnchanged";
import UnsavedChangesPrompt from "./UnsavedChangesPrompt";
import { designationLabel } from "./DesignationSelect";
import { contactOrdinalLabel, priorityLabel } from "./PriorityControl";
import { relationshipLabel } from "./RelationshipSelect";
import "./emergency-contacts.css";

/* -------------------------------------------------------------------------- */
/*  The governed rules, said in English                                        */
/* -------------------------------------------------------------------------- */

/**
 * One broken rule. The same shape the server reports, so the two can be read together.
 *
 * `priority` is the slot at fault and `field` the governed attribute. Neither ever carries a
 * worker's value.
 */
type Violation = {
  code: EmergencyContactRefusalCode;
  priority: string | null;
  field: ContactField | null;
};

/** What a refusal means, whoever raised it. Keyed by code so an unknown one cannot slip by. */
const REFUSAL_MESSAGES: Record<EmergencyContactRefusalCode, string> = {
  CONTACTS_REQUIRED: "Give us at least one emergency contact.",
  TOO_MANY_CONTACTS: "You can give us up to three emergency contacts.",
  DUPLICATE_PRIORITY: "Two contacts cannot be called at the same point in the order.",
  PRIORITY_ORDER_INVALID:
    "Fill the earlier position first. We call people in the order you set.",
  VALUE_NOT_GOVERNED: "One of the choices is not one we recognise. Choose it again.",
  CONTACT_FIELD_REQUIRED: "Some details we have to have are still missing.",
  RELATIONSHIP_DETAIL_REQUIRED:
    "Tell us how you know the person whose relationship you gave as Other.",
  ACTIVE_CONTACT_REQUIRED:
    "At least one of your contacts has to be someone we can call.",
  NO_EFFECTIVE_CONTACTS: "There are no emergency contacts on your record yet.",
};

/** What a missing required attribute means, beside the field it is missing from. */
const FIELD_REQUIRED_MESSAGES: Partial<Record<ContactField, string>> = {
  fullName: "Enter this person's full name.",
  relationship: "Choose their relationship to you.",
  primaryPhone: "Enter a phone number we can reach them on.",
  designation: "Choose what this person may be told.",
};

/** One list, so an unattempted set never presents a new empty array to a dependency check. */
const EMPTY_VIOLATIONS: readonly Violation[] = [];

const REQUIRED_FIELDS: readonly ContactField[] = [
  "fullName",
  "relationship",
  "primaryPhone",
  "designation",
];

/**
 * The governed rules of architecture 4.7.3 - 4.7.6, over a proposed set.
 *
 * A MIRROR of the server's `validateContactSet`, deliberately written in the same order and
 * reporting the same codes, so what the worker is told beside a field and what the server would
 * refuse are the same statement. Every violation is returned rather than the first.
 */
export function validateContactSet(contacts: readonly ContactDraft[]): Violation[] {
  const violations: Violation[] = [];
  const add = (
    code: EmergencyContactRefusalCode,
    priority: string | null = null,
    field: ContactField | null = null,
  ): void => {
    violations.push({ code, priority, field });
  };

  if (contacts.length === 0) {
    add("CONTACTS_REQUIRED");
    return violations;
  }
  if (contacts.length > EMERGENCY_CONTACT_MAX_CONTACTS) add("TOO_MANY_CONTACTS");

  for (const contact of contacts) {
    const priority = (EMERGENCY_CONTACT_PRIORITIES as readonly string[]).includes(
      contact.priority,
    )
      ? contact.priority
      : null;
    if (!priority) add("VALUE_NOT_GOVERNED", null, "priority");
    if (
      contact.designation !== "" &&
      !(EMERGENCY_CONTACT_DESIGNATIONS as readonly string[]).includes(
        contact.designation,
      )
    ) {
      add("VALUE_NOT_GOVERNED", priority, "designation");
    }
    if (
      contact.relationship !== "" &&
      !(EMERGENCY_CONTACT_RELATIONSHIPS as readonly string[]).includes(
        contact.relationship,
      )
    ) {
      add("VALUE_NOT_GOVERNED", priority, "relationship");
    }

    for (const field of REQUIRED_FIELDS) {
      if (contact[field].trim().length === 0) {
        add("CONTACT_FIELD_REQUIRED", priority, field);
      }
    }

    if (
      contact.relationship === EMERGENCY_CONTACT_RELATIONSHIP_OTHER &&
      contact.relationshipDetail.trim().length === 0
    ) {
      add("RELATIONSHIP_DETAIL_REQUIRED", priority, "relationshipDetail");
    }
  }

  const seen = new Set<string>();
  for (const contact of contacts) {
    if (seen.has(contact.priority)) {
      add("DUPLICATE_PRIORITY", contact.priority, "priority");
    }
    seen.add(contact.priority);
  }

  // Contiguous from the first slot down. Occupancy, not activity: a deactivated contact still
  // holds its slot, so deactivating someone has not created a gap.
  const occupied = EMERGENCY_CONTACT_PRIORITIES.map((slot) => seen.has(slot));
  let highestOccupied = -1;
  occupied.forEach((held, rank) => {
    if (held) highestOccupied = rank;
  });
  for (let slot = 0; slot < highestOccupied; slot += 1) {
    if (!occupied[slot]) {
      add("PRIORITY_ORDER_INVALID", EMERGENCY_CONTACT_PRIORITIES[slot], "priority");
    }
  }

  // ACTIVE_CONTACT_REQUIRED is not tested here, and its absence is not a relaxation. Every
  // contact the worker lists is submitted as active, so a set with any contact in it
  // satisfies the rule and a set with none is already refused above as CONTACTS_REQUIRED.
  // The server continues to enforce both rules independently, and its message is still
  // carried below if it ever refuses one.
  return violations;
}

/* -------------------------------------------------------------------------- */
/*  Local state helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The governed order, as a rank.
 *
 * Derived from the governed list rather than written out again, so the ordering has exactly one
 * definition. An ungoverned value ranks last: ordering is presentation, and the value has
 * already been reported as a violation before it could be saved.
 */
const PRIORITY_RANK = new Map<string, number>(
  EMERGENCY_CONTACT_PRIORITIES.map((slot, rank) => [slot as string, rank]),
);

function rankOf(priority: string): number {
  return PRIORITY_RANK.get(priority) ?? EMERGENCY_CONTACT_PRIORITIES.length;
}

/** Local render identity for the blank row a worker with no record starts from. */
function firstSlotKey(): string {
  return "new-0";
}

/** A contact the worker added and has not touched. It states nothing, so it is not an edit. */
function isBlank(contact: ContactDraft): boolean {
  if (!contact.isNew) return false;
  const stated: ContactField[] = [
    "fullName",
    "relationship",
    "relationshipDetail",
    "primaryPhone",
    "secondaryPhone",
    "email",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "postalCode",
    "preferredLanguage",
    "designation",
  ];
  return stated.every((field) => contact[field].trim().length === 0);
}

/** What the worker is actually proposing: the blank rows he has not filled in do not count. */
function proposedSet(contacts: readonly ContactDraft[]): ContactDraft[] {
  return contacts.filter((contact) => !isBlank(contact));
}

/** Comparable content of a set, for deciding whether anything has changed. */
function fingerprint(contacts: readonly ContactDraft[]): string {
  return JSON.stringify(
    proposedSet(contacts)
      .map((contact) => ({ ...toContactInput(contact) }))
      .sort((left, right) => left.priority.localeCompare(right.priority)),
  );
}

/** The recorded profile, opened for editing, in the worker's own priority order. */
function draftsFromProfile(profile: EmergencyContactProfile | null): ContactDraft[] {
  if (!profile) return [];
  return [...profile.contacts]
    .sort((left, right) => rankOf(left.priority) - rankOf(right.priority))
    .map(contactFromRecord);
}

/* -------------------------------------------------------------------------- */
/*  The module                                                                 */
/* -------------------------------------------------------------------------- */

export function EmergencyContactsModule({
  invocationId,
  module,
  complete,
  busy,
}: OnboardingModuleRendererProps) {
  const { registerLeaveGuard } = useOnboardingRuntime();

  const [profile, setProfile] = useState<EmergencyContactProfile | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  /** The set as the server last confirmed it. What "unchanged" is measured against. */
  const [baseline, setBaseline] = useState<string>(fingerprint([]));
  const [saving, setSaving] = useState(false);
  /**
   * True from the moment the worker presses Save & Continue until the section is actually
   * finished - the save, the completion, and the re-read of his packet that follows it.
   *
   * IT COVERS THE WHOLE OPERATION AND NOT MERELY THE FIRST REQUEST IN IT, which is the point:
   * a state that ended when the save returned told him his contacts were saved while the
   * section was still being finished, and left both buttons live in front of a worker with
   * nothing to do but press one of them again.
   */
  const [finishing, setFinishing] = useState(false);
  /**
   * The same fact, readable before React has re-rendered.
   *
   * Two presses landing in one tick would both read `finishing` as false, because state a
   * handler closed over is the state at its render. The ref is what makes the second press
   * a no-op rather than a second completion recorded for one decision.
   */
  const finishingRef = useRef(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [completionError, setCompletionError] = useState<unknown>(null);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  /** Violations are shown once the worker has tried to commit, not while he is still typing. */
  const [attempted, setAttempted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [leavePending, setLeavePending] = useState(false);

  /** The navigation the runtime handed over while this module was dirty. */
  const retainedLeave = useRef<(() => void) | null>(null);
  const added = useRef(0);

  const recorded =
    module.status === "COMPLETE" || module.status === "ALREADY_COMPLETE";

  /* ------------------------------------------------------------------ load */

  useEffect(() => {
    let live = true;
    setProfile(null);
    setLoadError(null);
    getOwnEmergencyContacts(invocationId)
      .then((value) => {
        if (!live) return;
        const drafts = draftsFromProfile(value);
        setProfile(value);
        // A worker with no record still needs somewhere to begin, so the first slot is put
        // in front of him. It is BLANK, and a blank row states nothing, so opening the
        // module has not made him unsaved and leaving it again asks him nothing.
        setContacts(
          drafts.length > 0 ? drafts : [emptyContact("PRIMARY", firstSlotKey())],
        );
        setBaseline(fingerprint(drafts));
      })
      .catch((failure: unknown) => {
        if (live) setLoadError(failure);
      });
    return () => {
      live = false;
    };
  }, [invocationId]);

  /* ----------------------------------------------------------------- dirty */

  const proposed = useMemo(() => proposedSet(contacts), [contacts]);
  const dirty = useMemo(
    () => fingerprint(contacts) !== baseline,
    [baseline, contacts],
  );

  /**
   * The guard reads dirtiness from here rather than from a closure.
   *
   * That is what lets the guard be registered ONCE for the life of the module: a guard that
   * closed over `dirty` would have to be re-registered on every keystroke, and any registration
   * that lost the race would leave the worker's edits unprotected.
   */
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(
    () =>
      registerLeaveGuard(({ proceed }) => {
        if (!dirtyRef.current) return "LEAVE";
        retainedLeave.current = proceed;
        setLeavePending(true);
        return "BLOCK";
      }),
    [registerLeaveGuard],
  );

  /**
   * A reload or a closed tab is not navigation the runtime can hold, so the browser's own
   * prompt is the only protection available for it - and it is registered only while there is
   * something to lose.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ------------------------------------------------------------ validation */

  const violations = useMemo(() => validateContactSet(proposed), [proposed]);
  const shown = useMemo(
    () => (attempted ? violations : EMPTY_VIOLATIONS),
    [attempted, violations],
  );

  const errorsFor = useCallback(
    (contact: ContactDraft): Partial<Record<ContactField, string>> => {
      const errors: Partial<Record<ContactField, string>> = {};
      for (const violation of shown) {
        if (violation.priority !== contact.priority || !violation.field) continue;
        if (violation.code === "CONTACT_FIELD_REQUIRED") {
          errors[violation.field] =
            FIELD_REQUIRED_MESSAGES[violation.field] ?? REFUSAL_MESSAGES[violation.code];
          continue;
        }
        errors[violation.field] = REFUSAL_MESSAGES[violation.code];
      }
      return errors;
    },
    [shown],
  );

  /* ----------------------------------------------------------------- edits */

  const change = useCallback((key: string, field: ContactField, value: string) => {
    setContacts((current) =>
      current.map((contact) =>
        contact.key === key ? { ...contact, [field]: value } : contact,
      ),
    );
  }, []);

  const addContact = useCallback(() => {
    setContacts((current) => {
      if (current.length >= EMERGENCY_CONTACT_MAX_CONTACTS) return current;
      const taken = new Set(current.map((contact) => contact.priority));
      const free = EMERGENCY_CONTACT_PRIORITIES.find((slot) => !taken.has(slot));
      if (!free) return current;
      added.current += 1;
      return [...current, emptyContact(free, `new-${added.current}`)];
    });
  }, []);

  const removeContact = useCallback((key: string) => {
    setContacts((current) => current.filter((contact) => contact.key !== key));
  }, []);

  const resetToRecord = useCallback(() => {
    const drafts = draftsFromProfile(profile);
    setContacts(drafts.length > 0 ? drafts : [emptyContact("PRIMARY", firstSlotKey())]);
    setAttempted(false);
    setSaveError(null);
    // Set before any continuation runs, so a discard that navigates cannot be re-guarded by
    // state React has not applied yet.
    dirtyRef.current = false;
  }, [profile]);

  /* ------------------------------------------------------------------ save */

  /**
   * THE explicit save. The whole set, in one deliberate act, or nothing.
   *
   * Returns whether the set is now on the record, so a caller that must not proceed without
   * confirmed persistence - Save & Continue, and Save and leave - can tell.
   */
  const save = useCallback(async (): Promise<boolean> => {
    setAttempted(true);
    setCompletionError(null);
    if (validateContactSet(proposedSet(contacts)).length > 0) {
      setSaveError(null);
      return false;
    }

    setSaving(true);
    try {
      const value = await saveOwnEmergencyContacts(
        invocationId,
        proposedSet(contacts).map(toContactInput),
      );
      const drafts = draftsFromProfile(value);
      setProfile(value);
      setContacts(drafts);
      setBaseline(fingerprint(drafts));
      dirtyRef.current = false;
      setSaveError(null);
      setAttempted(false);
      setSavedVersion(value.setVersion);
      return true;
    } catch (failure: unknown) {
      // The edits stay exactly where they are. A failed save is not a reason to lose them,
      // and the module stays dirty so leaving is still protected.
      setSaveError(failure);
      return false;
    } finally {
      setSaving(false);
    }
  }, [contacts, invocationId]);

  /**
   * SAVE, THEN COMPLETE - in that order, and only on confirmed persistence.
   *
   * The reverse order would record a completion the worker's answers had not reached, and the
   * module's own server-side validator would be asked about a record that does not yet say
   * what he just typed.
   *
   * A set the server ALREADY HOLDS, with nothing changed in front of it, is not saved again.
   * Re-posting it would append a version of a record nobody changed, supersede the version
   * actually in force, and re-date the worker's answers to the day he was asked about them -
   * which is the distinction the immutable history exists to keep. Completion then runs
   * against the effective set, which is what it would have been validated against anyway.
   *
   * This is NOT the no-change confirmation. Confirming a re-presented record is a separate
   * affirmative act the worker takes deliberately, and it still says so through
   * `confirmNoChange`; continuing past a record he did not change says nothing of the kind.
   */
  const saveAndContinue = useCallback(async () => {
    // A second press cannot start a second one. The controls are disabled while this runs, so
    // this guards the case a control cannot - a re-entrant call between renders - and it is
    // the same guard that keeps two completions from being recorded for one decision.
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      const alreadyOnTheRecord = !dirty && profile !== null && profile.setVersion !== null;
      if (!alreadyOnTheRecord) {
        const persisted = await save();
        if (!persisted) return;
      }
      try {
        await complete();
        setCompletionError(null);
      } catch (failure: unknown) {
        setCompletionError(failure);
      }
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  }, [complete, dirty, profile, save]);

  /** The affirmative no-change act. It writes no version; it says the record still stands. */
  const confirmUnchanged = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    try {
      await complete({ confirmNoChange: true });
      setCompletionError(null);
    } catch (failure: unknown) {
      setCompletionError(failure);
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  }, [complete]);

  /* ------------------------------------------------------- leaving decision */

  const resumeLeave = useCallback(() => {
    const proceed = retainedLeave.current;
    retainedLeave.current = null;
    setLeavePending(false);
    proceed?.();
  }, []);

  const saveAndLeave = useCallback(async () => {
    if (await save()) {
      resumeLeave();
      return;
    }
    // Nothing was persisted, so nothing leaves. The retained navigation is dropped and the
    // worker stays with his edits and the refusal in front of him.
    retainedLeave.current = null;
    setLeavePending(false);
  }, [resumeLeave, save]);

  const discardAndLeave = useCallback(() => {
    resetToRecord();
    resumeLeave();
  }, [resetToRecord, resumeLeave]);

  const cancelLeave = useCallback(() => {
    retainedLeave.current = null;
    setLeavePending(false);
  }, []);

  /* ----------------------------------------------------------------- render */

  if (loadError) {
    return (
      <section className="ec-module" data-ec-state="ERROR">
        <OnboardingErrorNotice error={loadError} />
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="ec-module" data-ec-state="LOADING">
        <p className="wf-loading">Loading your emergency contacts.</p>
      </section>
    );
  }

  const disabled = saving || busy || finishing;
  const takenBy = (contact: ContactDraft): string[] =>
    contacts
      .filter((other) => other.key !== contact.key)
      .map((other) => other.priority);

  /* Recorded, and not being changed: the record, read only, with a way to change it. */
  if (recorded && !editing) {
    return (
      <section className="ec-module" data-ec-state="RECORDED">
        <Intro />
        <p className="ec-recorded" role="status">
          Your emergency contacts are on your record.
        </p>
        <RecordedContacts profile={profile} />
        <div className="wf-btn-row">
          <button
            type="button"
            className="wf-btn wf-btn-secondary"
            onClick={() => setEditing(true)}
          >
            Change these contacts
          </button>
          {/*
            HIS OWN PACKET, not the list of every packet he has ever had. This section is one
            part of one packet, and what he wants after reading his record back is the rest of
            that packet - so the way out leads to where the remaining work is.
          */}
          <Link
            className="wf-btn wf-btn-primary"
            data-ec-return-to-packet
            href={packetPath(invocationId)}
          >
            Back to my sections
          </Link>
        </div>
      </section>
    );
  }

  const canConfirmUnchanged =
    !dirty && !recorded && profile.setVersion !== null && proposed.length > 0;

  return (
    <section
      className="ec-module"
      data-ec-state={proposed.length === 0 ? "EMPTY" : "EDITING"}
      data-ec-dirty={dirty ? "true" : "false"}
    >
      <Intro />

      {profile.setVersion === null && proposed.length === 0 ? (
        <p className="wf-empty" data-ec-empty="true">
          You have not given us anyone to call yet. Add at least one person below.
        </p>
      ) : null}

      {saveError ? (
        <RefusalNotice error={saveError} heading="We could not save your contacts." />
      ) : null}
      {completionError ? (
        <RefusalNotice
          error={completionError}
          heading="We could not finish this section."
        />
      ) : null}

      {shown.length > 0 ? (
        <div className="wf-error ec-summary" role="alert" data-ec-violations="true">
          <p className="wf-error-title">Check the following before saving.</p>
          <ul className="wf-list">
            {[...new Set(shown.map((violation) => violation.code))].map((code) => (
              <li key={code}>{REFUSAL_MESSAGES[code]}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="ec-contact-list">
        {contacts.map((contact) => (
          <ContactEditor
            key={contact.key}
            contact={contact}
            takenPriorities={takenBy(contact)}
            fieldErrors={errorsFor(contact)}
            disabled={disabled}
            onChange={(field, value) => change(contact.key, field, value)}
            onRemove={() => removeContact(contact.key)}
          />
        ))}
      </ul>

      {contacts.length < EMERGENCY_CONTACT_MAX_CONTACTS ? (
        <div className="wf-btn-row">
          <button
            type="button"
            className="wf-btn wf-btn-secondary"
            disabled={disabled}
            onClick={addContact}
          >
            {contacts.length === 0 ? "Add a contact" : "Add another contact"}
          </button>
        </div>
      ) : null}

      {/*
        WHAT IS ACTUALLY HAPPENING, for as long as it is happening. It says finishing rather
        than saving because the save is only the first part of it, and a worker told "saved"
        while his packet is still being brought up to date has been told something that is
        true of one request and not of the operation he asked for.
      */}
      {finishing ? (
        <p className="ec-saved" role="status" data-ec-finishing="true">
          Finishing this section. Please wait.
        </p>
      ) : null}

      {dirty && !finishing ? (
        <p className="ec-dirty" role="status" data-ec-unsaved="true">
          You have changes that are not saved yet.
        </p>
      ) : null}
      {!dirty && !finishing && savedVersion !== null ? (
        <p className="ec-saved" role="status" data-ec-saved-version={savedVersion}>
          Your emergency contacts are saved.
        </p>
      ) : null}

      <div className="wf-btn-row ec-actions">
        <button
          type="button"
          className="wf-btn wf-btn-secondary"
          disabled={disabled || !dirty}
          onClick={() => void save()}
        >
          {saving ? "Saving." : "Save"}
        </button>
        <button
          type="button"
          className="wf-btn wf-btn-primary"
          disabled={disabled}
          aria-busy={finishing || undefined}
          onClick={() => void saveAndContinue()}
        >
          {finishing ? "Finishing." : "Save & Continue"}
        </button>
      </div>

      {canConfirmUnchanged ? (
        <ConfirmUnchanged
          setVersion={profile.setVersion as number}
          busy={disabled}
          onConfirm={() => void confirmUnchanged()}
        />
      ) : null}

      {leavePending ? (
        <UnsavedChangesPrompt
          saving={saving}
          onSaveAndLeave={() => void saveAndLeave()}
          onDiscardAndLeave={discardAndLeave}
          onCancel={cancelLeave}
        />
      ) : null}
    </section>
  );
}

/**
 * What the worker actually needs to be told, and nothing he can already see.
 *
 * Three facts survive, each because leaving it out would cost him something: that the ORDER
 * he sets is the order we call in, which is the one thing a list of names cannot show; that
 * three is the limit, so he plans rather than discovers it; and that nothing is stored until
 * he presses Save, which is the module's own unusual behaviour and the only warning standing
 * between him and lost work. What an emergency contact is, is not explained.
 */
function Intro() {
  return (
    <div className="ec-intro">
      <p>
        We call these people in the order you set, and you can give us up to three. Nothing
        is saved until you press Save.
      </p>
    </div>
  );
}

/** The record as it stands, in the worker's own order. Read only, and stated plainly. */
function RecordedContacts({ profile }: { profile: EmergencyContactProfile }) {
  const ordered = [...profile.contacts].sort(
    (left, right) => rankOf(left.priority) - rankOf(right.priority),
  );

  return (
    <ul className="ec-contact-list">
      {ordered.map((contact) => (
        <li
          key={contact.id}
          className="wf-card ec-recorded-contact"
          data-contact-priority={contact.priority}
          data-contact-status={contact.status}
        >
          {/*
            The same identification the editor uses, from the same governed order, so the
            record and the form cannot number the same person differently.
          */}
          <h3 className="ec-contact-title">{contactOrdinalLabel(contact.priority)}</h3>
          <p className="ec-recorded-name">
            {contact.fullName}
            <span className="ec-recorded-meta">
              {priorityLabel(contact.priority)} ·{" "}
              {relationshipLabel(contact.relationship)}
              {contact.relationshipDetail ? ` (${contact.relationshipDetail})` : ""}
            </span>
          </p>
          <p className="ec-recorded-meta">{contact.primaryPhone}</p>
          {contact.secondaryPhone ? (
            <p className="ec-recorded-meta">{contact.secondaryPhone}</p>
          ) : null}
          <p className="ec-recorded-meta">{designationLabel(contact.designation)}</p>
          {contact.status === "INACTIVE" ? (
            <p className="ec-recorded-meta">
              We will not call this person while they are switched off.
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * A server refusal, said in the module's own words.
 *
 * Keyed by the governed CODE the refusal carries. Where the code is one of this module's own,
 * the worker is told what rule was broken; where it is not, the server's message stands as it
 * is rather than being paraphrased into something it did not say.
 */
function RefusalNotice({ error, heading }: { error: unknown; heading: string }) {
  const code = emergencyContactRefusalCode(error);
  /*
    A refused COMPLETION is the framework's refusal carrying this module's validator codes,
    which the shared transport surfaces as field errors. They are the same governed codes, so
    they are said the same way rather than printed as identifiers.
  */
  const carried = Array.isArray((error as { fieldErrors?: unknown })?.fieldErrors)
    ? ((error as { fieldErrors: unknown[] }).fieldErrors.filter(
        (entry): entry is EmergencyContactRefusalCode =>
          typeof entry === "string" && entry in REFUSAL_MESSAGES,
      ) as EmergencyContactRefusalCode[])
    : [];

  const message =
    code !== null
      ? REFUSAL_MESSAGES[code]
      : carried.length === 0
        ? (((error as { message?: unknown })?.message as string | undefined) ??
          "Something went wrong. Nothing was changed.")
        : null;

  return (
    <div className="wf-error" role="alert" data-ec-refusal={code ?? "UNCLASSIFIED"}>
      <p className="wf-error-title">{heading}</p>
      {message ? <p>{message}</p> : null}
      {carried.length > 0 ? (
        <ul className="wf-list">
          {[...new Set(carried)].map((carriedCode) => (
            <li key={carriedCode}>{REFUSAL_MESSAGES[carriedCode]}</li>
          ))}
        </ul>
      ) : null}
      <p className="ec-refusal-detail">
        Your changes are still on this screen. Nothing was recorded.
      </p>
    </div>
  );
}

export default EmergencyContactsModule;
