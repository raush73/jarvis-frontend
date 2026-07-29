"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WorkforceWizardShell from "@/components/workforce/WorkforceWizardShell";
import CategorizedSelector from "@/components/catalog/CategorizedSelector";
import {
  CATALOG_UNAVAILABLE_LABEL,
  type CatalogSelectionView,
  type CatalogView,
} from "@/components/catalog/catalogContract";
import {
  WorkforceApiError,
  getPrimaryTrade,
  getTradeRegistry,
  getTradeSkillSets,
  getTradeSpecializations,
  savePrimaryTrade,
  type SpecializationOption,
  type SpecializationSelectionView,
} from "@/lib/workforce/workforceApi";

const EMPTY_CATALOG: CatalogView = {
  catalogKey: "TRADE",
  categorized: false,
  groups: [],
};

const EMPTY_SKILL_SETS: CatalogView = {
  catalogKey: "CAPABILITY",
  categorized: true,
  groups: [],
};

/**
 * Trade Selection screen (backend stage PRIMARY_TRADE).
 *
 * One screen, revealed a step at a time:
 *
 *   Trade -> Specializations (only when the trade offers them) -> Skill Sets
 *
 * A trade that defines no specializations skips that step and shows its trade-level skill sets
 * instead. Which of the two sets of skill sets applies is the server's decision - the page asks
 * the same endpoint either way and renders what comes back.
 *
 * Trades come from the canonical active trade catalog owned by Workforce Administration; nothing
 * is hardcoded here.
 */
export default function TradePage() {
  const [catalog, setCatalog] = useState<CatalogView>(EMPTY_CATALOG);
  const [selected, setSelected] = useState("");
  const [stale, setStale] = useState<CatalogSelectionView[]>([]);

  const [offered, setOffered] = useState<SpecializationOption[]>([]);
  const [specializationsOffered, setSpecializationsOffered] = useState(false);
  const [chosenSpecializations, setChosenSpecializations] = useState<string[]>([]);
  const [staleSpecializations, setStaleSpecializations] = useState<
    SpecializationSelectionView[]
  >([]);

  const [skillSets, setSkillSets] = useState<CatalogView>(EMPTY_SKILL_SETS);
  const [chosenSkillSets, setChosenSkillSets] = useState<string[]>([]);
  const [staleSkillSets, setStaleSkillSets] = useState<CatalogSelectionView[]>([]);

  const [loading, setLoading] = useState(true);
  const [stageError, setStageError] = useState<unknown>(null);

  // Trade and specialization changes both refetch skill sets, so a slow earlier response must
  // not overwrite a newer one.
  const requestSeq = useRef(0);

  /** Load what the trade offers, then the skill sets for the given specializations. */
  const loadTaxonomy = useCallback(
    async (tradeId: string, specializationIds: string[]) => {
      const seq = ++requestSeq.current;
      if (!tradeId) {
        setSpecializationsOffered(false);
        setOffered([]);
        setSkillSets(EMPTY_SKILL_SETS);
        return;
      }
      const [specializations, sets] = await Promise.all([
        getTradeSpecializations(tradeId),
        getTradeSkillSets(tradeId, specializationIds),
      ]);
      if (seq !== requestSeq.current) return;
      setSpecializationsOffered(specializations.specializationsOffered);
      setOffered(specializations.specializations);
      setSkillSets(sets);
      // A skill set that is no longer presented cannot remain chosen; the backend refuses it.
      const available = new Set(
        sets.groups.flatMap((group) => group.options.map((option) => option.id)),
      );
      setChosenSkillSets((current) => current.filter((id) => available.has(id)));
    },
    [],
  );

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

        const live = current.specializations.filter((entry) => !entry.unavailable);
        setChosenSpecializations(live.map((entry) => entry.id));
        setStaleSpecializations(
          current.specializations.filter((entry) => entry.unavailable),
        );
        setChosenSkillSets(current.skillSets.map((entry) => entry.id));
        setStaleSkillSets(current.skillSets.filter((entry) => entry.unavailable));

        if (current.primaryTradeId && !current.primaryTradeUnavailable) {
          await loadTaxonomy(
            current.primaryTradeId,
            live.map((entry) => entry.id),
          );
        }
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
  }, [loadTaxonomy]);

  /** Choosing a different trade clears the answers beneath it; they belong to a trade. */
  const chooseTrade = useCallback(
    (id: string) => {
      if (id === selected) return;
      setSelected(id);
      setChosenSpecializations([]);
      setStaleSpecializations([]);
      setChosenSkillSets([]);
      setStaleSkillSets([]);
      void loadTaxonomy(id, []).catch(setStageError);
    },
    [selected, loadTaxonomy],
  );

  const toggleSpecialization = useCallback(
    (id: string) => {
      const next = chosenSpecializations.includes(id)
        ? chosenSpecializations.filter((entry) => entry !== id)
        : [...chosenSpecializations, id];
      setChosenSpecializations(next);
      void loadTaxonomy(selected, next).catch(setStageError);
    },
    [chosenSpecializations, selected, loadTaxonomy],
  );

  const dropStaleSpecialization = useCallback((id: string) => {
    setStaleSpecializations((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toggleSkillSet = useCallback((id: string) => {
    setChosenSkillSets((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }, []);

  const onSave = useCallback(async () => {
    if (!selected) {
      throw new WorkforceApiError("Please select your primary trade.", 400);
    }
    const stage = await savePrimaryTrade(
      selected,
      chosenSpecializations,
      chosenSkillSets,
    );
    // The save rejects anything no longer available, so a successful save clears retired answers.
    if (!stage.primaryTradeUnavailable) setStale([]);
    setStaleSpecializations(
      stage.specializations.filter((entry) => entry.unavailable),
    );
    setStaleSkillSets(stage.skillSets.filter((entry) => entry.unavailable));
  }, [selected, chosenSpecializations, chosenSkillSets]);

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
          onToggle={chooseTrade}
          staleSelections={stale}
          searchPlaceholder="Search trades"
          emptyText="No trades are available right now. Please try again later."
          ariaLabel="Trades"
        />
      </div>

      {selected && specializationsOffered ? (
        <div className="wf-section">
          <h2 className="wf-section-title">What do you specialize in?</h2>
          <p className="wf-section-note">
            Choose every area you have worked in. Choose more than one if they apply.
          </p>
          <div className="wf-choices">
            {offered.map((specialization) => {
              const isSelected = chosenSpecializations.includes(specialization.id);
              return (
                <label
                  key={specialization.id}
                  className={`wf-choice${isSelected ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSpecialization(specialization.id)}
                  />
                  <span className="wf-choice-body">{specialization.name}</span>
                </label>
              );
            })}
            {staleSpecializations.map((entry) => (
              <label key={entry.id} className="wf-choice">
                <input
                  type="checkbox"
                  checked
                  onChange={() => dropStaleSpecialization(entry.id)}
                />
                {/* Never the raw identifier, even when the name cannot be resolved (§11.2). */}
                <span className="wf-choice-body">
                  {entry.name ?? CATALOG_UNAVAILABLE_LABEL}
                  {entry.name ? ` — ${CATALOG_UNAVAILABLE_LABEL}` : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {selected && skillSets.groups.length > 0 ? (
        <div className="wf-section">
          <h2 className="wf-section-title">What can you do?</h2>
          <p className="wf-section-note">Select everything you are able to do.</p>
          <CategorizedSelector
            view={skillSets}
            selectedIds={chosenSkillSets}
            onToggle={toggleSkillSet}
            staleSelections={staleSkillSets}
            searchPlaceholder="Search skills"
            ariaLabel="Skill sets"
          />
        </div>
      ) : null}
    </WorkforceWizardShell>
  );
}
