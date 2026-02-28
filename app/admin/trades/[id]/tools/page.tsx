"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type ToolType = {
  id: string;
  name: string;
  isActive: boolean;
};

type TradeToolType = {
  toolTypeId: string;
  isRequired: boolean;
  toolType?: { id: string; name: string; isActive: boolean };
};

type TradeToolTypesResponse = {
  tradeId: string;
  tools: TradeToolType[];
};

export default function TradeToolsTemplatePage() {
  const params = useParams<{ id: string }>();
  const tradeId = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [toolTypes, setToolTypes] = useState<ToolType[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [requiredIds, setRequiredIds] = useState<Set<string>>(new Set());

  const [initialSelectedIds, setInitialSelectedIds] = useState<Set<string>>(new Set());
  const [initialRequiredIds, setInitialRequiredIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [showRequiredOnly, setShowRequiredOnly] = useState(false);

  const selectedCount = selectedIds.size;
  const requiredCount = requiredIds.size;

  const isDirty = useMemo(() => {
    if (initialSelectedIds.size !== selectedIds.size) return true;
    if (initialRequiredIds.size !== requiredIds.size) return true;
    for (const id of selectedIds) {
      if (!initialSelectedIds.has(id)) return true;
    }
    for (const id of requiredIds) {
      if (!initialRequiredIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, requiredIds, initialSelectedIds, initialRequiredIds]);

  const activeToolTypes = useMemo(
    () => toolTypes.filter((t) => t.isActive),
    [toolTypes]
  );

  const filteredAndSortedTools = useMemo(() => {
    let filtered = activeToolTypes;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(q));
    }

    if (showSelectedOnly) {
      filtered = filtered.filter((t) => selectedIds.has(t.id));
    }

    if (showRequiredOnly) {
      filtered = filtered.filter((t) => requiredIds.has(t.id));
    }

    const selected = filtered.filter((t) => selectedIds.has(t.id));
    const unselected = filtered.filter((t) => !selectedIds.has(t.id));

    selected.sort((a, b) => a.name.localeCompare(b.name));
    unselected.sort((a, b) => a.name.localeCompare(b.name));

    return [...selected, ...unselected];
  }, [activeToolTypes, searchQuery, showSelectedOnly, showRequiredOnly, selectedIds, requiredIds]);

  useEffect(() => {
    if (!tradeId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [allTools, tradeTools] = await Promise.all([
          apiFetch(`/tool-types?activeOnly=true`),
          apiFetch(`/trades/${tradeId}/tool-types`),
        ]);

        if (cancelled) return;

        setToolTypes(allTools as ToolType[]);

        const resp = tradeTools as TradeToolTypesResponse;
        const nextSelected = new Set<string>();
        const nextRequired = new Set<string>();

        for (const row of resp.tools || []) {
          nextSelected.add(row.toolTypeId);
          if (row.isRequired) nextRequired.add(row.toolTypeId);
        }

        setSelectedIds(nextSelected);
        setRequiredIds(nextRequired);
        setInitialSelectedIds(new Set(nextSelected));
        setInitialRequiredIds(new Set(nextRequired));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load trade tool template.";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [tradeId]);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setRequiredIds((prevReq) => {
          const n = new Set(prevReq);
          n.delete(id);
          return n;
        });
      } else {
        next.add(id);
      }
      return next;
    });
    setSaveSuccess(false);
  }, []);

  const toggleRequired = useCallback((id: string) => {
    setSelectedIds((currentSelected) => {
      if (!currentSelected.has(id)) return currentSelected;
      setRequiredIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return currentSelected;
    });
    setSaveSuccess(false);
  }, []);

  async function save() {
    if (!tradeId) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const toolTypeIds = Array.from(selectedIds);
      const requiredToolTypeIds = Array.from(requiredIds);

      await apiFetch(`/trades/${tradeId}/tool-types`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolTypeIds, requiredToolTypeIds }),
      });

      setInitialSelectedIds(new Set(selectedIds));
      setInitialRequiredIds(new Set(requiredIds));
      setSaveSuccess(true);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!tradeId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Missing trade id.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Tools Template</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">
                  Trade: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{tradeId}</code>
                </span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {selectedCount} selected
                  </span>
                  <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    {requiredCount} required
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isDirty && !saving && (
                <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
              )}
              {saveSuccess && (
                <span className="text-xs text-green-600 font-medium">Saved!</span>
              )}
              <button
                className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                onClick={() => router.back()}
                disabled={saving}
              >
                Back
              </button>
              <button
                className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={save}
                disabled={saving || loading || !isDirty}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-4 rounded-lg border border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showSelectedOnly}
              onChange={(e) => setShowSelectedOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Selected only</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRequiredOnly}
              onChange={(e) => setShowRequiredOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Required only</span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="col-span-6 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Tool
              </div>
              <div className="col-span-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Selected
              </div>
              <div className="col-span-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Required
              </div>
            </div>

            {filteredAndSortedTools.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {activeToolTypes.length === 0
                  ? "No active tool types found."
                  : "No tools match your filters."}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredAndSortedTools.map((t) => {
                  const selected = selectedIds.has(t.id);
                  const required = requiredIds.has(t.id);

                  return (
                    <div
                      key={t.id}
                      className={`grid grid-cols-12 gap-4 px-4 py-3 items-center transition-colors hover:bg-gray-50 ${
                        selected ? "bg-blue-50/30" : ""
                      }`}
                    >
                      <div className="col-span-6 flex items-center gap-2">
                        <span className="text-sm text-gray-900">{t.name}</span>
                        {required && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">
                            Required
                          </span>
                        )}
                      </div>

                      <div className="col-span-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(t.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {selected ? "Yes" : "No"}
                          </span>
                        </label>
                      </div>

                      <div className="col-span-3">
                        <label
                          className={`inline-flex items-center gap-2 ${
                            selected ? "cursor-pointer" : "cursor-not-allowed"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={required}
                            disabled={!selected}
                            onChange={() => toggleRequired(t.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                          <span
                            className={`text-sm ${
                              selected ? "text-gray-700" : "text-gray-400"
                            }`}
                          >
                            {required ? "Yes" : "No"}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && filteredAndSortedTools.length > 0 && (
          <div className="mt-3 text-xs text-gray-500 text-right">
            Showing {filteredAndSortedTools.length} of {activeToolTypes.length} tools
          </div>
        )}
      </div>
    </div>
  );
}
