'use client';

import { useParams, useRouter } from 'next/navigation';

/**
 * Jarvis Matches Workspace
 * 
 * UI-only shell for AI-generated candidate recommendations.
 * Route: /orders/[id]/vetting/jarvis-matches
 * 
 * This is a contract surface for future AI recommendation logic.
 * No backend, no mock data, no AI logic implemented.
 */

export default function JarvisMatchesPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const router = useRouter();

  return (
    <div className="jarvis-matches-page">
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
          <span className="breadcrumb-current">Jarvis Matches</span>
        </div>

        <div className="title-section">
          <div className="title-icon">🤖</div>
          <div className="title-content">
            <h1 className="page-title">Jarvis Matches</h1>
            <p className="page-subtitle">AI-generated recommendations for this order</p>
          </div>
        </div>
      </header>

      {/* Informational Banner */}
      <section className="info-banner">
        <div className="banner-icon">💡</div>
        <div className="banner-content">
          <p className="banner-text">
            Jarvis uses AI to recommend candidates based on order requirements, certifications, 
            tools, availability, and historical outcomes.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Empty State */}
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <h2 className="empty-title">AI analysis pending</h2>
          <p className="empty-description">
            Recommendations will appear here.
          </p>

          {/* Disabled Action Buttons */}
          <div className="action-buttons">
            <button className="action-btn primary" disabled title="Feature not yet active">
              <span className="btn-icon">📥</span>
              Pull to Vetting Lane
            </button>
            <button className="action-btn secondary" disabled title="Feature not yet active">
              <span className="btn-icon">❓</span>
              Why this candidate?
            </button>
          </div>
        </div>
      </main>

      <style jsx>{`
        /* ============================================================
           INDUSTRIAL LIGHT V1 — Jarvis Matches Shell Page
        ============================================================ */
        .jarvis-matches-page {
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
          background: #f5f3ff;
          border: 1px solid #ddd6fe;
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
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          margin-bottom: 28px;
        }

        .banner-icon { font-size: 18px; flex-shrink: 0; }
        .banner-content { flex: 1; }

        .banner-text {
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
          color: #374151;
        }

        .main-content { flex: 1; }

        /* Empty State */
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
          margin: 0 0 28px 0;
          font-size: 14px;
          color: #6b7280;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          cursor: not-allowed;
        }

        .action-btn.primary {
          background: #f5f3ff;
          border: 1px solid #ddd6fe;
          color: #9ca3af;
        }

        .action-btn.secondary {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          color: #9ca3af;
        }

        .action-btn:disabled { opacity: 0.6; }
        .btn-icon { font-size: 15px; }
      `}</style>
    </div>
  );
}
