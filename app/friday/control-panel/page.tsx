'use client';

import { useState } from 'react';

type Tab =
  | 'system-rules'
  | 'absence-continuity'
  | 'rescue-queue'
  | 'sales-admin-actions'
  | 'audit-log';

const TABS: { id: Tab; label: string }[] = [
  { id: 'system-rules', label: 'System Rules' },
  { id: 'absence-continuity', label: 'Absence & Continuity' },
  { id: 'rescue-queue', label: 'Rescue Queue' },
  { id: 'sales-admin-actions', label: 'Sales Admin Actions' },
  { id: 'audit-log', label: 'Audit Log' },
];

export default function FridayControlPanelPage() {
  const [activeTab, setActiveTab] = useState<Tab>('system-rules');

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Friday Control Panel
      </h1>

      {/* Tab navigation */}
      <nav style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              background: 'none',
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? '#2563eb' : '#6b7280',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {activeTab === 'system-rules' && <SystemRulesSection />}
      {activeTab === 'absence-continuity' && <AbsenceContinuitySection />}
      {activeTab === 'rescue-queue' && <RescueQueueSection />}
      {activeTab === 'sales-admin-actions' && <SalesAdminActionsSection />}
      {activeTab === 'audit-log' && <AuditLogSection />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 1 — System Rules
   Admin-only editable. Read-only for sales_admin/manager.
   ──────────────────────────────────────────────────────────────── */
function SystemRulesSection() {
  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        System Rules
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <FieldGroup title="Scoring Weights">
          <MockField label="FOLLOW_UP_OVERDUE" value="100" />
          <MockField label="FOLLOW_UP_DUE" value="80" />
          <MockField label="ACTIVE_CONVERSATION" value="60" />
          <MockField label="NEW_LEAD" value="40" />
          <MockField label="STALE_OWNED" value="30" />
          <MockField label="RECYCLED_POOL" value="20" />
          <MockField label="STRATEGIC_TARGET" value="50" />
        </FieldGroup>

        <FieldGroup title="Ownership Timers">
          <MockField label="Default Ownership (days)" value="90" />
          <MockField label="Inactivity Threshold (days)" value="14" />
          <MockField label="Expiration Threshold (days)" value="30" />
          <MockField label="Expiration Behavior" value="FLAG" />
        </FieldGroup>

        <FieldGroup title="Activity Thresholds">
          <MockField label="Min Call Duration (sec)" value="60" />
          <MockField label="Stale Threshold (days)" value="60" />
          <MockField label="At Risk Threshold (days)" value="30" />
          <MockField label="Force Release (days)" value="90" />
        </FieldGroup>

        <FieldGroup title="System Switches">
          <MockField label="System Enabled" value="true" />
          <MockField label="Follow-up Enforced" value="true" />
          <MockField label="Absence Protection" value="false" />
          <MockField label="Call Pressure" value="NORMAL" />
          <MockField label="Rescue Threshold (min)" value="120" />
        </FieldGroup>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 2 — Absence & Continuity
   ──────────────────────────────────────────────────────────────── */
function AbsenceContinuitySection() {
  const mockAbsences = [
    { name: 'John Doe', pendingFollowUps: 5, unresolvedCoverage: true },
    { name: 'Jane Smith', pendingFollowUps: 2, unresolvedCoverage: false },
  ];

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Absence & Continuity
      </h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>Salesperson</th>
            <th style={{ padding: '0.5rem' }}>Pending Follow-ups</th>
            <th style={{ padding: '0.5rem' }}>Unresolved Coverage</th>
            <th style={{ padding: '0.5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {mockAbsences.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.5rem' }}>{row.name}</td>
              <td style={{ padding: '0.5rem' }}>{row.pendingFollowUps}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{
                  color: row.unresolvedCoverage ? '#dc2626' : '#16a34a',
                  fontWeight: 600,
                }}>
                  {row.unresolvedCoverage ? 'YES' : 'NO'}
                </span>
              </td>
              <td style={{ padding: '0.5rem' }}>
                <button style={actionBtnStyle}>Resolve Coverage</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 3 — Rescue Queue
   ──────────────────────────────────────────────────────────────── */
function RescueQueueSection() {
  const mockItems = [
    { id: 'fu-1', customer: 'Acme Corp', rep: 'John Doe', scheduledDate: '2026-04-05', severity: 'OVERDUE' },
    { id: 'fu-2', customer: 'Beta LLC', rep: 'John Doe', scheduledDate: '2026-04-08', severity: 'DUE_TODAY' },
    { id: 'fu-3', customer: 'Gamma Inc', rep: 'Jane Smith', scheduledDate: '2026-04-10', severity: 'SCHEDULED' },
  ];

  const severityColor: Record<string, string> = {
    OVERDUE: '#dc2626',
    DUE_TODAY: '#d97706',
    SCHEDULED: '#2563eb',
  };

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Rescue Queue
      </h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>Customer</th>
            <th style={{ padding: '0.5rem' }}>Assigned Rep</th>
            <th style={{ padding: '0.5rem' }}>Due Date</th>
            <th style={{ padding: '0.5rem' }}>Severity</th>
            <th style={{ padding: '0.5rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {mockItems.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.5rem' }}>{item.customer}</td>
              <td style={{ padding: '0.5rem' }}>{item.rep}</td>
              <td style={{ padding: '0.5rem' }}>{item.scheduledDate}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{
                  color: severityColor[item.severity] ?? '#6b7280',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                }}>
                  {item.severity.replace('_', ' ')}
                </span>
              </td>
              <td style={{ padding: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                <button style={actionBtnStyle}>Reassign</button>
                <button style={actionBtnStyle}>To Manager</button>
                <button style={actionBtnStyle}>To Sales Admin</button>
                <button style={actionBtnStyle}>Shift Date</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 4 — Sales Admin Actions (quick-action panel)
   ──────────────────────────────────────────────────────────────── */
function SalesAdminActionsSection() {
  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Sales Admin Actions
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <ActionCard
          title="Reassign Follow-up"
          description="Transfer a follow-up to a different salesperson."
        />
        <ActionCard
          title="Shift Due Date"
          description="Move the due date for a loose follow-up."
        />
        <ActionCard
          title="Move to Manager Queue"
          description="Escalate a follow-up to the manager queue."
        />
        <ActionCard
          title="Resolve Absence Coverage"
          description="Bulk-resolve uncovered follow-ups for an absent rep."
        />
        <ActionCard
          title="Move to Sales Admin Review"
          description="Flag a follow-up for sales admin review."
        />
        <ActionCard
          title="View Absence Risk"
          description="See upcoming absence impact across the team."
        />
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section 5 — Audit Log
   ──────────────────────────────────────────────────────────────── */
function AuditLogSection() {
  const mockLogs = [
    { id: '1', actionType: 'FOLLOWUP_REASSIGNED', entity: 'FollowUp fu-1', performer: 'Admin', timestamp: '2026-04-08 14:30', reason: 'Rep on PTO' },
    { id: '2', actionType: 'FOLLOWUP_DUE_DATE_SHIFTED', entity: 'FollowUp fu-3', performer: 'Sales Admin', timestamp: '2026-04-08 13:15', reason: 'Customer requested delay' },
    { id: '3', actionType: 'CONFIG_UPDATED', entity: 'Config', performer: 'Admin', timestamp: '2026-04-07 09:00', reason: null },
  ];

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Audit Log
      </h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>Action</th>
            <th style={{ padding: '0.5rem' }}>Entity</th>
            <th style={{ padding: '0.5rem' }}>Performed By</th>
            <th style={{ padding: '0.5rem' }}>Timestamp</th>
            <th style={{ padding: '0.5rem' }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {mockLogs.map((log) => (
            <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                {log.actionType}
              </td>
              <td style={{ padding: '0.5rem' }}>{log.entity}</td>
              <td style={{ padding: '0.5rem' }}>{log.performer}</td>
              <td style={{ padding: '0.5rem' }}>{log.timestamp}</td>
              <td style={{ padding: '0.5rem', color: log.reason ? 'inherit' : '#9ca3af' }}>
                {log.reason ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Shared UI primitives
   ──────────────────────────────────────────────────────────────── */

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#374151' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {children}
      </div>
    </div>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function ActionCard({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '1rem',
      cursor: 'pointer',
      transition: 'box-shadow 0.15s',
    }}>
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>{title}</h4>
      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>{description}</p>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
};
