'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import PricingSnapshotList from './PricingSnapshotList';
import RateSheetList from './RateSheetList';
import RateSheetDetail from './RateSheetDetail';

interface Props {
  customerId: string;
}

export default function CommercialSection({ customerId }: Props) {
  const [selectedRsId, setSelectedRsId] = useState<string | null>(null);
  const [rsRefreshKey, setRsRefreshKey] = useState(0);
  const [showCreateRs, setShowCreateRs] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [newRsTitle, setNewRsTitle] = useState('');
  const [newRsNotes, setNewRsNotes] = useState('');
  const [newRsExpiresAt, setNewRsExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const refreshList = useCallback(() => {
    setRsRefreshKey((k) => k + 1);
  }, []);

  const handleCreateRateSheet = async () => {
    if (!newRsExpiresAt) return;
    setCreating(true);
    setCreateError('');
    try {
      const rs = await apiFetch<{ id: string }>(`/commercial/customers/${customerId}/rate-sheets`, {
        method: 'POST',
        body: JSON.stringify({
          title: newRsTitle.trim() || undefined,
          notes: newRsNotes.trim() || undefined,
          expiresAt: new Date(newRsExpiresAt).toISOString(),
        }),
      });
      setShowCreateRs(false);
      setNewRsTitle('');
      setNewRsNotes('');
      setSelectedRsId(rs.id);
      refreshList();
    } catch (e: any) {
      setCreateError(e?.message ?? 'Failed to create rate sheet');
    } finally {
      setCreating(false);
    }
  };

  if (selectedRsId) {
    return (
      <RateSheetDetail
        rateSheetId={selectedRsId}
        onBack={() => { setSelectedRsId(null); refreshList(); }}
        onChanged={refreshList}
      />
    );
  }

  return (
    <div style={{ color: '#111827' }}>
      {/* Rate Sheets */}
      <div style={S.panel}>
        <div style={S.panelHeader}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Rate Sheets</h2>
          <button style={S.btnPrimarySmall} onClick={() => setShowCreateRs(true)}>
            + New Rate Sheet
          </button>
        </div>
        <RateSheetList customerId={customerId} onSelect={setSelectedRsId} refreshKey={rsRefreshKey} />
      </div>

      {/* Pricing Snapshots */}
      <div style={{ ...S.panel, marginTop: 28 }}>
        <div style={S.panelHeader}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Pricing Snapshots</h2>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', padding: '2px 8px', border: '1px solid #e5e7eb', borderRadius: 4 }}>Internal Only</span>
        </div>
        <PricingSnapshotList customerId={customerId} />
      </div>

      {/* Create Rate Sheet Modal */}
      {showCreateRs && (
        <div style={S.overlay} onClick={() => setShowCreateRs(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>New Rate Sheet</h3>
              <button style={S.modalClose} onClick={() => setShowCreateRs(false)}>×</button>
            </div>
            <div style={S.modalBody}>
              {createError && <div style={S.error}>{createError}</div>}
              <div style={S.formRow}>
                <label style={S.formLabel}>Title (optional)</label>
                <input style={S.formInput} value={newRsTitle} onChange={(e) => setNewRsTitle(e.target.value)} placeholder="e.g., Plant Turnaround 2026" />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Valid Until *</label>
                <input style={S.formInput} type="date" value={newRsExpiresAt} onChange={(e) => setNewRsExpiresAt(e.target.value)} />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Notes</label>
                <textarea style={{ ...S.formInput, resize: 'vertical' as const, fontFamily: 'inherit' }} rows={3} value={newRsNotes} onChange={(e) => setNewRsNotes(e.target.value)} placeholder="Optional notes" />
              </div>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowCreateRs(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: (!newRsExpiresAt || creating) ? 0.5 : 1 }} disabled={!newRsExpiresAt || creating} onClick={handleCreateRateSheet}>
                {creating ? 'Creating...' : 'Create Rate Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  panel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', overflow: 'hidden' as const },
  panelHeader: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 14 },
  btnPrimarySmall: { padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  btnPrimary: { padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  btnSecondary: { padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  error: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 8 },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } as React.CSSProperties,
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' } as React.CSSProperties,
  modalClose: { background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' } as React.CSSProperties,
  modalBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 12 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb' } as React.CSSProperties,
  formRow: { display: 'flex' as const, flexDirection: 'column' as const, gap: 4 },
  formLabel: { fontSize: 12, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  formInput: { padding: '7px 10px', fontSize: 13, color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' } as React.CSSProperties,
};
