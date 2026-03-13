"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

const LOCKED_BASIS_LABEL =
  "Trade labor gross margin (REG/OT/DT hours only; excludes per diem/bonus/travel/mob/demob/reimbursements/discounts/credits)";

type TierConfig = {
  minDays: number;
  maxDays: number | null;
  multiplierPct: number;
};

type BackendPlan = {
  id: string;
  name: string;
  type: string;
  defaultRate: number;
  isActive: boolean;
  isDefault: boolean;
  tiers: { id: string; minDays: number; maxDays: number | null; multiplier: number }[];
};

type PlanEditorState = {
  planId: string;
  name: string;
  defaultRatePct: number;
  tiers: TierConfig[];
  isDefault: boolean;
};

function planToEditor(plan: BackendPlan): PlanEditorState {
  return {
    planId: plan.id,
    name: plan.name,
    defaultRatePct: plan.defaultRate * 100,
    isDefault: plan.isDefault,
    tiers: plan.tiers.map((t) => ({
      minDays: t.minDays,
      maxDays: t.maxDays,
      multiplierPct: t.multiplier * 100,
    })),
  };
}

function validateEditor(state: PlanEditorState): string | null {
  if (!state.name.trim()) return "Plan name is required";
  if (state.defaultRatePct < 0 || state.defaultRatePct > 100)
    return "Default rate must be between 0 and 100";

  for (let i = 0; i < state.tiers.length; i++) {
    const tier = state.tiers[i];
    if (tier.multiplierPct < 0 || tier.multiplierPct > 100)
      return `Tier ${i + 1} multiplier must be between 0 and 100`;
    if (tier.minDays < 0) return `Tier ${i + 1} min days cannot be negative`;
    if (tier.maxDays !== null && tier.maxDays < tier.minDays)
      return `Tier ${i + 1} max days must be >= min days`;
  }
  return null;
}

function formatTierRange(tier: TierConfig): string {
  if (tier.maxDays === null) return `${tier.minDays}+ days`;
  return `${tier.minDays}\u2013${tier.maxDays} days`;
}

export default function AdminCommissionsPage() {
  const [plans, setPlans] = useState<BackendPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editor, setEditor] = useState<PlanEditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadPlans = useCallback(async () => {
    setError(null);
    try {
      const list = await apiFetch<BackendPlan[]>("/commissions/plans");
      setPlans(list);
      return list;
    } catch (e: any) {
      setError(e?.message ?? "Failed to load commission plans.");
      return [];
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const list = await loadPlans();
      if (!alive) return;
      if (list.length > 0) {
        const defaultPlan = list.find((p) => p.isDefault) ?? list[0];
        setSelectedPlanId(defaultPlan.id);
        setEditor(planToEditor(defaultPlan));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [loadPlans]);

  const selectPlan = (plan: BackendPlan) => {
    setSelectedPlanId(plan.id);
    setEditor(planToEditor(plan));
    setSaveStatus("idle");
    setSaveError(null);
    setShowNewPlanForm(false);
  };

  const handleCreatePlan = async () => {
    const trimmed = newPlanName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await apiFetch<BackendPlan>("/commissions/plans", {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          defaultRate: 0.10,
          tiers: [
            { minDays: 0, maxDays: 35, multiplier: 1.0 },
            { minDays: 36, maxDays: 60, multiplier: 0.75 },
            { minDays: 61, maxDays: 90, multiplier: 0.5 },
            { minDays: 91, maxDays: null, multiplier: 0.0 },
          ],
        }),
      });
      const list = await loadPlans();
      const fresh = list.find((p) => p.id === created.id);
      if (fresh) selectPlan(fresh);
      setNewPlanName("");
      setShowNewPlanForm(false);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to create plan.");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setCreating(false);
    }
  };

  const handleSetDefault = async (planId: string) => {
    try {
      await apiFetch(`/commissions/plans/${planId}/default`, { method: "PATCH" });
      const list = await loadPlans();
      const fresh = list.find((p) => p.id === planId);
      if (fresh) {
        setSelectedPlanId(fresh.id);
        setEditor(planToEditor(fresh));
      }
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to set default plan.");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const handleTierChange = (index: number, field: string, value: string) => {
    setEditor((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tiers: prev.tiers.map((t, i) => {
          if (i !== index) return t;
          if (field === "multiplierPct")
            return { ...t, multiplierPct: Math.max(0, Math.min(100, parseFloat(value) || 0)) };
          if (field === "minDays")
            return { ...t, minDays: Math.max(0, parseInt(value) || 0) };
          if (field === "maxDays")
            return { ...t, maxDays: value === "" ? null : Math.max(0, parseInt(value) || 0) };
          return t;
        }),
      };
    });
  };

  const addTier = () => {
    if (!editor) return;
    const lastTier = editor.tiers[editor.tiers.length - 1];
    const newMin = lastTier ? (lastTier.maxDays ?? lastTier.minDays) + 1 : 0;
    setEditor((prev) =>
      prev ? { ...prev, tiers: [...prev.tiers, { minDays: newMin, maxDays: null, multiplierPct: 0 }] } : prev
    );
  };

  const removeTier = (index: number) => {
    if (!editor || editor.tiers.length <= 1) return;
    setEditor((prev) =>
      prev ? { ...prev, tiers: prev.tiers.filter((_, i) => i !== index) } : prev
    );
  };

  const handleSave = async () => {
    if (!editor) return;
    setSaveError(null);
    setSaveStatus("saving");

    const sorted = { ...editor, tiers: [...editor.tiers].sort((a, b) => a.minDays - b.minDays) };
    const validationError = validateEditor(sorted);
    if (validationError) {
      setSaveError(validationError);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    try {
      await apiFetch<BackendPlan>(`/commissions/plans/${editor.planId}`, {
        method: "PATCH",
        body: JSON.stringify({
          defaultRate: sorted.defaultRatePct / 100,
          tiers: sorted.tiers.map((t) => ({
            minDays: t.minDays,
            maxDays: t.maxDays,
            multiplier: t.multiplierPct / 100,
          })),
        }),
      });
      const list = await loadPlans();
      const fresh = list.find((p) => p.id === editor.planId);
      if (fresh) setEditor(planToEditor(fresh));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save commission plan.");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  if (loading) {
    return (
      <div className="commissions-admin-container">
        <div className="loading">Loading commission plans...</div>
        <style jsx>{`
          .commissions-admin-container { padding: 24px 40px 60px; max-width: 1100px; margin: 0 auto; }
          .loading { color: rgba(255,255,255,0.5); font-size: 14px; }
        `}</style>
      </div>
    );
  }

  if (error && plans.length === 0) {
    return (
      <div className="commissions-admin-container">
        <div className="page-header">
          <Link href="/admin" className="back-link">← Back to Admin</Link>
          <h1>Commission Plans</h1>
        </div>
        <div className="error-banner">{error}</div>
        <style jsx>{`
          .commissions-admin-container { padding: 24px 40px 60px; max-width: 1100px; margin: 0 auto; }
          .back-link { font-size: 13px; color: rgba(255,255,255,0.5); text-decoration: none; display: inline-block; margin-bottom: 12px; }
          .back-link:hover { color: #3b82f6; }
          h1 { font-size: 28px; font-weight: 600; color: #fff; margin: 0 0 8px; letter-spacing: -0.5px; }
          .error-banner { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 16px 20px; border-radius: 8px; font-size: 14px; margin-top: 16px; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="commissions-admin-container">
      <div className="page-header">
        <Link href="/admin" className="back-link">← Back to Admin</Link>
        <h1>Commission Plans</h1>
        <p className="subtitle">
          Manage reusable commission plan templates. The default plan applies to all job orders unless overridden.
        </p>
      </div>

      {/* Formula Explainer */}
      <div className="formula-box">
        <div className="formula-title">Commission Formula</div>
        <div className="formula-text">
          <code>Earned = Gross Margin × Rate% × Tier Multiplier%</code>
        </div>
        <div className="formula-desc">
          The tier multiplier is determined by days-to-paid from invoice issue to payment.
          The rate is the default rate or a salesperson-specific override.
        </div>
      </div>

      <div className="plans-layout">
        {/* Plan Sidebar */}
        <div className="plans-sidebar">
          <div className="sidebar-header">
            <h2>Plans</h2>
            <button className="new-plan-btn" onClick={() => setShowNewPlanForm(true)}>+ New</button>
          </div>

          {showNewPlanForm && (
            <div className="new-plan-form">
              <input
                type="text"
                placeholder="Plan name..."
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlan()}
                autoFocus
              />
              <div className="new-plan-actions">
                <button className="create-btn" onClick={handleCreatePlan} disabled={creating || !newPlanName.trim()}>
                  {creating ? "Creating..." : "Create"}
                </button>
                <button className="cancel-btn" onClick={() => { setShowNewPlanForm(false); setNewPlanName(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="plan-list">
            {plans.map((plan) => (
              <button
                key={plan.id}
                className={`plan-item${plan.id === selectedPlanId ? " selected" : ""}`}
                onClick={() => selectPlan(plan)}
              >
                <span className="plan-name">{plan.name}</span>
                {plan.isDefault && <span className="default-badge">Default</span>}
              </button>
            ))}
            {plans.length === 0 && (
              <div className="empty-plans">No commission plans found.</div>
            )}
          </div>
        </div>

        {/* Plan Editor */}
        <div className="plan-editor">
          {editor ? (
            <>
              <div className="editor-header">
                <h2>{editor.name}</h2>
                {!editor.isDefault && (
                  <button className="set-default-btn" onClick={() => handleSetDefault(editor.planId)}>
                    Set as Default
                  </button>
                )}
                {editor.isDefault && <span className="current-default-badge">Global Default</span>}
              </div>

              {/* Commission Basis (locked) */}
              <section className="config-section">
                <div className="section-header">
                  <h3>Commission Basis</h3>
                  <span className="locked-badge">Locked</span>
                </div>
                <div className="basis-display">
                  <span className="basis-value">{LOCKED_BASIS_LABEL}</span>
                </div>
              </section>

              {/* Default Rate */}
              <section className="config-section">
                <div className="section-header">
                  <h3>Default Commission Rate</h3>
                  <span className="section-note">Applied to all salespeople unless overridden</span>
                </div>
                <div className="rate-input-row">
                  <div className="input-wrap">
                    <input
                      type="number"
                      min={0} max={100} step={0.5}
                      value={editor.defaultRatePct}
                      onChange={(e) => setEditor((prev) => prev ? { ...prev, defaultRatePct: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) } : prev)}
                    />
                    <span className="input-suffix">%</span>
                  </div>
                  <span className="rate-desc">of gross margin</span>
                </div>
              </section>

              {/* Tiers Table */}
              <section className="config-section">
                <div className="section-header">
                  <h3>Days-to-Paid Tier Multipliers</h3>
                  <span className="section-note">Multipliers applied based on payment speed</span>
                </div>
                <div className="tiers-table-wrap">
                  <table className="tiers-table">
                    <thead>
                      <tr>
                        <th>Min Days</th>
                        <th>Max Days</th>
                        <th>Range</th>
                        <th>Multiplier</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editor.tiers.map((tier, index) => (
                        <tr key={index}>
                          <td className="tier-input-cell">
                            <input type="number" min={0} value={tier.minDays}
                              onChange={(e) => handleTierChange(index, "minDays", e.target.value)} />
                          </td>
                          <td className="tier-input-cell">
                            <input type="number" min={0} value={tier.maxDays ?? ""} placeholder="∞"
                              onChange={(e) => handleTierChange(index, "maxDays", e.target.value)} />
                          </td>
                          <td className="tier-range">{formatTierRange(tier)}</td>
                          <td className="tier-multiplier">
                            <div className="input-wrap">
                              <input type="number" min={0} max={100} step={1} value={tier.multiplierPct}
                                onChange={(e) => handleTierChange(index, "multiplierPct", e.target.value)} />
                              <span className="input-suffix">%</span>
                            </div>
                          </td>
                          <td className="tier-actions">
                            <button className="remove-btn" onClick={() => removeTier(index)}
                              disabled={editor.tiers.length <= 1} title="Remove tier">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="add-row-btn" onClick={addTier}>+ Add Tier</button>
              </section>

              {/* Save Footer */}
              <div className="save-footer">
                {saveStatus === "saved" && <span className="save-status success">Configuration saved</span>}
                {saveStatus === "error" && <span className="save-status error">{saveError || "Failed to save"}</span>}
                <button className="save-btn" onClick={handleSave} disabled={saveStatus === "saving"}>
                  {saveStatus === "saving" ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          ) : (
            <div className="no-plan-selected">Select a plan from the list or create a new one.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .commissions-admin-container {
          padding: 24px 40px 60px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .page-header { margin-bottom: 24px; }
        .back-link {
          font-size: 13px; color: rgba(255,255,255,0.5); text-decoration: none;
          transition: color 0.15s ease; display: inline-block; margin-bottom: 12px;
        }
        .back-link:hover { color: #3b82f6; }
        h1 { font-size: 28px; font-weight: 600; color: #fff; margin: 0 0 8px; letter-spacing: -0.5px; }
        .subtitle { font-size: 14px; color: rgba(255,255,255,0.55); margin: 0; }

        .formula-box {
          background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2);
          border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;
        }
        .formula-title {
          font-size: 12px; font-weight: 600; color: rgba(59,130,246,0.9);
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
        }
        .formula-text { margin-bottom: 8px; }
        .formula-text code {
          font-size: 15px; font-family: var(--font-geist-mono), monospace; color: #fff;
          background: rgba(0,0,0,0.2); padding: 6px 12px; border-radius: 6px; display: inline-block;
        }
        .formula-desc { font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.5; }

        /* Layout */
        .plans-layout { display: flex; gap: 24px; align-items: flex-start; }

        /* Sidebar */
        .plans-sidebar {
          width: 260px; min-width: 260px;
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 16px; position: sticky; top: 24px;
        }
        .sidebar-header {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
        }
        .sidebar-header h2 { font-size: 14px; font-weight: 600; color: #fff; margin: 0; }
        .new-plan-btn {
          padding: 4px 12px; font-size: 12px; font-weight: 600;
          color: rgba(59,130,246,0.9); background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2); border-radius: 6px; cursor: pointer;
          transition: all 0.15s ease;
        }
        .new-plan-btn:hover { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.35); }

        .new-plan-form {
          margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
        }
        .new-plan-form input {
          width: 100%; padding: 8px 10px; font-size: 13px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px; color: #fff; margin-bottom: 8px; box-sizing: border-box;
        }
        .new-plan-form input:focus { outline: none; border-color: rgba(59,130,246,0.5); }
        .new-plan-actions { display: flex; gap: 8px; }
        .create-btn {
          padding: 6px 14px; font-size: 12px; font-weight: 600; color: #fff;
          background: rgba(59,130,246,0.8); border: 1px solid rgba(59,130,246,0.6);
          border-radius: 6px; cursor: pointer; transition: all 0.15s ease;
        }
        .create-btn:hover:not(:disabled) { background: rgba(59,130,246,1); }
        .create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cancel-btn {
          padding: 6px 14px; font-size: 12px; font-weight: 500;
          color: rgba(255,255,255,0.5); background: transparent;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
          cursor: pointer; transition: all 0.15s ease;
        }
        .cancel-btn:hover { color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.2); }

        .plan-list { display: flex; flex-direction: column; gap: 4px; }
        .plan-item {
          display: flex; align-items: center; gap: 8px; padding: 10px 12px;
          background: transparent; border: 1px solid transparent; border-radius: 8px;
          color: rgba(255,255,255,0.7); font-size: 13px; cursor: pointer;
          transition: all 0.15s ease; text-align: left; width: 100%;
        }
        .plan-item:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
        .plan-item.selected {
          background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); color: #fff;
        }
        .plan-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .default-badge {
          font-size: 10px; font-weight: 600; color: rgba(34,197,94,0.9);
          background: rgba(34,197,94,0.1); padding: 2px 6px; border-radius: 4px;
          text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0;
        }
        .empty-plans { color: rgba(255,255,255,0.3); font-size: 13px; padding: 16px 0; text-align: center; }

        /* Editor */
        .plan-editor { flex: 1; min-width: 0; }
        .editor-header {
          display: flex; align-items: center; gap: 16px; margin-bottom: 20px;
        }
        .editor-header h2 { font-size: 20px; font-weight: 600; color: #fff; margin: 0; flex: 1; }
        .set-default-btn {
          padding: 6px 14px; font-size: 12px; font-weight: 600;
          color: rgba(245,158,11,0.9); background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.2); border-radius: 6px;
          cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
        }
        .set-default-btn:hover { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.35); }
        .current-default-badge {
          font-size: 11px; font-weight: 600; color: rgba(34,197,94,0.9);
          background: rgba(34,197,94,0.1); padding: 4px 10px; border-radius: 6px;
          white-space: nowrap;
        }

        .config-section {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; padding: 24px; margin-bottom: 20px;
        }
        .section-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 20px; }
        .section-header h3 { font-size: 16px; font-weight: 600; color: #fff; margin: 0; }
        .section-note { font-size: 12px; color: rgba(255,255,255,0.4); }
        .locked-badge {
          font-size: 12px; color: rgba(245,158,11,0.9); background: rgba(245,158,11,0.1);
          padding: 2px 8px; border-radius: 4px; font-weight: 500;
        }

        .basis-display { display: flex; align-items: center; gap: 12px; }
        .basis-value {
          font-size: 13px; color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.1); line-height: 1.5;
        }

        .rate-input-row { display: flex; align-items: center; gap: 12px; }
        .rate-desc { font-size: 13px; color: rgba(255,255,255,0.5); }
        .input-wrap { display: flex; align-items: center; gap: 4px; }
        .input-wrap input {
          width: 80px; padding: 8px 10px; font-size: 14px;
          font-family: var(--font-geist-mono), monospace;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px; color: #fff; text-align: right;
        }
        .input-wrap input:focus { outline: none; border-color: rgba(59,130,246,0.5); }
        .input-suffix { font-size: 13px; color: rgba(255,255,255,0.5); }

        .tiers-table-wrap {
          background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px; overflow: hidden; margin-bottom: 12px;
        }
        .tiers-table { width: 100%; border-collapse: collapse; }
        .tiers-table thead { background: rgba(255,255,255,0.03); }
        .tiers-table th {
          padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600;
          color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .tiers-table td {
          padding: 12px 16px; font-size: 14px; color: rgba(255,255,255,0.85);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .tiers-table tr:last-child td { border-bottom: none; }
        .tier-input-cell input {
          width: 70px; padding: 6px 8px; font-size: 13px;
          font-family: var(--font-geist-mono), monospace;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
          border-radius: 5px; color: #fff; text-align: right;
        }
        .tier-input-cell input:focus { outline: none; border-color: rgba(59,130,246,0.5); }
        .tier-input-cell input::placeholder { color: rgba(255,255,255,0.3); }
        .tier-range { font-size: 12px; color: rgba(255,255,255,0.5); font-style: italic; }
        .tier-multiplier .input-wrap input { width: 70px; }
        .tier-actions { text-align: right; }
        .remove-btn {
          width: 28px; height: 28px; padding: 0; font-size: 18px; line-height: 1;
          color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
          cursor: pointer; transition: all 0.15s ease;
        }
        .remove-btn:hover:not(:disabled) {
          color: #ef4444; background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3);
        }
        .remove-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .add-row-btn {
          padding: 8px 16px; font-size: 13px; font-weight: 500;
          color: rgba(59,130,246,0.9); background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2); border-radius: 6px;
          cursor: pointer; transition: all 0.15s ease;
        }
        .add-row-btn:hover:not(:disabled) { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.35); }

        .save-footer { display: flex; align-items: center; justify-content: flex-end; gap: 16px; margin-top: 24px; }
        .save-status { font-size: 13px; padding: 6px 12px; border-radius: 6px; }
        .save-status.success {
          color: #22c55e; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.2);
        }
        .save-status.error {
          color: #ef4444; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2);
        }
        .save-btn {
          padding: 10px 24px; font-size: 14px; font-weight: 600; color: #fff;
          background: rgba(59,130,246,0.8); border: 1px solid rgba(59,130,246,0.6);
          border-radius: 8px; cursor: pointer; transition: all 0.15s ease;
        }
        .save-btn:hover:not(:disabled) { background: rgba(59,130,246,1); }
        .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .no-plan-selected {
          color: rgba(255,255,255,0.4); font-size: 14px; text-align: center; padding: 80px 20px;
          background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08);
          border-radius: 12px;
        }
      `}</style>
    </div>
  );
}
