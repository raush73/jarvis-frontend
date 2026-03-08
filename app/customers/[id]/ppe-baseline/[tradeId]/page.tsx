"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type ToolCategory = {
  id: string;
  name: string;
  isActive: boolean;
};

type Tool = {
  id: string;
  name: string;
  categoryId: string;
  isActive: boolean;
};

type CustomerPPEBaselineResponse = {
  customerId: string;
  baselines: Array<{ tradeId: string; ppeTypeIds: string[] }>;
};

export default function CustomerTradePPEBaselinePage() {
  const params = useParams<{ id: string; tradeId: string }>();
  const customerId = params?.id;
  const tradeId = params?.tradeId;
  const router = useRouter();

  const [customerName, setCustomerName] = useState<string>("Customer");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [categories, setCategories] = useState<ToolCategory[]>([]);
  const [PPEByCategory, setPPEByCategory] = useState<Record<string, Tool[]>>({});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialSelectedIds, setInitialSelectedIds] = useState<Set<string>>(new Set());

  // full customer baseline map (so PUT stays replace-all)
  const [baselineMap, setBaselineMap] = useState<Record<string, string[]>>({});

  const [searchQuery, setSearchQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const selectedCount = selectedIds.size;

  const isDirty = useMemo(() => {
    if (initialSelectedIds.size !== selectedIds.size) return true;
    for (const id of selectedIds) {
      if (!initialSelectedIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, initialSelectedIds]);

  useEffect(() => {
    if (!customerId || !tradeId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Customer header
        const cust = await apiFetch<any>(`/customers/${customerId}`);
        if (cancelled) return;
        setCustomerName(cust?.name || "Customer");
        // PPE dictionary (flat)
        const ppeTypes = await apiFetch<Array<{ id: string; name: string; active?: boolean }>>("/ppe-types?activeOnly=true");
        if (cancelled) return;

        setCategories([{ id: "all", name: "PPE", isActive: true }]);

        const toolMap: Record<string, Tool[]> = {
          all: (Array.isArray(ppeTypes) ? ppeTypes : []).map((pt) => ({
            id: pt.id,
            name: pt.name,
            categoryId: "all",
            isActive: pt.active ?? true,
          })),
        };

        setPPEByCategory(toolMap);
// Customer baseline (replace-all model)
        const baseline = await apiFetch<CustomerPPEBaselineResponse>(
          `/customers/${customerId}/ppe-baseline`
        );
        if (cancelled) return;

        const map: Record<string, string[]> = {};
        for (const b of baseline.baselines || []) {
          map[b.tradeId] = b.ppeTypeIds || [];
        }
        setBaselineMap(map);

        const currentTradeIds = new Set<string>((map[tradeId] || []) as string[]);
        setSelectedIds(currentTradeIds);
        setInitialSelectedIds(new Set(currentTradeIds));
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : "Failed to load customer PPE baseline.";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [customerId, tradeId]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q && !showSelectedOnly) return categories;

    return categories.filter((c) => {
      const PPE = PPEByCategory[c.id] || [];
      const PPEFiltered = PPE.filter((t) => {
        if (showSelectedOnly && !selectedIds.has(t.id)) return false;
        if (q && !t.name.toLowerCase().includes(q)) return false;
        return true;
      });
      return PPEFiltered.length > 0;
    });
  }, [categories, PPEByCategory, searchQuery, showSelectedOnly, selectedIds]);

  function visiblePPEForCategory(categoryId: string) {
    const q = searchQuery.trim().toLowerCase();
    let PPE = PPEByCategory[categoryId] || [];
    if (q) PPE = PPE.filter((t) => t.name.toLowerCase().includes(q));
    if (showSelectedOnly) PPE = PPE.filter((t) => selectedIds.has(t.id));
    return PPE;
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaveSuccess(false);
  }

  async function save() {
    if (!customerId || !tradeId) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const nextMap: Record<string, string[]> = { ...(baselineMap || {}) };
      nextMap[tradeId] = Array.from(selectedIds);

      const baselines = Object.entries(nextMap).map(([tId, ppeTypeIds]) => ({
        tradeId: tId,
        ppeTypeIds: ppeTypeIds || [],
      }));

      await apiFetch(`/customers/${customerId}/ppe-baseline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baselines }),
      });

      setBaselineMap(nextMap);
      setInitialSelectedIds(new Set(selectedIds));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!customerId || !tradeId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Missing customer id or trade id.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {customerName} — PPE Baseline
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-500">
                  Trade:{" "}
                  <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                    {tradeId}
                  </code>
                </span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {selectedCount} selected
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
              <svg
                className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
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
              placeholder="Search PPE..."
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-sm text-gray-600">
            No PPE match your filters.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredCategories.map((category) => {
              const PPE = visiblePPEForCategory(category.id);
              return (
                <div key={category.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-900">
                        {category.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {PPE.filter((t) => selectedIds.has(t.id)).length} selected
                      </div>
                    </div>
                  </div>

                  {PPE.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">
                      No PPE in this category.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {PPE.map((t) => {
                        const selected = selectedIds.has(t.id);
                        return (
                          <label
                            key={t.id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                              selected ? "bg-blue-50/30" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggle(t.id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-900">{t.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}









