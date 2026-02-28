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
        .jarvis-matches-page {
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
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
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
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 10px;
          margin-bottom: 32px;
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
          margin: 0 0 32px 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Action Buttons */
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
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: not-allowed;
          transition: all 0.2s ease;
        }

        .action-btn.primary {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%);
          border: 1px solid rgba(139, 92, 246, 0.4);
          color: rgba(255, 255, 255, 0.5);
        }

        .action-btn.secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.5);
        }

        .action-btn:disabled {
          opacity: 0.6;
        }

        .btn-icon {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}
