'use client';

import { useParams, useRouter } from 'next/navigation';

/**
 * Manual Recruiting Search Workspace
 * 
 * UI-only shell for order-scoped candidate search.
 * Route: /orders/[id]/vetting/manual-search
 * 
 * This is a contract surface for future search logic.
 * No backend, no mock data, no search logic implemented.
 */

export default function ManualSearchPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const router = useRouter();

  return (
    <div className="manual-search-page">
      {/* Header with Navigation */}
      <header className="page-header">
        <div className="breadcrumb">
          <button className="breadcrumb-link" onClick={() => router.push('/orders')}>
            Orders
          </button>
          <span className="breadcrumb-sep">/</span>
          <button className="breadcrumb-link" onClick={() => router.push(`/orders/${orderId}`)}>
            {orderId}
          </button>
          <span className="breadcrumb-sep">/</span>
          <button className="breadcrumb-link" onClick={() => router.push(`/orders/${orderId}/vetting`)}>
            Vetting
          </button>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Manual Search</span>
        </div>

        <div className="title-section">
          <div className="title-icon">🔍</div>
          <div className="title-content">
            <h1 className="page-title">Manual Recruiting Search</h1>
            <p className="page-subtitle">Order-scoped candidate search</p>
          </div>
        </div>
      </header>

      {/* Informational Banner */}
      <section className="info-banner">
        <div className="banner-icon">💡</div>
        <div className="banner-content">
          <p className="banner-text">
            Use this workspace to manually search for candidates for this order.
          </p>
        </div>
      </section>

      {/* Search Controls (Disabled) */}
      <section className="search-controls">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search candidates by name, trade, certification..."
            disabled
            title="Feature not yet active"
          />
          <button className="search-btn" disabled title="Feature not yet active">
            Search
          </button>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label className="filter-label">Trade</label>
            <select className="filter-select" disabled title="Feature not yet active">
              <option>All Trades</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Availability</label>
            <select className="filter-select" disabled title="Feature not yet active">
              <option>Any</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Distance</label>
            <select className="filter-select" disabled title="Feature not yet active">
              <option>Any Distance</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Certifications</label>
            <select className="filter-select" disabled title="Feature not yet active">
              <option>Any</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Empty State */}
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h2 className="empty-title">Search results will appear here</h2>
          <p className="empty-description">
            Use the search bar and filters above to find candidates for this order.
          </p>
        </div>
      </main>

      <style jsx>{`
        /* ============================================================
           INDUSTRIAL LIGHT V1 — Manual Search Shell Page
        ============================================================ */
        .manual-search-page {
          min-height: 100vh;
          background: #f8fafc;
          padding: 24px 40px 60px;
        }

        .page-header { margin-bottom: 24px; }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          font-size: 13px;
        }

        .breadcrumb-link {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          padding: 0;
          font-size: 13px;
          transition: color 0.12s ease;
        }

        .breadcrumb-link:hover { color: #2563eb; text-decoration: underline; }
        .breadcrumb-sep { color: #d1d5db; }

        .breadcrumb-current {
          color: #374151;
          font-weight: 500;
        }

        .title-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .title-icon {
          font-size: 28px;
          width: 52px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
        }

        .title-content { flex: 1; }

        .page-title {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.3px;
        }

        .page-subtitle {
          margin: 4px 0 0 0;
          font-size: 14px;
          color: #6b7280;
        }

        /* Info Banner */
        .info-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 18px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          margin-bottom: 24px;
        }

        .banner-icon { font-size: 18px; flex-shrink: 0; }
        .banner-content { flex: 1; }

        .banner-text {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: #374151;
        }

        /* Search Controls */
        .search-controls { margin-bottom: 24px; }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .search-icon {
          font-size: 16px;
          opacity: 0.5;
        }

        .search-input {
          flex: 1;
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 13px;
          outline: none;
        }

        .search-input::placeholder { color: #d1d5db; }
        .search-input:disabled { cursor: not-allowed; }

        .search-btn {
          padding: 7px 18px;
          background: #f1f5f9;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #9ca3af;
          font-size: 13px;
          font-weight: 600;
          cursor: not-allowed;
        }

        .search-btn:disabled { opacity: 0.65; }

        .filter-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 150px;
        }

        .filter-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #374151;
        }

        .filter-select {
          padding: 8px 11px;
          background: #f1f5f9;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #9ca3af;
          font-size: 13px;
          cursor: not-allowed;
          outline: none;
        }

        .filter-select option {
          background: #ffffff;
          color: #111827;
        }

        .filter-select:disabled { opacity: 0.65; }

        .main-content { flex: 1; }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          background: #ffffff;
          border: 1px dashed #d1d5db;
          border-radius: 12px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.6;
        }

        .empty-title {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 700;
          color: #111827;
        }

        .empty-description {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
          max-width: 400px;
        }
      `}</style>
    </div>
  );
}
