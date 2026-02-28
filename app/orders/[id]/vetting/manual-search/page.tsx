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
        .manual-search-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          color: #fff;
          padding: 24px;
        }

        /* Header Styles */
        .page-header {
          margin-bottom: 24px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }

        .breadcrumb-link {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          padding: 0;
          font-size: 13px;
        }

        .breadcrumb-link:hover {
          color: #fff;
          text-decoration: underline;
        }

        .breadcrumb-sep {
          color: rgba(255, 255, 255, 0.3);
        }

        .breadcrumb-current {
          color: #fff;
          font-weight: 500;
        }

        .title-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .title-icon {
          font-size: 32px;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 12px;
        }

        .title-content {
          flex: 1;
        }

        .page-title {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: #fff;
        }

        .page-subtitle {
          margin: 4px 0 0 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Info Banner */
        .info-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 10px;
          margin-bottom: 24px;
        }

        .banner-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .banner-content {
          flex: 1;
        }

        .banner-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.85);
        }

        /* Search Controls */
        .search-controls {
          margin-bottom: 24px;
        }

        .search-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .search-icon {
          font-size: 18px;
          opacity: 0.5;
        }

        .search-input {
          flex: 1;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          outline: none;
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .search-input:disabled {
          cursor: not-allowed;
        }

        .search-btn {
          padding: 8px 20px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%);
          border: 1px solid rgba(34, 197, 94, 0.4);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          font-weight: 500;
          cursor: not-allowed;
        }

        .search-btn:disabled {
          opacity: 0.6;
        }

        .filter-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 150px;
        }

        .filter-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
        }

        .filter-select {
          padding: 10px 12px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          cursor: not-allowed;
        }

        .filter-select:disabled {
          opacity: 0.6;
        }

        /* Main Content */
        .main-content {
          flex: 1;
        }

        /* Empty State */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.7;
        }

        .empty-title {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .empty-description {
          margin: 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          max-width: 400px;
        }
      `}</style>
    </div>
  );
}
