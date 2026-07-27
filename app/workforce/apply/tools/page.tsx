"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import DeclarationChoice from "@/components/workforce/DeclarationChoice";
import RegistryPicker from "@/components/workforce/RegistryPicker";
import {
  type RegistryOption,
  WorkforceApiError,
  getToolRegistry,
  getToolsPpe,
  saveTools,
  setToolsDeclaration,
} from "@/lib/workforce/workforceApi";

/**
 * Tools screen - the tools half of the backend TOOLS_PPE stage, which already exposes
 * tools and PPE as separate endpoints. PPE is the next screen.
 */
export default function ToolsPage() {
  const [registry, setRegistry] = useState<RegistryOption[]>([]);
  const [declaration, setDeclaration] = useState<boolean | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [options, stage] = await Promise.all([
          getToolRegistry(),
          getToolsPpe(),
        ]);
        if (cancelled) return;
        setRegistry(options);
        setDeclaration(stage.hasTools);
        setSelectedIds(stage.tools.map((t) => t.id));
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

  const answer = useCallback(async (hasTools: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const stage = await setToolsDeclaration(hasTools);
      setDeclaration(stage.hasTools);
      setSelectedIds(stage.tools.map((t) => t.id));
    } catch (err) {
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
        "Please tell us whether you can provide your own tools.",
        400,
      );
    }
    if (declaration) {
      if (selectedIds.length === 0) {
        throw new WorkforceApiError(
          "Please select at least one tool, or choose that you have none.",
          400,
        );
      }
      await saveTools(selectedIds);
    }
  }, [declaration, selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  return (
    <WorkforceWizardShell
      slug="tools"
      loading={loading}
      onSave={onSave}
      intro="Tell us which tools you own and can bring to a job site."
    >
      {error ? (
        <div className="wf-error" role="alert">
          <p className="wf-error-title">{error}</p>
        </div>
      ) : null}

      <div className="wf-section">
        <DeclarationChoice
          name="hasTools"
          value={declaration}
          onChange={(v) => void answer(v)}
          yesLabel="I own tools I can bring to a job"
          noLabel="I do not own any tools"
          disabled={busy}
        />
      </div>

      {declaration ? (
        <div className="wf-section">
          <h2 className="wf-section-title">Your tools</h2>
          <p className="wf-section-note">Select every tool you can provide.</p>
          <RegistryPicker
            options={registry}
            selectedIds={selectedIds}
            onToggle={toggle}
            searchPlaceholder="Search tools"
            emptyText="No tools are available to select right now."
          />
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
