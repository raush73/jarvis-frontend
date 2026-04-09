'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api';
import { useSession } from '../../../lib/auth/useSession';

type Tab = 'queue' | 'company' | 'stale' | 'strategic';

const TABS: { id: Tab; label: string }[] = [
  { id: 'queue', label: 'Intelligence Queue' },
  { id: 'company', label: 'Company View' },
  { id: 'stale', label: 'Stale Opportunities' },
  { id: 'strategic', label: 'Strategic Targets' },
];

type Bucket = 'OVERDUE' | 'DUE_TODAY' | 'STALE' | 'NORMAL';

const BUCKET_COLORS: Record<Bucket, string> = {
  OVERDUE: '#dc2626',
  DUE_TODAY: '#d97706',
  STALE: '#7c3aed',
  NORMAL: '#6b7280',
};

const BUCKET_LABELS: Record<Bucket, string> = {
  OVERDUE: 'Overdue',
  DUE_TODAY: 'Due Today',
  STALE: 'Stale',
  NORMAL: 'Normal',
};

/* ────────────────────────────────────────────────────────────────
   Types matching backend contracts
   ──────────────────────────────────────────────────────────────── */

interface FlatQueueEntry {
  customerId: string;
  customerName: string;
  bucket: Bucket;
  representativeFollowUpId: string | null;
  representativeFollowUpDate: string | null;
  representativeFollowUpTime: string | null;
  topExplanation: string;
  isStrategicTarget: boolean;
  lifecycleStatus: string;
  healthStatus: string | null;
}

interface FlatQueueResponse {
  entries: FlatQueueEntry[];
  total: number;
  bucketCounts: Record<Bucket, number>;
}

interface BucketFollowUp {
  id: string;
  type: string;
  scheduledDate: string;
  scheduledTime: string | null;
  context: string | null;
  status: string;
}

interface CompanyQueueGroup {
  customerId: string;
  customerName: string;
  bucket: Bucket;
  explanationSummary: string;
  representativeFollowUp: BucketFollowUp | null;
  followUps: BucketFollowUp[];
  lifecycleStatus: string;
  healthStatus: string | null;
  isStrategicTarget: boolean;
  daysSinceLastActivity: number | null;
  daysOverdue: number | null;
}

interface BucketSection {
  bucket: Bucket;
  count: number;
  companies: CompanyQueueGroup[];
}

interface CompanyFirstResponse {
  buckets: BucketSection[];
  totalCompanies: number;
}

interface StrategicTarget {
  customerId: string;
  customerName: string;
  lifecycleStatus: string;
  healthStatus: string | null;
  strategicTargetSetAt: string | null;
  strategicTargetReason: string | null;
  bucket: Bucket;
  bucketReason: string;
}

interface StrategicTargetsResponse {
  items: StrategicTarget[];
  total: number;
}

/* ────────────────────────────────────────────────────────────────
   Main Page
   ──────────────────────────────────────────────────────────────── */

export default function FridayIntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('queue');

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Friday Intelligence
      </h1>

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

      {activeTab === 'queue' && <FlatQueueSection />}
      {activeTab === 'company' && <CompanyFirstSection />}
      {activeTab === 'stale' && <StaleSection />}
      {activeTab === 'strategic' && <StrategicTargetsSection />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section A — Flat Intelligence Queue
   ──────────────────────────────────────────────────────────────── */

function FlatQueueSection() {
  const [data, setData] = useState<FlatQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<FlatQueueResponse>('/friday/intelligence/queue?limit=200');
        setData(res);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load intelligence queue');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={mutedText}>Loading intelligence queue...</p>;
  if (error) return <p style={errorStyle}>{error}</p>;
  if (!data || data.entries.length === 0) return <p style={mutedText}>No companies in queue.</p>;

  return (
    <section>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['OVERDUE', 'DUE_TODAY', 'STALE', 'NORMAL'] as Bucket[]).map((b) => (
          <BucketCountBadge key={b} bucket={b} count={data.bucketCounts[b]} />
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={thStyle}>Customer</th>
            <th style={thStyle}>Bucket</th>
            <th style={thStyle}>Follow-up Date</th>
            <th style={thStyle}>Reason</th>
            <th style={thStyle}>Lifecycle</th>
            <th style={thStyle}>Health</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((entry) => (
            <tr key={entry.customerId} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={tdStyle}>
                <Link
                  href={`/friday/intelligence/${entry.customerId}`}
                  style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                >
                  {entry.customerName}
                </Link>
                {entry.isStrategicTarget && <StrategicBadge />}
              </td>
              <td style={tdStyle}>
                <BucketBadge bucket={entry.bucket} />
              </td>
              <td style={tdStyle}>
                {entry.representativeFollowUpDate
                  ? formatDateStr(entry.representativeFollowUpDate)
                  : '—'}
                {entry.representativeFollowUpTime && (
                  <span style={{ color: '#6b7280', marginLeft: 4 }}>
                    {formatTimeStr(entry.representativeFollowUpTime)}
                  </span>
                )}
              </td>
              <td style={{ ...tdStyle, maxWidth: 280, whiteSpace: 'normal' }}>
                {entry.topExplanation}
              </td>
              <td style={tdStyle}>
                <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                  {entry.lifecycleStatus.toLowerCase()}
                </span>
              </td>
              <td style={tdStyle}>
                <HealthBadge status={entry.healthStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section B — Company-First View
   ──────────────────────────────────────────────────────────────── */

function CompanyFirstSection() {
  const [data, setData] = useState<CompanyFirstResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<CompanyFirstResponse>('/friday/intelligence/company-queue?limit=200');
        setData(res);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load company view');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={mutedText}>Loading company view...</p>;
  if (error) return <p style={errorStyle}>{error}</p>;
  if (!data || data.totalCompanies === 0) return <p style={mutedText}>No companies in queue.</p>;

  return (
    <section>
      {data.buckets.map((section) => {
        if (section.count === 0) return null;
        return (
          <div key={section.bucket} style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BucketBadge bucket={section.bucket} />
              <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.8125rem' }}>
                ({section.count})
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {section.companies.map((company) => (
                <CompanyCard key={company.customerId} company={company} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function CompanyCard({ company }: { company: CompanyQueueGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link
            href={`/friday/intelligence/${company.customerId}`}
            style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem' }}
          >
            {company.customerName}
          </Link>
          {company.isStrategicTarget && <StrategicBadge />}
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#374151' }}>
            {company.explanationSummary}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
            <span>Lifecycle: {company.lifecycleStatus.toLowerCase()}</span>
            <span>Health: <HealthBadge status={company.healthStatus} /></span>
            {company.daysOverdue !== null && <span>{company.daysOverdue}d overdue</span>}
            {company.daysSinceLastActivity !== null && <span>{company.daysSinceLastActivity}d since activity</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {company.representativeFollowUp && (
            <div style={{ fontSize: '0.75rem', color: '#374151' }}>
              {formatDateStr(company.representativeFollowUp.scheduledDate)}
              {company.representativeFollowUp.scheduledTime && (
                <span style={{ marginLeft: 4, color: '#6b7280' }}>
                  {formatTimeStr(company.representativeFollowUp.scheduledTime)}
                </span>
              )}
            </div>
          )}
          {company.followUps.length > 1 && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{ ...actionBtnStyle, marginTop: '0.25rem', fontSize: '0.6875rem' }}
            >
              {expanded ? 'Hide' : `${company.followUps.length} follow-ups`}
            </button>
          )}
        </div>
      </div>

      {expanded && company.followUps.length > 0 && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f3f4f6' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                <th style={{ padding: '0.25rem 0.5rem' }}>Type</th>
                <th style={{ padding: '0.25rem 0.5rem' }}>Date</th>
                <th style={{ padding: '0.25rem 0.5rem' }}>Time</th>
                <th style={{ padding: '0.25rem 0.5rem' }}>Context</th>
              </tr>
            </thead>
            <tbody>
              {company.followUps.map((fu) => (
                <tr key={fu.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '0.25rem 0.5rem' }}>{fu.type}</td>
                  <td style={{ padding: '0.25rem 0.5rem' }}>{formatDateStr(fu.scheduledDate)}</td>
                  <td style={{ padding: '0.25rem 0.5rem' }}>{fu.scheduledTime ? formatTimeStr(fu.scheduledTime) : '—'}</td>
                  <td style={{ padding: '0.25rem 0.5rem', color: '#6b7280' }}>{fu.context ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section C — Stale Opportunities
   ──────────────────────────────────────────────────────────────── */

function StaleSection() {
  const [data, setData] = useState<FlatQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<FlatQueueResponse>('/friday/intelligence/stale-opportunities?limit=200');
        setData(res);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load stale opportunities');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={mutedText}>Loading stale opportunities...</p>;
  if (error) return <p style={errorStyle}>{error}</p>;
  if (!data || data.entries.length === 0) return <p style={mutedText}>No stale opportunities found.</p>;

  return (
    <section>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1rem' }}>
        Companies with pending follow-ups and no meaningful activity beyond the configured threshold.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={thStyle}>Customer</th>
            <th style={thStyle}>Follow-up Date</th>
            <th style={thStyle}>Reason</th>
            <th style={thStyle}>Lifecycle</th>
            <th style={thStyle}>Health</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((entry) => (
            <tr key={entry.customerId} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={tdStyle}>
                <Link
                  href={`/friday/intelligence/${entry.customerId}`}
                  style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                >
                  {entry.customerName}
                </Link>
                {entry.isStrategicTarget && <StrategicBadge />}
              </td>
              <td style={tdStyle}>
                {entry.representativeFollowUpDate ? formatDateStr(entry.representativeFollowUpDate) : '—'}
              </td>
              <td style={{ ...tdStyle, maxWidth: 300, whiteSpace: 'normal' }}>
                {entry.topExplanation}
              </td>
              <td style={tdStyle}>
                <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                  {entry.lifecycleStatus.toLowerCase()}
                </span>
              </td>
              <td style={tdStyle}>
                <HealthBadge status={entry.healthStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Section D — Strategic Targets
   ──────────────────────────────────────────────────────────────── */

function StrategicTargetsSection() {
  const session = useSession();
  const canManage = session.hasRole('admin') || session.hasRole('sales_admin');

  const [data, setData] = useState<StrategicTargetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addCustomerId, setAddCustomerId] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  const loadTargets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<StrategicTargetsResponse>('/friday/intelligence/strategic-targets?limit=200');
      setData(res);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load strategic targets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTargets(); }, [loadTargets]);

  const handleAdd = async () => {
    if (!addCustomerId.trim()) { setAddError('Customer ID is required'); return; }
    if (!addReason.trim()) { setAddError('Reason is required'); return; }
    setAddSubmitting(true);
    setAddError(null);
    try {
      await apiFetch('/friday/intelligence/strategic-targets', {
        method: 'POST',
        body: JSON.stringify({ customerId: addCustomerId.trim(), reason: addReason.trim() }),
      });
      setAddCustomerId('');
      setAddReason('');
      setShowAddForm(false);
      await loadTargets();
    } catch (err: any) {
      setAddError(err?.message ?? 'Failed to set strategic target');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleRemove = async (customerId: string) => {
    setRemoveLoading(customerId);
    try {
      await apiFetch(`/friday/intelligence/strategic-targets/${customerId}`, {
        method: 'DELETE',
      });
      await loadTargets();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to remove strategic target');
    } finally {
      setRemoveLoading(null);
    }
  };

  if (loading) return <p style={mutedText}>Loading strategic targets...</p>;
  if (error) return <p style={errorStyle}>{error}</p>;

  return (
    <section>
      {canManage && !showAddForm && (
        <button onClick={() => setShowAddForm(true)} style={{ ...primaryBtnStyle, marginBottom: '1rem' }}>
          + Mark Strategic Target
        </button>
      )}

      {showAddForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Mark Customer as Strategic Target
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Customer ID</label>
              <input
                type="text"
                value={addCustomerId}
                onChange={(e) => setAddCustomerId(e.target.value)}
                placeholder="Enter customer ID"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input
                type="text"
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder="Why is this customer strategic?"
                style={inputStyle}
              />
            </div>
          </div>
          {addError && <p style={errorStyle}>{addError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleAdd} disabled={addSubmitting} style={primaryBtnStyle}>
              {addSubmitting ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowAddForm(false); setAddError(null); }} style={actionBtnStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {(!data || data.items.length === 0) && (
        <p style={mutedText}>No strategic targets set.</p>
      )}

      {data && data.items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Bucket</th>
              <th style={thStyle}>Bucket Reason</th>
              <th style={thStyle}>Lifecycle</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Set At</th>
              {canManage && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.customerId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <Link
                    href={`/friday/intelligence/${t.customerId}`}
                    style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {t.customerName}
                  </Link>
                </td>
                <td style={tdStyle}><BucketBadge bucket={t.bucket} /></td>
                <td style={{ ...tdStyle, maxWidth: 240, whiteSpace: 'normal' }}>{t.bucketReason}</td>
                <td style={tdStyle}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                    {t.lifecycleStatus.toLowerCase()}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: '#374151' }}>{t.strategicTargetReason ?? '—'}</td>
                <td style={tdStyle}>
                  {t.strategicTargetSetAt ? new Date(t.strategicTargetSetAt).toLocaleDateString() : '—'}
                </td>
                {canManage && (
                  <td style={tdStyle}>
                    <button
                      onClick={() => handleRemove(t.customerId)}
                      disabled={removeLoading === t.customerId}
                      style={{ ...actionBtnStyle, color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      {removeLoading === t.customerId ? 'Removing...' : 'Remove'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────
   Shared UI Primitives
   ──────────────────────────────────────────────────────────────── */

function BucketBadge({ bucket }: { bucket: Bucket }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.125rem 0.5rem',
      borderRadius: 4,
      fontSize: '0.6875rem',
      fontWeight: 700,
      color: '#fff',
      background: BUCKET_COLORS[bucket] ?? '#6b7280',
      textTransform: 'uppercase',
      letterSpacing: '0.025em',
    }}>
      {BUCKET_LABELS[bucket] ?? bucket}
    </span>
  );
}

function BucketCountBadge({ bucket, count }: { bucket: Bucket; count: number }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      padding: '0.375rem 0.75rem',
      border: `1px solid ${BUCKET_COLORS[bucket]}33`,
      borderRadius: 6,
      background: `${BUCKET_COLORS[bucket]}0a`,
    }}>
      <span style={{ fontSize: '1.125rem', fontWeight: 700, color: BUCKET_COLORS[bucket] }}>{count}</span>
      <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{BUCKET_LABELS[bucket]}</span>
    </div>
  );
}

function StrategicBadge() {
  return (
    <span style={{
      display: 'inline-block',
      marginLeft: 6,
      padding: '0.0625rem 0.375rem',
      borderRadius: 3,
      fontSize: '0.625rem',
      fontWeight: 700,
      color: '#b45309',
      background: '#fef3c7',
      verticalAlign: 'middle',
    }}>
      STRATEGIC
    </span>
  );
}

function HealthBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>—</span>;
  const colors: Record<string, string> = {
    HEALTHY: '#16a34a',
    AT_RISK: '#d97706',
    STALE: '#dc2626',
  };
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors[status] ?? '#6b7280', textTransform: 'capitalize' }}>
      {status.toLowerCase().replace('_', ' ')}
    </span>
  );
}

function formatDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatTimeStr(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const amPm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${amPm}`;
}

const actionBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  fontSize: '0.8125rem',
  border: 'none',
  borderRadius: 4,
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.375rem 0.5rem',
  fontSize: '0.8125rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.25rem',
};

const errorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '0.8125rem',
  marginBottom: '0.5rem',
};

const mutedText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.875rem',
};

const thStyle: React.CSSProperties = { padding: '0.5rem' };
const tdStyle: React.CSSProperties = { padding: '0.5rem' };
