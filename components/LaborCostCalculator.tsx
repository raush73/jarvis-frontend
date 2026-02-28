"use client";

import { useState, useEffect } from "react";

const STATES = ["KY", "TX"];

interface Trade {
  id: string;
  name: string;
}

interface CalcResult {
  stateCode: string;
  tradeId: string;
  baseRate: number;
  burdenPct: number;
  rates: {
    reg: number;
    ot: number;
    dt: number;
  };
}

export default function LaborCostCalculator() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [state, setState] = useState("KY");
  const [tradeId, setTradeId] = useState("");
  const [baseRate, setBaseRate] = useState<number | "">(30);

  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch trades on mount
  useEffect(() => {
    fetch("http://localhost:3001/demo/trades")
      .then((res) => res.json())
      .then((data: Trade[]) => {
        setTrades(data);
        if (data.length > 0) setTradeId(data[0].id);
      })
      .catch(() => setError("Failed to load trades. Is backend running on port 3001?"));
  }, []);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("http://localhost:3001/demo/burdened-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateCode: state,
          tradeId,
          baseRate: typeof baseRate === "number" ? baseRate : 0,
        }),
      });

      if (!res.ok) throw new Error("Calculation failed");
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Calculation failed. Check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;
  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

  return (
    <div className="calculator-container">
      {/* Guardrail */}
      <div className="guardrail">
        Internal conversation support only. Not a quote. Final pricing requires a Quote.
      </div>

      {error && (
        <div className="error-banner">{error}</div>
      )}

      {/* Inputs Section */}
      <div className="input-section">
        <h2 className="section-title">Inputs</h2>
        <div className="input-grid">
          <div className="input-group">
            <label className="input-label">State</label>
            <select
              className="input-select"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Trade</label>
            <select
              className="input-select"
              value={tradeId}
              onChange={(e) => setTradeId(e.target.value)}
            >
              <option value="">Select Trade</option>
              {trades.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Base Rate $/hr</label>
            <input
              type="number"
              className="input-number"
              placeholder="0.00"
              min={0}
              step={0.01}
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value ? parseFloat(e.target.value) : "")}
            />
          </div>
        </div>

        <button
          className="calc-button"
          onClick={handleCalculate}
          disabled={loading || !tradeId}
        >
          {loading ? "Calculating..." : "Calculate"}
        </button>
      </div>

      {/* Results Section */}
      {result && (
        <div className="output-section">
          <h2 className="section-title">Burdened Hourly Rates</h2>

          <div className="rate-row-triple">
            <div className="rate-card">
              <span className="rate-label">REG</span>
              <span className="rate-value">{formatCurrency(result.rates.reg)}</span>
            </div>
            <div className="rate-card">
              <span className="rate-label">OT (1.5×)</span>
              <span className="rate-value">{formatCurrency(result.rates.ot)}</span>
            </div>
            <div className="rate-card">
              <span className="rate-label">DT (2×)</span>
              <span className="rate-value">{formatCurrency(result.rates.dt)}</span>
            </div>
          </div>

          <div className="burden-note">
            Burden: {formatPercent(result.burdenPct)}
          </div>
        </div>
      )}

      <style jsx>{`
        .calculator-container {
          max-width: 720px;
          margin: 0 auto;
        }

        .guardrail {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          color: #f59e0b;
          text-align: center;
          margin-bottom: 24px;
        }

        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          color: #ef4444;
          text-align: center;
          margin-bottom: 24px;
        }

        .input-section,
        .output-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 16px;
          letter-spacing: -0.2px;
        }

        .input-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }

        .input-select,
        .input-number {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 10px 12px;
          font-size: 14px;
          color: #fff;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .input-select:focus,
        .input-number:focus {
          border-color: rgba(59, 130, 246, 0.5);
        }

        .input-select option {
          background: #1a1d24;
          color: #fff;
        }

        .calc-button {
          margin-top: 20px;
          width: 100%;
          background: #3b82f6;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .calc-button:hover:not(:disabled) {
          background: #2563eb;
        }

        .calc-button:disabled {
          background: rgba(59, 130, 246, 0.5);
          cursor: not-allowed;
        }

        .rate-row-triple {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .rate-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .rate-label {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rate-value {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }

        .burden-note {
          margin-top: 12px;
          text-align: center;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        @media (max-width: 640px) {
          .input-grid {
            grid-template-columns: 1fr;
          }
          .rate-row-triple {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
