'use client';

/**
 * WipTradeBreakdown — Slice B (WIP Visibility)
 * 
 * Work-In-Process Health — Weekly Detail View
 * Per-trade breakdown with margin health stoplights.
 * UI-only shell with mocked data.
 * Read-only. No calculations. No backend calls.
 * 
 * VISIBILITY: INTERNAL ONLY
 * AUTHORITY: NONE (directional only)
 * 
 * PROHIBITIONS:
 * - No total gross margin $
 * - No trade profit totals $
 * - No revenue $
 * - No burden line items
 * - No WC, tax, overhead, or bank fees
 * - No commission math
 * - No invoice/snapshot references
 */

type HealthIndicator = '🟢' | '🟡' | '🔴';

interface TradeSummary {
  trade: string;
  headcount: number;
  marginPct: string;
  marginPerHr: string;
  indicator: HealthIndicator;
}

interface WipTradeBreakdownData {
  weekLabel: string;
  overallMarginPct: string;
  overallIndicator: HealthIndicator;
  overallMarginPerHr: string;
  trades: TradeSummary[];
}

// Mocked data for Slice B — Weekly Detail
const MOCK_TRADE_DATA: WipTradeBreakdownData = {
  weekLabel: 'Week of Jan 27 – Feb 2, 2026',
  overallMarginPct: '29.1%',
  overallIndicator: '🟢',
  overallMarginPerHr: '$8.20 / hr',
  trades: [
    {
      trade: 'Millwright',
      headcount: 4,
      marginPct: '31.2%',
      marginPerHr: '$9.40 / hr',
      indicator: '🟢',
    },
    {
      trade: 'Crane Operator',
      headcount: 2,
      marginPct: '27.8%',
      marginPerHr: '$7.90 / hr',
      indicator: '🟡',
    },
    {
      trade: 'Welder',
      headcount: 3,
      marginPct: '28.5%',
      marginPerHr: '$8.10 / hr',
      indicator: '🟢',
    },
    {
      trade: 'Electrician',
      headcount: 2,
      marginPct: '24.2%',
      marginPerHr: '$6.20 / hr',
      indicator: '🔴',
    },
    {
      trade: 'Pipefitter',
      headcount: 1,
      marginPct: '26.5%',
      marginPerHr: '$7.40 / hr',
      indicator: '🟡',
    },
  ],
};

export function WipTradeBreakdown() {
  const data = MOCK_TRADE_DATA;

  return (
    <div className="wip-trade-breakdown">
      {/* Panel Header */}
      <div className="panel-header">
        <h2 className="panel-title">WIP Health — Trade Breakdown</h2>
        <span className="panel-subtitle">Directional only · Not authoritative</span>
      </div>

      {/* Section 1: Weekly Overall Health */}
      <div className="wip-health-section">
        <div className="health-metric primary">
          <div className="metric-row">
            <span className="metric-label">Gross Margin %</span>
            <span className="metric-indicator">{data.overallIndicator}</span>
          </div>
          <div className="metric-value">{data.overallMarginPct}</div>
          <div className="metric-secondary">{data.weekLabel}</div>
        </div>

        <div className="health-metric">
          <div className="metric-label">Gross Margin per Labor Hour</div>
          <div className="metric-value">{data.overallMarginPerHr}</div>
          <div className="metric-helper">Blended across all trades this week</div>
        </div>
      </div>

      {/* Section 2: Per-Trade Breakdown */}
      <div className="trade-breakdown-section">
        <h3 className="section-title">Margin by Trade</h3>

        <div className="trades-table">
          <div className="trades-table-header">
            <span className="col-trade">Trade</span>
            <span className="col-count">Count</span>
            <span className="col-margin-pct">Margin %</span>
            <span className="col-margin-hr">$/hr</span>
            <span className="col-health">Health</span>
          </div>

          {data.trades.map((trade) => (
            <div className="trades-table-row" key={trade.trade}>
              <span className="col-trade">{trade.trade}</span>
              <span className="col-count">{trade.headcount}</span>
              <span className="col-margin-pct">{trade.marginPct}</span>
              <span className="col-margin-hr">{trade.marginPerHr}</span>
              <span className="col-health">{trade.indicator}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Interpretation Guardrail */}
      <div className="guardrail-box">
        <div className="guardrail-title">Interpretation</div>
        <div className="guardrail-text">
          Figures are directional and subject to approved hours and final execution.
        </div>
      </div>

      <style jsx>{`
        .wip-trade-breakdown {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
          max-width: 900px;
        }

        .panel-header {
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .panel-title {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 4px;
          letter-spacing: -0.2px;
        }

        .panel-subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
          font-style: italic;
        }

        /* WIP Health Section */
        .wip-health-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 24px;
        }

        .health-metric {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .health-metric.primary {
          border-color: rgba(34, 197, 94, 0.25);
          background: rgba(34, 197, 94, 0.05);
        }

        .metric-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .metric-label {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .metric-indicator {
          font-size: 14px;
        }

        .metric-value {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
          font-family: var(--font-geist-mono), monospace;
          letter-spacing: -0.5px;
        }

        .metric-secondary {
          font-size: 11px;
          color: rgba(34, 197, 94, 0.9);
          font-weight: 500;
        }

        .metric-helper {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          margin-top: 4px;
        }

        /* Trade Breakdown Section */
        .trade-breakdown-section {
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 14px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .trades-table {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          overflow: hidden;
        }

        .trades-table-header {
          display: grid;
          grid-template-columns: 2fr 0.8fr 1fr 1fr 0.8fr;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .trades-table-row {
          display: grid;
          grid-template-columns: 2fr 0.8fr 1fr 1fr 0.8fr;
          padding: 14px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          align-items: center;
        }

        .trades-table-row:last-child {
          border-bottom: none;
        }

        .col-trade {
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }

        .col-count {
          text-align: center;
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.6);
        }

        .col-margin-pct,
        .col-margin-hr {
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.7);
          text-align: right;
        }

        .col-health {
          text-align: center;
          font-size: 14px;
        }

        /* Guardrail Box */
        .guardrail-box {
          background: rgba(148, 163, 184, 0.08);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          padding: 14px 16px;
        }

        .guardrail-title {
          font-size: 12px;
          font-weight: 600;
          color: rgba(148, 163, 184, 0.9);
          margin-bottom: 4px;
        }

        .guardrail-text {
          font-size: 13px;
          color: rgba(148, 163, 184, 0.75);
          line-height: 1.5;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .wip-health-section {
            grid-template-columns: 1fr;
          }

          .trades-table-header,
          .trades-table-row {
            grid-template-columns: 1.5fr 0.6fr 1fr 0.6fr;
          }

          .col-margin-hr {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default WipTradeBreakdown;

