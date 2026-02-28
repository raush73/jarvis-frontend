'use client';

/**
 * CommercialMarginPanel — Slice A (Sales View)
 * 
 * Commercial Health — Estimate
 * UI-only shell with mocked data.
 * Read-only. No calculations. No backend calls.
 */

interface TradeEstimate {
  trade: string;
  estBillRate: string;
  estCost: string;
  marginPerHr: string;
  indicator: '🟢' | '🟡' | '🔴';
}

interface CommercialMarginData {
  estimatedGrossMargin: string;
  marginIndicator: '🟢' | '🟡' | '🔴';
  targetText: string;
  blendedMarginPerHour: string;
  blendedHelperText: string;
  trades: TradeEstimate[];
}

interface CommercialMarginPanelProps {
  mode: 'estimate';
  data: CommercialMarginData;
}

// Mocked data for Slice A
const MOCK_ESTIMATE_DATA: CommercialMarginData = {
  estimatedGrossMargin: '29.5%',
  marginIndicator: '🟢',
  targetText: 'Target ≥ 28%',
  blendedMarginPerHour: '$8.40 / hr',
  blendedHelperText: 'Across all trades on this quote',
  trades: [
    {
      trade: 'Millwright',
      estBillRate: '$95/hr',
      estCost: '$84/hr',
      marginPerHr: '$11/hr',
      indicator: '🟢',
    },
    {
      trade: 'Crane Operator',
      estBillRate: '$140/hr',
      estCost: '$134/hr',
      marginPerHr: '$6/hr',
      indicator: '🟡',
    },
    {
      trade: 'Electrician',
      estBillRate: '$90/hr',
      estCost: '$88/hr',
      marginPerHr: '$2/hr',
      indicator: '🔴',
    },
  ],
};

export function CommercialMarginPanel({ mode, data }: CommercialMarginPanelProps) {
  // Use mocked data for estimate mode
  const displayData = mode === 'estimate' ? MOCK_ESTIMATE_DATA : data;

  return (
    <div className="commercial-margin-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <h2 className="panel-title">Commercial Health — Estimate</h2>
        <span className="panel-subtitle">Estimate only · Not final</span>
      </div>

      {/* Section 1: Deal Health */}
      <div className="deal-health-section">
        <div className="health-metric primary">
          <div className="metric-row">
            <span className="metric-label">Estimated Gross Margin</span>
            <span className="metric-indicator">{displayData.marginIndicator}</span>
          </div>
          <div className="metric-value">{displayData.estimatedGrossMargin}</div>
          <div className="metric-secondary">{displayData.targetText}</div>
        </div>

        <div className="health-metric">
          <div className="metric-label">Blended Margin per Labor Hour</div>
          <div className="metric-value">{displayData.blendedMarginPerHour}</div>
          <div className="metric-helper">{displayData.blendedHelperText}</div>
        </div>
      </div>

      {/* Section 2: Profitability by Trade */}
      <div className="trade-profitability-section">
        <h3 className="section-title">Profitability by Trade (Estimate)</h3>
        
        <div className="trade-table">
          <div className="trade-table-header">
            <span className="col-trade">Trade</span>
            <span className="col-bill">Est. Bill Rate</span>
            <span className="col-cost">Est. Cost</span>
            <span className="col-margin">Margin / Hr</span>
          </div>

          {displayData.trades.map((trade) => (
            <div className="trade-table-row" key={trade.trade}>
              <span className="col-trade">{trade.trade}</span>
              <span className="col-bill">{trade.estBillRate}</span>
              <span className="col-cost">{trade.estCost}</span>
              <span className="col-margin">
                <span className="margin-value">{trade.marginPerHr}</span>
                <span className="margin-indicator">{trade.indicator}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Interpretation Guardrail */}
      <div className="guardrail-box">
        <div className="guardrail-title">How to read this</div>
        <div className="guardrail-text">
          Final results depend on hours, execution, and approvals.
        </div>
      </div>

      <style jsx>{`
        .commercial-margin-panel {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          grid-column: span 2;
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

        /* Deal Health Section */
        .deal-health-section {
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

        /* Trade Profitability Section */
        .trade-profitability-section {
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

        .trade-table {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          overflow: hidden;
        }

        .trade-table-header {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.2fr;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .trade-table-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1.2fr;
          padding: 14px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          align-items: center;
        }

        .trade-table-row:last-child {
          border-bottom: none;
        }

        .col-trade {
          font-weight: 500;
        }

        .col-bill,
        .col-cost {
          font-family: var(--font-geist-mono), monospace;
          color: rgba(255, 255, 255, 0.7);
        }

        .col-margin {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .margin-value {
          font-family: var(--font-geist-mono), monospace;
          font-weight: 700;
          color: #fff;
        }

        .margin-indicator {
          font-size: 12px;
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
          .deal-health-section {
            grid-template-columns: 1fr;
          }

          .trade-table-header,
          .trade-table-row {
            grid-template-columns: 1.5fr 1fr 1fr;
          }

          .col-cost {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default CommercialMarginPanel;

