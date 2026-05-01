"use client";

const BURDEN_LABELS: Record<string,string> = {
  FICA: "FICA",
  FUTA: "FUTA",
  ADMIN: "Admin / PEO",
  GL: "General Liability",
  INT_W: "Bank Time Value of Money",
  INT_PD: "Late Payment Carrying Cost",
  WC: "Workers Compensation",
  SUTA: "SUTA"
}


import { useEffect, useState } from "react";
import Link from "next/link";

// Types
type BurdenScope = "GLOBAL" | "STATE" | "SITE" | "WORKER";
type BurdenBasis = "Total wages" | "Base wage only";

type BurdenComponent = {
  id: string;
  name: string;
  scope: BurdenScope;
  basis: BurdenBasis;
  followsPremium: boolean;
  includedInGM: boolean;
  ratePct: number | null; // null for WC (managed elsewhere)
  editable: boolean;
  notes: string;
};

type SUTARate = {
  id: string;
  state: string;
  ratePct: number;
};

type BackendBurdenRate = {
  id: string;
  level: BurdenScope;
  category: string;
  ratePercent: number;
  stateCode?: string | null;
  effectiveDate?: string | null;
};

type SellingPreset = {
  id: string;
  marginPct: number;
  otMultiplier: number;
  label: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type SellingPresetEditing = {
  marginPct: string;
  otMultiplier: string;
  displayOrder: string;
  label: string;
  isActive: boolean;
};


function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("jp_accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function BurdenSettingsPage() {
  const [components, setComponents] = useState<BurdenComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRates, setEditingRates] = useState<Record<string, number | null>>({});
  const [savedRates, setSavedRates] = useState<Record<string, number | null>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [sutaRates, setSutaRates] = useState<SUTARate[]>([]);
  const [sutaSearch, setSutaSearch] = useState("");

  // Selling Presets state
  const [sellingPresets, setSellingPresets] = useState<SellingPreset[]>([]);
  const [spLoading, setSpLoading] = useState(true);
  const [spError, setSpError] = useState<string | null>(null);
  const [spEditing, setSpEditing] = useState<Record<string, SellingPresetEditing>>({});
  const [spSaved, setSpSaved] = useState<Record<string, SellingPresetEditing>>({});
  const [spSavingIds, setSpSavingIds] = useState<Set<string>>(new Set());
  const [spShowNew, setSpShowNew] = useState(false);
  const [spNewDraft, setSpNewDraft] = useState({ marginPct: "", otMultiplier: "1.50", displayOrder: "0", label: "" });
  const [spNewSaving, setSpNewSaving] = useState(false);

  // Load all burden rows from API on mount; derives both component table and SUTA grid
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/payroll-burden-rates", {
          headers: { ...getAuthHeaders() },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = (await res.json()) as BackendBurdenRate[];

        // Map all rows into the component table — SUTA is excluded here; it appears in the state grid below
        const mapped: BurdenComponent[] = data.filter((row) => row.category !== "SUTA").map((row) => ({
          id: row.id,
          name: BURDEN_LABELS[row.category] ?? row.category,
          scope: row.level,
          basis: "Total wages",
          followsPremium: true,
          includedInGM: true,
          ratePct: row.ratePercent,
          editable: true,
          notes: "",
        }));
        setComponents(mapped);
        const rates: Record<string, number | null> = {};
        mapped.forEach((c) => { rates[c.id] = c.ratePct; });

        // Derive SUTA grid: category=SUTA, level=STATE, stateCode present
        // If multiple rows exist for the same state, prefer the most recent effectiveDate
        const sutaRows = data.filter(
          (r) => r.category === "SUTA" && r.level === "STATE" && r.stateCode
        );
        const bestByState = new Map<string, BackendBurdenRate>();
        for (const row of sutaRows) {
          const code = row.stateCode!;
          const existing = bestByState.get(code);
          if (
            !existing ||
            (row.effectiveDate ?? "") > (existing.effectiveDate ?? "")
          ) {
            bestByState.set(code, row);
          }
        }
        const sutaMapped: SUTARate[] = Array.from(bestByState.values())
          .sort((a, b) => a.stateCode!.localeCompare(b.stateCode!))
          .map((r) => ({ id: r.id, state: r.stateCode!, ratePct: r.ratePercent }));
        setSutaRates(sutaMapped);

        // Merge SUTA rates into the shared rates map so both tables use the same state
        sutaMapped.forEach((s) => { rates[s.id] = s.ratePct; });
        setEditingRates(rates);
        setSavedRates(rates);
      } catch (e) {
        console.error("Failed to load burden rates:", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Fetch selling presets
  useEffect(() => {
    const loadPresets = async () => {
      setSpLoading(true);
      setSpError(null);
      try {
        const res = await fetch("/api/selling-presets", {
          headers: { ...getAuthHeaders() },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = (await res.json()) as SellingPreset[];
        setSellingPresets(data);
        const editing: Record<string, SellingPresetEditing> = {};
        data.forEach((p) => {
          editing[p.id] = {
            marginPct: p.marginPct.toFixed(2),
            otMultiplier: p.otMultiplier.toFixed(2),
            displayOrder: String(p.displayOrder),
            label: p.label ?? "",
            isActive: p.isActive,
          };
        });
        setSpEditing(editing);
        setSpSaved(JSON.parse(JSON.stringify(editing)));
      } catch (e: any) {
        console.error("Failed to load selling presets:", e);
        setSpError(e?.message ?? "Failed to load selling presets");
      } finally {
        setSpLoading(false);
      }
    };
    loadPresets();
  }, []);

  const spIsRowDirty = (id: string) => {
    const cur = spEditing[id];
    const orig = spSaved[id];
    if (!cur || !orig) return false;
    return (
      cur.marginPct !== orig.marginPct ||
      cur.otMultiplier !== orig.otMultiplier ||
      cur.displayOrder !== orig.displayOrder ||
      cur.label !== orig.label ||
      cur.isActive !== orig.isActive
    );
  };

  const spIsRowValid = (vals: SellingPresetEditing) => {
    const m = parseFloat(vals.marginPct);
    const ot = parseFloat(vals.otMultiplier);
    const d = parseInt(vals.displayOrder, 10);
    return !isNaN(m) && m >= 0 && m < 100 && !isNaN(ot) && ot > 0 && !isNaN(d) && d >= 0;
  };

  const handleSpFieldChange = (id: string, field: keyof SellingPresetEditing, value: string | boolean) => {
    setSpEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSpSave = async (id: string) => {
    const vals = spEditing[id];
    if (!vals || !spIsRowValid(vals)) return;
    setSpSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/selling-presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          marginPct: parseFloat(vals.marginPct),
          otMultiplier: parseFloat(vals.otMultiplier),
          displayOrder: parseInt(vals.displayOrder, 10),
          label: vals.label || null,
          isActive: vals.isActive,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const updated = (await res.json()) as SellingPreset;
      setSellingPresets((prev) => prev.map((p) => (p.id === id ? updated : p)));
      const newVals: SellingPresetEditing = {
        marginPct: updated.marginPct.toFixed(2),
        otMultiplier: updated.otMultiplier.toFixed(2),
        displayOrder: String(updated.displayOrder),
        label: updated.label ?? "",
        isActive: updated.isActive,
      };
      setSpEditing((prev) => ({ ...prev, [id]: newVals }));
      setSpSaved((prev) => ({ ...prev, [id]: { ...newVals } }));
    } catch (e) {
      console.error("Failed to save selling preset:", e);
    } finally {
      setSpSavingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleSpDeactivate = async (id: string) => {
    setSpSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/selling-presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const updated = (await res.json()) as SellingPreset;
      setSellingPresets((prev) => prev.map((p) => (p.id === id ? updated : p)));
      const newVals: SellingPresetEditing = {
        marginPct: updated.marginPct.toFixed(2),
        otMultiplier: updated.otMultiplier.toFixed(2),
        displayOrder: String(updated.displayOrder),
        label: updated.label ?? "",
        isActive: false,
      };
      setSpEditing((prev) => ({ ...prev, [id]: newVals }));
      setSpSaved((prev) => ({ ...prev, [id]: { ...newVals } }));
    } catch (e) {
      console.error("Failed to deactivate selling preset:", e);
    } finally {
      setSpSavingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleSpReactivate = async (id: string) => {
    setSpSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/selling-presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const updated = (await res.json()) as SellingPreset;
      setSellingPresets((prev) => prev.map((p) => (p.id === id ? updated : p)));
      const newVals: SellingPresetEditing = {
        marginPct: updated.marginPct.toFixed(2),
        otMultiplier: updated.otMultiplier.toFixed(2),
        displayOrder: String(updated.displayOrder),
        label: updated.label ?? "",
        isActive: true,
      };
      setSpEditing((prev) => ({ ...prev, [id]: newVals }));
      setSpSaved((prev) => ({ ...prev, [id]: { ...newVals } }));
    } catch (e) {
      console.error("Failed to reactivate selling preset:", e);
    } finally {
      setSpSavingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const spIsNewValid = () => {
    const m = parseFloat(spNewDraft.marginPct);
    const ot = parseFloat(spNewDraft.otMultiplier);
    const d = parseInt(spNewDraft.displayOrder, 10);
    return !isNaN(m) && m >= 0 && m < 100 && !isNaN(ot) && ot > 0 && !isNaN(d) && d >= 0 && spNewDraft.marginPct !== "";
  };

  const handleSpCreate = async () => {
    if (!spIsNewValid()) return;
    setSpNewSaving(true);
    try {
      const res = await fetch("/api/selling-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          marginPct: parseFloat(spNewDraft.marginPct),
          otMultiplier: parseFloat(spNewDraft.otMultiplier),
          displayOrder: parseInt(spNewDraft.displayOrder, 10),
          label: spNewDraft.label || undefined,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const created = (await res.json()) as SellingPreset;
      setSellingPresets((prev) => [...prev, created]);
      const newVals: SellingPresetEditing = {
        marginPct: created.marginPct.toFixed(2),
        otMultiplier: created.otMultiplier.toFixed(2),
        displayOrder: String(created.displayOrder),
        label: created.label ?? "",
        isActive: created.isActive,
      };
      setSpEditing((prev) => ({ ...prev, [created.id]: newVals }));
      setSpSaved((prev) => ({ ...prev, [created.id]: { ...newVals } }));
      setSpNewDraft({ marginPct: "", otMultiplier: "1.50", displayOrder: "0", label: "" });
      setSpShowNew(false);
    } catch (e) {
      console.error("Failed to create selling preset:", e);
    } finally {
      setSpNewSaving(false);
    }
  };

  // Filtered SUTA rates
  const filteredSutaRates = sutaRates.filter((s) =>
    s.state.toLowerCase().includes(sutaSearch.toLowerCase())
  );

  // Updates local editing state only — does not persist until Save is clicked
  const handleRateChange = (id: string, value: string) => {
    const parsed = parseFloat(value);
    setEditingRates((prev) => ({ ...prev, [id]: isNaN(parsed) ? null : parsed }));
  };

  // Explicit save: persists the pending edited rate for a single row via PATCH
  const handleSaveRate = async (id: string) => {
    const newRate = editingRates[id];
    if (newRate === null || newRate === undefined) return;
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/payroll-burden-rates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ratePercent: newRate }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setSavedRates((prev) => ({ ...prev, [id]: newRate }));
    } catch (e) {
      console.error("Failed to save burden rate:", e);
    } finally {
      setSavingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  // Updates SUTA editing state by row id — does not persist until Save is clicked
  const handleSutaChange = (id: string, value: string) => {
    const parsed = parseFloat(value);
    setEditingRates((prev) => ({ ...prev, [id]: isNaN(parsed) ? null : parsed }));
  };

  // Scope badge style
  const getScopeStyle = (scope: BurdenScope) => {
    switch (scope) {
      case "GLOBAL":
        return { bg: "rgba(59, 130, 246, 0.12)", color: "#3b82f6", border: "rgba(59, 130, 246, 0.25)" };
      case "STATE":
        return { bg: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.25)" };
      case "SITE":
        return { bg: "rgba(139, 92, 246, 0.12)", color: "#8b5cf6", border: "rgba(139, 92, 246, 0.25)" };
      case "WORKER":
        return { bg: "rgba(34, 197, 94, 0.12)", color: "#22c55e", border: "rgba(34, 197, 94, 0.25)" };
      default:
        return { bg: "rgba(148, 163, 184, 0.12)", color: "#94a3b8", border: "rgba(148, 163, 184, 0.25)" };
    }
  };

  return (
    <div className="burden-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Burden Settings</h1>
          <p className="subtitle">
            Configure employer burden components for standard cost calculations. All rates are percentages.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/admin/burden/preview" className="btn-preview">
            Burden Preview Utility →
          </Link>
        </div>
      </div>

      {/* Burden Components Registry */}
      <div className="section">
        <div className="section-header">
          <h2>Burden Components</h2>
          <span className="section-count">
            {isLoading ? "Loading…" : `${components.length} components`}
          </span>
        </div>

        <div className="table-section">
          <div className="table-wrap">
            <table className="burden-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Scope</th>
                  <th>Basis</th>
                  <th>Follows OT/DT Premium</th>
                  <th>Included in GM</th>
                  <th>Rate (%)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "28px 16px", color: "rgba(255,255,255,0.4)" }}>
                      Loading burden rates…
                    </td>
                  </tr>
                ) : components.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "28px 16px", color: "rgba(255,255,255,0.4)" }}>
                      No burden rates configured yet.
                    </td>
                  </tr>
                ) : (
                  components.map((component) => (
                    <tr key={component.id} className={component.name === "WC" ? "wc-row" : ""}>
                      <td className="cell-name">
                        <div className="name-col">
                          <span className="component-name">{component.name}</span>
                          {component.notes && (
                            <span className="component-notes">{component.notes}</span>
                          )}
                        </div>
                      </td>
                      <td className="cell-scope">
                        <span
                          className="scope-badge"
                          style={{
                            backgroundColor: getScopeStyle(component.scope).bg,
                            color: getScopeStyle(component.scope).color,
                            borderColor: getScopeStyle(component.scope).border,
                          }}
                        >
                          {component.scope}
                        </span>
                      </td>
                      <td className="cell-basis">{component.basis}</td>
                      <td className="cell-premium">
                        <span className={`premium-badge ${component.followsPremium ? "yes" : "no"}`}>
                          {component.followsPremium ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="cell-gm">
                        <span className="gm-badge">Yes</span>
                      </td>
                      <td className="cell-rate">
                        {component.name === "WC" ? (
                          <Link href="/admin/safety/work-comp" className="wc-link">
                            Manage in Work Comp Rates →
                          </Link>
                        ) : component.name === "SUTA" ? (
                          <span className="rate-hint">See SUTA table below</span>
                        ) : component.editable ? (
                          <div className="rate-cell-edit">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="rate-input"
                              value={editingRates[component.id] ?? ""}
                              onChange={(e) => handleRateChange(component.id, e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn-save-rate"
                              disabled={
                                editingRates[component.id] === savedRates[component.id] ||
                                savingIds.has(component.id)
                              }
                              onClick={() => handleSaveRate(component.id)}
                            >
                              {savingIds.has(component.id) ? "…" : "Save"}
                            </button>
                          </div>
                        ) : (
                          <span className="rate-value">
                            {editingRates[component.id]?.toFixed(2) ?? "—"}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SUTA Rates by State */}
      <div className="section">
        <div className="section-header">
          <h2>SUTA Rates by State</h2>
          <span className="section-count">{filteredSutaRates.length} states</span>
        </div>

        <div className="suta-filter">
          <label htmlFor="sutaSearch">Filter States</label>
          <input
            id="sutaSearch"
            type="text"
            placeholder="Search state..."
            value={sutaSearch}
            onChange={(e) => setSutaSearch(e.target.value)}
          />
        </div>

        <div className="suta-grid">
          {filteredSutaRates.map((suta) => (
            <div key={suta.state} className="suta-card">
              <div className="suta-state">{suta.state}</div>
              <div className="suta-rate-field">
                <label>Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="20"
                  value={editingRates[suta.id] ?? suta.ratePct}
                  onChange={(e) => handleSutaChange(suta.id, e.target.value)}
                />
              </div>
              <button
                type="button"
                className="suta-save-btn"
                disabled={
                  editingRates[suta.id] === savedRates[suta.id] ||
                  savingIds.has(suta.id)
                }
                onClick={() => handleSaveRate(suta.id)}
              >
                {savingIds.has(suta.id) ? "…" : "Save"}
              </button>
            </div>
          ))}
          {filteredSutaRates.length === 0 && (
            <div className="suta-empty">No states match your filter</div>
          )}
        </div>
      </div>

      {/* Selling Presets */}
      <div className="section">
        <div className="section-header">
          <div>
            <h2>Selling Presets</h2>
            <p className="section-subtitle">Configure preset margin suggestions for the selling calculator.</p>
          </div>
          <span className="section-count">
            {spLoading ? "Loading\u2026" : `${sellingPresets.filter((p) => p.isActive).length} active`}
          </span>
        </div>

        {spError && (
          <div className="sp-error">{spError}</div>
        )}

        <div className="table-section">
          <div className="table-wrap">
            <table className="burden-table sp-table">
              <thead>
                <tr>
                  <th>Margin %</th>
                  <th>OT Mult</th>
                  <th>DT Mult</th>
                  <th>Order</th>
                  <th>Active</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {spLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "28px 16px", color: "rgba(255,255,255,0.4)" }}>
                      Loading selling presets&hellip;
                    </td>
                  </tr>
                ) : sellingPresets.length === 0 && !spShowNew ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "28px 16px", color: "rgba(255,255,255,0.4)" }}>
                      No selling presets configured yet. Add presets to power the Selling Price Calculator.
                    </td>
                  </tr>
                ) : (
                  sellingPresets.map((preset) => {
                    const vals = spEditing[preset.id];
                    if (!vals) return null;
                    const otNum = parseFloat(vals.otMultiplier);
                    const dtDisplay = !isNaN(otNum) ? (otNum * 2).toFixed(2) : "\u2014";
                    const inactive = !vals.isActive;
                    return (
                      <tr key={preset.id} className={inactive ? "sp-row-inactive" : ""}>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="99.99"
                            className="rate-input sp-input"
                            value={vals.marginPct}
                            onChange={(e) => handleSpFieldChange(preset.id, "marginPct", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="rate-input sp-input"
                            value={vals.otMultiplier}
                            onChange={(e) => handleSpFieldChange(preset.id, "otMultiplier", e.target.value)}
                          />
                        </td>
                        <td>
                          <span className="sp-derived">{dtDisplay}</span>
                          <span className="sp-derived-label">derived</span>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            className="rate-input sp-input sp-input-sm"
                            value={vals.displayOrder}
                            onChange={(e) => handleSpFieldChange(preset.id, "displayOrder", e.target.value)}
                          />
                        </td>
                        <td>
                          <span className={`premium-badge ${vals.isActive ? "yes" : "no"}`}>
                            {vals.isActive ? "Yes" : "No"}
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="rate-input sp-input sp-input-label"
                            placeholder="optional"
                            value={vals.label}
                            onChange={(e) => handleSpFieldChange(preset.id, "label", e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="sp-actions">
                            <button
                              type="button"
                              className="btn-save-rate"
                              disabled={!spIsRowDirty(preset.id) || !spIsRowValid(vals) || spSavingIds.has(preset.id)}
                              onClick={() => handleSpSave(preset.id)}
                            >
                              {spSavingIds.has(preset.id) ? "\u2026" : "Save"}
                            </button>
                            {vals.isActive ? (
                              <button
                                type="button"
                                className="btn-deactivate"
                                disabled={spSavingIds.has(preset.id)}
                                onClick={() => handleSpDeactivate(preset.id)}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-reactivate"
                                disabled={spSavingIds.has(preset.id)}
                                onClick={() => handleSpReactivate(preset.id)}
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                {spShowNew && (
                  <tr className="sp-row-new">
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="99.99"
                        className="rate-input sp-input"
                        placeholder="20.00"
                        value={spNewDraft.marginPct}
                        onChange={(e) => setSpNewDraft((d) => ({ ...d, marginPct: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="rate-input sp-input"
                        value={spNewDraft.otMultiplier}
                        onChange={(e) => setSpNewDraft((d) => ({ ...d, otMultiplier: e.target.value }))}
                      />
                    </td>
                    <td>
                      <span className="sp-derived">
                        {!isNaN(parseFloat(spNewDraft.otMultiplier)) ? (parseFloat(spNewDraft.otMultiplier) * 2).toFixed(2) : "\u2014"}
                      </span>
                      <span className="sp-derived-label">derived</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="rate-input sp-input sp-input-sm"
                        value={spNewDraft.displayOrder}
                        onChange={(e) => setSpNewDraft((d) => ({ ...d, displayOrder: e.target.value }))}
                      />
                    </td>
                    <td>
                      <span className="premium-badge yes">Yes</span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="rate-input sp-input sp-input-label"
                        placeholder="optional"
                        value={spNewDraft.label}
                        onChange={(e) => setSpNewDraft((d) => ({ ...d, label: e.target.value }))}
                      />
                    </td>
                    <td>
                      <div className="sp-actions">
                        <button
                          type="button"
                          className="btn-save-rate"
                          disabled={!spIsNewValid() || spNewSaving}
                          onClick={handleSpCreate}
                        >
                          {spNewSaving ? "\u2026" : "Create"}
                        </button>
                        <button
                          type="button"
                          className="btn-deactivate"
                          onClick={() => setSpShowNew(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!spShowNew && !spLoading && (
            <div className="sp-add-row">
              <button type="button" className="sp-add-btn" onClick={() => setSpShowNew(true)}>
                + Add Preset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rules Summary */}
      <div className="section rules-section">
        <div className="section-header">
          <h2>Burden Model v1.0 Rules</h2>
        </div>
        <ul className="rules-list">
          <li>Burden is <strong>standard cost</strong> (not actual), used for pricing/margin/commissions.</li>
          <li>Burden outputs are <strong>REG/OT/DT</strong> (no blended rate).</li>
          <li>All burden inputs are <strong>% based</strong> (no flat fees in v1.0).</li>
          <li>All burden rolls into <strong>Gross Margin</strong>.</li>
          <li>FUTA + SUTA wage caps are <strong>intentionally ignored</strong> (simplification for v1.0).</li>
          <li><strong>WC</strong> = base-wage-only; does NOT follow OT/DT premium.</li>
          <li><strong>All others</strong> = total-wage; DO follow OT/DT premium.</li>
        </ul>
      </div>

      <style jsx>{`
        .burden-container {
          padding: 24px 40px 60px;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Header */
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .back-link {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          transition: color 0.15s ease;
          display: inline-block;
          margin-bottom: 12px;
        }

        .back-link:hover {
          color: #3b82f6;
        }

        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.55);
          margin: 0;
          max-width: 520px;
          line-height: 1.5;
        }

        .header-actions {
          padding-top: 28px;
        }

        .btn-preview {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: rgba(139, 92, 246, 0.15);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .btn-preview:hover {
          background: rgba(139, 92, 246, 0.25);
          border-color: rgba(139, 92, 246, 0.5);
        }

        /* Shell Notice */
        .shell-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #f59e0b;
        }

        .shell-icon {
          font-size: 16px;
        }

        /* Sections */
        .section {
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .section-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .section-count {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Table */
        .table-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          overflow: hidden;
        }

        .table-wrap {
          overflow-x: auto;
        }

        .burden-table {
          width: 100%;
          border-collapse: collapse;
        }

        .burden-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .burden-table th {
          padding: 14px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .burden-table td {
          padding: 14px 16px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          vertical-align: middle;
        }

        .burden-table tr:last-child td {
          border-bottom: none;
        }

        .burden-table tbody tr:hover {
          background: rgba(59, 130, 246, 0.04);
        }

        .wc-row {
          background: rgba(139, 92, 246, 0.04);
        }

        .name-col {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .component-name {
          font-weight: 500;
          color: #fff;
        }

        .component-notes {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
        }

        .scope-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .cell-basis {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7) !important;
        }

        .premium-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
        }

        .premium-badge.yes {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .premium-badge.no {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .gm-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .rate-cell-edit {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rate-input {
          width: 80px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 5px;
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          text-align: right;
        }

        .rate-input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .btn-save-rate {
          padding: 5px 11px;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease;
        }

        .btn-save-rate:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-save-rate:disabled {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.3);
          cursor: not-allowed;
        }

        .rate-value {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 500;
        }

        .rate-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .wc-link {
          font-size: 12px;
          color: #8b5cf6;
          text-decoration: none;
          font-weight: 500;
        }

        .wc-link:hover {
          text-decoration: underline;
        }

        /* SUTA Section */
        .suta-filter {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
          max-width: 220px;
        }

        .suta-filter label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .suta-filter input {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: #fff;

        }

        .suta-filter input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .suta-filter input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .suta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }

        .suta-card {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
        }

        .suta-state {
          font-size: 14px;
          font-weight: 700;
          color: #f59e0b;
          margin-bottom: 10px;
        }

        .suta-rate-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .suta-rate-field label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
        }

        .suta-rate-field input {
          width: 100%;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 5px;
          font-size: 13px;
          color: #fff;
          text-align: right;
        }

        .suta-rate-field input:focus {
          outline: none;
          border-color: #f59e0b;
        }

        .suta-save-btn {
          margin-top: 8px;
          width: 100%;
          padding: 5px 0;
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          background: #3b82f6;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .suta-save-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .suta-save-btn:disabled {
          background: rgba(255, 255, 255, 0.07);
          color: rgba(255, 255, 255, 0.28);
          cursor: not-allowed;
        }

        .suta-empty {
          grid-column: 1 / -1;
          text-align: center;
          padding: 24px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
        }

        /* Rules Section */
        .rules-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }

        .rules-section .section-header {
          margin-bottom: 12px;
        }

        .rules-list {
          margin: 0;
          padding: 0 0 0 20px;
        }

        .rules-list li {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.7;
          margin-bottom: 4px;
        }

        .rules-list li strong {
          color: #fff;
        }

        /* Selling Presets */
        .section-subtitle {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.45);
          margin: 4px 0 0;
          line-height: 1.4;
        }

        .sp-error {
          padding: 10px 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
          margin-bottom: 12px;
        }

        .sp-table .rate-input {
          width: 80px;
        }

        .sp-input-sm {
          width: 56px !important;
        }

        .sp-input-label {
          width: 120px !important;
          text-align: left !important;
        }

        .sp-derived {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
        }

        .sp-derived-label {
          display: block;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-top: 2px;
        }

        .sp-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-deactivate {
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 5px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .btn-deactivate:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
        }

        .btn-deactivate:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-reactivate {
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 5px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .btn-reactivate:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.4);
        }

        .btn-reactivate:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .sp-row-inactive td {
          opacity: 0.5;
        }

        .sp-row-inactive td:last-child {
          opacity: 1;
        }

        .sp-row-new {
          background: rgba(59, 130, 246, 0.06);
        }

        .sp-add-row {
          padding: 12px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        .sp-add-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.08);
          border: 1px dashed rgba(59, 130, 246, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .sp-add-btn:hover {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.5);
        }
      `}</style>
    </div>
  );
}



