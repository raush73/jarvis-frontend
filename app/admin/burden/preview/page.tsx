"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;

type Trade = {
  id: string;
  name: string;
  wcClassCode: string;
  isActive: boolean;
};

type BurdenPreviewResult = {
  payRate: number;
  stateCode: string;
  tradeName: string;
  wcClassCode: string;
  wcSource: "CLASS_CODE_RATE" | "PAYROLL_BURDEN_RATE";
  burdenBreakdown: Record<string, number>;
  totalBurdenPercent: number;
  fullBaseBurdenPercent: number;
  premiumBurdenPercent: number;
  wcPercent: number;
  regCost: number;
  otCost: number;
  dtCost: number;
  regMultiplier: number;
  otMultiplier: number;
  dtMultiplier: number;
};

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("jp_accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function BurdenPreviewPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);

  const [stateCode, setStateCode] = useState("");
  const [tradeId, setTradeId] = useState("");
  const [payRate, setPayRate] = useState("");

  const [result, setResult] = useState<BurdenPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/trades", {
          headers: getAuthHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load trades");
        const data: Trade[] = await res.json();
        setTrades(data.filter((t) => t.isActive));
      } catch {
        setTrades([]);
      } finally {
        setTradesLoading(false);
      }
    })();
  }, []);

  const computePreview = useCallback(async () => {
    const rate = parseFloat(payRate);
    if (!stateCode || !tradeId || isNaN(rate) || rate <= 0) return;

    setComputing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/payroll-burden-rates/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ payRate: rate, stateCode, tradeId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Preview failed (${res.status})`);
      }

      setResult(await res.json());
    } catch (err: any) {
      setError(err.message ?? "Preview request failed");
    } finally {
      setComputing(false);
    }
  }, [stateCode, tradeId, payRate]);

  const selectedTrade = trades.find((t) => t.id === tradeId);
  const canCompute = stateCode && tradeId && payRate && parseFloat(payRate) > 0;

  return (
    <div className="preview-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin/burden" className="back-link">
            &larr; Back to Burden Settings
          </Link>
          <h1>Burden Preview</h1>
          <p className="subtitle">
            Utility preview for burden calculations. Not for quoting — use Quote Builder for actual quotes.
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="input-section">
        <h2>Inputs</h2>
        <div className="input-grid">
          <div className="input-field">
            <label htmlFor="stateSelect">State</label>
            <select
              id="stateSelect"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
            >
              <option value="">Select State</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="input-field">
            <label htmlFor="tradeSelect">Trade</label>
            <select
              id="tradeSelect"
              value={tradeId}
              onChange={(e) => setTradeId(e.target.value)}
              disabled={tradesLoading}
            >
              <option value="">
                {tradesLoading ? "Loading trades…" : "Select Trade"}
              </option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.wcClassCode})
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

        <div className="compute-row">
          <button
            className="compute-btn"
            disabled={!canCompute || computing}
            onClick={computePreview}
          >
            {computing ? "Computing…" : "Compute Preview"}
          </button>
          {selectedTrade && (
            <span className="trade-hint">
              WC Class Code: {selectedTrade.wcClassCode}
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-notice">
          <span className="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Results Section */}
      <div className="results-section">
        <h2>Cost Per Hour (Burdened)</h2>

        {result ? (
          <>
            {/* WC Source Indicator */}
            <div className={`wc-source-badge ${result.wcSource === "CLASS_CODE_RATE" ? "primary" : "fallback"}`}>
              WC Source: {result.wcSource === "CLASS_CODE_RATE"
                ? `Class Code Rate (${result.stateCode} × ${result.wcClassCode})`
                : "Payroll Burden Rate (fallback)"}
            </div>

            <div className="results-grid">
              <div className="result-card reg">
                <div className="result-label">REG</div>
                <div className="result-value">{formatCurrency(result.regCost)}</div>
                <div className="result-multiplier">
                  {result.regMultiplier.toFixed(4)}&times; base
                </div>
              </div>

              <div className="result-card ot">
                <div className="result-label">OT (1.5&times;)</div>
                <div className="result-value">{formatCurrency(result.otCost)}</div>
                <div className="result-multiplier">
                  {result.otMultiplier.toFixed(4)}&times; base
                </div>
              </div>

              <div className="result-card dt">
                <div className="result-label">DT (2.0&times;)</div>
                <div className="result-value">{formatCurrency(result.dtCost)}</div>
                <div className="result-multiplier">
                  {result.dtMultiplier.toFixed(4)}&times; base
                </div>
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="breakdown-section">
              <h3>Calculation Breakdown</h3>
              <div className="breakdown-grid">
                <div className="breakdown-item">
                  <span className="breakdown-label">Base Pay Rate</span>
                  <span className="breakdown-value">{formatCurrency(result.payRate)}/hr</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Full Base Burden %</span>
                  <span className="breakdown-value">{result.fullBaseBurdenPercent.toFixed(2)}%</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Premium Burden % (payroll tax)</span>
                  <span className="breakdown-value">{result.premiumBurdenPercent.toFixed(2)}%</span>
                </div>
              </div>

              {/* Per-category breakdown */}
              <div className="category-grid">
                {Object.entries(result.burdenBreakdown)
                  .filter(([, v]) => v > 0)
                  .map(([cat, val]) => (
                    <div key={cat} className="category-chip">
                      <span className="category-name">{cat}</span>
                      <span className="category-rate">{val.toFixed(2)}%</span>
                    </div>
                  ))}
              </div>

              <div className="formula-section">
                <div className="formula-title">Formulas Applied (Split Burden):</div>
                <div className="formula">
                  <code>REG = payRate &times; (1 + fullBurden%)</code>
                  <span className="formula-note">all categories on base hour</span>
                </div>
                <div className="formula">
                  <code>OT = REG + payRate &times; 0.5 &times; (1 + premiumBurden%)</code>
                  <span className="formula-note">premium carries FICA+SUTA+FUTA only</span>
                </div>
                <div className="formula">
                  <code>DT = REG + payRate &times; 1.0 &times; (1 + premiumBurden%)</code>
                  <span className="formula-note">premium carries FICA+SUTA+FUTA only</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="results-placeholder">
            <div className="placeholder-icon">&#x1F4CA;</div>
            <div className="placeholder-text">
              Select State, Trade, and enter Pay Rate then click Compute Preview
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

        .compute-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 16px;
        }

        .compute-btn {
          padding: 10px 24px;
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .compute-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .compute-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .trade-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-geist-mono), monospace;
        }

        /* Error */
        .error-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 8px;
          margin-bottom: 24px;
          font-size: 13px;
          color: #f87171;
        }

        .error-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.2);
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        /* WC Source Badge */
        .wc-source-badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 16px;
          font-family: var(--font-geist-mono), monospace;
        }

        .wc-source-badge.primary {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
          color: #4ade80;
        }

        .wc-source-badge.fallback {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
          color: #fbbf24;
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

        /* Category chips */
        .category-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 20px;
        }

        .category-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
        }

        .category-name {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .category-rate {
          font-size: 12px;
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
