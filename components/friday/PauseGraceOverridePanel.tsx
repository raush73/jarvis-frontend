'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

export default function PauseGraceOverridePanel() {
  return (
    <section>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Pause / Grace / Overrides</h2>
      <ActivePausesSection />
      <GraceExtensionsSection />
      <OverrideApprovalsSection />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
// Active Pauses
// ═══════════════════════════════════════════════════════════

function ActivePausesSection() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pause form
  const [showPauseForm, setShowPauseForm] = useState(false);
  const [pauseStateId, setPauseStateId] = useState('');
  const [pauseEndsAt, setPauseEndsAt] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [pauseError, setPauseError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: any[] }>('/friday/control-panel/control-states?isPaused=true&limit=100');
      setItems(data.items);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load paused states');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/friday/control-panel/control-states/${id}/resume`, { method: 'POST', body: '{}' });
      await load();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async () => {
    if (!pauseStateId || !pauseEndsAt || !pauseReason) { setPauseError('All fields required'); return; }
    setActionLoading('pause');
    setPauseError(null);
    try {
      await apiFetch(`/friday/control-panel/control-states/${pauseStateId}/pause`, {
        method: 'POST',
        body: JSON.stringify({ pauseEndsAt: new Date(pauseEndsAt).toISOString(), reason: pauseReason }),
      });
      setShowPauseForm(false);
      setPauseStateId(''); setPauseEndsAt(''); setPauseReason('');
      await load();
    } catch (err: any) {
      setPauseError(err?.message ?? 'Failed to pause');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Active Pauses ({items.length})</h3>
        {!showPauseForm && (
          <button onClick={() => setShowPauseForm(true)} style={primaryBtnStyle}>Pause a Control</button>
        )}
      </div>

      {showPauseForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Control State ID</label>
              <input value={pauseStateId} onChange={(e) => setPauseStateId(e.target.value)} placeholder="cuid..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Pause Ends At</label>
              <input type="date" value={pauseEndsAt} onChange={(e) => setPauseEndsAt(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {pauseError && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{pauseError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handlePause} disabled={actionLoading === 'pause'} style={primaryBtnStyle}>
              {actionLoading === 'pause' ? 'Pausing...' : 'Confirm Pause'}
            </button>
            <button onClick={() => setShowPauseForm(false)} style={actionBtnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: '#6b7280', fontSize: '0.8125rem' }}>Loading...</p>}
      {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>}
      {!loading && items.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>No active pauses</p>}
      {!loading && items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Rep</th>
              <th style={thStyle}>Paused By</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Pause Ends</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{item.customer?.name ?? '—'}</td>
                <td style={tdStyle}>{item.repUser?.fullName ?? '—'}</td>
                <td style={tdStyle}>{item.pausedBy?.fullName ?? '—'}</td>
                <td style={tdStyle}>{item.pauseReason ?? '—'}</td>
                <td style={tdStyle}>{item.pauseEndsAt ? new Date(item.pauseEndsAt).toLocaleDateString() : '—'}</td>
                <td style={tdStyle}>
                  <button onClick={() => handleResume(item.id)} disabled={actionLoading === item.id} style={actionBtnStyle}>
                    {actionLoading === item.id ? 'Resuming...' : 'Resume'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Grace Extensions
// ═══════════════════════════════════════════════════════════

function GraceExtensionsSection() {
  const [showForm, setShowForm] = useState(false);
  const [stateId, setStateId] = useState('');
  const [extType, setExtType] = useState('CONTROL_WINDOW');
  const [days, setDays] = useState('5');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGrant = async () => {
    if (!stateId || !reason) { setFormError('Control State ID and reason required'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch(`/friday/control-panel/control-states/${stateId}/grace-extension`, {
        method: 'POST',
        body: JSON.stringify({ extensionType: extType, workingDaysToAdd: parseInt(days, 10), reason }),
      });
      setSuccess('Grace extension granted');
      setShowForm(false);
      setStateId(''); setDays('5'); setReason('');
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to grant extension');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Grace Extensions</h3>
        {!showForm && <button onClick={() => { setShowForm(true); setSuccess(null); }} style={primaryBtnStyle}>Grant Extension</button>}
      </div>

      {success && <p style={{ color: '#16a34a', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{success}</p>}

      {showForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Control State ID</label>
              <input value={stateId} onChange={(e) => setStateId(e.target.value)} placeholder="cuid..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Extension Type</label>
              <select value={extType} onChange={(e) => setExtType(e.target.value)} style={selectStyle}>
                <option value="CONTROL_WINDOW" style={optionStyle}>Control Window</option>
                <option value="TOUCH_WINDOW" style={optionStyle}>Touch Window</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Working Days (max 30 cumulative)</label>
              <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {formError && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{formError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleGrant} disabled={submitting} style={primaryBtnStyle}>
              {submitting ? 'Granting...' : 'Confirm Extension'}
            </button>
            <button onClick={() => setShowForm(false)} style={actionBtnStyle}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Override Approvals
// ═══════════════════════════════════════════════════════════

function OverrideApprovalsSection() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formControlStateId, setFormControlStateId] = useState('');
  const [formType, setFormType] = useState('FUTURE_OPPORTUNITY');
  const [formReason, setFormReason] = useState('');
  const [formCadenceNotes, setFormCadenceNotes] = useState('');
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: any[] }>('/friday/control-panel/overrides?limit=50');
      setItems(data.items);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load overrides');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!formCustomerId || !formReason) { setFormError('Customer ID and reason required'); return; }
    setActionLoading('create');
    setFormError(null);
    try {
      await apiFetch('/friday/control-panel/overrides', {
        method: 'POST',
        body: JSON.stringify({
          customerId: formCustomerId,
          controlStateId: formControlStateId || undefined,
          overrideType: formType,
          reason: formReason,
          cadenceNotes: formCadenceNotes || undefined,
          expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : undefined,
        }),
      });
      setShowForm(false);
      setFormCustomerId(''); setFormControlStateId(''); setFormReason(''); setFormCadenceNotes(''); setFormExpiresAt('');
      await load();
    } catch (err: any) {
      setFormError(err?.message ?? 'Failed to create override');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'deny') => {
    setActionLoading(id);
    try {
      await apiFetch(`/friday/control-panel/overrides/${id}/${action}`, { method: 'PATCH', body: '{}' });
      await load();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const STATUS_COLORS: Record<string, string> = { PENDING: '#d97706', APPROVED: '#16a34a', DENIED: '#dc2626', EXPIRED: '#6b7280' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Override Approvals</h3>
        {!showForm && <button onClick={() => setShowForm(true)} style={primaryBtnStyle}>Request Override</button>}
      </div>

      {showForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Customer ID</label>
              <input value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Control State ID (optional)</label>
              <input value={formControlStateId} onChange={(e) => setFormControlStateId(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Override Type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value)} style={selectStyle}>
                <option value="FUTURE_OPPORTUNITY" style={optionStyle}>Future Opportunity</option>
                <option value="SEASONAL_OPPORTUNITY" style={optionStyle}>Seasonal Opportunity</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Reason</label>
              <input value={formReason} onChange={(e) => setFormReason(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cadence Notes (optional)</label>
              <input value={formCadenceNotes} onChange={(e) => setFormCadenceNotes(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expires At (optional)</label>
              <input type="date" value={formExpiresAt} onChange={(e) => setFormExpiresAt(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {formError && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{formError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleCreate} disabled={actionLoading === 'create'} style={primaryBtnStyle}>
              {actionLoading === 'create' ? 'Submitting...' : 'Submit Request'}
            </button>
            <button onClick={() => setShowForm(false)} style={actionBtnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: '#6b7280', fontSize: '0.8125rem' }}>Loading...</p>}
      {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>}
      {!loading && items.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>No overrides</p>}
      {!loading && items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Customer</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Requested By</th>
              <th style={thStyle}>Approved By</th>
              <th style={thStyle}>Expires</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>{item.customer?.name ?? item.customerId}</td>
                <td style={tdStyle}>{item.overrideType.replace(/_/g, ' ')}</td>
                <td style={tdStyle}>
                  <span style={{ color: STATUS_COLORS[item.status] ?? '#6b7280', fontWeight: 600, fontSize: '0.75rem' }}>{item.status}</span>
                </td>
                <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reason}</td>
                <td style={tdStyle}>{item.requestedBy?.fullName ?? '—'}</td>
                <td style={tdStyle}>{item.approvedBy?.fullName ?? '—'}</td>
                <td style={tdStyle}>{item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '—'}</td>
                <td style={tdStyle}>
                  {item.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button onClick={() => handleAction(item.id, 'approve')} disabled={!!actionLoading} style={{ ...actionBtnStyle, color: '#16a34a' }}>Approve</button>
                      <button onClick={() => handleAction(item.id, 'deny')} disabled={!!actionLoading} style={{ ...actionBtnStyle, color: '#dc2626' }}>Deny</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = { padding: '0.375rem 0.75rem', fontSize: '0.8125rem', border: 'none', borderRadius: 4, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 };
const actionBtnStyle: React.CSSProperties = { padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4 };
const selectStyle: React.CSSProperties = { width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #475569', borderRadius: 4, backgroundColor: '#0f172a', color: '#ffffff' };
const optionStyle: React.CSSProperties = { backgroundColor: '#0f172a', color: '#ffffff' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' };
const thStyle: React.CSSProperties = { padding: '0.5rem' };
const tdStyle: React.CSSProperties = { padding: '0.5rem' };
