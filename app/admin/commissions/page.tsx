"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// localStorage key
const CONFIG_KEY = "jarvisPrimeCommissionConfig.v1";

// Locked basis label
const LOCKED_BASIS_LABEL =
  "Trade labor gross margin (REG/OT/DT hours only; excludes per diem/bonus/travel/mob/demob/reimbursements/discounts/credits)";

// Types
type TierConfig = {
  minDays: number;
  maxDays: number | null; // null = unlimited
  multiplierPct: number;
};

type CommissionConfig = {
  basis: {
    type: string;
    label: string;
  };
  defaultRatePct: number;
  tiers: TierConfig[];
  salespersonOverrides: Record<string, number>;
};

// Default configuration (locked rules)
const DEFAULT_CONFIG: CommissionConfig = {
  basis: {
    type: "gross_margin",
    label: LOCKED_BASIS_LABEL,
  },
  defaultRatePct: 10,
  tiers: [
    { minDays: 0, maxDays: 40, multiplierPct: 100 },
    { minDays: 41, maxDays: 60, multiplierPct: 75 },
    { minDays: 61, maxDays: 90, multiplierPct: 50 },
    { minDays: 91, maxDays: null, multiplierPct: 0 },
  ],
  salespersonOverrides: {},
};

function loadConfig(): CommissionConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (
        parsed &&
        typeof parsed.defaultRatePct === "number" &&
        Array.isArray(parsed.tiers) &&
        parsed.basis &&
        typeof parsed.salespersonOverrides === "object"
      ) {
        return parsed as CommissionConfig;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: CommissionConfig): boolean {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

function validateConfig(config: CommissionConfig): string | null {
  // Validate defaultRatePct
  if (config.defaultRatePct < 0 || config.defaultRatePct > 100) {
    return "Default rate must be between 0 and 100";
  }

  // Validate tiers
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

  // Validate overrides
  for (const [name, pct] of Object.entries(config.salespersonOverrides)) {
    if (pct < 0 || pct > 100) {
      return `Override for "${name}" must be between 0 and 100`;
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
  const [config, setConfig] = useState<CommissionConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New override inputs
  const [newOverrideName, setNewOverrideName] = useState("");
  const [newOverridePct, setNewOverridePct] = useState(10);

  // Load config on mount
  useEffect(() => {
    const savedConfig = loadConfig();
    setConfig(savedConfig);
    setLoaded(true);
  }, []);

  const handleTierMultiplierChange = (index: number, value: string) => {
    const numVal = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) =>
        i === index ? { ...t, multiplierPct: numVal } : t
      ),
    }));
  };

  const handleTierMinDaysChange = (index: number, value: string) => {
    const numVal = Math.max(0, parseInt(value) || 0);
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) =>
        i === index ? { ...t, minDays: numVal } : t
      ),
    }));
  };

  const handleTierMaxDaysChange = (index: number, value: string) => {
    const numVal = value === "" ? null : Math.max(0, parseInt(value) || 0);
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t, i) =>
        i === index ? { ...t, maxDays: numVal } : t
      ),
    }));
  };

  const addTier = () => {
    const lastTier = config.tiers[config.tiers.length - 1];
    const newMin = lastTier ? (lastTier.maxDays ?? lastTier.minDays) + 1 : 0;
    setConfig((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        { minDays: newMin, maxDays: null, multiplierPct: 0 },
      ],
    }));
  };

  const removeTier = (index: number) => {
    if (config.tiers.length <= 1) return;
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }));
  };

  const handleDefaultRateChange = (value: string) => {
    const numVal = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setConfig((prev) => ({ ...prev, defaultRatePct: numVal }));
  };

  const addOverride = () => {
    const name = newOverrideName.trim();
    if (!name) return;
    setConfig((prev) => ({
      ...prev,
      salespersonOverrides: {
        ...prev.salespersonOverrides,
        [name]: Math.max(0, Math.min(100, newOverridePct)),
      },
    }));
    setNewOverrideName("");
    setNewOverridePct(10);
  };

  const updateOverridePct = (name: string, value: string) => {
    const numVal = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setConfig((prev) => ({
      ...prev,
      salespersonOverrides: {
        ...prev.salespersonOverrides,
        [name]: numVal,
      },
    }));
  };

  const removeOverride = (name: string) => {
    setConfig((prev) => {
      const newOverrides = { ...prev.salespersonOverrides };
      delete newOverrides[name];
      return { ...prev, salespersonOverrides: newOverrides };
    });
  };

  const handleSave = () => {
    setErrorMsg(null);
    setSaveStatus("saving");

    // Sort tiers by minDays
    const sortedTiers = [...config.tiers].sort((a, b) => a.minDays - b.minDays);
    const validatedConfig = { ...config, tiers: sortedTiers };

    const validationError = validateConfig(validatedConfig);
    if (validationError) {
      setErrorMsg(validationError);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    if (saveConfig(validatedConfig)) {
      setConfig(validatedConfig);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } else {
      setErrorMsg("Failed to save to localStorage");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const overrideEntries = Object.entries(config.salespersonOverrides);

  if (!loaded) {
    return (
      <div className="commissions-admin-container">
        <div className="loading">Loading configuration...</div>
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

      {/* Salesperson Overrides */}
      <section className="config-section">
        <div className="section-header">
          <h2>Salesperson Rate Overrides</h2>
          <span className="section-note">
            Custom rates for specific salespeople (e.g., Steve may differ)
          </span>
        </div>

        {overrideEntries.length > 0 ? (
          <div className="overrides-table-wrap">
            <table className="overrides-table">
              <thead>
                <tr>
                  <th>Salesperson Name</th>
                  <th>Override Rate</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {overrideEntries.map(([name, pct]) => (
                  <tr key={name}>
                    <td className="override-name-cell">
                      <span className="override-name">{name}</span>
                    </td>
                    <td className="override-rate-cell">
                      <div className="input-wrap">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={pct}
                          onChange={(e) => updateOverridePct(name, e.target.value)}
                        />
                        <span className="input-suffix">%</span>
                      </div>
                    </td>
                    <td className="override-actions">
                      <button
                        className="remove-btn"
                        onClick={() => removeOverride(name)}
                        title="Remove override"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-overrides">
            No salesperson overrides configured. All salespeople use the default rate.
          </div>
        )}

        <div className="add-override-row">
          <input
            type="text"
            placeholder="Salesperson name"
            value={newOverrideName}
            onChange={(e) => setNewOverrideName(e.target.value)}
            className="new-override-name"
          />
          <div className="input-wrap">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={newOverridePct}
              onChange={(e) => setNewOverridePct(parseFloat(e.target.value) || 0)}
              className="new-override-pct"
            />
            <span className="input-suffix">%</span>
          </div>
          <button
            className="add-row-btn"
            onClick={addOverride}
            disabled={!newOverrideName.trim()}
          >
            + Add Override
          </button>
        </div>
      </section>

      {/* Save Footer */}
      <div className="save-footer">
        {saveStatus === "saved" && (
          <span className="save-status success">✓ Configuration saved</span>
        )}
        {saveStatus === "error" && (
          <span className="save-status error">{errorMsg || "Failed to save"}</span>
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

        /* Formula Box */
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

        /* Config Sections */
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

        /* Basis Display */
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

        /* Rate Input */
        .rate-input-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .rate-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Input Wrap */
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

        /* Tiers Table */
        .tiers-table-wrap,
        .overrides-table-wrap {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .tiers-table,
        .overrides-table {
          width: 100%;
          border-collapse: collapse;
        }

        .tiers-table thead,
        .overrides-table thead {
          background: rgba(255, 255, 255, 0.03);
        }

        .tiers-table th,
        .overrides-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .tiers-table td,
        .overrides-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .tiers-table tr:last-child td,
        .overrides-table tr:last-child td {
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

        .tier-actions,
        .override-actions {
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

        /* Overrides */
        .override-name {
          font-weight: 500;
          color: #fff;
        }

        .override-rate-cell .input-wrap input {
          width: 70px;
        }

        .no-overrides {
          padding: 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .add-override-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .new-override-name {
          width: 180px;
          padding: 8px 12px;
          font-size: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #fff;
        }

        .new-override-name:focus {
          outline: none;
          border-color: rgba(59, 130, 246, 0.5);
        }

        .new-override-name::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .new-override-pct {
          width: 70px;
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

        /* Save Footer */
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
