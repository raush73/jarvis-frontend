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
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }
        .metric-value {
          font-size: 20px;
          font-weight: 700;
          line-height: 1.2;
          color: #111827;
        }
        .metric-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #6b7280;
          margin-top: 2px;
        }
        .metric-neutral .metric-value { color: #374151; }
        .metric-info .metric-value { color: #2563eb; }
        .metric-info { border-color: #bfdbfe; background: #eff6ff; }
        .metric-warning .metric-value { color: #d97706; }
        .metric-warning { border-color: #fde68a; background: #fffbeb; }
        .metric-success .metric-value { color: #16a34a; }
        .metric-success { border-color: #bbf7d0; background: #f0fdf4; }
        .metric-active .metric-value { color: #7c3aed; }
        .metric-active { border-color: #ddd6fe; background: #f5f3ff; }
        .metric-completed .metric-value { color: #9ca3af; }
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
    background: #ffffff;
    border: 1px solid #e5e7eb;
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
    color: #111827;
    margin: 0;
  }
  .trade-dates {
    font-size: 13px;
    color: #6b7280;
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
    color: #9ca3af;
    font-size: 14px;
    font-style: italic;
    border-top: 1px solid #f1f5f9;
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
    background: #f1f5f9;
    border-radius: 8px 8px 0 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #374151;
  }
  .table-row {
    display: grid;
    grid-template-columns: 1.5fr 1.5fr 1fr 1fr 1fr;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid #f1f5f9;
    align-items: center;
  }
  .table-row:last-child { border-bottom: none; }
  .table-row:hover { background: #f9fafb; }
  .col-name { font-size: 14px; font-weight: 600; color: #111827; }
  .col-email { font-size: 13px; color: #4b5563; }
  .col-status { font-size: 13px; }
  .col-start, .col-end { font-size: 13px; color: #374151; }
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
  .status-dispatched { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .status-on-assignment { background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; }
  .status-completed { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .status-cancelled { background: #fff1f2; color: #dc2626; border: 1px solid #fecaca; }
  .status-no-show { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
  .status-unknown { background: #f8fafc; color: #6b7280; border: 1px solid #e5e7eb; }
`;

const pageStyles = `
  /* ============================================================
     INDUSTRIAL LIGHT V1 — Dispatch Roster Page
  ============================================================ */
  .dispatch-page {
    min-height: 100vh;
    background: #f8fafc;
    padding: 24px 40px 60px;
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
    border: 3px solid #e5e7eb;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 16px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text {
    font-size: 14px;
    color: #6b7280;
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
    background: #fff1f2;
    border: 2px solid #fecaca;
    color: #dc2626;
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
    color: #111827;
    margin: 0 0 10px;
  }
  .error-message {
    font-size: 14px;
    color: #6b7280;
    margin: 0 0 24px;
    line-height: 1.5;
  }
  .error-actions {
    display: flex;
    gap: 12px;
  }

  /* Header */
  .page-header {
    margin-bottom: 28px;
    max-width: 1100px;
  }
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }
  .breadcrumb-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
    color: #6b7280;
    cursor: pointer;
    transition: color 0.12s ease;
  }
  .breadcrumb-link:hover { color: #2563eb; text-decoration: underline; }
  .breadcrumb-sep { color: #d1d5db; }
  .breadcrumb-current { font-size: 13px; color: #374151; font-weight: 500; }
  .header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
  }
  .page-title {
    margin: 0 0 6px;
    font-size: 26px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.3px;
  }
  .page-subtitle {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .customer-name {
    color: #374151;
    font-weight: 600;
  }
  .order-status-badge {
    display: inline-block;
    padding: 2px 8px;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .order-id {
    font-family: 'SF Mono', ui-monospace, monospace;
    font-size: 12px;
    color: #9ca3af;
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
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }
  .empty-icon-large {
    font-size: 48px;
    margin-bottom: 20px;
    opacity: 0.6;
  }
  .empty-title {
    font-size: 20px;
    font-weight: 700;
    margin: 0 0 10px;
    color: #111827;
  }
  .empty-text {
    font-size: 14px;
    color: #6b7280;
    margin: 0 0 24px;
    line-height: 1.6;
  }

  /* Buttons */
  .primary-btn {
    padding: 10px 22px;
    background: #2563eb;
    border: none;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    transition: background 0.12s ease;
  }
  .primary-btn:hover { background: #1d4ed8; }
  .secondary-btn {
    padding: 10px 20px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .secondary-btn:hover { background: #f1f5f9; border-color: #d1d5db; }

  /* Footer */
  .dispatch-footer {
    max-width: 1100px;
    padding-top: 24px;
    border-top: 1px solid #e5e7eb;
    margin-top: 12px;
  }

  /* Print */
  @media print {
    .dispatch-page {
      background: #fff;
      padding: 20px;
    }
    .dispatch-footer { display: none; }
    .breadcrumb { display: none; }
  }
`;

