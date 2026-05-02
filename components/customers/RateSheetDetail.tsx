'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface RateSheetLine {
  id: string;
  tradeCode: string;
  tradeName: string;
  state: string | null;
  basePayRate: number | null;
  baseBillRate: number | null;
  otPayRate: number | null;
  otBillRate: number | null;
  dtPayRate: number | null;
  dtBillRate: number | null;
  burdenPct: number | null;
  marginPct: number | null;
  markupPct: number | null;
  notes: string | null;
  sortOrder: number;
}

interface RateSheet {
  id: string;
  rateSheetNumber: string | null;
  status: string;
  title: string | null;
  notes: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: RateSheetLine[];
  customer?: { id: string; name: string };
}

interface Props {
  rateSheetId: string;
  onBack: () => void;
  onChanged?: () => void;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: '#d97706', bg: '#fffbeb' },
  ACTIVE: { color: '#16a34a', bg: '#f0fdf4' },
  EXPIRED: { color: '#6b7280', bg: '#f3f4f6' },
  SUPERSEDED: { color: '#6b7280', bg: '#f3f4f6' },
};

export default function RateSheetDetail({ rateSheetId, onBack, onChanged }: Props) {
  const [rs, setRs] = useState<RateSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showAddLine, setShowAddLine] = useState(false);
  const [showEditMeta, setShowEditMeta] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');

  const [newLine, setNewLine] = useState({
    tradeCode: '', tradeName: '', state: '',
    basePayRate: '', baseBillRate: '',
    otPayRate: '', otBillRate: '',
    dtPayRate: '', dtBillRate: '',
    burdenPct: '', marginPct: '', markupPct: '',
    notes: '', sortOrder: '',
  });

  const loadSheet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<RateSheet>(`/commercial/rate-sheets/${rateSheetId}`);
      setRs(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load rate sheet');
    } finally {
      setLoading(false);
    }
  }, [rateSheetId]);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  const isDraft = rs?.status === 'DRAFT';
  const isActive = rs?.status === 'ACTIVE';
  const isTerminal = rs?.status === 'EXPIRED' || rs?.status === 'SUPERSEDED';
  const canEdit = isDraft || isActive;

  const handleAction = async (action: string) => {
    setActionLoading(true);
    setActionError('');
    try {
      await apiFetch(`/commercial/rate-sheets/${rateSheetId}/${action}`, { method: 'POST' });
      await loadSheet();
      onChanged?.();
    } catch (e: any) {
      setActionError(e?.message ?? `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveMeta = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const body: Record<string, any> = {};
      if (editTitle !== (rs?.title ?? '')) body.title = editTitle;
      if (editNotes !== (rs?.notes ?? '')) body.notes = editNotes;
      if (editExpiresAt) body.expiresAt = new Date(editExpiresAt).toISOString();
      await apiFetch(`/commercial/rate-sheets/${rateSheetId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setShowEditMeta(false);
      await loadSheet();
      onChanged?.();
    } catch (e: any) {
      setActionError(e?.message ?? 'Failed to update');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddLine = async () => {
    setActionLoading(true);
    setActionError('');
    try {
      const body: Record<string, any> = {
        tradeCode: newLine.tradeCode,
        tradeName: newLine.tradeName,
      };
      if (newLine.state) body.state = newLine.state;
      if (newLine.basePayRate) body.basePayRate = parseFloat(newLine.basePayRate);
      if (newLine.baseBillRate) body.baseBillRate = parseFloat(newLine.baseBillRate);
      if (newLine.otPayRate) body.otPayRate = parseFloat(newLine.otPayRate);
      if (newLine.otBillRate) body.otBillRate = parseFloat(newLine.otBillRate);
      if (newLine.dtPayRate) body.dtPayRate = parseFloat(newLine.dtPayRate);
      if (newLine.dtBillRate) body.dtBillRate = parseFloat(newLine.dtBillRate);
      if (newLine.burdenPct) body.burdenPct = parseFloat(newLine.burdenPct);
      if (newLine.marginPct) body.marginPct = parseFloat(newLine.marginPct);
      if (newLine.markupPct) body.markupPct = parseFloat(newLine.markupPct);
      if (newLine.notes) body.notes = newLine.notes;
      if (newLine.sortOrder) body.sortOrder = parseInt(newLine.sortOrder, 10);

      await apiFetch(`/commercial/rate-sheets/${rateSheetId}/lines`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setShowAddLine(false);
      setNewLine({
        tradeCode: '', tradeName: '', state: '',
        basePayRate: '', baseBillRate: '',
        otPayRate: '', otBillRate: '',
        dtPayRate: '', dtBillRate: '',
        burdenPct: '', marginPct: '', markupPct: '',
        notes: '', sortOrder: '',
      });
      await loadSheet();
      onChanged?.();
    } catch (e: any) {
      setActionError(e?.message ?? 'Failed to add line');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!confirm('Remove this line?')) return;
    setActionLoading(true);
    setActionError('');
    try {
      await apiFetch(`/commercial/rate-sheets/${rateSheetId}/lines/${lineId}`, {
        method: 'DELETE',
      });
      await loadSheet();
      onChanged?.();
    } catch (e: any) {
      setActionError(e?.message ?? 'Failed to remove line');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePdf = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('jp_accessToken') : null;
    if (!token) return;
    const url = `/api/commercial/rate-sheets/${rateSheetId}/pdf`;
    window.open(url, '_blank');
  };

  const fmtRate = (v: number | null) => v != null ? `$${Number(v).toFixed(2)}` : '—';
  const fmtPct = (v: number | null) => v != null ? `${Number(v).toFixed(1)}%` : '—';

  if (loading) return <div style={S.loading}>Loading rate sheet...</div>;
  if (error) return <div style={S.error}>{error}<br /><button style={S.linkBtn} onClick={onBack}>Back</button></div>;
  if (!rs) return null;

  const statusStyle = STATUS_STYLES[rs.status] ?? STATUS_STYLES.EXPIRED;

  return (
    <div style={{ color: '#111827' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button style={{ ...S.linkBtn, marginBottom: 12, fontSize: 13 }} onClick={onBack}>← Back to Rate Sheets</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>{rs.rateSheetNumber ?? 'Rate Sheet'}</h3>
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, color: statusStyle.color, background: statusStyle.bg }}>
            {rs.status}
          </span>
        </div>
      </div>

      {actionError && <div style={{ ...S.error, marginBottom: 12 }}>{actionError}</div>}

      {/* Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', padding: '16px 20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 }}>
        <div><span style={S.metaLabel}>Customer</span><span style={S.metaValue}>{rs.customer?.name ?? '—'}</span></div>
        <div><span style={S.metaLabel}>Title</span><span style={S.metaValue}>{rs.title || '—'}</span></div>
        <div><span style={S.metaLabel}>Valid Until</span><span style={S.metaValue}>{rs.expiresAt ? new Date(rs.expiresAt).toLocaleDateString('en-US') : '—'}</span></div>
        <div><span style={S.metaLabel}>Created</span><span style={S.metaValue}>{new Date(rs.createdAt).toLocaleDateString('en-US')}</span></div>
        {rs.notes && <div style={{ gridColumn: '1 / -1' }}><span style={S.metaLabel}>Notes</span><p style={{ margin: '2px 0 0', color: '#374151', fontSize: 13 }}>{rs.notes}</p></div>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {canEdit && (
          <button style={S.btnSecondary}
            onClick={() => { setEditTitle(rs.title ?? ''); setEditNotes(rs.notes ?? ''); setEditExpiresAt(rs.expiresAt ? rs.expiresAt.slice(0, 10) : ''); setShowEditMeta(true); }}
          >
            Edit Details
          </button>
        )}
        {isDraft && (
          <button style={{ ...S.btnPrimary, opacity: (actionLoading || rs.lines.length === 0) ? 0.5 : 1 }}
            disabled={actionLoading || rs.lines.length === 0} onClick={() => handleAction('activate')}>
            Activate
          </button>
        )}
        {isActive && (
          <>
            <button style={{ ...S.btnDanger, opacity: actionLoading ? 0.5 : 1 }} disabled={actionLoading} onClick={() => handleAction('expire')}>Expire</button>
            <button style={{ ...S.btnSecondary, opacity: actionLoading ? 0.5 : 1 }} disabled={actionLoading} onClick={() => handleAction('supersede')}>Supersede</button>
          </>
        )}
        {(isDraft || isActive) && (
          <button style={S.btnSecondary} onClick={handlePdf}>Download PDF</button>
        )}
      </div>

      {/* Lines Table */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>Lines ({rs.lines.length})</h4>
        {isDraft && (
          <button style={{ ...S.btnPrimary, fontSize: 12, padding: '5px 12px' }} onClick={() => setShowAddLine(true)}>+ Add Line</button>
        )}
      </div>

      {rs.lines.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14, fontStyle: 'italic' }}>No lines added yet.</div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Trade','State','REG Pay','REG Bill','OT Pay','OT Bill','DT Pay','DT Bill','Burden','Margin'].concat(isDraft ? ['Actions'] : []).map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rs.lines.map((line) => (
                <tr key={line.id}>
                  <td style={{ ...S.td, fontWeight: 600, color: '#111827' }}>{line.tradeName || line.tradeCode}</td>
                  <td style={S.td}>{line.state ?? '—'}</td>
                  <td style={S.tdNum}>{fmtRate(line.basePayRate)}</td>
                  <td style={S.tdNum}>{fmtRate(line.baseBillRate)}</td>
                  <td style={S.tdNum}>{fmtRate(line.otPayRate)}</td>
                  <td style={S.tdNum}>{fmtRate(line.otBillRate)}</td>
                  <td style={S.tdNum}>{fmtRate(line.dtPayRate)}</td>
                  <td style={S.tdNum}>{fmtRate(line.dtBillRate)}</td>
                  <td style={S.tdNum}>{fmtPct(line.burdenPct)}</td>
                  <td style={S.tdNum}>{fmtPct(line.marginPct)}</td>
                  {isDraft && (
                    <td style={S.td}>
                      <button style={{ ...S.linkBtn, color: '#dc2626', fontSize: 12 }} disabled={actionLoading} onClick={() => handleRemoveLine(line.id)}>
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Line Modal */}
      {showAddLine && (
        <div style={S.overlay} onClick={() => setShowAddLine(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Add Rate Sheet Line</h3>
              <button style={S.modalClose} onClick={() => setShowAddLine(false)}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.formRow}>
                <label style={S.formLabel}>Trade Code *</label>
                <input style={S.formInput} value={newLine.tradeCode} onChange={(e) => setNewLine({ ...newLine, tradeCode: e.target.value })} placeholder="e.g., MILL" />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Trade Name *</label>
                <input style={S.formInput} value={newLine.tradeName} onChange={(e) => setNewLine({ ...newLine, tradeName: e.target.value })} placeholder="e.g., Millwright" />
              </div>
              <div style={S.formRow2}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>State</label>
                  <input style={S.formInput} value={newLine.state} onChange={(e) => setNewLine({ ...newLine, state: e.target.value })} placeholder="e.g., TX" />
                </div>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Sort Order</label>
                  <input style={S.formInput} type="number" value={newLine.sortOrder} onChange={(e) => setNewLine({ ...newLine, sortOrder: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div style={S.formRow2}>
                <div style={S.formRow}><label style={S.formLabel}>REG Pay Rate</label><input style={S.formInput} type="number" step="0.01" value={newLine.basePayRate} onChange={(e) => setNewLine({ ...newLine, basePayRate: e.target.value })} /></div>
                <div style={S.formRow}><label style={S.formLabel}>REG Bill Rate</label><input style={S.formInput} type="number" step="0.01" value={newLine.baseBillRate} onChange={(e) => setNewLine({ ...newLine, baseBillRate: e.target.value })} /></div>
              </div>
              <div style={S.formRow2}>
                <div style={S.formRow}><label style={S.formLabel}>OT Pay Rate</label><input style={S.formInput} type="number" step="0.01" value={newLine.otPayRate} onChange={(e) => setNewLine({ ...newLine, otPayRate: e.target.value })} /></div>
                <div style={S.formRow}><label style={S.formLabel}>OT Bill Rate</label><input style={S.formInput} type="number" step="0.01" value={newLine.otBillRate} onChange={(e) => setNewLine({ ...newLine, otBillRate: e.target.value })} /></div>
              </div>
              <div style={S.formRow2}>
                <div style={S.formRow}><label style={S.formLabel}>DT Pay Rate</label><input style={S.formInput} type="number" step="0.01" value={newLine.dtPayRate} onChange={(e) => setNewLine({ ...newLine, dtPayRate: e.target.value })} /></div>
                <div style={S.formRow}><label style={S.formLabel}>DT Bill Rate</label><input style={S.formInput} type="number" step="0.01" value={newLine.dtBillRate} onChange={(e) => setNewLine({ ...newLine, dtBillRate: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={S.formRow}><label style={S.formLabel}>Burden %</label><input style={S.formInput} type="number" step="0.1" value={newLine.burdenPct} onChange={(e) => setNewLine({ ...newLine, burdenPct: e.target.value })} /></div>
                <div style={S.formRow}><label style={S.formLabel}>Margin %</label><input style={S.formInput} type="number" step="0.1" value={newLine.marginPct} onChange={(e) => setNewLine({ ...newLine, marginPct: e.target.value })} /></div>
                <div style={S.formRow}><label style={S.formLabel}>Markup %</label><input style={S.formInput} type="number" step="0.1" value={newLine.markupPct} onChange={(e) => setNewLine({ ...newLine, markupPct: e.target.value })} /></div>
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Notes</label>
                <textarea style={{ ...S.formInput, resize: 'vertical' as const, fontFamily: 'inherit' }} rows={2} value={newLine.notes} onChange={(e) => setNewLine({ ...newLine, notes: e.target.value })} />
              </div>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowAddLine(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: (!newLine.tradeCode.trim() || !newLine.tradeName.trim() || actionLoading) ? 0.5 : 1 }}
                disabled={!newLine.tradeCode.trim() || !newLine.tradeName.trim() || actionLoading} onClick={handleAddLine}>
                {actionLoading ? 'Adding...' : 'Add Line'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meta Modal */}
      {showEditMeta && (
        <div style={S.overlay} onClick={() => setShowEditMeta(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Edit Rate Sheet</h3>
              <button style={S.modalClose} onClick={() => setShowEditMeta(false)}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.formRow}>
                <label style={S.formLabel}>Title</label>
                <input style={S.formInput} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Optional title" />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Valid Until</label>
                <input style={S.formInput} type="date" value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Notes</label>
                <textarea style={{ ...S.formInput, resize: 'vertical' as const, fontFamily: 'inherit' }} rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowEditMeta(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: actionLoading ? 0.5 : 1 }} disabled={actionLoading} onClick={handleSaveMeta}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  loading: { padding: '24px 0', textAlign: 'center' as const, color: '#6b7280', fontSize: 14 },
  error: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 },
  linkBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500 } as React.CSSProperties,
  metaLabel: { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280', marginBottom: 2 },
  metaValue: { display: 'block', fontSize: 14, color: '#111827', fontWeight: 500 },
  th: { textAlign: 'left' as const, padding: '10px 10px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' },
  td: { padding: '9px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: 13 },
  tdNum: { padding: '9px 10px', borderBottom: '1px solid #f3f4f6', color: '#111827', fontSize: 13, fontVariantNumeric: 'tabular-nums' as const, textAlign: 'right' as const },
  btnPrimary: { padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  btnSecondary: { padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  btnDanger: { padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } as React.CSSProperties,
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' } as React.CSSProperties,
  modalClose: { background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' } as React.CSSProperties,
  modalBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 12 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb' } as React.CSSProperties,
  formRow: { display: 'flex' as const, flexDirection: 'column' as const, gap: 4 },
  formRow2: { display: 'grid' as const, gridTemplateColumns: '1fr 1fr', gap: 12 },
  formLabel: { fontSize: 12, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  formInput: { padding: '7px 10px', fontSize: 13, color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' } as React.CSSProperties,
};
