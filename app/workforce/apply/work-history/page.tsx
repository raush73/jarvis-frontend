"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import DeclarationChoice from "@/components/workforce/DeclarationChoice";
import { US_STATES } from "@/lib/careers/usStates";
import {
  type TradeOption,
  type WorkHistoryEntryInput,
  type WorkHistoryEntryView,
  type WorkHistoryStageView,
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
};

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
  };
}

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
  const [busy, setBusy] = useState(false);

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
      } catch {
        // Save-time errors are surfaced by the shell.
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
      setEntryError([
        err instanceof WorkforceApiError
          ? err.message
          : "We could not save your answer. Please try again.",
      ]);
    } finally {
      setBusy(false);
    }
  }, []);

  const saveEntry = useCallback(async () => {
    if (!form) return;
    setBusy(true);
    setEntryError(null);
    try {
      const input = toInput(form);
      setView(
        editingId
          ? await updateWorkHistoryEntry(editingId, input)
          : await addWorkHistoryEntry(input),
      );
      setForm(null);
      setEditingId(null);
    } catch (err) {
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
  }, [editingId, form]);

  const remove = useCallback(async (entryId: string) => {
    setBusy(true);
    setEntryError(null);
    try {
      setView(await removeWorkHistoryEntry(entryId));
    } catch (err) {
      setEntryError([
        err instanceof WorkforceApiError
          ? err.message
          : "We could not remove this job. Please try again.",
      ]);
    } finally {
      setBusy(false);
    }
  }, []);

  const onSave = useCallback(async () => {
    if (view?.hasPreviousEmployment === null ||
        view?.hasPreviousEmployment === undefined) {
      throw new WorkforceApiError(
        "Please tell us whether you have previous employment.",
        400,
      );
    }
    if (view.hasPreviousEmployment && view.entries.length === 0) {
      throw new WorkforceApiError(
        "Please add at least one job, or choose that you have no previous employment.",
        400,
      );
    }
    if (form) {
      throw new WorkforceApiError(
        "Please save or cancel the job you are editing before continuing.",
        400,
      );
    }
  }, [form, view]);

  const set = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <WorkforceWizardShell
      slug="work-history"
      loading={loading}
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
                <div className="wf-btn-row">
                  <button
                    type="button"
                    className="wf-btn wf-btn-secondary wf-btn-sm"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(entry.id);
                      setForm(toForm(entry));
                      setEntryError(null);
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
                  />
                </label>

                <label className="wf-field">
                  <span className="wf-label">End date</span>
                  <input
                    className="wf-input"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set("endDate", e.target.value)}
                    disabled={form.currentlyEmployed}
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

                <label className="wf-field wf-field-wide">
                  <span className="wf-label">
                    What work did you do? <span className="wf-req">*</span>
                  </span>
                  <textarea
                    className="wf-textarea"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
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
                  className="wf-btn wf-btn-primary wf-btn-sm"
                  onClick={() => void saveEntry()}
                  disabled={busy}
                >
                  {busy ? "Saving." : editingId ? "Save changes" : "Add job"}
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-ghost wf-btn-sm"
                  onClick={() => {
                    setForm(null);
                    setEditingId(null);
                    setEntryError(null);
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
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
                }}
                disabled={busy}
              >
                Add a job
              </button>
            </div>
          )}
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
