'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api';

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

interface BucketFollowUp {
  id: string;
  type: string;
  scheduledDate: string;
  scheduledTime: string | null;
  context: string | null;
  status: string;
}

interface CompanyPriorityResponse {
  customerId: string;
  bucket: Bucket;
  explanationSummary: string;
  explanationFactors: string[];
  representativeFollowUp: BucketFollowUp | null;
  followUps: BucketFollowUp[];
  isStrategicTarget: boolean;
  lifecycleStatus: string;
  healthStatus: string | null;
}

export default function CompanyPriorityPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const [data, setData] = useState<CompanyPriorityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    (async () => {
      try {
        const res = await apiFetch<CompanyPriorityResponse>(
          `/friday/intelligence/company/${customerId}/priority`,
        );
        setData(res);
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load company priority');
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading company priority...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
        <Link href="/friday/intelligence" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8125rem' }}>
          &larr; Back to Intelligence
        </Link>
        <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '1rem' }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No data found.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <Link href="/friday/intelligence" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.8125rem' }}>
        &larr; Back to Intelligence
      </Link>

      <div style={{ marginTop: '1.25rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          Company Priority
        </h1>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
          Why is this company in this bucket?
        </p>
      </div>

      {/* Header card */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        borderLeft: `4px solid ${BUCKET_COLORS[data.bucket] ?? '#6b7280'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{
                display: 'inline-block',
                padding: '0.125rem 0.5rem',
                borderRadius: 4,
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#fff',
                background: BUCKET_COLORS[data.bucket] ?? '#6b7280',
                textTransform: 'uppercase',
              }}>
                {BUCKET_LABELS[data.bucket] ?? data.bucket}
              </span>
              {data.isStrategicTarget && (
                <span style={{
                  padding: '0.0625rem 0.375rem',
                  borderRadius: 3,
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  color: '#b45309',
                  background: '#fef3c7',
                }}>
                  STRATEGIC
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '0.25rem 0' }}>
              {data.explanationSummary}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>
            <div>Lifecycle: <span style={{ textTransform: 'capitalize' }}>{data.lifecycleStatus.toLowerCase()}</span></div>
            {data.healthStatus && (
              <div>Health: <HealthBadge status={data.healthStatus} /></div>
            )}
          </div>
        </div>
      </div>

      {/* Explanation factors */}
      {data.explanationFactors.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Why this bucket
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {data.explanationFactors.map((factor, i) => (
              <li key={i} style={{ fontSize: '0.8125rem', color: '#374151', marginBottom: '0.25rem' }}>
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Representative follow-up */}
      {data.representativeFollowUp && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Representative Follow-up
          </h2>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div>
                <span style={{ color: '#6b7280' }}>Date: </span>
                {formatDateStr(data.representativeFollowUp.scheduledDate)}
              </div>
              <div>
                <span style={{ color: '#6b7280' }}>Time: </span>
                {data.representativeFollowUp.scheduledTime
                  ? formatTimeStr(data.representativeFollowUp.scheduledTime)
                  : '—'}
              </div>
              <div>
                <span style={{ color: '#6b7280' }}>Type: </span>
                {data.representativeFollowUp.type}
              </div>
            </div>
            {data.representativeFollowUp.context && (
              <div style={{ marginTop: '0.375rem', color: '#374151' }}>
                <span style={{ color: '#6b7280' }}>Context: </span>
                {data.representativeFollowUp.context}
              </div>
            )}
          </div>
        </div>
      )}

      {/* All pending follow-ups */}
      {data.followUps.length > 0 && (
        <div>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            All Pending Follow-ups ({data.followUps.length})
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Scheduled Date</th>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Context</th>
              </tr>
            </thead>
            <tbody>
              {data.followUps.map((fu) => (
                <tr key={fu.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>{fu.type}</td>
                  <td style={tdStyle}>{formatDateStr(fu.scheduledDate)}</td>
                  <td style={tdStyle}>{fu.scheduledTime ? formatTimeStr(fu.scheduledTime) : '—'}</td>
                  <td style={{ ...tdStyle, color: fu.context ? '#374151' : '#9ca3af' }}>
                    {fu.context ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.followUps.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.8125rem' }}>No pending follow-ups.</p>
      )}
    </div>
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

const thStyle: React.CSSProperties = { padding: '0.5rem' };
const tdStyle: React.CSSProperties = { padding: '0.5rem' };
