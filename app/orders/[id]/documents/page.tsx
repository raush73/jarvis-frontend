'use client';

import { useParams, useRouter } from 'next/navigation';
/**
 * Documents Page — UI Shell / Coming Soon
 * 
 * Placeholder for order-level document management.
 * This is a UI-only shell with no backend integration.
 */

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  return (
    <div className="documents-page">
      <div className="page-content">
        {/* Page Header */}
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
            <span className="breadcrumb-current">Documents</span>
          </div>
          <h1 className="page-title">📄 Documents</h1>
          <p className="page-subtitle">Order-level document repository and management</p>
        </header>

        {/* Coming Soon State */}
        <div className="coming-soon-container">
          <div className="coming-soon-icon">📄</div>
          <h2 className="coming-soon-title">UI Shell / Coming Soon</h2>
          <p className="coming-soon-desc">
            Document management for this order will be available in a future release.
            This page will include file uploads, version control, and document organization.
          </p>
          <div className="feature-preview">
            <h3>Planned Features</h3>
            <ul>
              <li>Contract and agreement storage</li>
              <li>Safety documentation repository</li>
              <li>Worker certifications and licenses</li>
              <li>Site-specific documents</li>
              <li>Version history and audit trail</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .documents-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .page-content {
          padding: 24px 40px 60px;
          max-width: 1000px;
          margin: 0 auto;
        }

        /* Page Header */
        .page-header {
          margin-bottom: 32px;
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

        .breadcrumb-link:hover {
          color: #60a5fa;
          text-decoration: underline;
        }

        .breadcrumb-sep {
          color: rgba(255, 255, 255, 0.3);
        }

        .breadcrumb-current {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
        }

        .page-title {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .page-subtitle {
          margin: 0;
          font-size: 15px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Coming Soon Container */
        .coming-soon-container {
          text-align: center;
          padding: 60px 40px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 16px;
        }

        .coming-soon-icon {
          font-size: 64px;
          margin-bottom: 24px;
          opacity: 0.6;
        }

        .coming-soon-title {
          font-size: 24px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 12px 0;
        }

        .coming-soon-desc {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.6);
          max-width: 500px;
          margin: 0 auto 32px;
          line-height: 1.6;
        }

        .feature-preview {
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          margin: 0 auto;
          text-align: left;
        }

        .feature-preview h3 {
          font-size: 14px;
          font-weight: 600;
          color: #a78bfa;
          margin: 0 0 16px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .feature-preview ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .feature-preview li {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
          padding: 8px 0;
          padding-left: 20px;
          position: relative;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .feature-preview li:last-child {
          border-bottom: none;
        }

        .feature-preview li::before {
          content: '○';
          position: absolute;
          left: 0;
          color: rgba(139, 92, 246, 0.6);
        }
      `}</style>
    </div>
  );
}

