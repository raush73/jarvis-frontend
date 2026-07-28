"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import DeclarationChoice from "@/components/workforce/DeclarationChoice";
import { US_STATES } from "@/lib/careers/usStates";
import {
  type TradeOption,
  type WorkHistoryEntryInput,
  type WorkHistoryEntryView,
  type WorkHistoryHiringMethod,
  type WorkHistoryStageView,
  WorkerSessionExpiredError,
  WorkforceApiError,
  addWorkHistoryEntry,
  getWorkHistory,
  getWorkHistoryTrades,
  removeWorkHistoryEntry,
  setEmploymentDeclaration,
  updateWorkHistoryEntry,
} from "@/lib/workforce/workforceApi";

type EntryForm = {
  employerName: string;
  jobTitle: string;
  primaryTradeId: string;
  startDate: string;
  endDate: string;
  currentlyEmployed: boolean;
  city: string;
  state: string;
  supervisorName: string;
  supervisorPhone: string;
  description: string;
  reasonForLeaving: string;
  /** "" until the worker answers; the question has no default. */
  hiringMethod: WorkHistoryHiringMethod | "";
};

const EMPTY_FORM: EntryForm = {
  employerName: "",
  jobTitle: "",
  primaryTradeId: "",
  startDate: "",
  endDate: "",
  currentlyEmployed: false,
  city: "",
  state: "",
  supervisorName: "",
  supervisorPhone: "",
  description: "",
  reasonForLeaving: "",
  hiringMethod: "",
};

/** The hiring-method answers, in the order they are offered. */
const HIRING_METHODS: { value: WorkHistoryHiringMethod; label: string }[] = [
  { value: "DIRECT_HIRE", label: "Hired directly by the company" },
  { value: "STAFFING_AGENCY", label: "Through a staffing agency" },
  { value: "UNION_HIRING_HALL", label: "Through a union hiring hall" },
];

type EntryField = keyof EntryForm;

/**
 * Fields the worker must fill in, labelled as the form labels them so a reported problem
 * names something visible on screen. The backend re-checks all of this; these labels only
 * let the page point at the field instead of relaying a field name.
 */
const REQUIRED_FIELDS: { field: EntryField; label: string }[] = [
  { field: "employerName", label: "Employer" },
  { field: "jobTitle", label: "Job title" },
  { field: "primaryTradeId", label: "Trade performed" },
  { field: "startDate", label: "Start date" },
  { field: "city", label: "City" },
  { field: "state", label: "State" },
  { field: "hiringMethod", label: "How were you hired for this position?" },
  { field: "description", label: "What work did you do?" },
];

function missingRequiredFields(form: EntryForm): { field: EntryField; label: string }[] {
  const missing = REQUIRED_FIELDS.filter(
    ({ field }) => String(form[field] ?? "").trim() === "",
  );
  if (!form.currentlyEmployed && !form.endDate.trim()) {
    missing.push({ field: "endDate", label: "End date" });
  }
  return missing;
}

function toForm(entry: WorkHistoryEntryView): EntryForm {
  return {
    employerName: entry.employerName,
    jobTitle: entry.jobTitle,
    primaryTradeId: entry.primaryTradeId,
    startDate: entry.startDate,
    endDate: entry.endDate ?? "",
    currentlyEmployed: entry.currentlyEmployed,
    city: entry.city,
    state: entry.state,
    supervisorName: entry.supervisorName ?? "",
    supervisorPhone: entry.supervisorPhone ?? "",
    description: entry.description,
    reasonForLeaving: entry.reasonForLeaving ?? "",
    hiringMethod: entry.hiringMethod ?? "",
  };
}

/** Called only for a form that has already passed `missingRequiredFields`. */
function toInput(form: EntryForm): WorkHistoryEntryInput {
  const input: WorkHistoryEntryInput = {
    employerName: form.employerName.trim(),
    jobTitle: form.jobTitle.trim(),
    primaryTradeId: form.primaryTradeId,
    startDate: form.startDate,
    currentlyEmployed: form.currentlyEmployed,
    city: form.city.trim(),
    state: form.state.trim(),
    description: form.description.trim(),
    hiringMethod: form.hiringMethod as WorkHistoryHiringMethod,
  };
  if (!form.currentlyEmployed && form.endDate) input.endDate = form.endDate;
  const supervisorName = form.supervisorName.trim();
  if (supervisorName) input.supervisorName = supervisorName;
  const supervisorPhone = form.supervisorPhone.trim();
  if (supervisorPhone) input.supervisorPhone = supervisorPhone;
  const reason = form.reasonForLeaving.trim();
  if (reason) input.reasonForLeaving = reason;
  return input;
}

function describeDates(entry: WorkHistoryEntryView): string {
  return entry.currentlyEmployed
    ? `${entry.startDate} to present`
    : `${entry.startDate} to ${entry.endDate ?? "unknown"}`;
}

/** Null on an entry saved before the question existed; the worker is asked to edit it. */
function describeHiringMethod(entry: WorkHistoryEntryView): string {
  const answer = HIRING_METHODS.find((m) => m.value === entry.hiringMethod);
  return answer ? answer.label : "Hiring method not answered yet";
}

/**
 * Work History screen (backend stage WORK_HISTORY).
 *
 * Each entry is persisted by its own backend call as it is added, changed, or removed,
 * so the list on screen is always the list the backend holds.
 */
export default function WorkHistoryPage() {
  const [view, setView] = useState<WorkHistoryStageView | null>(null);
  const [trades, setTrades] = useState<TradeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EntryForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string[] | null>(null);
  const [invalidFields, setInvalidFields] = useState<EntryField[]>([]);
  const [busy, setBusy] = useState(false);
  const [stageError, setStageError] = useState<unknown>(null);

  const isInvalid = (field: EntryField) => invalidFields.includes(field);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [registry, stage] = await Promise.all([
          getWorkHistoryTrades(),
          getWorkHistory(),
        ]);
        if (cancelled) return;
        setTrades(registry);
        setView(stage);
      } catch (err) {
        if (!cancelled) setStageError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setDeclaration = useCallback(async (hasPreviousEmployment: boolean) => {
    setBusy(true);
    setEntryError(null);
    try {
      setView(await setEmploymentDeclaration(hasPreviousEmployment));
      if (!hasPreviousEmployment) {
        setForm(null);
        setEditingId(null);
      }
    } catch (err) {
      if (err instanceof WorkerSessionExpiredError) {
        setStageError(err);
        return;
      }
      setEntryError([
        err instanceof WorkforceApiError
          ? err.message
          : "We could not save your answer. Please try again.",
      ]);
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Commit the employer currently on screen and return the stage as the backend now holds it.
   *
   * Throws a `WorkforceApiError` naming the fields still to fill in, so both callers - the
   * button on the form and Save & Continue - report the same thing and leave the worker on
   * the page with those fields marked.
   */
  const commitOpenForm = useCallback(
    async (current: EntryForm): Promise<WorkHistoryStageView> => {
      const missing = missingRequiredFields(current);
      if (missing.length > 0) {
        setInvalidFields(missing.map(({ field }) => field));
        throw new WorkforceApiError(
          "Please finish this job before continuing.",
          400,
          missing.map(({ label }) => `${label} is required`),
        );
      }

      setInvalidFields([]);
      const input = toInput(current);
      const next = editingId
        ? await updateWorkHistoryEntry(editingId, input)
        : await addWorkHistoryEntry(input);
      setView(next);
      setForm(null);
      setEditingId(null);
      return next;
    },
    [editingId],
  );

  /**
   * Commit the open employer and immediately offer a blank form. This is the "I have another
   * employer to enter" path; saving the LAST employer needs no button of its own, because
   * Save & Continue commits it.
   */
  const saveEntryAndAddAnother = useCallback(async () => {
    if (!form) return;
    setBusy(true);
    setEntryError(null);
    try {
      await commitOpenForm(form);
      if (!editingId) setForm({ ...EMPTY_FORM });
    } catch (err) {
      if (err instanceof WorkerSessionExpiredError) {
        setStageError(err);
        return;
      }
      if (err instanceof WorkforceApiError) {
        setEntryError(
          err.fieldErrors.length > 0 ? err.fieldErrors : [err.message],
        );
      } else {
        setEntryError(["We could not save this job. Please try again."]);
      }
    } finally {
      setBusy(false);
    }
  }, [commitOpenForm, editingId, form]);

  const remove = useCallback(async (entryId: string) => {
    setBusy(true);
    setEntryError(null);
    try {
      setView(await removeWorkHistoryEntry(entryId));
    } catch (err) {
      if (err instanceof WorkerSessionExpiredError) {
        setStageError(err);
        return;
      }
      setEntryError([
        err instanceof WorkforceApiError
          ? err.message
          : "We could not remove this job. Please try again.",
      ]);
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Save & Continue commits the employer the worker is looking at. Filling the form in IS
   * entering that employer, so nothing about it should have to be confirmed with a second
   * button first - a finished form that silently fails to save reads as a broken page.
   */
  const onSave = useCallback(async () => {
    if (view?.hasPreviousEmployment === null ||
        view?.hasPreviousEmployment === undefined) {
      throw new WorkforceApiError(
        "Please tell us whether you have previous employment.",
        400,
      );
    }

    const committed = form ? await commitOpenForm(form) : view;
    if (committed.hasPreviousEmployment && committed.entries.length === 0) {
      throw new WorkforceApiError(
        "Please add at least one job, or choose that you have no previous employment.",
        400,
      );
    }
    setEntryError(null);
  }, [commitOpenForm, form, view]);

  const set = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <WorkforceWizardShell
      slug="work-history"
      loading={loading}
      stageError={stageError}
      onSave={onSave}
      intro="Tell us where you have worked. Start with your most recent job."
    >
      <div className="wf-section">
        <h2 className="wf-section-title">Employment history</h2>
        <DeclarationChoice
          name="hasPreviousEmployment"
          value={view?.hasPreviousEmployment ?? null}
          onChange={(v) => void setDeclaration(v)}
          yesLabel="I have previous employment to report"
          noLabel="I have no previous employment"
          disabled={busy}
        />
      </div>

      {entryError ? (
        <div className="wf-error" role="alert">
          <p className="wf-error-title">Please review this job</p>
          <ul className="wf-error-list">
            {entryError.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {view?.hasPreviousEmployment ? (
        <div className="wf-section">
          <h2 className="wf-section-title">Your jobs</h2>

          {view.entries.length === 0 ? (
            <p className="wf-empty">No jobs added yet.</p>
          ) : (
            view.entries.map((entry) => (
              <div key={entry.id} className="wf-entry">
                <div className="wf-entry-head">
                  <h3 className="wf-entry-title">
                    {entry.jobTitle} &middot; {entry.employerName}
                  </h3>
                  <span className="wf-hint">{describeDates(entry)}</span>
                </div>
                <p className="wf-entry-meta">
                  {entry.primaryTradeName ?? "Trade no longer listed"} &middot;{" "}
                  {entry.city}, {entry.state}
                </p>
                <p className="wf-entry-meta">{describeHiringMethod(entry)}</p>
                <div className="wf-btn-row">
                  <button
                    type="button"
                    className="wf-btn wf-btn-secondary wf-btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(entry.id);
                      setForm(toForm(entry));
                      setEntryError(null);
                      setInvalidFields([]);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="wf-btn wf-btn-danger wf-btn-sm"
                    disabled={busy}
                    onClick={() => void remove(entry.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}

          {form ? (
            <div className="wf-entry" style={{ background: "var(--color-bg-card)" }}>
              <h3 className="wf-entry-title" style={{ marginBottom: 14 }}>
                {editingId ? "Edit job" : "Add a job"}
              </h3>

              <div className="wf-grid">
                <label className="wf-field">
                  <span className="wf-label">
                    Employer <span className="wf-req">*</span>
                  </span>
                  <input
                    className="wf-input"
                    value={form.employerName}
                    onChange={(e) => set("employerName", e.target.value)}
                    aria-invalid={isInvalid("employerName")}
                    maxLength={200}
                  />
                </label>

                <label className="wf-field">
                  <span className="wf-label">
                    Job title <span className="wf-req">*</span>
                  </span>
                  <input
                    className="wf-input"
                    value={form.jobTitle}
                    onChange={(e) => set("jobTitle", e.target.value)}
                    aria-invalid={isInvalid("jobTitle")}
                    maxLength={200}
                  />
                </label>

                <label className="wf-field">
                  <span className="wf-label">
                    Trade performed <span className="wf-req">*</span>
                  </span>
                  <select
                    className="wf-select"
                    value={form.primaryTradeId}
                    onChange={(e) => set("primaryTradeId", e.target.value)}
                    aria-invalid={isInvalid("primaryTradeId")}
                  >
                    <option value="">Select a trade</option>
                    {trades.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="wf-field">
                  <span className="wf-label">
                    Start date <span className="wf-req">*</span>
                  </span>
                  <input
                    className="wf-input"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set("startDate", e.target.value)}
                    aria-invalid={isInvalid("startDate")}
                  />
                </label>

                <label className="wf-field">
                  <span className="wf-label">
                    End date{" "}
                    {form.currentlyEmployed ? null : <span className="wf-req">*</span>}
                  </span>
                  <input
                    className="wf-input"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set("endDate", e.target.value)}
                    disabled={form.currentlyEmployed}
                    aria-invalid={isInvalid("endDate")}
                  />
                </label>

                <label className="wf-choice" style={{ alignSelf: "end" }}>
                  <input
                    type="checkbox"
                    checked={form.currentlyEmployed}
                    onChange={(e) => {
                      set("currentlyEmployed", e.target.checked);
                      if (e.target.checked) set("endDate", "");
                    }}
                  />
                  <span className="wf-choice-body">
                    <span>I currently work here</span>
                  </span>
                </label>

                <label className="wf-field">
                  <span className="wf-label">
                    City <span className="wf-req">*</span>
                  </span>
                  <input
                    className="wf-input"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    aria-invalid={isInvalid("city")}
                    maxLength={100}
                  />
                </label>

                <label className="wf-field">
                  <span className="wf-label">
                    State <span className="wf-req">*</span>
                  </span>
                  <select
                    className="wf-select"
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                    aria-invalid={isInvalid("state")}
                  >
                    <option value="">Select a state</option>
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="wf-field">
                  <span className="wf-label">Supervisor name</span>
                  <input
                    className="wf-input"
                    value={form.supervisorName}
                    onChange={(e) => set("supervisorName", e.target.value)}
                    maxLength={200}
                  />
                </label>

                <label className="wf-field">
                  <span className="wf-label">Supervisor phone</span>
                  <input
                    className="wf-input"
                    type="tel"
                    value={form.supervisorPhone}
                    onChange={(e) => set("supervisorPhone", e.target.value)}
                    placeholder="(555) 555-5555"
                  />
                </label>

                <div className="wf-field wf-field-wide">
                  <span className="wf-label">
                    How were you hired for this position?{" "}
                    <span className="wf-req">*</span>
                  </span>
                  <div
                    className="wf-choices"
                    role="radiogroup"
                    aria-label="How were you hired for this position?"
                    aria-invalid={isInvalid("hiringMethod")}
                  >
                    {HIRING_METHODS.map(({ value, label }) => (
                      <label
                        key={value}
                        className={`wf-choice ${
                          form.hiringMethod === value ? "is-selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="hiringMethod"
                          value={value}
                          checked={form.hiringMethod === value}
                          onChange={() => set("hiringMethod", value)}
                        />
                        <span className="wf-choice-body">
                          <span>{label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="wf-field wf-field-wide">
                  <span className="wf-label">
                    What work did you do? <span className="wf-req">*</span>
                  </span>
                  <textarea
                    className="wf-textarea"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    aria-invalid={isInvalid("description")}
                    maxLength={2000}
                  />
                </label>

                <label className="wf-field wf-field-wide">
                  <span className="wf-label">Reason for leaving</span>
                  <input
                    className="wf-input"
                    value={form.reasonForLeaving}
                    onChange={(e) => set("reasonForLeaving", e.target.value)}
                    maxLength={500}
                  />
                </label>
              </div>

              <div className="wf-btn-row">
                <button
                  type="button"
                  className="wf-btn wf-btn-secondary wf-btn-sm"
                  onClick={() => void saveEntryAndAddAnother()}
                  disabled={busy}
                >
                  {busy
                    ? "Saving."
                    : editingId
                      ? "Save changes"
                      : "Add another company"}
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost wf-btn-sm"
                  onClick={() => {
                    setForm(null);
                    setEditingId(null);
                    setEntryError(null);
                    setInvalidFields([]);
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
              <p className="wf-hint">
                This job is saved when you continue. Use Add another company only if you
                have more employers to enter.
              </p>
            </div>
          ) : (
            <div className="wf-btn-row">
              <button
                type="button"
                className="wf-btn wf-btn-secondary"
                onClick={() => {
                  setForm({ ...EMPTY_FORM });
                  setEditingId(null);
                  setEntryError(null);
                  setInvalidFields([]);
                }}
                disabled={busy}
              >
                Add a company
              </button>
            </div>
          )}
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
