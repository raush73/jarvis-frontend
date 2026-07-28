"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import DeclarationChoice from "@/components/workforce/DeclarationChoice";
import {
  MILITARY_BRANCHES,
  MILITARY_SERVICE_COMPONENTS,
  type MilitaryBranch,
  type MilitaryServiceComponent,
  WorkerSessionExpiredError,
  WorkforceApiError,
  getLegal,
  saveMilitary,
  setMilitaryDeclaration,
} from "@/lib/workforce/workforceApi";

/**
 * Military Service screen - the military section of the backend
 * LEGAL_ACKNOWLEDGEMENTS stage. Branch and service component are distinct: Reserve and
 * National Guard are components, not branches.
 */
export default function MilitaryPage() {
  const [declaration, setDeclaration] = useState<boolean | null>(null);
  const [branch, setBranch] = useState<MilitaryBranch | "">("");
  const [component, setComponent] = useState<MilitaryServiceComponent | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const stage = await getLegal();
        if (cancelled) return;
        setDeclaration(stage.military.hasMilitaryService);
        setBranch(stage.military.branch ?? "");
        setComponent(stage.military.serviceComponent ?? "");
        setStartDate(stage.military.serviceStartDate ?? "");
        setEndDate(stage.military.serviceEndDate ?? "");
        setSpecialty(stage.military.occupationalSpecialty ?? "");
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

  const answer = useCallback(async (hasMilitaryService: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const stage = await setMilitaryDeclaration(hasMilitaryService);
      setDeclaration(stage.military.hasMilitaryService);
      if (!hasMilitaryService) {
        setBranch("");
        setComponent("");
        setStartDate("");
        setEndDate("");
        setSpecialty("");
      }
    } catch (err) {
      if (err instanceof WorkerSessionExpiredError) {
        setStageError(err);
        return;
      }
      setError(
        err instanceof WorkforceApiError
          ? err.message
          : "We could not save your answer. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const onSave = useCallback(async () => {
    if (declaration === null) {
      throw new WorkforceApiError(
        "Please tell us whether you have served in the U.S. Armed Forces.",
        400,
      );
    }
    if (!declaration) return;
    if (!branch || !component) {
      throw new WorkforceApiError("Please complete your service details.", 400, [
        ...(!branch ? ["Branch of service is required"] : []),
        ...(!component ? ["Service component or status is required"] : []),
      ]);
    }
    await saveMilitary({
      branch,
      serviceComponent: component,
      ...(startDate ? { serviceStartDate: startDate } : {}),
      ...(endDate ? { serviceEndDate: endDate } : {}),
      ...(specialty.trim() ? { occupationalSpecialty: specialty.trim() } : {}),
    });
  }, [branch, component, declaration, endDate, specialty, startDate]);

  return (
    <WorkforceWizardShell
      slug="military"
      loading={loading}
      stageError={stageError}
      onSave={onSave}
      intro="Military service is recorded as part of your application. Answering does not affect whether you are considered for work."
    >
      {error ? (
        <div className="wf-error" role="alert">
          <p className="wf-error-title">{error}</p>
        </div>
      ) : null}

      <div className="wf-section">
        <DeclarationChoice
          name="hasMilitaryService"
          value={declaration}
          onChange={(v) => void answer(v)}
          yesLabel="I have served or am currently serving in the U.S. Armed Forces"
          noLabel="I have not served in the U.S. Armed Forces"
          disabled={busy}
        />
      </div>

      {declaration ? (
        <div className="wf-section">
          <h2 className="wf-section-title">Service details</h2>
          <p className="wf-section-note">
            Dates and occupational specialty are optional if you do not remember them.
          </p>

          <div className="wf-grid">
            <label className="wf-field">
              <span className="wf-label">
                Branch <span className="wf-req">*</span>
              </span>
              <select
                className="wf-select"
                value={branch}
                onChange={(e) => setBranch(e.target.value as MilitaryBranch)}
              >
                <option value="">Select a branch</option>
                {MILITARY_BRANCHES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="wf-field">
              <span className="wf-label">
                Component or status <span className="wf-req">*</span>
              </span>
              <select
                className="wf-select"
                value={component}
                onChange={(e) =>
                  setComponent(e.target.value as MilitaryServiceComponent)
                }
              >
                <option value="">Select one</option>
                {MILITARY_SERVICE_COMPONENTS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="wf-field">
              <span className="wf-label">Service start date</span>
              <input
                className="wf-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label className="wf-field">
              <span className="wf-label">Service end date</span>
              <input
                className="wf-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <span className="wf-hint">Leave blank if you are still serving.</span>
            </label>

            <label className="wf-field wf-field-wide">
              <span className="wf-label">Occupational specialty</span>
              <input
                className="wf-input"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="MOS, Rating, or AFSC"
                maxLength={100}
              />
            </label>
          </div>
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
