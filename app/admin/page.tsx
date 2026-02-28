"use client";

import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin</h1>
        <p className="subtitle">System configuration and settings</p>
      </div>

      <div className="admin-grid">
        {/* Trades Card - Active */}
        <Link href="/admin/trades" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Trades</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Define and manage the skilled trades used across Jarvis Prime for orders, quotes, staffing, and compliance.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Trade Registry →</span>
          </div>
        </Link>

        {/* Commissions Card - Active */}
        <Link href="/admin/commissions" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Commissions</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Configure commission tiers based on days-to-paid from invoice payment events.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Commission Settings →</span>
          </div>
        </Link>

        {/* User Management Card - Active */}
        <Link href="/admin/users" className="admin-card active">
          <div className="card-header">
            <div className="card-title">User Management</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Manage system users, roles, and access permissions.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open User Management →</span>
          </div>
        </Link>

        {/* Safety / Work Comp Card - Active */}
        <Link href="/admin/safety/work-comp" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Work Comp Rates</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Configure workers&apos; compensation rates by State and Trade for burden calculations.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Work Comp Rates →</span>
          </div>
        </Link>

        {/* Safety / Certifications Card - Active */}
        <Link href="/admin/safety/certifications" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Certifications</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Define certification types for safety, trade, and site compliance requirements.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Certifications →</span>
          </div>
        </Link>

        {/* Safety / Incident Types Card - Active */}
        <Link href="/admin/safety/incidents/types" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Incident Types</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Define the categories of safety incidents for reporting and compliance.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Incident Types →</span>
          </div>
        </Link>

        {/* Safety / Incident Records Card - Active */}
        <Link href="/admin/safety/incidents/records" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Incident Records</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            View logged safety incidents across the system for audit and review.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Incident Records →</span>
          </div>
        </Link>

        {/* Burden Settings Card - Active */}
        <Link href="/admin/burden" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Burden Settings</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Configure employer burden components (FICA, FUTA, SUTA, Admin, GL, etc.) for cost calculations.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Burden Settings →</span>
          </div>
        </Link>

        {/* Salespeople Card - Active */}
        <Link href="/admin/salespeople" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Salespeople</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Commercial owners used for Customer defaults and commission attribution.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Salespeople →</span>
          </div>
        </Link>

        {/* Tool Catalog Card - Active */}
        <Link href="/admin/tools" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Tool Catalog</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Single source of truth for all tools.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Tool Catalog →</span>
          </div>
        </Link>

        {/* PPE Catalog Card - Active */}
        <Link href="/admin/ppe" className="admin-card active">
          <div className="card-header">
            <div className="card-title">PPE Catalog</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Manage personal protective equipment types for orders and compliance.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open PPE Catalog →</span>
          </div>
        </Link>

        {/* Work Comp Report Card - Active */}
        <Link href="/admin/reports/work-comp" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Work Comp Report</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Workers&apos; compensation burden analysis by state, trade, and job site.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open Work Comp Report →</span>
          </div>
        </Link>

        {/* Gross Margin Report Card - Active */}
        <Link href="/admin/reports/gm" className="admin-card active">
          <div className="card-header">
            <div className="card-title">Gross Margin Report</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Estimated vs actual gross margin analysis by order, customer, and salesperson.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open GM Report →</span>
          </div>
        </Link>

        {/* WIP Report Card - Active */}
        <Link href="/admin/reports/wip" className="admin-card active">
          <div className="card-header">
            <div className="card-title">WIP Report</div>
            <span className="badge active">ACTIVE</span>
          </div>
          <div className="card-desc">
            Work-in-progress analysis: unapproved hours, billing status, and risk assessment.
          </div>
          <div className="card-footer">
            <span className="link-hint">Open WIP Report →</span>
          </div>
        </Link>

        <div className="admin-card disabled">
          <div className="card-header">
            <div className="card-title">System Settings</div>
            <span className="badge future">FUTURE</span>
          </div>
          <div className="card-desc">
            Global configuration options and system preferences.
          </div>
          <div className="card-footer">
            <span className="disabled-hint">UI shell planned</span>
          </div>
        </div>

        <div className="admin-card disabled">
          <div className="card-header">
            <div className="card-title">Integrations</div>
            <span className="badge future">FUTURE</span>
          </div>
          <div className="card-desc">
            External system connections and API configurations.
          </div>
          <div className="card-footer">
            <span className="disabled-hint">UI shell planned</span>
          </div>
        </div>

        <div className="admin-card disabled">
          <div className="card-header">
            <div className="card-title">Audit Logs</div>
            <span className="badge future">FUTURE</span>
          </div>
          <div className="card-desc">
            System activity logs and audit trail.
          </div>
          <div className="card-footer">
            <span className="disabled-hint">UI shell planned</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-container {
          padding: 24px 40px 60px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .admin-header {
          text-align: center;
          margin-bottom: 32px;
        }

        h1 {
          font-size: 36px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
          letter-spacing: -0.5px;
        }

        .subtitle {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        .admin-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .admin-card {
          display: block;
          text-decoration: none;
          padding: 20px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          transition: all 0.15s ease;
        }

        .admin-card.active {
          cursor: pointer;
        }

        .admin-card.active:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(59, 130, 246, 0.3);
          transform: translateY(-2px);
        }

        .admin-card.disabled {
          opacity: 0.75;
          cursor: default;
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .card-title {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .badge {
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .badge.active {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .badge.future {
          background: rgba(148, 163, 184, 0.12);
          color: rgba(148, 163, 184, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .card-desc {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.5;
          margin-bottom: 14px;
        }

        .card-footer {
          display: flex;
          justify-content: flex-end;
        }

        .link-hint {
          font-size: 13px;
          font-weight: 600;
          color: #3b82f6;
        }

        .disabled-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.35);
        }
      `}</style>
    </div>
  );
}

