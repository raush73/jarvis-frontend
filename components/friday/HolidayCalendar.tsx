'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

interface Holiday {
  id: string;
  date: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export default function HolidayCalendar({ isAdmin }: { isAdmin: boolean }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addDate, setAddDate] = useState('');
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editName, setEditName] = useState('');

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = showInactive ? '?includeInactive=true' : '';
      const data = await apiFetch<Holiday[]>(`/friday/control-panel/holidays${params}`);
      setHolidays(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!addDate || !addName) { setAddError('Date and name required'); return; }
    setAdding(true);
    setAddError(null);
    try {
      await apiFetch('/friday/control-panel/holidays', {
        method: 'POST',
        body: JSON.stringify({ date: new Date(addDate).toISOString(), name: addName }),
      });
      setShowAddForm(false);
      setAddDate(''); setAddName('');
      await load();
    } catch (err: any) {
      setAddError(err?.message ?? 'Failed to add holiday');
    } finally {
      setAdding(false);
    }
  };

  const handleEditSave = async (id: string) => {
    setActionLoading(id);
    try {
      const updates: Record<string, any> = {};
      if (editDate) updates.date = new Date(editDate).toISOString();
      if (editName) updates.name = editName;
      await apiFetch(`/friday/control-panel/holidays/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      setEditingId(null);
      await load();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (id: string) => {
    setActionLoading(id);
    try {
      await apiFetch(`/friday/control-panel/holidays/${id}/deactivate`, { method: 'PATCH', body: '{}' });
      await load();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const now = new Date();

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Holiday / Business Closure Calendar</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          {isAdmin && !showAddForm && (
            <button onClick={() => setShowAddForm(true)} style={primaryBtnStyle}>Add Holiday</button>
          )}
        </div>
      </div>

      {showAddForm && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Name</label>
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. New Year's Day" style={inputStyle} />
            </div>
          </div>
          {addError && <p style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '0.5rem' }}>{addError}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleAdd} disabled={adding} style={primaryBtnStyle}>
              {adding ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => setShowAddForm(false)} style={actionBtnStyle}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading...</p>}
      {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>}

      {!loading && holidays.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>No holidays found.</p>
      )}

      {!loading && holidays.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Status</th>
              {isAdmin && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => {
              const isPast = new Date(h.date) < now;
              const rowStyle = (!h.isActive || isPast) ? { ...trStyle, color: '#9ca3af' } : trStyle;
              const isEditing = editingId === h.id;

              return (
                <tr key={h.id} style={rowStyle}>
                  <td style={tdStyle}>
                    {isEditing ? (
                      <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
                    ) : (
                      new Date(h.date).toLocaleDateString()
                    )}
                  </td>
                  <td style={tdStyle}>
                    {isEditing ? (
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
                    ) : (
                      h.name
                    )}
                  </td>
                  <td style={tdStyle}>
                    {h.isActive ? (
                      <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.75rem' }}>Active</span>
                    ) : (
                      <span style={{ color: '#9ca3af', fontWeight: 600, fontSize: '0.75rem' }}>Inactive</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td style={tdStyle}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => handleEditSave(h.id)} disabled={!!actionLoading} style={actionBtnStyle}>Save</button>
                          <button onClick={() => setEditingId(null)} style={actionBtnStyle}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={() => { setEditingId(h.id); setEditDate(h.date.slice(0, 10)); setEditName(h.name); }} style={actionBtnStyle}>Edit</button>
                          {h.isActive && (
                            <button onClick={() => handleDeactivate(h.id)} disabled={!!actionLoading} style={{ ...actionBtnStyle, color: '#dc2626' }}>Deactivate</button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

const primaryBtnStyle: React.CSSProperties = { padding: '0.375rem 0.75rem', fontSize: '0.8125rem', border: 'none', borderRadius: 4, background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 };
const actionBtnStyle: React.CSSProperties = { padding: '0.25rem 0.5rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.375rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' };
const thStyle: React.CSSProperties = { padding: '0.5rem' };
const tdStyle: React.CSSProperties = { padding: '0.5rem' };
const trStyle: React.CSSProperties = { borderBottom: '1px solid #f3f4f6' };
