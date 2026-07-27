"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import DeclarationChoice from "@/components/workforce/DeclarationChoice";
import RegistryPicker from "@/components/workforce/RegistryPicker";
import {
  type CertificationOption,
  WorkforceApiError,
  getCertificationRegistry,
  getCertifications,
  saveCertifications,
  setCertificationsDeclaration,
} from "@/lib/workforce/workforceApi";

/**
 * Certifications screen (backend stage CERTIFICATIONS_LICENSES).
 *
 * Options come from the canonical active Certification Registry; the draft stores only
 * the selected ids.
 */
export default function CertificationsPage() {
  const [registry, setRegistry] = useState<CertificationOption[]>([]);
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
          getCertificationRegistry(),
          getCertifications(),
        ]);
        if (cancelled) return;
        setRegistry(options);
        setDeclaration(stage.hasCertifications);
        setSelectedIds(stage.selections.map((s) => s.id));
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

  const answer = useCallback(async (hasCertifications: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const stage = await setCertificationsDeclaration(hasCertifications);
      setDeclaration(stage.hasCertifications);
      setSelectedIds(stage.selections.map((s) => s.id));
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
          <RegistryPicker
            options={registry}
            selectedIds={selectedIds}
            onToggle={toggle}
            searchPlaceholder="Search certifications"
            emptyText="No certifications are available to select right now."
          />
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
