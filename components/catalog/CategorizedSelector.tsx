"use client";

import { useId, useMemo, useState, type ReactNode } from "react";

import "./catalog-selector.css";
import {
  CATALOG_UNAVAILABLE_LABEL,
  CATALOG_UNCATEGORIZED_LABEL,
  catalogGroupKey,
  type CatalogSelectionView,
  type CatalogView,
} from "./catalogContract";

/**
 * The standard selection UI for every master catalog: Trades, Tools, PPE, Certifications, and
 * Capabilities.
 *
 * Governance: 02_backend/governance/MASTER_CATALOG_PRESENTATION_CONTRACT.md
 *
 * The component consumes the server's consumer projection as given. It does not group, does not
 * order, and does not know which catalog it is rendering — grouping and ordering are
 * server-authoritative (§7) and catalog-specific logic lives in adapters, never here. The only
 * client-side transformation is search filtering, which §10 keeps client-side over the served
 * catalog.
 *
 * A surface showing several catalogs mounts one instance per catalog, which is what keeps
 * identically named categories in different catalogs from ever collapsing together (§5).
 *
 * Surfaces that attach their own governed per-entry semantics - a job order's enforcement mode,
 * a baseline's locked entries - supply them through `lockedIds` and `renderOptionAdornment`.
 * Those are presentation slots only. The catalog contract is unchanged by them, and the
 * semantics they carry stay owned by the consuming domain, which is why this component never
 * interprets what an adornment means.
 */
export default function CategorizedSelector({
  view,
  selectedIds,
  onToggle,
  selectionMode = "multiple",
  staleSelections = [],
  lockedIds = [],
  renderOptionAdornment,
  searchPlaceholder = "Search",
  emptyText = "Nothing available to select.",
  disabled = false,
  ariaLabel,
}: {
  /** Already grouped and ordered by the server. Rendered in the order received. */
  view: CatalogView;
  selectedIds: string[];
  onToggle: (id: string) => void;
  /**
   * "single" renders radios for catalogs where one entry is chosen, such as a primary trade.
   * The caller still owns state and receives the same callback; it replaces the selection
   * rather than adding to it.
   */
  selectionMode?: "multiple" | "single";
  /**
   * Stored selections that no longer resolve against the live catalog. Retained and flagged
   * rather than dropped (§11.2). Entries whose `unavailable` is false are ignored, since those
   * resolve normally and already appear within their group.
   */
  staleSelections?: CatalogSelectionView[];
  /**
   * Selections the consuming domain does not permit clearing here, such as a job order entry
   * inherited from a trade or customer baseline. Rendered selected and not togglable; the
   * surface that imposed the lock owns how it is released.
   */
  lockedIds?: string[];
  /**
   * Trailing slot for controls the consuming domain owns per entry. Called for live entries and
   * for retained unavailable ones, so an entry does not lose its controls by being deactivated.
   * Return null where no control applies.
   */
  renderOptionAdornment?: (entry: {
    id: string;
    name: string | null;
    category: string | null;
    selected: boolean;
    locked: boolean;
    unavailable: boolean;
  }) => ReactNode;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const fieldPrefix = useId();
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const locked = useMemo(() => new Set(lockedIds), [lockedIds]);

  const totalAvailable = useMemo(
    () => view.groups.reduce((sum, group) => sum + group.options.length, 0),
    [view.groups],
  );

  /**
   * Filtering only. Group order and option order are preserved exactly as served; a group left
   * with no matches is omitted, mirroring how the server omits empty groups for consumers.
   */
  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return view.groups;
    return view.groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          option.name.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [view.groups, query]);

  const visibleCount = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.options.length, 0),
    [visibleGroups],
  );

  const unavailable = useMemo(
    () => staleSelections.filter((entry) => entry.unavailable),
    [staleSelections],
  );

  // Trades have no category dimension, so a lone synthetic heading would be noise.
  const showGroupTitles = view.categorized;
  const inputType = selectionMode === "single" ? "radio" : "checkbox";
  // Radios need a shared name to behave as one group across every category.
  const radioGroupName = selectionMode === "single" ? `${fieldPrefix}-choice` : undefined;

  return (
    <div className="jp-catalog">
      <input
        type="search"
        className="jp-catalog-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        disabled={disabled || totalAvailable === 0}
      />

      {totalAvailable === 0 ? (
        <p className="jp-catalog-empty">{emptyText}</p>
      ) : visibleCount === 0 ? (
        <p className="jp-catalog-empty">No matches for &ldquo;{query.trim()}&rdquo;.</p>
      ) : (
        <div className="jp-catalog-list" role="group" aria-label={ariaLabel}>
          {visibleGroups.map((group) => {
            const groupKey = catalogGroupKey(view.catalogKey, group.category);
            return (
              <div className="jp-catalog-group" key={groupKey}>
                {showGroupTitles ? (
                  <p className="jp-catalog-group-title">
                    {group.category ?? CATALOG_UNCATEGORIZED_LABEL}
                  </p>
                ) : null}
                {group.options.map((option) => {
                  // An item belonging to several categories renders under each of them. Selection
                  // is keyed by stable identifier, so ticking it in one group ticks it in all
                  // (§6). The DOM id is group-scoped to stay unique across those repeats.
                  const fieldId = `${fieldPrefix}-${groupKey}-${option.id}`;
                  const isSelected = selected.has(option.id);
                  const isLocked = locked.has(option.id);
                  const adornment = renderOptionAdornment?.({
                    id: option.id,
                    name: option.name,
                    category: group.category,
                    selected: isSelected,
                    locked: isLocked,
                    unavailable: false,
                  });
                  return (
                    <div className="jp-catalog-row" key={fieldId}>
                      <label
                        className={`jp-catalog-option${disabled || isLocked ? " is-disabled" : ""}`}
                        htmlFor={fieldId}
                      >
                        <input
                          id={fieldId}
                          type={inputType}
                          name={radioGroupName}
                          checked={isSelected || isLocked}
                          disabled={disabled || isLocked}
                          onChange={() => onToggle(option.id)}
                        />
                        <span>{option.name}</span>
                      </label>
                      {adornment ? (
                        <div className="jp-catalog-row-adornment">{adornment}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {unavailable.length > 0 ? (
        <div className="jp-catalog-unavailable">
          <p className="jp-catalog-unavailable-title">Previously selected</p>
          {unavailable.map((entry) => {
            const fieldId = `${fieldPrefix}-unavailable-${entry.id}`;
            const isLocked = locked.has(entry.id);
            const adornment = renderOptionAdornment?.({
              id: entry.id,
              name: entry.name,
              category: entry.category,
              selected: selected.has(entry.id) || isLocked,
              locked: isLocked,
              unavailable: true,
            });
            return (
              <div className="jp-catalog-row" key={fieldId}>
                <label
                  className={`jp-catalog-option${disabled || isLocked ? " is-disabled" : ""}`}
                  htmlFor={fieldId}
                >
                  {/* Part of the same input group, so choosing a live entry in single-select mode
                      visibly replaces the retired one. */}
                  <input
                    id={fieldId}
                    type={inputType}
                    name={radioGroupName}
                    checked={selected.has(entry.id) || isLocked}
                    disabled={disabled || isLocked}
                    onChange={() => onToggle(entry.id)}
                  />
                  {/* Never the raw identifier, even when the name cannot be resolved (§11.2). */}
                  <span className="jp-catalog-unavailable-label">
                    {entry.name ?? CATALOG_UNAVAILABLE_LABEL}
                    {entry.name ? ` — ${CATALOG_UNAVAILABLE_LABEL}` : ""}
                  </span>
                </label>
                {adornment ? (
                  <div className="jp-catalog-row-adornment">{adornment}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* A running count is only meaningful when more than one entry can be chosen. */}
      {selectionMode === "multiple" ? (
        <p className="jp-catalog-count">{selectedIds.length} selected</p>
      ) : null}
    </div>
  );
}
