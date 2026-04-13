'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

interface ControlStateRow {
  id: string;
  customerId: string;
  repUserId: string;
  status: 'ACTIVE' | 'AT_RISK' | 'RELEASED';
  firstControlAt: string;
  lastTouchAt: string;
  controlDeadlineAt: string;
  touchDeadlineAt: string;
  nonMeaningfulAttemptCount: number;
  isPaused: boolean;
  pauseEndsAt: string | null;
  pauseReason: string | null;
  pauseStartedAt: string | null;
  releaseReason: string | null;
  releasedRepUserId: string | null;
  nextCallableAt: string | null;
  customer: { id: string; name: string };
  repUser: { id: string; fullName: string | null };
  pausedBy: { id: string; fullName: string | null } | null;
}

interface ControlStateDetail extends ControlStateRow {
  graceExtensions: Array<{
    id: string;
    extensionType: string;
    workingDaysAdded: number;
    previousDeadline: string;
    newDeadline: string;
    reason: string;
    createdAt: string;
    grantedBy: { id: string; fullName: string | null };
  }>;
  overrideApprovals: Array<{
    id: string;
    overrideType: string;
    status: string;
    reason: string;
    cadenceNotes: string | null;
    createdAt: string;
    expiresAt: string | null;
    requestedBy: { id: string; fullName: string | null };
    approvedBy: { id: string; fullName: string | null } | null;
  }>;
  auditHistory: Array<{
    id: string;
    actionType: string;
    createdAt: string;
    performedBy: { fullName: string | null };
    reason: string | null;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#16a34a',
  AT_RISK: '#d97706',
  RELEASED: '#6b7280',
};

export default function ControlStatesTable() {
  const [items, setItems] = useState<ControlStateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [statusFilter, setStatusFilter] = useState('');
  const [pausedFilter, setPausedFilter] = useState('');
  const [repFilter, setRepFilter] = useState('');

  const [detail, setDetail] = useState<ControlStateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (pausedFilter === 'true') params.set('isPaused', 'true');
      if (repFilter) params.set('repUserId', repFilter);
      params.set('page', String(page));
      params.set('limit', '25');
      const data = await apiFetch<{ items: ControlStateRow[]; total: number }>(
        `/friday/control-panel/control-states?${params.toString()}`,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load control states');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pausedFilter, repFilter, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await apiFetch<ControlStateDetail>(
        `/friday/control-panel/control-states/${id}`,
      );
      setDetail(data);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 25);

  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
        Control States
      </h2>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}
          options={[
            { value: '', label: 'All' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'AT_RISK', label: 'At Risk' },
            { value: 'RELEASED', label: 'Released' },
          ]}
        />
        <FilterSelect label="Paused" value={pausedFilter} onChange={setPausedFilter}
          options={[
            { value: '', label: 'All' },
            { value: 'true', label: 'Paused Only' },
          ]}
        />
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({total} total)</span>
      </div>

      {loading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading...</p>}
      {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>}

      {!loading && items.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No control states found.</p>
      )}

      {!loading && items.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Rep</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>First Control</th>
                <th style={thStyle}>Last Touch</th>
                <th style={thStyle}>Control Deadline</th>
                <th style={thStyle}>Touch Deadline</th>
                <th style={thStyle}>Attempts</th>
                <th style={thStyle}>Paused</th>
                <th style={thStyle}>Release Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onClick={() => openDetail(row.id)}
                >
                  <td style={tdStyle}>{row.customer.name}</td>
                  <td style={tdStyle}>{row.repUser.fullName ?? '—'}</td>
                  <td style={tdStyle}>
                    <span style={{ color: STATUS_COLORS[row.status] ?? '#6b7280', fontWeight: 600, fontSize: '0.75rem' }}>
                      {row.status}
                    </span>
                    {row.isPaused && (
                      <span style={{
                        marginLeft: '0.25rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: 4,
                        fontSize: '0.625rem',
                        fontWeight: 700,
                        background: '#fef3c7',
                        color: '#92400e',
                      }}>
                        PAUSED
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{fmtDate(row.firstControlAt)}</td>
                  <td style={tdStyle}>{fmtDate(row.lastTouchAt)}</td>
                  <td style={tdStyle}>{fmtDate(row.controlDeadlineAt)}</td>
                  <td style={tdStyle}>{fmtDate(row.touchDeadlineAt)}</td>
                  <td style={tdStyle}>{row.nonMeaningfulAttemptCount}</td>
                  <td style={tdStyle}>
                    {row.isPaused ? (
                      <span style={{ color: '#d97706', fontSize: '0.75rem' }}>
                        Until {fmtDate(row.pauseEndsAt)}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.75rem' }}>{row.releaseReason?.replace(/_/g, ' ') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pageBtnStyle}>Prev</button>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pageBtnStyle}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {(detail || detailLoading) && (
        <ModalOverlay onClose={() => setDetail(null)}>
          {detailLoading && <p style={{ color: '#6b7280' }}>Loading detail...</p>}
          {detail && <ControlStateDetailView detail={detail} onClose={() => setDetail(null)} onRefresh={loadData} />}
        </ModalOverlay>
      )}
    </section>
  );
}

function ControlStateDetailView({ detail, onClose, onRefresh }: { detail: ControlStateDetail; onClose: () => void; onRefresh: () => void }) {
  return (
    <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
          {detail.customer.name} — {detail.repUser.fullName ?? 'Unknown Rep'}
        </h3>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
      </div>

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem' }}>
        <div><strong>Status:</strong> {detail.status}{detail.isPaused ? ' (PAUSED)' : ''}</div>
        <div><strong>First Control:</strong> {fmtDate(detail.firstControlAt)}</div>
        <div><strong>Last Touch:</strong> {fmtDate(detail.lastTouchAt)}</div>
        <div><strong>Control Deadline:</strong> {fmtDate(detail.controlDeadlineAt)}</div>
        <div><strong>Touch Deadline:</strong> {fmtDate(detail.touchDeadlineAt)}</div>
        <div><strong>Attempts:</strong> {detail.nonMeaningfulAttemptCount}</div>
        {detail.isPaused && <div><strong>Pause Ends:</strong> {fmtDate(detail.pauseEndsAt)}</div>}
        {detail.isPaused && <div><strong>Pause Reason:</strong> {detail.pauseReason ?? '—'}</div>}
        {detail.releaseReason && <div><strong>Release Reason:</strong> {detail.releaseReason.replace(/_/g, ' ')}</div>}
      </div>

      {/* Grace Extensions */}
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem' }}>Grace Extensions ({detail.graceExtensions.length})</h4>
      {detail.graceExtensions.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>None</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Days</th>
              <th style={thStyle}>Prev Deadline</th>
              <th style={thStyle}>New Deadline</th>
              <th style={thStyle}>Granted By</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {detail.graceExtensions.map((ext) => (
              <tr key={ext.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{ext.extensionType.replace('_', ' ')}</td>
                <td style={tdStyle}>{ext.workingDaysAdded}</td>
                <td style={tdStyle}>{fmtDate(ext.previousDeadline)}</td>
                <td style={tdStyle}>{fmtDate(ext.newDeadline)}</td>
                <td style={tdStyle}>{ext.grantedBy.fullName ?? '—'}</td>
                <td style={tdStyle}>{fmtDate(ext.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Override Approvals */}
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem' }}>Override Approvals ({detail.overrideApprovals.length})</h4>
      {detail.overrideApprovals.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>None</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Requested By</th>
              <th style={thStyle}>Approved By</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {detail.overrideApprovals.map((ov) => (
              <tr key={ov.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{ov.overrideType.replace(/_/g, ' ')}</td>
                <td style={tdStyle}>
                  <span style={{ color: ov.status === 'APPROVED' ? '#16a34a' : ov.status === 'DENIED' ? '#dc2626' : '#d97706', fontWeight: 600 }}>
                    {ov.status}
                  </span>
                </td>
                <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ov.reason}</td>
                <td style={tdStyle}>{ov.requestedBy.fullName ?? '—'}</td>
                <td style={tdStyle}>{ov.approvedBy?.fullName ?? '—'}</td>
                <td style={tdStyle}>{fmtDate(ov.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Audit History */}
      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem' }}>Audit History</h4>
      {detail.auditHistory.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No audit entries for this control state</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>By</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Date</th>
            </tr>
          </thead>
          <tbody>
            {detail.auditHistory.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{entry.actionType}</td>
                <td style={tdStyle}>{entry.performedBy?.fullName ?? '—'}</td>
                <td style={tdStyle}>{entry.reason ?? '—'}</td>
                <td style={tdStyle}>{new Date(entry.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* Shared helpers */
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>{label}:</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((o) => <option key={o.value} value={o.value} style={optionStyle}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', minWidth: 700, maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
        {children}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: '0.25rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #475569', borderRadius: 4, backgroundColor: '#0f172a', color: '#ffffff' };
const optionStyle: React.CSSProperties = { backgroundColor: '#0f172a', color: '#ffffff' };
const thStyle: React.CSSProperties = { padding: '0.5rem' };
const tdStyle: React.CSSProperties = { padding: '0.5rem' };
const pageBtnStyle: React.CSSProperties = { padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' };
