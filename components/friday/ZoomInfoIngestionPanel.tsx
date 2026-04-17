'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

interface IngestionLog {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  recordsFound: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage: string | null;
  triggeredBy: string | null;
}

interface PullResult {
  logId: string;
  status: string;
  recordsFound: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
}

export default function ZoomInfoIngestionPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [maxRecords, setMaxRecords] = useState(200);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PullResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<IngestionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await apiFetch<IngestionLog[]>('/zoominfo/logs');
      setLogs(data);
    } catch (err: any) {
      console.error('Failed to load logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handlePull = async () => {
    if (!searchQuery.trim()) {
      setError('Search query is required');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<PullResult>('/zoominfo/pull', {
        method: 'POST',
        body: JSON.stringify({
          searchQuery: searchQuery.trim(),
          ...(stateFilter ? { state: stateFilter.trim() } : {}),
          ...(industryFilter ? { industry: industryFilter.trim() } : {}),
          maxRecords,
        }),
      });
      setResult(data);
      loadLogs();
    } catch (err: any) {
      setError(err.message || 'Pull failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        ZoomInfo Lead Ingestion
      </h2>

      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        background: '#fafafa',
      }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: '#374151' }}>
          Trigger Company Pull
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>
              Company Name / Search Term *
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. industrial staffing"
              disabled={loading}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>
              State (optional)
            </span>
            <input
              type="text"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              placeholder="e.g. Kentucky"
              disabled={loading}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>
              Industry (optional)
            </span>
            <input
              type="text"
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              placeholder="e.g. Manufacturing"
              disabled={loading}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>
              Max Records
            </span>
            <input
              type="number"
              value={maxRecords}
              onChange={(e) => setMaxRecords(Math.max(1, Math.min(1000, parseInt(e.target.value) || 200)))}
              disabled={loading}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            />
          </label>
        </div>

        <button
          onClick={handlePull}
          disabled={loading || !searchQuery.trim()}
          style={{
            padding: '0.5rem 1.5rem',
            background: loading ? '#9ca3af' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Running...' : 'Start Pull'}
        </button>

        {error && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '0.375rem',
            color: '#991b1b',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
          }}>
            <strong>Pull Complete</strong> — Found: {result.recordsFound},
            Created: {result.recordsCreated},
            Updated: {result.recordsUpdated},
            Skipped: {result.recordsSkipped}
          </div>
        )}
      </div>

      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            Pull History
          </h3>
          <button
            onClick={loadLogs}
            disabled={logsLoading}
            style={{
              padding: '0.25rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              background: '#fff',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            {logsLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {logs.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No ingestion runs yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={TH}>Started</th>
                <th style={TH}>Status</th>
                <th style={TH}>Found</th>
                <th style={TH}>Created</th>
                <th style={TH}>Updated</th>
                <th style={TH}>Skipped</th>
                <th style={TH}>By</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={TD}>{new Date(log.startedAt).toLocaleString()}</td>
                  <td style={TD}>
                    <StatusBadge status={log.status} />
                  </td>
                  <td style={TD}>{log.recordsFound}</td>
                  <td style={TD}>{log.recordsCreated}</td>
                  <td style={TD}>{log.recordsUpdated}</td>
                  <td style={TD}>{log.recordsSkipped}</td>
                  <td style={TD}>{log.triggeredBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    COMPLETED: { bg: '#dcfce7', text: '#166534' },
    RUNNING: { bg: '#dbeafe', text: '#1e40af' },
    FAILED: { bg: '#fef2f2', text: '#991b1b' },
  };
  const c = colors[status] || { bg: '#f3f4f6', text: '#374151' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.125rem 0.5rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: c.bg,
      color: c.text,
    }}>
      {status}
    </span>
  );
}

const TH: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  fontWeight: 600,
  color: '#6b7280',
};

const TD: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
};
