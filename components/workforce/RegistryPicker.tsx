"use client";

import { useMemo, useState } from "react";

export type PickerOption = {
  id: string;
  name: string;
  /** Optional grouping label; ungrouped options are listed under "Other". */
  category?: string | null;
};

/**
 * Multi-select over a canonical registry (trades, certifications, tools, PPE).
 *
 * Options always come from the backend registry endpoint - no list is hardcoded here,
 * so anything added or deactivated in Workforce Administration is reflected
 * automatically. Only ids are ever sent back.
 */
export default function RegistryPicker({
  options,
  selectedIds,
  onToggle,
  searchPlaceholder = "Search",
  emptyText = "Nothing available to select.",
}: {
  options: PickerOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? options.filter((o) => o.name.toLowerCase().includes(needle))
      : options;

    const grouped = new Map<string, PickerOption[]>();
    for (const option of matched) {
      const key = option.category?.trim() || "";
      const list = grouped.get(key);
      if (list) list.push(option);
      else grouped.set(key, [option]);
    }
    // Named categories first (alphabetically), uncategorized last.
    return Array.from(grouped.entries()).sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });
  }, [options, query]);

  const showGroupTitles = groups.length > 1 || Boolean(groups[0]?.[0]);
  const total = groups.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div>
      <input
        className="wf-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        style={{ marginBottom: 10 }}
      />

      {options.length === 0 ? (
        <p className="wf-empty">{emptyText}</p>
      ) : total === 0 ? (
        <p className="wf-empty">No matches for &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="wf-picker">
          {groups.map(([category, list]) => (
            <div key={category || "__uncategorized"}>
              {showGroupTitles ? (
                <p className="wf-picker-group-title">{category || "Other"}</p>
              ) : null}
              {list.map((option) => (
                <label key={option.id} className="wf-option">
                  <input
                    type="checkbox"
                    checked={selected.has(option.id)}
                    onChange={() => onToggle(option.id)}
                  />
                  <span>{option.name}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="wf-selected-count">
        {selectedIds.length} selected
      </p>
    </div>
  );
}
