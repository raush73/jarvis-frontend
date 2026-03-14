'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type {
  DispatchRosterResponse,
  DispatchTradeLine,
  OrderHeaderResponse,
} from '@/lib/types/dispatch-roster';

export default function DispatchOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [roster, setRoster] = useState<DispatchRosterResponse | null>(null);
  const [orderHeader, setOrderHeader] = useState<OrderHeaderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [rosterData, headerData] = await Promise.all([
          apiFetch<DispatchRosterResponse>(`/orders/${orderId}/dispatch-roster`),
          apiFetch<OrderHeaderResponse>(`/orders/${orderId}`).catch(() => null),
        ]);
        if (cancelled) return;
        setRoster(rosterData);
        setOrderHeader(headerData);
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load dispatch roster');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [orderId]);

  const customerName = orderHeader?.customer?.name ?? null;
  const orderStatus = orderHeader?.status ?? null;

  if (loading) {
    return (
    <div className="dispatch-page">
      <div style={{ background: "red", padding: "10px", fontWeight: "bold" }}>PHASE 7 DISPATCH ROSTER LIVE PAGE</div>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p className="loading-text">Loading dispatch roster...</p>
        </div>
        <style jsx>{pageStyles}</style>
      </div>
    );
  }

  if (error) {
    return (
    <div className="dispatch-page">
      <div style={{ background: "red", padding: "10px", fontWeight: "bold" }}>PHASE 7 DISPATCH ROSTER LIVE PAGE</div>
        <div className="error-container">
          <div className="error-icon">!</div>
          <h2 className="error-title">Failed to Load Dispatch Roster</h2>
          <p className="error-message">{error}</p>
          <div className="error-actions">
            <button className="primary-btn" onClick={() => window.location.reload()}>
              Retry
            </button>
            <button className="secondary-btn" onClick={() => router.push(`/orders/${orderId}`)}>
              Back to Order
            </button>
          </div>
        </div>
        <style jsx>{pageStyles}</style>
      </div>
    );
  }

  const tradeLines = roster?.tradeLines ?? [];

  return (
    <div className="dispatch-page">
      <div style={{ background: "red", padding: "10px", fontWeight: "bold" }}>PHASE 7 DISPATCH ROSTER LIVE PAGE</div>
      {/* Page Header */}
      <header className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => router.push('/orders')}>
            Orders
          </button>
          <span className="breadcrumb-sep">/</span>
          <button className="breadcrumb-link" onClick={() => router.push(`/orders/${orderId}`)}>
            {customerName ?? orderId}
          </button>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Dispatch Roster</span>
        </div>

        <div className="header-row">
          <div className="header-text">
            <h1 className="page-title">Dispatch Roster</h1>
            <p className="page-subtitle">
              {customerName && <span className="customer-name">{customerName}</span>}
              {orderStatus && <span className="order-status-badge">{orderStatus}</span>}
              <span className="order-id">Order {orderId}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Trade Lines */}
      {tradeLines.length === 0 ? (
        <div className="empty-state-page">
          <div className="empty-icon-large">&#9744;</div>
          <h2 className="empty-title">No Trade Lines</h2>
          <p className="empty-text">
            This order has no trade requirements configured yet.
            Trade lines and assignments will appear here once they are created.
          </p>
          <button
            className="secondary-btn"
            onClick={() => router.push(`/orders/${orderId}`)}
          >
            Back to Order
          </button>
        </div>
      ) : (
        <div className="trade-lines">
          {tradeLines.map((tl) => (
            <TradeLineCard key={tl.orderTradeRequirementId} tradeLine={tl} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="dispatch-footer">
        <button className="secondary-btn" onClick={() => router.push(`/orders/${orderId}`)}>
          &larr; Back to Order
        </button>
      </div>

      <style jsx>{pageStyles}</style>
    </div>
  );
}

function TradeLineCard({ tradeLine }: { tradeLine: DispatchTradeLine }) {
  const tl = tradeLine;
  const requested = tl.requestedHeadcount ?? 0;

  return (
    <div className="trade-card">
      <div className="trade-header">
        <div className="trade-title-row">
          <h2 className="trade-name">{tl.tradeName ?? 'Unknown Trade'}</h2>
          {tl.startDate && (
            <span className="trade-dates">
              {formatDate(tl.startDate)}
              {tl.expectedEndDate && <> &mdash; {formatDate(tl.expectedEndDate)}</>}
            </span>
          )}
        </div>

        {/* Seat Metrics */}
        <div className="seat-metrics">
          <MetricPill label="Requested" value={requested} variant="neutral" />
          <MetricPill label="Assigned" value={tl.assignedCount} variant="info" />
          <MetricPill label="Open" value={tl.openCount} variant={tl.openCount > 0 ? 'warning' : 'success'} />
          <MetricPill label="Dispatched" value={tl.dispatchedCount} variant="info" />
          <MetricPill label="On Assignment" value={tl.onAssignmentCount} variant="active" />
          <MetricPill label="Completed" value={tl.completedCount} variant="completed" />
        </div>
      </div>

      {/* Assignment Table */}
      {tl.assignments.length === 0 ? (
        <div className="empty-state-trade">
          No assigned workers yet.
        </div>
      ) : (
        <div className="assignment-table">
          <div className="table-header-row">
            <span className="col-name">Worker</span>
            <span className="col-email">Email</span>
            <span className="col-status">Status</span>
            <span className="col-start">Start Date</span>
            <span className="col-end">End Date</span>
          </div>
          {tl.assignments.map((a) => (
            <div key={a.assignmentId} className="table-row">
              <span className="col-name">{a.workerName ?? '—'}</span>
              <span className="col-email">{a.workerEmail ?? '—'}</span>
              <span className="col-status">
                <span className={`status-badge status-${(a.status ?? 'unknown').toLowerCase().replace(/_/g, '-')}`}>
                  {formatStatus(a.status)}
                </span>
              </span>
              <span className="col-start mono">{a.startDate ? formatDate(a.startDate) : '—'}</span>
              <span className="col-end mono">{a.endDate ? formatDate(a.endDate) : '—'}</span>
            </div>
          ))}
        </div>
      )}

      <style jsx>{tradeCardStyles}</style>
    </div>
  );
}

function MetricPill({ label, value, variant }: { label: string; value: number; variant: string }) {
  return (
    <div className={`metric-pill metric-${variant}`}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
      <style jsx>{`
        .metric-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 14px;
          border-radius: 8px;
          min-width: 72px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .metric-value {
          font-size: 20px;
          font-weight: 700;
          line-height: 1.2;
        }
        .metric-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 2px;
        }
        .metric-neutral .metric-value { color: rgba(255, 255, 255, 0.8); }
        .metric-info .metric-value { color: #60a5fa; }
        .metric-info { border-color: rgba(96, 165, 250, 0.2); background: rgba(96, 165, 250, 0.06); }
        .metric-warning .metric-value { color: #fbbf24; }
        .metric-warning { border-color: rgba(251, 191, 36, 0.2); background: rgba(251, 191, 36, 0.06); }
        .metric-success .metric-value { color: #34d399; }
        .metric-success { border-color: rgba(52, 211, 153, 0.2); background: rgba(52, 211, 153, 0.06); }
        .metric-active .metric-value { color: #a78bfa; }
        .metric-active { border-color: rgba(167, 139, 250, 0.2); background: rgba(167, 139, 250, 0.06); }
        .metric-completed .metric-value { color: rgba(255, 255, 255, 0.45); }
      `}</style>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatStatus(status: string | null): string {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const tradeCardStyles = `
  .trade-card {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .trade-header {
    margin-bottom: 20px;
  }
  .trade-title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }
  .trade-name {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    margin: 0;
  }
  .trade-dates {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    font-family: 'SF Mono', ui-monospace, monospace;
    white-space: nowrap;
  }
  .seat-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .empty-state-trade {
    text-align: center;
    padding: 28px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
    font-style: italic;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .assignment-table {
    display: flex;
    flex-direction: column;
  }
  .table-header-row {
    display: grid;
    grid-template-columns: 1.5fr 1.5fr 1fr 1fr 1fr;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px 8px 0 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.45);
  }
  .table-row {
    display: grid;
    grid-template-columns: 1.5fr 1.5fr 1fr 1fr 1fr;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    align-items: center;
  }
  .table-row:last-child { border-bottom: none; }
  .table-row:hover { background: rgba(255, 255, 255, 0.02); }
  .col-name { font-size: 14px; font-weight: 500; color: #fff; }
  .col-email { font-size: 13px; color: rgba(255, 255, 255, 0.6); }
  .col-status { font-size: 13px; }
  .col-start, .col-end { font-size: 13px; color: rgba(255, 255, 255, 0.65); }
  .mono { font-family: 'SF Mono', ui-monospace, monospace; }
  .status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .status-dispatched { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
  .status-on-assignment { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
  .status-completed { background: rgba(52, 211, 153, 0.15); color: #34d399; }
  .status-cancelled { background: rgba(239, 68, 68, 0.15); color: #f87171; }
  .status-no-show { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
  .status-unknown { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.5); }
`;

const pageStyles = `
  .dispatch-page {
    min-height: 100vh;
    background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
    color: #fff;
    padding: 24px 40px 60px;
    font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* Loading */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
  }
  .loading-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 16px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Error */
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    max-width: 480px;
    margin: 0 auto;
  }
  .error-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.15);
    border: 2px solid rgba(239, 68, 68, 0.4);
    color: #f87171;
    font-size: 24px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }
  .error-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 10px;
  }
  .error-message {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 24px;
    line-height: 1.5;
  }
  .error-actions {
    display: flex;
    gap: 12px;
  }

  /* Header */
  .page-header {
    margin-bottom: 32px;
    max-width: 1100px;
  }
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .breadcrumb-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .breadcrumb-link:hover { color: #60a5fa; text-decoration: underline; }
  .breadcrumb-sep { color: rgba(255, 255, 255, 0.3); }
  .breadcrumb-current { font-size: 13px; color: rgba(255, 255, 255, 0.8); }
  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
  }
  .page-title {
    margin: 0 0 6px;
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .page-subtitle {
    margin: 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .customer-name {
    color: rgba(255, 255, 255, 0.75);
    font-weight: 500;
  }
  .order-status-badge {
    display: inline-block;
    padding: 2px 8px;
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .order-id {
    font-family: 'SF Mono', ui-monospace, monospace;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
  }

  /* Trade Lines Container */
  .trade-lines {
    max-width: 1100px;
  }

  /* Page-level Empty State */
  .empty-state-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 40vh;
    max-width: 480px;
    margin: 0 auto;
    padding: 48px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 16px;
  }
  .empty-icon-large {
    font-size: 56px;
    margin-bottom: 20px;
    opacity: 0.5;
  }
  .empty-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0 0 10px;
    color: rgba(255, 255, 255, 0.85);
  }
  .empty-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0 24px;
    line-height: 1.6;
  }

  /* Buttons */
  .primary-btn {
    padding: 10px 24px;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .primary-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
  .secondary-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .secondary-btn:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); color: #fff; }

  /* Footer */
  .dispatch-footer {
    max-width: 1100px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    margin-top: 12px;
  }

  /* Print */
  @media print {
    .dispatch-page {
      background: #fff;
      color: #000;
      padding: 20px;
    }
    .dispatch-footer { display: none; }
    .breadcrumb { display: none; }
  }
`;

