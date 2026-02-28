'use client';

import { Trade, getOpenSlots, isTradeOverbooked } from '@/data/mockRecruitingData';

interface TradeCount {
  trade: Trade;
  countInBucket: number;
}

interface BucketTradeSummaryProps {
  tradeCounts: TradeCount[];
}

/**
 * Trade Summary Strip Component
 * 
 * Displays trade-level capacity for each bucket.
 * Format: Trade Name / X (open Y)
 * Shows ⚠️ warning when bucket count exceeds open slots
 */
export function BucketTradeSummary({ tradeCounts }: BucketTradeSummaryProps) {
  // Filter to only show trades with candidates in this bucket or with open slots
  const relevantTrades = tradeCounts.filter(
    tc => tc.countInBucket > 0 || getOpenSlots(tc.trade) > 0
  );

  if (relevantTrades.length === 0) {
    return null;
  }

  return (
    <div className="trade-summary-strip">
      {relevantTrades.map(({ trade, countInBucket }) => {
        const openSlots = getOpenSlots(trade);
        const overbooked = isTradeOverbooked(countInBucket, openSlots);

        return (
          <div
            key={trade.id}
            className={`trade-block ${overbooked ? 'trade-block--warning' : ''}`}
          >
            <span className="trade-name">{trade.name}</span>
            <span className="trade-count">
              {countInBucket}
              <span className="trade-open"> (open {openSlots})</span>
              {overbooked && (
                <span className="warning-icon" title="Exceeds open slots">
                  ⚠️
                </span>
              )}
            </span>
          </div>
        );
      })}

      <style jsx>{`
        .trade-summary-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .trade-block {
          display: flex;
          flex-direction: column;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          min-width: 90px;
        }

        .trade-block--warning {
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.3);
        }

        .trade-name {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .trade-count {
          font-size: 13px;
          font-weight: 500;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .trade-open {
          color: rgba(255, 255, 255, 0.5);
          font-weight: 400;
        }

        .warning-icon {
          font-size: 12px;
          margin-left: 2px;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

export default BucketTradeSummary;

