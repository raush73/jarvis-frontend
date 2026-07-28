"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import DeclarationChoice from "@/components/workforce/DeclarationChoice";
import CategorizedSelector from "@/components/catalog/CategorizedSelector";
import type {
  CatalogSelectionView,
  CatalogView,
} from "@/components/catalog/catalogContract";
import {
  WorkerSessionExpiredError,
  WorkforceApiError,
  getToolRegistry,
  getToolsPpe,
  saveTools,
  setToolsDeclaration,
} from "@/lib/workforce/workforceApi";

const EMPTY_CATALOG: CatalogView = {
  catalogKey: "TOOL",
  categorized: true,
  groups: [],
};

/**
 * Tools screen - the tools half of the backend TOOLS_PPE stage, which already exposes
 * tools and PPE as separate endpoints. PPE is the next screen.
 *
 * C4E: the catalog arrives grouped by category and in curated order from the presentation facade,
 * and is rendered by the shared selector. Tool categories were previously discarded here.
 */
export default function ToolsPage() {
  const [catalog, setCatalog] = useState<CatalogView>(EMPTY_CATALOG);
  const [declaration, setDeclaration] = useState<boolean | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stale, setStale] = useState<CatalogSelectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [view, stage] = await Promise.all([
          getToolRegistry(),
          getToolsPpe(),
        ]);
        if (cancelled) return;
        setCatalog(view);
        setDeclaration(stage.hasTools);
        setSelectedIds(stage.tools.map((t) => t.id));
        setStale(stage.tools.filter((t) => t.unavailable));
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

  const answer = useCallback(async (hasTools: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const stage = await setToolsDeclaration(hasTools);
      setDeclaration(stage.hasTools);
      setSelectedIds(stage.tools.map((t) => t.id));
      setStale(stage.tools.filter((t) => t.unavailable));
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
      stageError={stageError}
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
          <CategorizedSelector
            view={catalog}
            selectedIds={selectedIds}
            onToggle={toggle}
            staleSelections={stale}
            searchPlaceholder="Search tools"
            emptyText="No tools are available to select right now."
            ariaLabel="Tools"
          />
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
