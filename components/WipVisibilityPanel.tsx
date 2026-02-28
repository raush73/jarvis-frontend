'use client';

/**
 * WipVisibilityPanel — Slice B (WIP Visibility)
 * 
 * Work-In-Process Health — Timesheet Hub View
 * UI-only shell with mocked data.
 * Read-only. No calculations. No backend calls.
 * 
 * VISIBILITY: INTERNAL ONLY
 * AUTHORITY: NONE (directional only)
 * 
 * PROHIBITIONS:
 * - No total gross margin $
 * - No revenue $
 * - No burden line items
 * - No WC, tax, overhead, or bank fees
 * - No commission math
 * - No invoice/snapshot references
 */

type HealthIndicator = '🟢' | '🟡' | '🔴';

interface WeekSummary {
  weekLabel: string;
  weekId: string;
  marginPct: string;
  marginPerHr: string;
  indicator: HealthIndicator;
}

interface WipVisibilityData {
  overallMarginPct: string;
  overallIndicator: HealthIndicator;
  overallMarginPerHr: string;
  weeks: WeekSummary[];
}

// Mocked data for Slice B — Timesheet Hub
const MOCK_WIP_DATA: WipVisibilityData = {
  overallMarginPct: '27.2%',
  overallIndicator: '🟡',
  overallMarginPerHr: '$7.85 / hr',
  weeks: [
    {
      weekLabel: 'Week of Jan 27 – Feb 2, 2026',
      weekId: 'ts_001',
      marginPct: '29.1%',
      marginPerHr: '$8.20 / hr',
      indicator: '🟢',
    },
    {
      weekLabel: 'Week of Jan 20 – Jan 26, 2026',
      weekId: 'ts_002',
      marginPct: '26.8%',
      marginPerHr: '$7.60 / hr',
      indicator: '🟡',
    },
    {
      weekLabel: 'Week of Jan 13 – Jan 19, 2026',
      weekId: 'ts_003',
      marginPct: '25.5%',
      marginPerHr: '$7.10 / hr',
      indicator: '🔴',
    },
  ],
};

export function WipVisibilityPanel() {
  const data = MOCK_WIP_DATA;

  return (
    <div className="wip-visibility-panel">
      {/* Panel Header */}
      <div className="panel-header">
        <h2 className="panel-title">WIP Health — Timesheets</h2>
        <span className="panel-subtitle">Directional only · Not authoritative</span>
      </div>

      {/* Section 1: Overall WIP Health */}
      <div className="wip-health-section">
        <div className="health-metric primary">
          <div className="metric-row">
            <span className="metric-label">Gross Margin %</span>
            <span className="metric-indicator">{data.overallIndicator}</span>
          </div>
          <div className="metric-value">{data.overallMarginPct}</div>
          <div className="metric-secondary">Across all in-flight weeks</div>
        </div>

        <div className="health-metric">
          <div className="metric-label">Gross Margin per Labor Hour</div>
          <div className="metric-value">{data.overallMarginPerHr}</div>
          <div className="metric-helper">Blended across all submitted timesheets</div>
        </div>
      </div>

      {/* Section 2: Weekly Breakdown */}
      <div className="weekly-breakdown-section">
        <h3 className="section-title">Weekly Margin Health</h3>

        <div className="weeks-table">
          <div className="weeks-table-header">
            <span className="col-week">Week</span>
            <span className="col-margin-pct">Margin %</span>
            <span className="col-margin-hr">$/hr</span>
            <span className="col-health">Health</span>
          </div>

          {data.weeks.map((week) => (
            <div className="weeks-table-row" key={week.weekId}>
              <span className="col-week">
                <span className="week-label">{week.weekLabel}</span>
                <span className="week-id">{week.weekId}</span>
              </span>
              <span className="col-margin-pct">{week.marginPct}</span>
              <span className="col-margin-hr">{week.marginPerHr}</span>
              <span className="col-health">{week.indicator}</span>
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
        .wip-visibility-panel {
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
          border-color: rgba(234, 179, 8, 0.25);
          background: rgba(234, 179, 8, 0.05);
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
          color: rgba(234, 179, 8, 0.9);
          font-weight: 500;
        }

        .metric-helper {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.45);
          margin-top: 4px;
        }

        /* Weekly Breakdown Section */
        .weekly-breakdown-section {
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

        .weeks-table {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          overflow: hidden;
        }

        .weeks-table-header {
          display: grid;
          grid-template-columns: 2.5fr 1fr 1fr 0.8fr;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .weeks-table-row {
          display: grid;
          grid-template-columns: 2.5fr 1fr 1fr 0.8fr;
          padding: 14px 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          align-items: center;
        }

        .weeks-table-row:last-child {
          border-bottom: none;
        }

        .col-week {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .week-label {
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }

        .week-id {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-family: var(--font-geist-mono), monospace;
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

          .weeks-table-header,
          .weeks-table-row {
            grid-template-columns: 2fr 1fr 0.8fr;
          }

          .col-margin-hr {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default WipVisibilityPanel;

