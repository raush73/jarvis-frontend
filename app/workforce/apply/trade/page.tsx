"use client";

import { useCallback, useEffect, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import CategorizedSelector from "@/components/catalog/CategorizedSelector";
import type {
  CatalogSelectionView,
  CatalogView,
} from "@/components/catalog/catalogContract";
import {
  WorkforceApiError,
  getPrimaryTrade,
  getTradeRegistry,
  savePrimaryTrade,
} from "@/lib/workforce/workforceApi";

const EMPTY_CATALOG: CatalogView = {
  catalogKey: "TRADE",
  categorized: false,
  groups: [],
};

/**
 * Trade Selection screen (backend stage PRIMARY_TRADE).
 *
 * Trades come from the canonical active trade catalog owned by Workforce Administration; nothing is
 * hardcoded here.
 *
 * C4E: the shared selector renders this in single-select mode, so the search, ordering, and
 * stale-selection behavior match every other catalog surface. Trades carry no categories, so the
 * list arrives as one unlabelled group in curated order.
 */
export default function TradePage() {
  const [catalog, setCatalog] = useState<CatalogView>(EMPTY_CATALOG);
  const [selected, setSelected] = useState("");
  const [stale, setStale] = useState<CatalogSelectionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageError, setStageError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [view, current] = await Promise.all([
          getTradeRegistry(),
          getPrimaryTrade(),
        ]);
        if (cancelled) return;
        setCatalog(view);
        setSelected(current.primaryTradeId ?? "");
        // A trade retired since the worker chose it is shown as no longer available rather than
        // leaving the stage looking unanswered.
        setStale(
          current.primaryTradeId && current.primaryTradeUnavailable
            ? [
                {
                  id: current.primaryTradeId,
                  name: current.primaryTradeName,
                  category: null,
                  unavailable: true,
                },
              ]
            : [],
        );
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

  const onSave = useCallback(async () => {
    if (!selected) {
      throw new WorkforceApiError("Please select your primary trade.", 400);
    }
    const stage = await savePrimaryTrade(selected);
    // The save rejects an inactive trade, so a successful save clears any retired prior answer.
    if (!stage.primaryTradeUnavailable) setStale([]);
  }, [selected]);

  const choose = useCallback((id: string) => setSelected(id), []);

  return (
    <WorkforceWizardShell
      slug="trade"
      loading={loading}
      stageError={stageError}
      onSave={onSave}
      intro="Choose the single trade that best describes the work you are qualified to perform. You can list additional experience in your work history."
    >
      <div className="wf-section">
        <CategorizedSelector
          view={catalog}
          selectionMode="single"
          selectedIds={selected ? [selected] : []}
          onToggle={choose}
          staleSelections={stale}
          searchPlaceholder="Search trades"
          emptyText="No trades are available right now. Please try again later."
          ariaLabel="Trades"
        />
      </div>
    </WorkforceWizardShell>
  );
}
