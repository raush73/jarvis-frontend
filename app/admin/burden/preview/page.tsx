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

type MarginHealthStatus = "RED" | "YELLOW" | "GREEN";

type SellingRateResult = {
  regSellRate: number;
  otSellRate: number;
  dtSellRate: number;
  grossMarginPct: number;
  marginHealth: MarginHealthStatus;
};

type PresetComputeResult = SellingRateResult & {
  presetId: string;
  marginPct: number;
  otMultiplier: number;
  label: string | null;
};

type SellingComputeResponse = {
  presets: PresetComputeResult[];
  customMargin: SellingRateResult | null;
  customProfit: SellingRateResult | null;
};

type CostCalcType = "standard" | "ocip" | "prevailing" | "prevailing-ocip";

type SellingTab = "presets" | "custom-margin" | "profit-hr";

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

const HEALTH_STYLES: Record<MarginHealthStatus, { label: string; color: string; bg: string; border: string }> = {
  GREEN: { label: "Healthy", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)" },
  YELLOW: { label: "Watch", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
  RED: { label: "Risk", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" },
};

function HealthBadge({ status }: { status: MarginHealthStatus }) {
  const s = HEALTH_STYLES[status];
  return (
    <span
      style={{
        display: "inline-block", padding: "3px 10px", fontSize: "11px", fontWeight: 600,
        borderRadius: "4px", border: "1px solid", color: s.color, background: s.bg, borderColor: s.border,
        letterSpacing: "0.3px",
      }}
    >
      {s.label}
    </span>
  );
}

export default function BurdenPreviewPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);

  const [costCalcType, setCostCalcType] = useState<CostCalcType>("standard");
  const [stateCode, setStateCode] = useState("");
  const [tradeId, setTradeId] = useState("");
  const [payRate, setPayRate] = useState("");
  const [baseWage, setBaseWage] = useState("");
  const [fringeAmount, setFringeAmount] = useState("");

  const [result, setResult] = useState<BurdenPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  // Selling state
  const [activeSellingTab, setActiveSellingTab] = useState<SellingTab>("presets");
  const [sellingPresets, setSellingPresets] = useState<PresetComputeResult[] | null>(null);
  const [sellingLoading, setSellingLoading] = useState(false);
  const [sellingError, setSellingError] = useState<string | null>(null);

  const [cmMarginPct, setCmMarginPct] = useState("20");
  const [cmOtMult, setCmOtMult] = useState("1.50");
  const [cmResult, setCmResult] = useState<SellingRateResult | null>(null);
  const [cmLoading, setCmLoading] = useState(false);

  const [cpProfitPerHour, setCpProfitPerHour] = useState("8.00");
  const [cpOtMult, setCpOtMult] = useState("1.50");
  const [cpResult, setCpResult] = useState<SellingRateResult | null>(null);
  const [cpLoading, setCpLoading] = useState(false);

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

  const isPrevailing = costCalcType === "prevailing" || costCalcType === "prevailing-ocip";
  const isOcip = costCalcType === "ocip" || costCalcType === "prevailing-ocip";

  const computePreview = useCallback(async () => {
    if (!stateCode || !tradeId) return;

    let payload: Record<string, unknown> = { stateCode, tradeId };

    if (isPrevailing) {
      const bw = parseFloat(baseWage);
      const fr = parseFloat(fringeAmount);
      if (isNaN(bw) || bw <= 0 || isNaN(fr) || fr < 0) return;
      payload.baseWage = bw;
      payload.fringeAmount = fr;
    } else {
      const rate = parseFloat(payRate);
      if (isNaN(rate) || rate <= 0) return;
      payload.payRate = rate;
    }

    if (isOcip) {
      payload.isOsep = true;
    }

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
        body: JSON.stringify(payload),
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
  }, [stateCode, tradeId, payRate, baseWage, fringeAmount, isPrevailing, isOcip]);

  // Auto-fetch selling presets when burden result changes
  useEffect(() => {
    if (!result) {
      setSellingPresets(null);
      setSellingError(null);
      setCmResult(null);
      setCpResult(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setSellingLoading(true);
      setSellingError(null);
      try {
        const res = await fetch("/api/selling-calculator/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ regCost: result.regCost, otCost: result.otCost, dtCost: result.dtCost }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Selling compute failed (${res.status})`);
        }
        const data: SellingComputeResponse = await res.json();
        if (!cancelled) setSellingPresets(data.presets);
      } catch (err: any) {
        if (!cancelled) setSellingError(err.message ?? "Failed to load selling presets");
      } finally {
        if (!cancelled) setSellingLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [result]);

  const computeCustomMargin = useCallback(async () => {
    if (!result) return;
    const margin = parseFloat(cmMarginPct);
    const ot = parseFloat(cmOtMult);
    if (isNaN(margin) || margin < 0 || margin >= 100 || isNaN(ot) || ot <= 0) return;
    setCmLoading(true);
    try {
      const res = await fetch("/api/selling-calculator/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          regCost: result.regCost, otCost: result.otCost, dtCost: result.dtCost,
          customMarginPct: margin, customOtMultiplier: ot,
        }),
      });
      if (!res.ok) throw new Error(`Selling compute failed (${res.status})`);
      const data: SellingComputeResponse = await res.json();
      setCmResult(data.customMargin);
    } catch (err: any) {
      console.error("Custom margin compute failed:", err);
    } finally {
      setCmLoading(false);
    }
  }, [result, cmMarginPct, cmOtMult]);

  const computeCustomProfit = useCallback(async () => {
    if (!result) return;
    const profit = parseFloat(cpProfitPerHour);
    const ot = parseFloat(cpOtMult);
    if (isNaN(profit) || profit < 0 || isNaN(ot) || ot <= 0) return;
    setCpLoading(true);
    try {
      const res = await fetch("/api/selling-calculator/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          regCost: result.regCost, otCost: result.otCost, dtCost: result.dtCost,
          customProfitPerHour: profit, customOtMultiplier: ot,
        }),
      });
      if (!res.ok) throw new Error(`Selling compute failed (${res.status})`);
      const data: SellingComputeResponse = await res.json();
      setCpResult(data.customProfit);
    } catch (err: any) {
      console.error("Custom profit compute failed:", err);
    } finally {
      setCpLoading(false);
    }
  }, [result, cpProfitPerHour, cpOtMult]);

  const canComputeCm = !cmLoading && cmMarginPct !== "" && parseFloat(cmMarginPct) >= 0 && parseFloat(cmMarginPct) < 100 && parseFloat(cmOtMult) > 0;
  const canComputeCp = !cpLoading && cpProfitPerHour !== "" && parseFloat(cpProfitPerHour) >= 0 && parseFloat(cpOtMult) > 0;

  const selectedTrade = trades.find((t) => t.id === tradeId);
  const canCompute = stateCode && tradeId && (
    isPrevailing
      ? baseWage !== "" && parseFloat(baseWage) > 0 && fringeAmount !== "" && parseFloat(fringeAmount) >= 0
      : payRate !== "" && parseFloat(payRate) > 0
  );

  return (
    <div className="preview-container">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <Link href="/admin/burden" className="back-link">
            &larr; Back to Burden Settings
          </Link>
          <h1>Burden &amp; Selling Calculator</h1>
          <p className="subtitle">
            Calculate true labor cost, then derive selling prices with preset or custom margin models.
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="input-section">
        <h2>Inputs</h2>

        {/* Cost Calculation Type Selector */}
        <div className="cost-type-selector">
          <label className="cost-type-label">Cost Calculation Type</label>
          <div className="cost-type-options">
            {([
              { value: "standard", label: "Standard" },
              { value: "ocip", label: "OCIP" },
              { value: "prevailing", label: "Prevailing Wage" },
              { value: "prevailing-ocip", label: "Prevailing Wage + OCIP" },
            ] as const).map((opt) => (
              <label key={opt.value} className={`cost-type-radio ${costCalcType === opt.value ? "active" : ""}`}>
                <input
                  type="radio"
                  name="costCalcType"
                  value={opt.value}
                  checked={costCalcType === opt.value}
                  onChange={() => {
                    setCostCalcType(opt.value);
                    setResult(null);
                    setError(null);
                  }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {isOcip && (
            <div className="cost-type-hint ocip-hint">OCIP excludes workers&apos; comp from the cost calculation.</div>
          )}
          {isPrevailing && !isOcip && (
            <div className="cost-type-hint pw-hint">Fringe is flat and is not multiplied for OT/DT.</div>
          )}
          {isPrevailing && isOcip && (
            <div className="cost-type-hint pw-ocip-hint">
              Fringe is flat (not multiplied for OT/DT). OCIP excludes workers&apos; comp.
            </div>
          )}
        </div>

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
                {tradesLoading ? "Loading trades\u2026" : "Select Trade"}
              </option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.wcClassCode})
                </option>
              ))}
            </select>
          </div>

          {!isPrevailing ? (
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
          ) : (
            <>
              <div className="input-field">
                <label htmlFor="baseWageInput">Base Wage ($/hr)</label>
                <input
                  id="baseWageInput"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 45.00"
                  value={baseWage}
                  onChange={(e) => setBaseWage(e.target.value)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="fringeInput">Fringe Amount ($/hr)</label>
                <input
                  id="fringeInput"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 18.50"
                  value={fringeAmount}
                  onChange={(e) => setFringeAmount(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="compute-row">
          <button
            className="compute-btn"
            disabled={!canCompute || computing}
            onClick={computePreview}
          >
            {computing ? "Computing\u2026" : "Compute Preview"}
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

      {/* Results: Two-Column Layout */}
      {result ? (
        <div className="two-col-layout">
          {/* Left Column: True Labor Cost */}
          <div className="col-left">
            <div className="results-section">
              <div className="cost-type-header">
                <h2>True Labor Cost</h2>
                <div className="cost-type-badges">
                  <span className="cost-type-badge">
                    {costCalcType === "standard" && "Standard"}
                    {costCalcType === "ocip" && "OCIP"}
                    {costCalcType === "prevailing" && "Prevailing Wage"}
                    {costCalcType === "prevailing-ocip" && "Prevailing Wage + OCIP"}
                  </span>
                  {isOcip && <span className="wc-excluded-badge">WC Excluded</span>}
                </div>
              </div>

              <div className={`wc-source-badge ${result.wcSource === "CLASS_CODE_RATE" ? "primary" : "fallback"}`}>
                WC Source: {result.wcSource === "CLASS_CODE_RATE"
                  ? `Class Code Rate (${result.stateCode} \u00d7 ${result.wcClassCode})`
                  : "Payroll Burden Rate (fallback)"}
              </div>

              {isPrevailing && (
                <div className="wage-basis-section">
                  <div className="wage-basis-title">Effective Wage Basis</div>
                  <div className="wage-basis-grid">
                    <div className="wage-basis-item">
                      <span className="wage-basis-label">REG</span>
                      <span className="wage-basis-value">
                        {formatCurrency(parseFloat(baseWage) + parseFloat(fringeAmount))}/hr
                      </span>
                      <span className="wage-basis-formula">baseWage + fringe</span>
                    </div>
                    <div className="wage-basis-item">
                      <span className="wage-basis-label">OT</span>
                      <span className="wage-basis-value">
                        {formatCurrency(parseFloat(baseWage) * 1.5 + parseFloat(fringeAmount))}/hr
                      </span>
                      <span className="wage-basis-formula">baseWage &times; 1.5 + fringe</span>
                    </div>
                    <div className="wage-basis-item">
                      <span className="wage-basis-label">DT</span>
                      <span className="wage-basis-value">
                        {formatCurrency(parseFloat(baseWage) * 2.0 + parseFloat(fringeAmount))}/hr
                      </span>
                      <span className="wage-basis-formula">baseWage &times; 2.0 + fringe</span>
                    </div>
                  </div>
                </div>
              )}

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

              <div className="breakdown-section">
                <h3>Calculation Breakdown</h3>
                <div className="breakdown-grid">
                  <div className="breakdown-item">
                    <span className="breakdown-label">{isPrevailing ? "Effective REG Rate" : "Base Pay Rate"}</span>
                    <span className="breakdown-value">{formatCurrency(result.payRate)}/hr</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Full Base Burden %</span>
                    <span className="breakdown-value">{result.fullBaseBurdenPercent.toFixed(2)}%</span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Premium Burden %</span>
                    <span className="breakdown-value">{result.premiumBurdenPercent.toFixed(2)}%</span>
                  </div>
                </div>

                <div className="category-grid">
                  {Object.entries(result.burdenBreakdown)
                    .filter(([, v]) => v > 0)
                    .map(([cat, val]) => (
                      <div key={cat} className="category-chip">
                        <span className="category-name">{cat}</span>
                        <span className="category-rate">{val.toFixed(2)}%</span>
                      </div>
                    ))}
                  {isOcip && (
                    <div className="category-chip wc-excluded-chip">
                      <span className="category-name">WC</span>
                      <span className="category-rate">0.00% (OCIP)</span>
                    </div>
                  )}
                </div>

                <div className="formula-section">
                  {isPrevailing ? (
                    <>
                      <div className="formula-title">Formulas Applied (Split Burden, Prevailing Wage):</div>
                      <div className="formula">
                        <code>REG = (baseWage + fringe) &times; (1 + fullBurden%)</code>
                        <span className="formula-note">fringe is flat on base hour</span>
                      </div>
                      <div className="formula">
                        <code>OT = REG + baseWage &times; 0.5 &times; (1 + premiumBurden%)</code>
                        <span className="formula-note">premium on baseWage only</span>
                      </div>
                      <div className="formula">
                        <code>DT = REG + baseWage &times; 1.0 &times; (1 + premiumBurden%)</code>
                        <span className="formula-note">premium on baseWage only</span>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Selling Price Calculator */}
          <div className="col-right">
            <div className="selling-section">
              <h2>Selling Price Calculator</h2>

              <div className="selling-tabs">
                <button
                  type="button"
                  className={`selling-tab ${activeSellingTab === "presets" ? "active" : ""}`}
                  onClick={() => setActiveSellingTab("presets")}
                >
                  Presets
                </button>
                <button
                  type="button"
                  className={`selling-tab ${activeSellingTab === "custom-margin" ? "active" : ""}`}
                  onClick={() => setActiveSellingTab("custom-margin")}
                >
                  Custom Margin
                </button>
                <button
                  type="button"
                  className={`selling-tab ${activeSellingTab === "profit-hr" ? "active" : ""}`}
                  onClick={() => setActiveSellingTab("profit-hr")}
                >
                  Profit $/hr
                </button>
              </div>

              {/* Model 1: Presets */}
              {activeSellingTab === "presets" && (
                <div className="selling-tab-content">
                  {sellingLoading ? (
                    <div className="selling-placeholder">Loading preset calculations&hellip;</div>
                  ) : sellingError ? (
                    <div className="selling-error">{sellingError}</div>
                  ) : !sellingPresets || sellingPresets.length === 0 ? (
                    <div className="selling-placeholder">
                      No selling presets configured.{" "}
                      <Link href="/admin/burden" className="selling-link">Add presets in Burden Settings.</Link>
                    </div>
                  ) : (
                    <div className="preset-list">
                      {sellingPresets.map((p) => (
                        <div key={p.presetId} className="preset-card">
                          <div className="preset-header">
                            <span className="preset-identity">
                              {p.marginPct.toFixed(1)}% Margin | OT {p.otMultiplier.toFixed(2)}x
                            </span>
                            <HealthBadge status={p.marginHealth} />
                          </div>
                          {p.label && <div className="preset-note">{p.label}</div>}
                          <div className="sell-rates-grid">
                            <div className="sell-rate-item">
                              <span className="sell-rate-label">REG Sell</span>
                              <span className="sell-rate-value">{formatCurrency(p.regSellRate)}</span>
                            </div>
                            <div className="sell-rate-item">
                              <span className="sell-rate-label">OT Sell</span>
                              <span className="sell-rate-value">{formatCurrency(p.otSellRate)}</span>
                            </div>
                            <div className="sell-rate-item">
                              <span className="sell-rate-label">DT Sell</span>
                              <span className="sell-rate-value">{formatCurrency(p.dtSellRate)}</span>
                            </div>
                          </div>
                          <div className="preset-gm">GM: {p.grossMarginPct.toFixed(2)}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Model 2: Custom Margin */}
              {activeSellingTab === "custom-margin" && (
                <div className="selling-tab-content">
                  <div className="custom-inputs">
                    <div className="custom-field">
                      <label>Margin %</label>
                      <input
                        type="number" step="0.01" min="0" max="99.99"
                        placeholder="20.00"
                        value={cmMarginPct}
                        onChange={(e) => setCmMarginPct(e.target.value)}
                      />
                    </div>
                    <div className="custom-field">
                      <label>OT Multiplier</label>
                      <input
                        type="number" step="0.01" min="0.01"
                        placeholder="1.50"
                        value={cmOtMult}
                        onChange={(e) => setCmOtMult(e.target.value)}
                      />
                    </div>
                    <div className="custom-field">
                      <label>DT Multiplier</label>
                      <div className="derived-value">
                        {!isNaN(parseFloat(cmOtMult)) ? (parseFloat(cmOtMult) * 2).toFixed(2) : "\u2014"}x
                        <span className="derived-tag">derived</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="compute-btn selling-compute-btn"
                    disabled={!canComputeCm}
                    onClick={computeCustomMargin}
                  >
                    {cmLoading ? "Computing\u2026" : "Calculate Selling Price"}
                  </button>

                  {cmResult && (
                    <div className="custom-result">
                      <div className="custom-result-header">
                        <span className="custom-result-margin">GM: {cmResult.grossMarginPct.toFixed(2)}%</span>
                        <HealthBadge status={cmResult.marginHealth} />
                      </div>
                      <div className="sell-rates-grid">
                        <div className="sell-rate-item">
                          <span className="sell-rate-label">REG Sell</span>
                          <span className="sell-rate-value">{formatCurrency(cmResult.regSellRate)}</span>
                        </div>
                        <div className="sell-rate-item">
                          <span className="sell-rate-label">OT Sell</span>
                          <span className="sell-rate-value">{formatCurrency(cmResult.otSellRate)}</span>
                        </div>
                        <div className="sell-rate-item">
                          <span className="sell-rate-label">DT Sell</span>
                          <span className="sell-rate-value">{formatCurrency(cmResult.dtSellRate)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Model 3: Profit $/hr */}
              {activeSellingTab === "profit-hr" && (
                <div className="selling-tab-content">
                  <div className="custom-inputs">
                    <div className="custom-field">
                      <label>Desired Profit $/hr</label>
                      <input
                        type="number" step="0.01" min="0"
                        placeholder="8.00"
                        value={cpProfitPerHour}
                        onChange={(e) => setCpProfitPerHour(e.target.value)}
                      />
                    </div>
                    <div className="custom-field">
                      <label>OT Multiplier</label>
                      <input
                        type="number" step="0.01" min="0.01"
                        placeholder="1.50"
                        value={cpOtMult}
                        onChange={(e) => setCpOtMult(e.target.value)}
                      />
                    </div>
                    <div className="custom-field">
                      <label>DT Multiplier</label>
                      <div className="derived-value">
                        {!isNaN(parseFloat(cpOtMult)) ? (parseFloat(cpOtMult) * 2).toFixed(2) : "\u2014"}x
                        <span className="derived-tag">derived</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="compute-btn selling-compute-btn"
                    disabled={!canComputeCp}
                    onClick={computeCustomProfit}
                  >
                    {cpLoading ? "Computing\u2026" : "Calculate Selling Price"}
                  </button>

                  {cpResult && (
                    <div className="custom-result">
                      <div className="custom-result-header">
                        <span className="custom-result-margin">GM: {cpResult.grossMarginPct.toFixed(2)}%</span>
                        <HealthBadge status={cpResult.marginHealth} />
                      </div>
                      <div className="sell-rates-grid">
                        <div className="sell-rate-item">
                          <span className="sell-rate-label">REG Sell</span>
                          <span className="sell-rate-value">{formatCurrency(cpResult.regSellRate)}</span>
                        </div>
                        <div className="sell-rate-item">
                          <span className="sell-rate-label">OT Sell</span>
                          <span className="sell-rate-value">{formatCurrency(cpResult.otSellRate)}</span>
                        </div>
                        <div className="sell-rate-item">
                          <span className="sell-rate-label">DT Sell</span>
                          <span className="sell-rate-value">{formatCurrency(cpResult.dtSellRate)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="results-section">
          <h2>True Labor Cost</h2>
          <div className="results-placeholder">
            <div className="placeholder-icon">&#x1F4CA;</div>
            <div className="placeholder-text">
              Calculate true labor cost first to unlock selling price calculations.
            </div>
          </div>
        </div>
      )}

      {/* Rules Reminder */}
      <div className="rules-reminder">
        <strong>Reminder:</strong> Workers&apos; Comp (WC) is base-wage-only and does NOT follow OT/DT premium.
        All other burden components follow the OT/DT premium multiplier.
      </div>

      <style jsx>{`
        .preview-container {
          padding: 24px 40px 60px;
          max-width: 1400px;
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
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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

        /* Two-Column Layout */
        .two-col-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .col-left .results-section,
        .col-right .selling-section {
          height: 100%;
        }

        /* Selling Section */
        .selling-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 20px;
        }

        .selling-section h2 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 16px;
        }

        .selling-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          padding: 3px;
        }

        .selling-tab {
          flex: 1;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .selling-tab:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .selling-tab.active {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }

        .selling-tab-content {
          min-height: 120px;
        }

        .selling-placeholder {
          text-align: center;
          padding: 32px 16px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
          line-height: 1.6;
        }

        .selling-link {
          color: #3b82f6;
          text-decoration: none;
        }

        .selling-link:hover {
          text-decoration: underline;
        }

        .selling-error {
          padding: 10px 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
        }

        /* Preset Cards */
        .preset-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preset-card {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
        }

        .preset-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .preset-identity {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
        }

        .preset-note {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 10px;
        }

        .sell-rates-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 8px;
        }

        .sell-rate-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 6px;
          text-align: center;
        }

        .sell-rate-label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .sell-rate-value {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-geist-mono), monospace;
        }

        .preset-gm {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          font-family: var(--font-geist-mono), monospace;
        }

        /* Custom Inputs (Model 2 / Model 3) */
        .custom-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .custom-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .custom-field label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .custom-field input {
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 13px;
          color: #fff;
          text-align: right;
        }

        .custom-field input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .custom-field input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .derived-value {
          padding: 8px 10px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          font-family: var(--font-geist-mono), monospace;
          text-align: right;
        }

        .derived-tag {
          display: inline-block;
          margin-left: 6px;
          font-size: 9px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-family: inherit;
        }

        .selling-compute-btn {
          width: 100%;
          margin-bottom: 16px;
        }

        /* Custom Result */
        .custom-result {
          padding: 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
        }

        .custom-result-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .custom-result-margin {
          font-size: 14px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-geist-mono), monospace;
        }

        /* Cost Calculation Type Selector */
        .cost-type-selector {
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .cost-type-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }

        .cost-type-options {
          display: flex;
          gap: 4px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          padding: 3px;
        }

        .cost-type-radio {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          text-align: center;
        }

        .cost-type-radio input {
          display: none;
        }

        .cost-type-radio:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .cost-type-radio.active {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }

        .cost-type-hint {
          margin-top: 8px;
          font-size: 12px;
          line-height: 1.5;
          padding: 6px 10px;
          border-radius: 6px;
        }

        .ocip-hint {
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.15);
        }

        .pw-hint {
          color: #a78bfa;
          background: rgba(167, 139, 250, 0.08);
          border: 1px solid rgba(167, 139, 250, 0.15);
        }

        .pw-ocip-hint {
          color: #a78bfa;
          background: rgba(167, 139, 250, 0.08);
          border: 1px solid rgba(167, 139, 250, 0.15);
        }

        /* Cost Type Header / Badges */
        .cost-type-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 8px;
        }

        .cost-type-header h2 {
          margin: 0;
        }

        .cost-type-badges {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .cost-type-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          color: #a78bfa;
          background: rgba(167, 139, 250, 0.1);
          border: 1px solid rgba(167, 139, 250, 0.25);
          letter-spacing: 0.3px;
        }

        .wc-excluded-badge {
          display: inline-block;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.25);
          letter-spacing: 0.3px;
        }

        .wc-excluded-chip {
          border-color: rgba(245, 158, 11, 0.3) !important;
          background: rgba(245, 158, 11, 0.06) !important;
        }

        .wc-excluded-chip .category-rate {
          color: #fbbf24;
        }

        /* Wage Basis Section (Prevailing Wage) */
        .wage-basis-section {
          margin-bottom: 16px;
          padding: 12px;
          background: rgba(167, 139, 250, 0.06);
          border: 1px solid rgba(167, 139, 250, 0.15);
          border-radius: 8px;
        }

        .wage-basis-title {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 8px;
        }

        .wage-basis-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .wage-basis-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: center;
          padding: 8px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
        }

        .wage-basis-label {
          font-size: 10px;
          font-weight: 700;
          color: #a78bfa;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .wage-basis-value {
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          font-family: var(--font-geist-mono), monospace;
        }

        .wage-basis-formula {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.35);
          font-style: italic;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .two-col-layout {
            grid-template-columns: 1fr;
          }

          .custom-inputs {
            grid-template-columns: 1fr 1fr 1fr;
          }
        }

        @media (max-width: 768px) {
          .input-grid,
          .results-grid,
          .breakdown-grid,
          .wage-basis-grid {
            grid-template-columns: 1fr;
          }

          .custom-inputs {
            grid-template-columns: 1fr;
          }

          .sell-rates-grid {
            grid-template-columns: 1fr;
          }

          .cost-type-options {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
