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
  getCertificationRegistry,
  getCertifications,
  saveCertifications,
  setCertificationsDeclaration,
} from "@/lib/workforce/workforceApi";

const EMPTY_CATALOG: CatalogView = {
  catalogKey: "CERTIFICATION",
  categorized: true,
  groups: [],
};

/**
 * Certifications screen (backend stage CERTIFICATIONS_LICENSES).
 *
 * Options come from the canonical active certification catalog; the draft stores only the selected
 * ids.
 *
 * C4E: categories arrive in curated order rather than being alphabetized on the client.
 */
export default function CertificationsPage() {
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
          getCertificationRegistry(),
          getCertifications(),
        ]);
        if (cancelled) return;
        setCatalog(view);
        setDeclaration(stage.hasCertifications);
        setSelectedIds(stage.selections.map((s) => s.id));
        setStale(stage.selections.filter((s) => s.unavailable));
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

  const answer = useCallback(async (hasCertifications: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const stage = await setCertificationsDeclaration(hasCertifications);
      setDeclaration(stage.hasCertifications);
      setSelectedIds(stage.selections.map((s) => s.id));
      setStale(stage.selections.filter((s) => s.unavailable));
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
        "Please tell us whether you hold any certifications.",
        400,
      );
    }
    if (declaration) {
      if (selectedIds.length === 0) {
        throw new WorkforceApiError(
          "Please select at least one certification, or choose that you have none.",
          400,
        );
      }
      await saveCertifications(selectedIds);
    }
  }, [declaration, selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  return (
    <WorkforceWizardShell
      slug="certifications"
      loading={loading}
      stageError={stageError}
      onSave={onSave}
      intro="Select the certifications and licenses you currently hold. You may be asked to provide documentation later."
    >
      {error ? (
        <div className="wf-error" role="alert">
          <p className="wf-error-title">{error}</p>
        </div>
      ) : null}

      <div className="wf-section">
        <DeclarationChoice
          name="hasCertifications"
          value={declaration}
          onChange={(v) => void answer(v)}
          yesLabel="I hold certifications or licenses"
          noLabel="I do not hold any certifications or licenses"
          disabled={busy}
        />
      </div>

      {declaration ? (
        <div className="wf-section">
          <h2 className="wf-section-title">Your certifications</h2>
          <p className="wf-section-note">
            Select every certification you currently hold.
          </p>
          <CategorizedSelector
            view={catalog}
            selectedIds={selectedIds}
            onToggle={toggle}
            staleSelections={stale}
            searchPlaceholder="Search certifications"
            emptyText="No certifications are available to select right now."
            ariaLabel="Certifications and licenses"
          />
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
