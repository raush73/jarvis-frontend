"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

const LOCKED_BASIS_LABEL =
  "Trade labor gross margin (REG/OT/DT hours only; excludes per diem/bonus/travel/mob/demob/reimbursements/discounts/credits)";

type TierConfig = {
  minDays: number;
  maxDays: number | null;
  multiplierPct: number;
};

type CommissionConfig = {
  planId: string;
  basis: { type: string; label: string };
  defaultRatePct: number;
  tiers: TierConfig[];
};

type BackendPlan = {
  id: string;
  name: string;
  type: string;
  defaultRate: number;
  isActive: boolean;
  tiers: { id: string; minDays: number; maxDays: number | null; multiplier: number }[];
};

function backendToConfig(plan: BackendPlan): CommissionConfig {
  return {
    planId: plan.id,
    basis: {
      type: plan.type,
      label: LOCKED_BASIS_LABEL,
    },
    defaultRatePct: plan.defaultRate * 100,
    tiers: plan.tiers.map((t) => ({
      minDays: t.minDays,
      maxDays: t.maxDays,
      multiplierPct: t.multiplier * 100,
    })),
  };
}

function validateConfig(config: CommissionConfig): string | null {
  if (config.defaultRatePct < 0 || config.defaultRatePct > 100) {
    return "Default rate must be between 0 and 100";
  }

  for (let i = 0; i < config.tiers.length; i++) {
    const tier = config.tiers[i];
    if (tier.multiplierPct < 0 || tier.multiplierPct > 100) {
      return `Tier ${i + 1} multiplier must be between 0 and 100`;
    }
    if (tier.minDays < 0) {
      return `Tier ${i + 1} min days cannot be negative`;
    }
    if (tier.maxDays !== null && tier.maxDays < tier.minDays) {
      return `Tier ${i + 1} max days must be >= min days`;
    }
  }

  return null;
}

function formatTierRange(tier: TierConfig): string {
  if (tier.maxDays === null) {
    return `${tier.minDays}+ days`;
  }
  return `${tier.minDays}–${tier.maxDays} days`;
}

export default function AdminCommissionsPage() {
  const [config, setConfig] = useState<CommissionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const plan = await apiFetch<BackendPlan>("/commissions/plans/active");
        if (!alive) return;
        setConfig(backendToConfig(plan));
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load commission plan.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleTierMultiplierChange = (index: number, value: string) => {
    const numVal = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            tiers: prev.tiers.map((t, i) =>
              i === index ? { ...t, multiplierPct: numVal } : t
            ),
          }
        : prev
    );
  };

  const handleTierMinDaysChange = (index: number, value: string) => {
    const numVal = Math.max(0, parseInt(value) || 0);
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            tiers: prev.tiers.map((t, i) =>
              i === index ? { ...t, minDays: numVal } : t
            ),
          }
        : prev
    );
  };

  const handleTierMaxDaysChange = (index: number, value: string) => {
    const numVal = value === "" ? null : Math.max(0, parseInt(value) || 0);
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            tiers: prev.tiers.map((t, i) =>
              i === index ? { ...t, maxDays: numVal } : t
            ),
          }
        : prev
    );
  };

  const addTier = () => {
    if (!config) return;
    const lastTier = config.tiers[config.tiers.length - 1];
    const newMin = lastTier ? (lastTier.maxDays ?? lastTier.minDays) + 1 : 0;
    setConfig((prev) =>
      prev
        ? {
            ...prev,
            tiers: [
              ...prev.tiers,
              { minDays: newMin, maxDays: null, multiplierPct: 0 },
            ],
          }
        : prev
    );
  };

  const removeTier = (index: number) => {
    if (!config || config.tiers.length <= 1) return;
    setConfig((prev) =>
      prev
        ? { ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }
        : prev
    );
  };

  const handleDefaultRateChange = (value: string) => {
    const numVal = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setConfig((prev) => (prev ? { ...prev, defaultRatePct: numVal } : prev));
  };

  const handleSave = async () => {
    if (!config) return;
    setSaveError(null);
    setSaveStatus("saving");

    const sortedTiers = [...config.tiers].sort((a, b) => a.minDays - b.minDays);
    const validatedConfig = { ...config, tiers: sortedTiers };

    const validationError = validateConfig(validatedConfig);
    if (validationError) {
      setSaveError(validationError);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    try {
      const updated = await apiFetch<BackendPlan>(
        `/commissions/plans/${config.planId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            defaultRate: validatedConfig.defaultRatePct / 100,
            tiers: validatedConfig.tiers.map((t) => ({
              minDays: t.minDays,
              maxDays: t.maxDays,
              multiplier: t.multiplierPct / 100,
            })),
          }),
        }
      );
      setConfig(backendToConfig(updated));
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
        <div className="loading">Loading commission plan...</div>
        <style jsx>{`
          .commissions-admin-container {
            padding: 24px 40px 60px;
            max-width: 900px;
            margin: 0 auto;
          }
          .loading {
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="commissions-admin-container">
        <div className="page-header">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Commission Configuration</h1>
        </div>
        <div className="error-banner">{error ?? "No active commission plan found."}</div>
        <style jsx>{`
          .commissions-admin-container {
            padding: 24px 40px 60px;
            max-width: 900px;
            margin: 0 auto;
          }
          .back-link {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.5);
            text-decoration: none;
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
          .error-banner {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            padding: 16px 20px;
            border-radius: 8px;
            font-size: 14px;
            margin-top: 16px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="commissions-admin-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin" className="back-link">
            ← Back to Admin
          </Link>
          <h1>Commission Configuration</h1>
          <p className="subtitle">
            Configure commission tiers, rates, and salesperson overrides.
          </p>
        </div>
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

      {/* Commission Basis (locked) */}
      <section className="config-section">
        <div className="section-header">
          <h2>Commission Basis</h2>
          <span className="section-note locked-badge">Locked</span>
        </div>
        <div className="basis-display">
          <span className="basis-value">{config.basis.label}</span>
        </div>
      </section>

      {/* Default Rate */}
      <section className="config-section">
        <div className="section-header">
          <h2>Default Commission Rate</h2>
          <span className="section-note">
            Applied to all salespeople unless overridden
          </span>
        </div>
        <div className="rate-input-row">
          <div className="input-wrap">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={config.defaultRatePct}
              onChange={(e) => handleDefaultRateChange(e.target.value)}
            />
            <span className="input-suffix">%</span>
          </div>
          <span className="rate-desc">of gross margin</span>
        </div>
      </section>

      {/* Tiers Table */}
      <section className="config-section">
        <div className="section-header">
          <h2>Days-to-Paid Tier Multipliers</h2>
          <span className="section-note">
            Multipliers applied to the commission rate based on payment speed
          </span>
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
              {config.tiers.map((tier, index) => (
                <tr key={index}>
                  <td className="tier-input-cell">
                    <input
                      type="number"
                      min={0}
                      value={tier.minDays}
                      onChange={(e) =>
                        handleTierMinDaysChange(index, e.target.value)
                      }
                    />
                  </td>
                  <td className="tier-input-cell">
                    <input
                      type="number"
                      min={0}
                      value={tier.maxDays ?? ""}
                      placeholder="∞"
                      onChange={(e) =>
                        handleTierMaxDaysChange(index, e.target.value)
                      }
                    />
                  </td>
                  <td className="tier-range">{formatTierRange(tier)}</td>
                  <td className="tier-multiplier">
                    <div className="input-wrap">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={tier.multiplierPct}
                        onChange={(e) =>
                          handleTierMultiplierChange(index, e.target.value)
                        }
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </td>
                  <td className="tier-actions">
                    <button
                      className="remove-btn"
                      onClick={() => removeTier(index)}
                      disabled={config.tiers.length <= 1}
                      title="Remove tier"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="add-row-btn" onClick={addTier}>
          + Add Tier
        </button>
      </section>

      {/* Salesperson Overrides — deferred */}
      <section className="config-section">
        <div className="section-header">
          <h2>Salesperson Rate Overrides</h2>
          <span className="section-note deferred-badge">Coming Soon</span>
        </div>
        <div className="deferred-notice">
          Salesperson-specific rate overrides will be supported in a future release.
          All salespeople currently use the default rate above.
        </div>
      </section>

      {/* Save Footer */}
      <div className="save-footer">
        {saveStatus === "saved" && (
          <span className="save-status success">Configuration saved</span>
        )}
        {saveStatus === "error" && (
          <span className="save-status error">{saveError || "Failed to save"}</span>
        )}
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <style jsx>{`
        .commissions-admin-container {
          padding: 24px 40px 60px;
          max-width: 900px;
          margin: 0 auto;
        }

        .page-header {
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
        }

        .formula-box {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 12px;
          padding: 20px 24px;
          margin-bottom: 24px;
        }

        .formula-title {
          font-size: 12px;
          font-weight: 600;
          color: rgba(59, 130, 246, 0.9);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .formula-text {
          margin-bottom: 8px;
        }

        .formula-text code {
          font-size: 15px;
          font-family: var(--font-geist-mono), monospace;
          color: #fff;
          background: rgba(0, 0, 0, 0.2);
          padding: 6px 12px;
          border-radius: 6px;
          display: inline-block;
        }

        .formula-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.5;
        }

        .config-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .section-header {
          display: flex;
          align-items: baseline;
          gap: 16px;
          margin-bottom: 20px;
        }

        .section-header h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .section-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .locked-badge {
          color: rgba(245, 158, 11, 0.9);
          background: rgba(245, 158, 11, 0.1);
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        .deferred-badge {
          color: rgba(139, 92, 246, 0.9);
          background: rgba(139, 92, 246, 0.1);
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        .basis-display {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .basis-value {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          background: rgba(255, 255, 255, 0.05);
          padding: 12px 16px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          line-height: 1.5;
        }

        .rate-input-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .rate-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .input-wrap {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .input-wrap input {
          width: 80px;
          padding: 8px 10px;
          font-size: 14px;
          font-family: var(--font-geist-mono), monospace;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #fff;
          text-align: right;
        }

        .input-wrap input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .input-suffix {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .tiers-table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .tiers-table {
          width: 100%;
          border-collapse: collapse;
        }

        .tiers-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .tiers-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .tiers-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .tiers-table tr:last-child td {
          border-bottom: none;
        }

        .tier-input-cell input {
          width: 70px;
          padding: 6px 8px;
          font-size: 13px;
          font-family: var(--font-geist-mono), monospace;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 5px;
          color: #fff;
          text-align: right;
        }

        .tier-input-cell input:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .tier-input-cell input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .tier-range {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
        }

        .tier-multiplier .input-wrap input {
          width: 70px;
        }

        .tier-actions {
          text-align: right;
        }

        .remove-btn {
          width: 28px;
          height: 28px;
          padding: 0;
          font-size: 18px;
          line-height: 1;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .remove-btn:hover:not(:disabled) {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .remove-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .deferred-notice {
          padding: 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          line-height: 1.5;
        }

        .add-row-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(59, 130, 246, 0.9);
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-row-btn:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.35);
        }

        .add-row-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .save-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 16px;
          margin-top: 24px;
        }

        .save-status {
          font-size: 13px;
          padding: 6px 12px;
          border-radius: 6px;
        }

        .save-status.success {
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .save-status.error {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .save-btn {
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: rgba(59, 130, 246, 0.8);
          border: 1px solid rgba(59, 130, 246, 0.6);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .save-btn:hover:not(:disabled) {
          background: rgba(59, 130, 246, 1);
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
