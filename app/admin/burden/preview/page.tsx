"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// Mock data (same as Burden Settings for consistency)
const STATES = ["KY", "TN", "IN", "OH", "TX", "CA", "FL", "GA", "NC", "PA", "IL", "MI"] as const;
const TRADES = ["Millwright", "Welder", "Pipefitter", "Electrician", "Crane Operator", "Ironworker"] as const;

// Mock burden rates (v1.0)
const MOCK_GLOBAL_BURDENS = {
  fica: 7.65,
  futa: 0.6,
  admin: 2.5,
  gl: 1.5,
  bank: 0.75,
};

// Mock SUTA rates by state
const MOCK_SUTA: Record<string, number> = {
  KY: 2.7,
  TN: 2.5,
  IN: 2.5,
  OH: 2.7,
  TX: 2.7,
  CA: 3.4,
  FL: 2.7,
  GA: 2.64,
  NC: 1.0,
  PA: 3.6,
  IL: 3.175,
  MI: 2.7,
};

// Mock WC rates by State×Trade (subset)
const MOCK_WC: Record<string, Record<string, number>> = {
  KY: { Millwright: 4.25, Welder: 5.10, Pipefitter: 4.75, Electrician: 3.85, "Crane Operator": 5.50, Ironworker: 6.20 },
  TN: { Millwright: 3.90, Welder: 4.65, Pipefitter: 4.30, Electrician: 3.50, "Crane Operator": 5.20, Ironworker: 5.80 },
  IN: { Millwright: 4.00, Welder: 4.85, Pipefitter: 4.50, Electrician: 3.65, "Crane Operator": 5.30, Ironworker: 5.90 },
  OH: { Millwright: 4.40, Welder: 5.25, Pipefitter: 4.90, Electrician: 3.95, "Crane Operator": 5.60, Ironworker: 6.40 },
  TX: { Millwright: 3.80, Welder: 4.55, Pipefitter: 4.20, Electrician: 3.40, "Crane Operator": 5.00, Ironworker: 5.60 },
  CA: { Millwright: 5.00, Welder: 5.80, Pipefitter: 5.40, Electrician: 4.50, "Crane Operator": 6.20, Ironworker: 7.00 },
  FL: { Millwright: 3.70, Welder: 4.45, Pipefitter: 4.10, Electrician: 3.30, "Crane Operator": 4.90, Ironworker: 5.50 },
  GA: { Millwright: 3.85, Welder: 4.60, Pipefitter: 4.25, Electrician: 3.45, "Crane Operator": 5.10, Ironworker: 5.70 },
  NC: { Millwright: 3.75, Welder: 4.50, Pipefitter: 4.15, Electrician: 3.35, "Crane Operator": 4.95, Ironworker: 5.55 },
  PA: { Millwright: 4.60, Welder: 5.45, Pipefitter: 5.10, Electrician: 4.15, "Crane Operator": 5.80, Ironworker: 6.60 },
  IL: { Millwright: 4.30, Welder: 5.15, Pipefitter: 4.80, Electrician: 3.90, "Crane Operator": 5.50, Ironworker: 6.30 },
  MI: { Millwright: 4.20, Welder: 5.05, Pipefitter: 4.70, Electrician: 3.80, "Crane Operator": 5.40, Ironworker: 6.10 },
};

type CalculationResult = {
  reg: number;
  ot: number;
  dt: number;
  breakdown: {
    payRate: number;
    totalWageBurdenPct: number;
    wcPct: number;
    regMultiplier: number;
    otMultiplier: number;
    dtMultiplier: number;
  };
};

export default function BurdenPreviewPage() {
  // Input state
  const [state, setState] = useState<string>("");
  const [trade, setTrade] = useState<string>("");
  const [payRate, setPayRate] = useState<string>("");

  // Calculate burden (mocked calculation per v1.0 rules)
  const result = useMemo<CalculationResult | null>(() => {
    if (!state || !trade || !payRate) return null;

    const baseRate = parseFloat(payRate);
    if (isNaN(baseRate) || baseRate <= 0) return null;

    // Get rates
    const sutaPct = MOCK_SUTA[state] ?? 2.7;
    const wcPct = MOCK_WC[state]?.[trade] ?? 4.0;
    const globalBurdenPct =
      MOCK_GLOBAL_BURDENS.fica +
      MOCK_GLOBAL_BURDENS.futa +
      MOCK_GLOBAL_BURDENS.admin +
      MOCK_GLOBAL_BURDENS.gl +
      MOCK_GLOBAL_BURDENS.bank;

    // Total-wage burden (follows OT/DT premium): FICA + FUTA + SUTA + Admin + GL + Bank
    const totalWageBurdenPct = globalBurdenPct + sutaPct;

    // v1.0 Burden Formulas:
    // REG = payRate * (1 + totalWageBurden% + WC%)
    // OT = (payRate * 1.5) * (1 + totalWageBurden%) + (payRate * WC%)  // WC base-only
    // DT = (payRate * 2.0) * (1 + totalWageBurden%) + (payRate * WC%)  // WC base-only

    const totalWageFactor = 1 + totalWageBurdenPct / 100;
    const wcFactor = wcPct / 100;

    const reg = baseRate * (totalWageFactor + wcFactor);
    const ot = baseRate * 1.5 * totalWageFactor + baseRate * wcFactor;
    const dt = baseRate * 2.0 * totalWageFactor + baseRate * wcFactor;

    return {
      reg,
      ot,
      dt,
      breakdown: {
        payRate: baseRate,
        totalWageBurdenPct,
        wcPct,
        regMultiplier: totalWageFactor + wcFactor,
        otMultiplier: ot / baseRate,
        dtMultiplier: dt / baseRate,
      },
    };
  }, [state, trade, payRate]);

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="preview-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin/burden" className="back-link">
            ← Back to Burden Settings
          </Link>
          <h1>Burden Preview</h1>
          <p className="subtitle">
            Utility preview for burden calculations. Not for quoting — use Quote Builder for actual quotes.
          </p>
        </div>
      </div>

      {/* UI Shell Notice */}
      <div className="shell-notice">
        <span className="shell-icon">⚠</span>
        <span>Mocked calculation (UI shell) — Burden Model v1.0 rules applied</span>
      </div>

      {/* Input Section */}
      <div className="input-section">
        <h2>Inputs</h2>
        <div className="input-grid">
          <div className="input-field">
            <label htmlFor="stateSelect">State</label>
            <select
              id="stateSelect"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">Select State</option>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="input-field">
            <label htmlFor="tradeSelect">Trade</label>
            <select
              id="tradeSelect"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
            >
              <option value="">Select Trade</option>
              {TRADES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="input-field">
            <label htmlFor="payRateInput">Base Pay Rate ($/hr)</label>
            <input
              id="payRateInput"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 35.00"
              value={payRate}
              onChange={(e) => setPayRate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="results-section">
        <h2>Cost Per Hour (Burdened)</h2>

        {result ? (
          <>
            <div className="results-grid">
              <div className="result-card reg">
                <div className="result-label">REG</div>
                <div className="result-value">{formatCurrency(result.reg)}</div>
                <div className="result-multiplier">
                  {result.breakdown.regMultiplier.toFixed(4)}× base
                </div>
              </div>

              <div className="result-card ot">
                <div className="result-label">OT (1.5×)</div>
                <div className="result-value">{formatCurrency(result.ot)}</div>
                <div className="result-multiplier">
                  {result.breakdown.otMultiplier.toFixed(4)}× base
                </div>
              </div>

              <div className="result-card dt">
                <div className="result-label">DT (2.0×)</div>
                <div className="result-value">{formatCurrency(result.dt)}</div>
                <div className="result-multiplier">
                  {result.breakdown.dtMultiplier.toFixed(4)}× base
                </div>
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="breakdown-section">
              <h3>Calculation Breakdown</h3>
              <div className="breakdown-grid">
                <div className="breakdown-item">
                  <span className="breakdown-label">Base Pay Rate</span>
                  <span className="breakdown-value">{formatCurrency(result.breakdown.payRate)}/hr</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Total-Wage Burden %</span>
                  <span className="breakdown-value">{result.breakdown.totalWageBurdenPct.toFixed(2)}%</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">WC Rate % ({state}×{trade})</span>
                  <span className="breakdown-value">{result.breakdown.wcPct.toFixed(2)}%</span>
                </div>
              </div>

              <div className="formula-section">
                <div className="formula-title">Formulas Applied (v1.0):</div>
                <div className="formula">
                  <code>REG = payRate × (1 + totalWageBurden% + WC%)</code>
                </div>
                <div className="formula">
                  <code>OT = (payRate × 1.5) × (1 + totalWageBurden%) + (payRate × WC%)</code>
                  <span className="formula-note">WC applies to base only</span>
                </div>
                <div className="formula">
                  <code>DT = (payRate × 2.0) × (1 + totalWageBurden%) + (payRate × WC%)</code>
                  <span className="formula-note">WC applies to base only</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="results-placeholder">
            <div className="placeholder-icon">📊</div>
            <div className="placeholder-text">
              Select State, Trade, and enter Pay Rate to see burdened costs
            </div>
          </div>
        )}
      </div>

      {/* Rules Reminder */}
      <div className="rules-reminder">
        <strong>Reminder:</strong> Workers&apos; Comp (WC) is base-wage-only and does NOT follow OT/DT premium. 
        All other burden components follow the OT/DT premium multiplier.
      </div>

      <style jsx>{`
        .preview-container {
          padding: 24px 40px 60px;
          max-width: 900px;
          margin: 0 auto;
        }

        /* Header */
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
          line-height: 1.5;
        }

        /* Shell Notice */
        .shell-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 8px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #a78bfa;
        }

        .shell-icon {
          font-size: 16px;
        }

        /* Input Section */
        .input-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .input-section h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 16px;
        }

        .input-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .input-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-field label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .input-field select,
        .input-field input {
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 14px;
          color: #fff;
        }

        .input-field select:focus,
        .input-field input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .input-field select option {
          background: #1a1d24;
          color: #fff;
        }

        .input-field input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        /* Results Section */
        .results-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .results-section h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 16px;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .result-card {
          padding: 20px;
          border-radius: 10px;
          text-align: center;
        }

        .result-card.reg {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.25);
        }

        .result-card.ot {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .result-card.dt {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .result-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .result-card.reg .result-label {
          color: #3b82f6;
        }

        .result-card.ot .result-label {
          color: #f59e0b;
        }

        .result-card.dt .result-label {
          color: #ef4444;
        }

        .result-value {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-geist-mono), monospace;
          margin-bottom: 6px;
        }

        .result-multiplier {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
          font-family: var(--font-geist-mono), monospace;
        }

        .results-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
        }

        .placeholder-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .placeholder-text {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.45);
        }

        /* Breakdown Section */
        .breakdown-section {
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .breakdown-section h3 {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 12px;
        }

        .breakdown-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .breakdown-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }

        .breakdown-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
        }

        .breakdown-value {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          font-family: var(--font-geist-mono), monospace;
        }

        .formula-section {
          padding: 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
        }

        .formula-title {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 10px;
        }

        .formula {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 6px;
        }

        .formula:last-child {
          margin-bottom: 0;
        }

        .formula code {
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
        }

        .formula-note {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-style: italic;
        }

        /* Rules Reminder */
        .rules-reminder {
          padding: 14px 16px;
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.5;
        }

        .rules-reminder strong {
          color: #3b82f6;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .input-grid,
          .results-grid,
          .breakdown-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

