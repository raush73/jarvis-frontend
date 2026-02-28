'use client';

import { useRouter } from 'next/navigation';

/**
 * Customer Portal Landing / Dashboard Page - UI Shell Only
 * 
 * Simple landing shell for the customer portal.
 * Placeholder copy (mock only).
 * No live data.
 * No actions.
 * 
 * Route: /customer
 */

export default function CustomerPortalLandingPage() {
  const router = useRouter();

  return (
    <div className="customer-landing-page">
      {/* Demo Warning Banner */}
      <div className="demo-banner">
        <span className="demo-icon">!</span>
        <span className="demo-text">UI Shell / Mock Data / Demo Only</span>
      </div>

      {/* Welcome Section */}
      <section className="welcome-section">
        <h1 className="welcome-title">Welcome to Your Portal</h1>
        <p className="welcome-subtitle">
          View dispatch details, timesheets, and order information for your active projects.
        </p>
      </section>

      {/* Quick Actions */}
      <section className="quick-actions">
        <h2 className="section-title">Quick Access</h2>
        <div className="actions-grid">
          {/* Orders Card */}
          <button
            type="button"
            className="action-card"
            onClick={() => router.push('/customer/orders')}
          >
            <div className="card-icon">[O]</div>
            <div className="card-content">
              <span className="card-title">Your Orders</span>
              <span className="card-description">View dispatch details and assigned workers</span>
            </div>
            <span className="card-arrow">{">"}</span>
          </button>

          {/* Timesheets Card (links to orders, which link to timesheets) */}
          <button
            type="button"
            className="action-card action-card-secondary"
            onClick={() => router.push('/customer/orders')}
          >
            <div className="card-icon">TS</div>
            <div className="card-content">
              <span className="card-title">Timesheets</span>
              <span className="card-description">Review submitted hours for your orders</span>
            </div>
            <span className="card-arrow">{">"}</span>
          </button>
        </div>
      </section>

      {/* Info Cards */}
      <section className="info-section">
        <div className="info-grid">
          {/* Portal Info Card */}
          <div className="info-card">
            <div className="info-icon">i</div>
            <div className="info-content">
              <span className="info-title">Read-Only Access</span>
              <p className="info-text">
                This portal provides read-only access to your order information. 
                For changes or questions, please contact your account representative.
              </p>
            </div>
          </div>

          {/* Support Card */}
          <div className="info-card">
            <div className="info-icon">[S]</div>
            <div className="info-content">
              <span className="info-title">Need Help?</span>
              <p className="info-text">
                Contact your MW4H account representative for assistance with orders, 
                dispatches, or timesheet inquiries.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Placeholder Stats (Mock UI Only) */}
      <section className="stats-section">
        <h2 className="section-title">Overview</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">-</span>
            <span className="stat-label">Active Orders</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">-</span>
            <span className="stat-label">Workers Assigned</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">-</span>
            <span className="stat-label">Pending Timesheets</span>
          </div>
        </div>
        <p className="stats-note">Statistics will be populated when connected to live data.</p>
      </section>

      <style jsx>{`
        .customer-landing-page {
          min-height: 100%;
          padding: 32px 40px 60px;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #fff;
        }

        /* Demo Banner */
        .demo-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 10px 20px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          margin-bottom: 40px;
        }

        .demo-icon {
          font-size: 14px;
        }

        .demo-text {
          font-size: 12px;
          font-weight: 600;
          color: #fbbf24;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Welcome Section */
        .welcome-section {
          margin-bottom: 48px;
          max-width: 700px;
        }

        .welcome-title {
          margin: 0 0 12px 0;
          font-size: 42px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #86efac 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.5px;
        }

        .welcome-subtitle {
          margin: 0;
          font-size: 17px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.6;
        }

        /* Section Titles */
        .section-title {
          margin: 0 0 20px 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Quick Actions */
        .quick-actions {
          margin-bottom: 48px;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          max-width: 900px;
        }

        .action-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 28px;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .action-card:hover {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%);
          border-color: rgba(34, 197, 94, 0.35);
          transform: translateX(4px);
        }

        .action-card-secondary {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%);
          border-color: rgba(139, 92, 246, 0.2);
        }

        .action-card-secondary:hover {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%);
          border-color: rgba(139, 92, 246, 0.35);
        }

        .card-icon {
          font-size: 36px;
          flex-shrink: 0;
        }

        .card-content {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .card-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
        }

        .card-description {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.55);
        }

        .card-arrow {
          font-size: 24px;
          color: rgba(255, 255, 255, 0.4);
          transition: all 0.2s ease;
        }

        .action-card:hover .card-arrow {
          color: #86efac;
          transform: translateX(4px);
        }

        /* Info Section */
        .info-section {
          margin-bottom: 48px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          max-width: 900px;
        }

        .info-card {
          display: flex;
          gap: 16px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .info-icon {
          font-size: 24px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .info-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-title {
          font-size: 15px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
        }

        .info-text {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
        }

        /* Stats Section */
        .stats-section {
          max-width: 900px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 28px 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.25);
        }

        .stat-label {
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .stats-note {
          margin: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
          font-style: italic;
          text-align: center;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .customer-landing-page {
            padding: 24px 20px 40px;
          }

          .welcome-title {
            font-size: 32px;
          }

          .actions-grid {
            grid-template-columns: 1fr;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .action-card {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}

