'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { mockOrder, Candidate } from '@/data/mockRecruitingData';
/**
 * Dispatch Order Page — UI Shell / Demo Only
 * 
 * A read-only, printable-style "dispatch packet" view.
 * This is a MOCK/DEMO page with no backend integration.
 * 
 * DOMAIN INVARIANTS (per governance):
 * - Certifications are GATING (missing required cert = Gate Closed)
 * - PPE is ALWAYS listed (full list shown for safety)
 * - Tools are NON-GATING (missing tools highlighted, but do not close gate)
 * 
 * UI-E.5 DISPATCH PRESENCE:
 * - hasDispatch: UI-only flag to simulate dispatch existence
 * - Never shows dead-end; always provides clear next action
 * - Sample dispatch can be rendered for any order
 */

// Mock PPE list (FULL list always shown per spec)
const REQUIRED_PPE = [
  'Hard Hat',
  'Safety Glasses',
  'Hi-Vis Vest',
  'Gloves',
  'Steel-Toe Boots',
  'FR Clothing',
];

// Mock tools list (required for job, non-gating)
const REQUIRED_TOOLS = [
  'Torque Wrenches',
  'Dial Indicators',
  'Laser Alignment Kit',
  'Rigging Equipment',
  'Multimeter',
  'Pipe Wrenches',
];

// Mock certifications required (GATING)
const REQUIRED_CERTS = [
  'OSHA 30',
  'First Aid/CPR',
  'Confined Space Entry',
];

// Mock order data lookup (keyed by order ID)
const MOCK_ORDERS: Record<string, typeof mockOrder> = {
  'ord_001': mockOrder,
  // Additional mock orders can be added here
};

export default function DispatchOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  // Share actions UI state
  const [linkCopied, setLinkCopied] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  /**
   * UI-ONLY: Dispatch presence state
   * - hasDispatch: simulates whether a dispatch exists for this order
   * - Default: true for known orders (ord_001), false for unknown orders
   * - User can toggle via "View Sample Dispatch" to see dispatch document
   */
  const knownOrder = MOCK_ORDERS[orderId];
  const [hasDispatch, setHasDispatch] = useState<boolean>(!!knownOrder);

  // Use known order data OR fallback to sample data for demo
  const order = knownOrder || (hasDispatch ? mockOrder : null);

  /**
   * UI-ONLY: Copy a mock/placeholder link to clipboard
   * This is demo functionality only — no real link is generated.
   */
  const handleCopyLink = async () => {
    const mockUrl = `https://jarvisprime.local/dispatch/SHARE_TOKEN_${orderId}`;
    try {
      await navigator.clipboard.writeText(mockUrl);
      setLinkCopied(true);
      // Reset the confirmation after 3 seconds
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      // Fallback for browsers without clipboard API
      alert(`Demo link (copy manually): ${mockUrl}`);
    }
  };

  /**
   * UI-ONLY: Show email modal explaining feature is not yet wired
   */
  const handleEmailPM = () => {
    setShowEmailModal(true);
  };

  /**
   * UI-ONLY: Handle viewing sample dispatch
   * Sets hasDispatch to true to render sample dispatch document
   */
  const handleViewSampleDispatch = () => {
    setHasDispatch(true);
  };

  /**
   * UI-ONLY: Toggle dispatch state (for demo/testing purposes)
   * Allows user to toggle between "has dispatch" and "no dispatch" states
   */
  const handleToggleDispatch = () => {
    setHasDispatch(!hasDispatch);
  };

  // Empty State: Dispatch not yet created (UI-ONLY)
  // This is shown when hasDispatch is false - never a dead end
  if (!order) {
    return (
      <div className="dispatch-order-page">
        {/* Demo Warning Banner */}
        <div className="demo-banner">
          <span className="demo-icon">⚠️</span>
          <span className="demo-text">UI Shell / Mock Data / Demo Only</span>
        </div>

        <div className="empty-state-container">
          <div className="empty-state-card">
            <div className="empty-icon">📋</div>
            <h1 className="empty-title">Dispatch Not Yet Created</h1>
            <p className="empty-message">
              Dispatch has not yet been created for this order.
            </p>
            <p className="empty-order-id">
              Order: <code>{orderId}</code>
            </p>

            <div className="empty-actions">
              <button 
                className="primary-action-btn"
                onClick={handleViewSampleDispatch}
              >
                <span className="btn-icon">📄</span>
                <span className="btn-text">View Sample Dispatch</span>
              </button>
              <p className="action-hint">
                Preview what a dispatch document looks like with sample data
              </p>
            </div>

            <div className="empty-footer">
              <button 
                className="secondary-btn"
                onClick={() => router.push(`/orders/${orderId}`)}
              >
                ← Back to Order
              </button>
              <button 
                className="secondary-btn"
                onClick={() => router.push('/orders')}
              >
                View All Orders
              </button>
            </div>
          </div>

          {/* Demo Label */}
          <div className="demo-label">
            <span className="demo-label-icon">🎭</span>
            <span className="demo-label-text">
              This empty state is UI-only demonstration
            </span>
          </div>
        </div>

        <style jsx>{`
          .dispatch-order-page {
            min-height: 100vh;
            background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
            color: #fff;
            padding: 24px 40px 60px;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
          }

          .demo-banner {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 12px 20px;
            background: rgba(245, 158, 11, 0.15);
            border: 1px solid rgba(245, 158, 11, 0.3);
            border-radius: 8px;
            margin-bottom: 40px;
          }

          .demo-icon {
            font-size: 16px;
          }

          .demo-text {
            font-size: 13px;
            font-weight: 600;
            color: #fbbf24;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .empty-state-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 240px);
          }

          .empty-state-card {
            text-align: center;
            max-width: 480px;
            padding: 48px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            backdrop-filter: blur(10px);
          }

          .empty-icon {
            font-size: 72px;
            margin-bottom: 24px;
            opacity: 0.6;
          }

          .empty-title {
            font-size: 26px;
            font-weight: 700;
            margin: 0 0 12px 0;
            background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .empty-message {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.7);
            margin: 0 0 8px 0;
            line-height: 1.5;
          }

          .empty-order-id {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.4);
            margin: 0 0 32px 0;
          }

          .empty-order-id code {
            font-family: 'SF Mono', monospace;
            background: rgba(255, 255, 255, 0.08);
            padding: 2px 8px;
            border-radius: 4px;
            color: rgba(255, 255, 255, 0.6);
          }

          .empty-actions {
            margin-bottom: 32px;
          }

          .primary-action-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 16px 32px;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            border: none;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            color: #fff;
            cursor: pointer;
            transition: all 0.25s ease;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
          }

          .primary-action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
          }

          .primary-action-btn:active {
            transform: translateY(0);
          }

          .primary-action-btn .btn-icon {
            font-size: 18px;
          }

          .action-hint {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
            margin: 14px 0 0 0;
            font-style: italic;
          }

          .empty-footer {
            display: flex;
            justify-content: center;
            gap: 12px;
            padding-top: 24px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
          }

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

          .secondary-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
            color: #fff;
          }

          .demo-label {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 24px;
            padding: 10px 16px;
            background: rgba(139, 92, 246, 0.1);
            border: 1px solid rgba(139, 92, 246, 0.2);
            border-radius: 8px;
          }

          .demo-label-icon {
            font-size: 14px;
          }

          .demo-label-text {
            font-size: 12px;
            color: #a78bfa;
            font-weight: 500;
          }
        `}</style>
      </div>
    );
  }

  // Get dispatched workers
  const dispatchedBucket = order.buckets.find(b => b.id === 'dispatched');
  const assignedWorkers = dispatchedBucket?.candidates || [];

  // Demo: determine cert gate status
  // In demo, we assume some workers may be missing certs
  const certGateStatus = computeCertGateStatus(assignedWorkers, REQUIRED_CERTS);

  // Determine if viewing sample data (unknown order using mockOrder fallback)
  const isViewingSample = !knownOrder && hasDispatch;

  return (
    <div className="dispatch-order-page">
      {/* Demo Warning Banner */}
      <div className="demo-banner">
        <span className="demo-icon">⚠️</span>
        <span className="demo-text">UI Shell / Mock Data / Demo Only</span>
      </div>

      {/* Sample Dispatch Banner - shown when viewing sample data for unknown order */}
      {isViewingSample && (
        <div className="sample-dispatch-banner">
          <div className="sample-banner-content">
            <span className="sample-icon">📄</span>
            <div className="sample-text">
              <span className="sample-title">Viewing Sample Dispatch</span>
              <span className="sample-subtitle">
                This is a sample dispatch document for demonstration. Order <code>{orderId}</code> does not have real dispatch data.
              </span>
            </div>
          </div>
          <button 
            className="reset-sample-btn"
            onClick={handleToggleDispatch}
          >
            View Empty State
          </button>
        </div>
      )}

      {/* Page Header */}
      <header className="page-header">
        <div className="header-top-row">
          <div className="breadcrumb">
            <button className="breadcrumb-link" onClick={() => router.push('/orders')}>
              Orders
            </button>
            <span className="breadcrumb-sep">/</span>
            <button className="breadcrumb-link" onClick={() => router.push(`/orders/${orderId}`)}>
              {order.projectName}
            </button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">Dispatch Order</span>
          </div>

          {/* Share Actions — UI-ONLY / Demo */}
          <div className="share-actions">
            <span className="share-label">Share</span>
            <button 
              className={`share-btn copy-link-btn ${linkCopied ? 'copied' : ''}`}
              onClick={handleCopyLink}
            >
              {linkCopied ? (
                <>
                  <span className="btn-icon">✓</span>
                  <span className="btn-text">Link copied (demo)</span>
                </>
              ) : (
                <>
                  <span className="btn-icon">🔗</span>
                  <span className="btn-text">Copy Link</span>
                </>
              )}
            </button>
            <button 
              className="share-btn email-pm-btn"
              onClick={handleEmailPM}
            >
              <span className="btn-icon">✉️</span>
              <span className="btn-text">Email PM</span>
            </button>
          </div>
        </div>

        <h1 className="page-title">📋 Dispatch Order</h1>
        <p className="page-subtitle">Printable dispatch packet for {order.projectName}</p>
      </header>

      {/* Email PM Modal — UI-ONLY / Demo */}
      {showEmailModal && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">✉️</div>
            <h2 className="modal-title">Email Delivery</h2>
            <p className="modal-message">
              Email delivery will be enabled when backend wiring is complete.
            </p>
            <p className="modal-note">
              This is a UI demonstration only. No emails are sent.
            </p>
            <button 
              className="modal-close-btn"
              onClick={() => setShowEmailModal(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* UI NOTE: Show only when an Approved RCO has issued a dispatch amendment */}
      {/* Dispatch Amendment Panel — READ-ONLY, SYSTEM-ISSUED */}
      <div className="dispatch-amendment-panel">
        <div className="amendment-header">
          <h2 className="amendment-title">Dispatch Amendment</h2>
          <span className="amendment-badge">Amended</span>
        </div>

        <div className="amendment-content">
          <div className="amendment-row">
            <span className="amendment-label">Dispatch Version</span>
            <div className="amendment-value-group">
              <span className="amendment-value version-value">v2 (Amended)</span>
              <span className="amendment-subtext">Previous version: v1</span>
            </div>
          </div>

          <div className="amendment-row">
            <span className="amendment-label">Amendment Source</span>
            <div className="amendment-value-group">
              <span className="amendment-value">Rate Change Order</span>
              <span className="amendment-subtext">Reference: RCO #RCO-1042</span>
            </div>
          </div>

          <div className="amendment-row">
            <span className="amendment-label">Effective Date</span>
            <span className="amendment-value">Effective: Feb 5, 2026</span>
          </div>

          <div className="amendment-summary">
            <span className="summary-label">Amendment Summary</span>
            <ul className="summary-list">
              <li>Billing rate updated per approved change order</li>
              <li>Effective mid-assignment</li>
              <li>Original dispatch preserved for audit</li>
            </ul>
          </div>

          <p className="amendment-audit-note">
            This dispatch packet was amended due to an approved Rate Change Order. No new dispatch was created.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="dispatch-content">
        {/* Top Section - Two Columns */}
        <div className="top-section">
          {/* Left Column: Order Info */}
          <div className="info-column">
            <div className="info-card">
              <h2 className="card-title">Order Details</h2>
              <div className="info-row">
                <span className="info-label">Customer</span>
                <span className="info-value">{order.customerName}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Job Site</span>
                <span className="info-value">{order.location}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Start Date</span>
                <span className="info-value">{formatDate(order.startDate)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">End Date</span>
                <span className="info-value">{formatDate(order.endDate)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Order ID</span>
                <span className="info-value mono">{order.id}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Dispatch Readiness */}
          <div className="readiness-column">
            <div className="readiness-card">
              <h2 className="card-title">Dispatch Readiness (Demo)</h2>
              
              {/* Cert Gate Status */}
              <div className={`gate-status ${certGateStatus.isOpen ? 'gate-open' : 'gate-closed'}`}>
                <div className="gate-header">
                  <span className="gate-icon">{certGateStatus.isOpen ? '✓' : '✗'}</span>
                  <span className="gate-label">Certification Gate</span>
                </div>
                <span className="gate-value">
                  {certGateStatus.isOpen ? 'OPEN' : 'CLOSED'} (Demo)
                </span>
                {!certGateStatus.isOpen && (
                  <span className="gate-reason">{certGateStatus.reason}</span>
                )}
              </div>

              {/* PPE Note */}
              <div className="readiness-note ppe-note">
                <span className="note-icon">🦺</span>
                <div className="note-content">
                  <span className="note-title">PPE Requirements</span>
                  <span className="note-text">Full PPE list always required — see below</span>
                </div>
              </div>

              {/* Tools Note */}
              <div className="readiness-note tools-note">
                <span className="note-icon">🔧</span>
                <div className="note-content">
                  <span className="note-title">Tools</span>
                  <span className="note-text">Non-gating — missing tools highlighted below</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Assigned Workers */}
        <section className="dispatch-section">
          <h2 className="section-title">
            <span className="section-icon">👷</span>
            Assigned Workers
            <span className="section-count">{assignedWorkers.length}</span>
          </h2>
          {assignedWorkers.length === 0 ? (
            <div className="empty-state">No workers currently dispatched</div>
          ) : (
            <div className="workers-table">
              <div className="table-header">
                <span className="col-name">Name</span>
                <span className="col-trade">Trade</span>
                <span className="col-date">Start Date</span>
                <span className="col-contact">Contact</span>
                <span className="col-certs">Certifications</span>
              </div>
              {assignedWorkers.map(worker => (
                <div key={worker.id} className="table-row">
                  <span className="col-name">{worker.name}</span>
                  <span className="col-trade">
                    <span className="trade-badge">{worker.tradeName}</span>
                  </span>
                  <span className="col-date mono">{worker.dispatchStartDate || '—'}</span>
                  <span className="col-contact">
                    <span className="contact-phone">{worker.phone}</span>
                  </span>
                  <span className="col-certs">
                    {worker.certifications.map(cert => (
                      <span 
                        key={cert.id} 
                        className={`cert-badge ${cert.verified ? 'verified' : 'unverified'}`}
                      >
                        {cert.verified ? '✓' : '○'} {cert.name}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Required Certifications (GATING) */}
        <section className="dispatch-section">
          <h2 className="section-title">
            <span className="section-icon">📜</span>
            Required Certifications
            <span className="gating-badge">GATING</span>
          </h2>
          <p className="section-note">
            Missing required certifications will <strong>close the dispatch gate</strong>. 
            All workers must have these certifications verified before dispatch.
          </p>
          <ul className="requirement-list cert-list">
            {REQUIRED_CERTS.map(cert => (
              <li key={cert} className="requirement-item">
                <span className="item-icon">📜</span>
                <span className="item-name">{cert}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3: Required PPE (ALWAYS SHOWN) */}
        <section className="dispatch-section">
          <h2 className="section-title">
            <span className="section-icon">🦺</span>
            Required PPE
            <span className="always-badge">ALWAYS REQUIRED</span>
          </h2>
          <p className="section-note">
            Full PPE list is <strong>always displayed</strong> for safety compliance. 
            All items are mandatory for site access.
          </p>
          <ul className="requirement-list ppe-list">
            {REQUIRED_PPE.map(item => (
              <li key={item} className="requirement-item">
                <span className="item-icon">🦺</span>
                <span className="item-name">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 4: Required Tools (NON-GATING) */}
        <section className="dispatch-section">
          <h2 className="section-title">
            <span className="section-icon">🔧</span>
            Required Tools
            <span className="non-gating-badge">NON-GATING</span>
          </h2>
          <p className="section-note">
            Tools are <strong>non-gating</strong> — missing tools are highlighted but do not prevent dispatch.
            Workers should coordinate tool availability with site supervisor.
          </p>
          <ul className="requirement-list tools-list">
            {REQUIRED_TOOLS.map(tool => (
              <li key={tool} className="requirement-item">
                <span className="item-icon">🔧</span>
                <span className="item-name">{tool}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer Actions */}
        <div className="dispatch-footer">
          <button className="action-btn disabled" disabled title="Future functionality">
            🖨️ Print Dispatch Order (Future)
          </button>
          <button className="action-btn disabled" disabled title="Demo only">
            📧 Email to Workers (Demo)
          </button>
          <button className="back-link" onClick={() => router.push(`/orders/${orderId}`)}>
            ← Back to Order
          </button>
        </div>
      </div>

      <style jsx>{`
        .dispatch-order-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0c0f14 0%, #111827 100%);
          color: #fff;
          padding: 24px 40px 60px;
          font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Demo Banner */
        .demo-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 20px;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .demo-icon {
          font-size: 16px;
        }

        .demo-text {
          font-size: 13px;
          font-weight: 600;
          color: #fbbf24;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Sample Dispatch Banner */
        .sample-dispatch-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 10px;
          margin-bottom: 24px;
        }

        .sample-banner-content {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .sample-icon {
          font-size: 24px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .sample-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sample-title {
          font-size: 14px;
          font-weight: 600;
          color: #a5b4fc;
        }

        .sample-subtitle {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.4;
        }

        .sample-subtitle code {
          font-family: 'SF Mono', monospace;
          background: rgba(255, 255, 255, 0.1);
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
        }

        .reset-sample-btn {
          flex-shrink: 0;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.75);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .reset-sample-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          color: #fff;
        }

        /* Page Header */
        .page-header {
          margin-bottom: 32px;
        }

        .header-top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 16px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Share Actions */
        .share-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .share-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.4);
          padding-right: 6px;
        }

        .share-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .share-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .share-btn:active {
          transform: translateY(0);
        }

        .share-btn .btn-icon {
          font-size: 14px;
        }

        .share-btn .btn-text {
          white-space: nowrap;
        }

        .copy-link-btn.copied {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.4);
          color: #34d399;
        }

        .email-pm-btn {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(99, 102, 241, 0.25);
          color: #a5b4fc;
        }

        .email-pm-btn:hover {
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.4);
        }

        /* Email Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: linear-gradient(180deg, #1e2330 0%, #171c28 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 40px;
          max-width: 420px;
          text-align: center;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
          animation: slideUp 0.25s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .modal-title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 16px 0;
          color: #fff;
        }

        .modal-message {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.85);
          margin: 0 0 12px 0;
          line-height: 1.5;
        }

        .modal-note {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.45);
          margin: 0 0 28px 0;
          padding: 10px 16px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
        }

        .modal-close-btn {
          padding: 12px 32px;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-close-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
        }

        .modal-close-btn:active {
          transform: translateY(0);
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
          font-size: 32px;
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

        /* Dispatch Amendment Panel — READ-ONLY */
        .dispatch-amendment-panel {
          background: rgba(139, 92, 246, 0.06);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
          max-width: 1100px;
        }

        .amendment-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.15);
        }

        .amendment-title {
          font-size: 16px;
          font-weight: 600;
          color: #c4b5fd;
          margin: 0;
          letter-spacing: 0.3px;
        }

        .amendment-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          border-radius: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .amendment-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .amendment-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }

        .amendment-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
        }

        .amendment-value-group {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .amendment-value {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
          text-align: right;
        }

        .amendment-value.version-value {
          color: #c4b5fd;
        }

        .amendment-subtext {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.4);
        }

        .amendment-summary {
          padding: 16px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }

        .summary-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 12px;
        }

        .summary-list {
          margin: 0;
          padding-left: 20px;
          list-style-type: disc;
        }

        .summary-list li {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.6;
          margin-bottom: 6px;
        }

        .summary-list li:last-child {
          margin-bottom: 0;
        }

        .amendment-audit-note {
          font-size: 12px;
          font-style: italic;
          color: rgba(255, 255, 255, 0.4);
          margin: 8px 0 0 0;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.15);
          border-radius: 6px;
          border-left: 3px solid rgba(139, 92, 246, 0.4);
        }

        /* Dispatch Content */
        .dispatch-content {
          max-width: 1100px;
        }

        /* Top Section */
        .top-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 32px;
        }

        .info-card,
        .readiness-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 24px;
          height: 100%;
        }

        .card-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 20px 0;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .info-value {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
          text-align: right;
          max-width: 60%;
        }

        .info-value.mono {
          font-family: 'SF Mono', monospace;
          color: rgba(255, 255, 255, 0.7);
        }

        /* Gate Status */
        .gate-status {
          padding: 16px;
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .gate-status.gate-open {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .gate-status.gate-closed {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .gate-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .gate-icon {
          font-size: 16px;
        }

        .gate-status.gate-open .gate-icon {
          color: #34d399;
        }

        .gate-status.gate-closed .gate-icon {
          color: #f87171;
        }

        .gate-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.6);
        }

        .gate-value {
          display: block;
          font-size: 18px;
          font-weight: 700;
        }

        .gate-status.gate-open .gate-value {
          color: #34d399;
        }

        .gate-status.gate-closed .gate-value {
          color: #f87171;
        }

        .gate-reason {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Readiness Notes */
        .readiness-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 10px;
        }

        .readiness-note:last-child {
          margin-bottom: 0;
        }

        .ppe-note {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
        }

        .tools-note {
          background: rgba(139, 92, 246, 0.08);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .note-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .note-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .note-title {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .note-text {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Dispatch Sections */
        .dispatch-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 12px 0;
        }

        .section-icon {
          font-size: 18px;
        }

        .section-count {
          font-size: 12px;
          font-weight: 700;
          padding: 3px 10px;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 12px;
          margin-left: auto;
        }

        .gating-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .always-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .non-gating-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .section-note {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 16px 0;
          line-height: 1.5;
        }

        .section-note strong {
          color: rgba(255, 255, 255, 0.85);
        }

        .empty-state {
          text-align: center;
          padding: 32px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
          font-style: italic;
        }

        /* Workers Table */
        .workers-table {
          display: flex;
          flex-direction: column;
        }

        .table-header {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1.2fr 2fr;
          gap: 12px;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px 8px 0 0;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.5);
        }

        .table-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1.2fr 2fr;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          align-items: center;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .col-name {
          font-size: 14px;
          font-weight: 500;
          color: #fff;
        }

        .col-trade {
          font-size: 13px;
        }

        .trade-badge {
          display: inline-block;
          padding: 4px 10px;
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 500;
        }

        .col-date {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .mono {
          font-family: 'SF Mono', monospace;
        }

        .col-contact {
          font-size: 12px;
        }

        .contact-phone {
          color: rgba(255, 255, 255, 0.6);
        }

        .col-certs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .cert-badge {
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 4px;
        }

        .cert-badge.verified {
          background: rgba(34, 197, 94, 0.15);
          color: #34d399;
        }

        .cert-badge.unverified {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }

        /* Requirement Lists */
        .requirement-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 10px;
        }

        .requirement-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.85);
        }

        .item-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .item-name {
          flex: 1;
        }

        /* Footer */
        .dispatch-footer {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 8px;
        }

        .action-btn {
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-btn:not(.disabled):hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .back-link {
          margin-left: auto;
          padding: 12px 20px;
          background: none;
          border: none;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .back-link:hover {
          color: #60a5fa;
        }

        /* Print Styles (basic) */
        @media print {
          .dispatch-order-page {
            background: #fff;
            color: #000;
            padding: 20px;
          }

          .demo-banner {
            background: #fff3cd;
            border-color: #ffc107;
            color: #856404;
          }

          .demo-text {
            color: #856404;
          }

          .dispatch-footer,
          .share-actions,
          .modal-overlay {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Helper: Format date string to readable format
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Helper: Compute certification gate status (DEMO LOGIC)
 * In real implementation, this would check each worker's certs against required certs.
 * For demo, we simulate a passing state.
 */
function computeCertGateStatus(
  workers: Candidate[],
  requiredCerts: string[]
): { isOpen: boolean; reason?: string } {
  // Demo: if no workers, gate is technically open (nothing to block)
  if (workers.length === 0) {
    return { isOpen: true };
  }

  // Demo: simulate checking (in reality would check each worker)
  // For this demo, we assume all dispatched workers have passed cert check
  // This is UI-only mock behavior
  const mockAllCertified = true; // Demo always passes

  if (mockAllCertified) {
    return { isOpen: true };
  }

  return {
    isOpen: false,
    reason: 'One or more workers missing required certifications',
  };
}

