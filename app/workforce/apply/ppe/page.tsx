"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import DeclarationChoice from "@/components/workforce/DeclarationChoice";
import RegistryPicker from "@/components/workforce/RegistryPicker";
import {
  type RegistryOption,
  WorkerSessionExpiredError,
  WorkforceApiError,
  getPpeRegistry,
  getToolsPpe,
  savePpe,
  setPpeDeclaration,
} from "@/lib/workforce/workforceApi";

/**
 * PPE screen - the PPE half of the backend TOOLS_PPE stage.
 */
export default function PpePage() {
  const [registry, setRegistry] = useState<RegistryOption[]>([]);
  const [declaration, setDeclaration] = useState<boolean | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [options, stage] = await Promise.all([
          getPpeRegistry(),
          getToolsPpe(),
        ]);
        if (cancelled) return;
        setRegistry(options);
        setDeclaration(stage.hasPpe);
        setSelectedIds(stage.ppe.map((p) => p.id));
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

  const answer = useCallback(async (hasPpe: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const stage = await setPpeDeclaration(hasPpe);
      setDeclaration(stage.hasPpe);
      setSelectedIds(stage.ppe.map((p) => p.id));
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
        "Please tell us whether you have your own personal protective equipment.",
        400,
      );
    }
    if (declaration) {
      if (selectedIds.length === 0) {
        throw new WorkforceApiError(
          "Please select at least one item, or choose that you have none.",
          400,
        );
      }
      await savePpe(selectedIds);
    }
  }, [declaration, selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  return (
    <WorkforceWizardShell
      slug="ppe"
      loading={loading}
      stageError={stageError}
      onSave={onSave}
      intro="Tell us which personal protective equipment you already have. Not having your own PPE does not disqualify you."
    >
      {error ? (
        <div className="wf-error" role="alert">
          <p className="wf-error-title">{error}</p>
        </div>
      ) : null}

      <div className="wf-section">
        <DeclarationChoice
          name="hasPpe"
          value={declaration}
          onChange={(v) => void answer(v)}
          yesLabel="I have my own personal protective equipment"
          noLabel="I do not have my own personal protective equipment"
          disabled={busy}
        />
      </div>

      {declaration ? (
        <div className="wf-section">
          <h2 className="wf-section-title">Your equipment</h2>
          <p className="wf-section-note">Select everything you have.</p>
          <RegistryPicker
            options={registry}
            selectedIds={selectedIds}
            onToggle={toggle}
            searchPlaceholder="Search equipment"
            emptyText="No equipment types are available to select right now."
          />
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
