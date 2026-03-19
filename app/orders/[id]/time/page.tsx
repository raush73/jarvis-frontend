'use client';

import { useParams, useRouter } from 'next/navigation';
import OrderNav from '@/components/OrderNav';

/**
 * Time Page — UI Shell / Coming Soon
 * 
 * Placeholder for order-level time tracking and timesheets.
 * This is a UI-only shell with no backend integration.
 */

export default function TimePage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  return (
    <div className="time-page">
      <OrderNav />
      
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
            <span className="breadcrumb-current">Time</span>
          </div>
          <h1 className="page-title">⏱️ Time Tracking</h1>
          <p className="page-subtitle">Order-level timesheets and time entries</p>
        </header>

        {/* Coming Soon State */}
        <div className="coming-soon-container">
          <div className="coming-soon-icon">⏱️</div>
          <h2 className="coming-soon-title">UI Shell / Coming Soon</h2>
          <p className="coming-soon-desc">
            Time tracking functionality for this order will be available in a future release.
            This page will include timesheet management, time entries, and approval workflows.
          </p>
          <div className="feature-preview">
            <h3>Planned Features</h3>
            <ul>
              <li>Weekly timesheet views</li>
              <li>Per-worker time entry management</li>
              <li>Time approval workflows</li>
              <li>Overtime tracking and alerts</li>
              <li>Export to payroll systems</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ============================================================
           INDUSTRIAL LIGHT V1 — Time Tracking Shell Page
        ============================================================ */
        .time-page {
          min-height: 100vh;
          background: #f8fafc;
        }

        .page-content {
          padding: 24px 40px 60px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 28px;
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

        .breadcrumb-link:hover {
          color: #2563eb;
          text-decoration: underline;
        }

        .breadcrumb-sep {
          color: #d1d5db;
        }

        .breadcrumb-current {
          font-size: 13px;
          color: #374151;
          font-weight: 500;
        }

        .page-title {
          margin: 0 0 6px 0;
          font-size: 26px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.3px;
        }

        .page-subtitle {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }

        .coming-soon-container {
          text-align: center;
          padding: 60px 40px;
          background: #ffffff;
          border: 1px dashed #d1d5db;
          border-radius: 12px;
        }

        .coming-soon-icon {
          font-size: 56px;
          margin-bottom: 20px;
        }

        .coming-soon-title {
          font-size: 22px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 10px 0;
        }

        .coming-soon-desc {
          font-size: 14px;
          color: #6b7280;
          max-width: 500px;
          margin: 0 auto 28px;
          line-height: 1.6;
        }

        .feature-preview {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 20px 24px;
          max-width: 400px;
          margin: 0 auto;
          text-align: left;
        }

        .feature-preview h3 {
          font-size: 11px;
          font-weight: 700;
          color: #374151;
          margin: 0 0 14px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .feature-preview ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .feature-preview li {
          font-size: 13px;
          color: #4b5563;
          padding: 7px 0;
          padding-left: 18px;
          position: relative;
          border-bottom: 1px solid #f1f5f9;
        }

        .feature-preview li:last-child {
          border-bottom: none;
        }

        .feature-preview li::before {
          content: '○';
          position: absolute;
          left: 0;
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}

