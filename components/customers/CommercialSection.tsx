'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import PricingSnapshotList from './PricingSnapshotList';
import RateSheetList from './RateSheetList';
import RateSheetDetail from './RateSheetDetail';
import ExhibitAList from './ExhibitAList';
import ExhibitADetail from './ExhibitADetail';
import MsaList from './MsaList';
import MsaDetail from './MsaDetail';

interface ContactOption { id: string; firstName: string; lastName: string; email: string | null; officePhone: string | null; cellPhone: string | null; jobTitle: string | null }

interface Props {
  customerId: string;
}

export default function CommercialSection({ customerId }: Props) {
  const [selectedRsId, setSelectedRsId] = useState<string | null>(null);
  const [rsRefreshKey, setRsRefreshKey] = useState(0);
  const [showCreateRs, setShowCreateRs] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [selectedEaId, setSelectedEaId] = useState<string | null>(null);
  const [eaRefreshKey, setEaRefreshKey] = useState(0);
  const [showCreateEa, setShowCreateEa] = useState(false);
  const [createEaError, setCreateEaError] = useState('');
  const [creatingEa, setCreatingEa] = useState(false);

  const [selectedMsaId, setSelectedMsaId] = useState<string | null>(null);
  const [msaRefreshKey, setMsaRefreshKey] = useState(0);
  const [showCreateMsa, setShowCreateMsa] = useState(false);
  const [createMsaError, setCreateMsaError] = useState('');
  const [creatingMsa, setCreatingMsa] = useState(false);

  const [newRsTitle, setNewRsTitle] = useState('');
  const [newRsNotes, setNewRsNotes] = useState('');
  const [newRsExpiresAt, setNewRsExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const [newEaTitle, setNewEaTitle] = useState('');
  const [newEaProject, setNewEaProject] = useState('');
  const [newEaSite, setNewEaSite] = useState('');
  const [newEaSiteAddress, setNewEaSiteAddress] = useState('');
  const [newEaNotes, setNewEaNotes] = useState('');
  const [newEaContactId, setNewEaContactId] = useState('');
  const [newEaContactName, setNewEaContactName] = useState('');
  const [newEaContactPhone, setNewEaContactPhone] = useState('');
  const [newEaContactEmail, setNewEaContactEmail] = useState('');
  const [newEaEffectiveDate, setNewEaEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEaExpiresAt, setNewEaExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().slice(0, 10);
  });

  const [contacts, setContacts] = useState<ContactOption[]>([]);

  const [newMsaTitle, setNewMsaTitle] = useState('');
  const [newMsaNotes, setNewMsaNotes] = useState('');
  const [newMsaExpiresAt, setNewMsaExpiresAt] = useState('');
  const [newMsaType, setNewMsaType] = useState('MW4H_STANDARD');

  // Load contacts
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<ContactOption[]>(`/customer-contacts/customer/${customerId}`);
        setContacts(data.filter(c => (c as any).isActive !== false));
      } catch { /* ignore */ }
    })();
  }, [customerId]);

  const refreshList = useCallback(() => {
    setRsRefreshKey((k) => k + 1);
  }, []);
  const refreshEaList = useCallback(() => {
    setEaRefreshKey((k) => k + 1);
  }, []);
  const refreshMsaList = useCallback(() => {
    setMsaRefreshKey((k) => k + 1);
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

  const handleCreateExhibitA = async () => {
    if (!newEaExpiresAt) return;
    setCreatingEa(true);
    setCreateEaError('');
    try {
      const ea = await apiFetch<{ id: string }>(`/commercial/customers/${customerId}/exhibit-as`, {
        method: 'POST',
        body: JSON.stringify({
          title: newEaTitle.trim() || undefined,
          projectName: newEaProject.trim() || undefined,
          siteName: newEaSite.trim() || undefined,
          siteAddress: newEaSiteAddress.trim() || undefined,
          notes: newEaNotes.trim() || undefined,
          customerContactId: newEaContactId || undefined,
          customerContactName: newEaContactName.trim() || undefined,
          customerContactPhone: newEaContactPhone.trim() || undefined,
          customerContactEmail: newEaContactEmail.trim() || undefined,
          effectiveDate: newEaEffectiveDate ? new Date(newEaEffectiveDate).toISOString() : undefined,
          expiresAt: new Date(newEaExpiresAt).toISOString(),
        }),
      });
      setShowCreateEa(false);
      setNewEaTitle('');
      setNewEaProject('');
      setNewEaSite('');
      setNewEaSiteAddress('');
      setNewEaNotes('');
      setNewEaContactId('');
      setNewEaContactName('');
      setNewEaContactPhone('');
      setNewEaContactEmail('');
      setSelectedEaId(ea.id);
      refreshEaList();
    } catch (e: any) {
      setCreateEaError(e?.message ?? 'Failed to create Exhibit A');
    } finally {
      setCreatingEa(false);
    }
  };

  const handleCreateMsa = async () => {
    setCreatingMsa(true);
    setCreateMsaError('');
    try {
      const created = await apiFetch<{ id: string }>(`/commercial/customers/${customerId}/msas`, {
        method: 'POST',
        body: JSON.stringify({
          title: newMsaTitle.trim() || undefined,
          notes: newMsaNotes.trim() || undefined,
          expiresAt: newMsaExpiresAt ? new Date(newMsaExpiresAt).toISOString() : undefined,
          agreementType: newMsaType,
        }),
      });
      setShowCreateMsa(false);
      setNewMsaTitle('');
      setNewMsaNotes('');
      setNewMsaExpiresAt('');
      setNewMsaType('MW4H_STANDARD');
      setSelectedMsaId(created.id);
      refreshMsaList();
    } catch (e: any) {
      setCreateMsaError(e?.message ?? 'Failed to create MSA');
    } finally {
      setCreatingMsa(false);
    }
  };

  // Detail drill-down views
  if (selectedRsId) {
    return (
      <RateSheetDetail
        rateSheetId={selectedRsId}
        onBack={() => { setSelectedRsId(null); refreshList(); }}
        onChanged={refreshList}
      />
    );
  }

  if (selectedEaId) {
    return (
      <ExhibitADetail
        exhibitAId={selectedEaId}
        customerId={customerId}
        onBack={() => { setSelectedEaId(null); refreshEaList(); }}
        onChanged={refreshEaList}
      />
    );
  }

  if (selectedMsaId) {
    return (
      <MsaDetail
        msaId={selectedMsaId}
        onBack={() => { setSelectedMsaId(null); refreshMsaList(); }}
        onChanged={refreshMsaList}
      />
    );
  }

  return (
    <div style={{ color: '#111827' }}>
      {/* Exhibit As */}
      <div style={S.panel}>
        <div style={S.panelHeader}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Exhibit As</h2>
          <button style={S.btnPrimarySmall} onClick={() => setShowCreateEa(true)}>
            + New Exhibit A
          </button>
        </div>
        <ExhibitAList customerId={customerId} onSelect={setSelectedEaId} refreshKey={eaRefreshKey} />
      </div>

      {/* Rate Sheets */}
      <div style={{ ...S.panel, marginTop: 24 }}>
        <div style={S.panelHeader}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Rate Sheets</h2>
          <button style={S.btnPrimarySmall} onClick={() => setShowCreateRs(true)}>
            + New Rate Sheet
          </button>
        </div>
        <RateSheetList customerId={customerId} onSelect={setSelectedRsId} refreshKey={rsRefreshKey} />
      </div>

      {/* MSAs */}
      <div style={{ ...S.panel, marginTop: 24 }}>
        <div style={S.panelHeader}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Master Service Agreements</h2>
          <button style={S.btnPrimarySmall} onClick={() => setShowCreateMsa(true)}>
            + New MSA
          </button>
        </div>
        <MsaList customerId={customerId} refreshKey={msaRefreshKey} onCreateNew={() => setShowCreateMsa(true)} onSelect={setSelectedMsaId} />
      </div>

      {/* Pricing Snapshots */}
      <div style={{ ...S.panel, marginTop: 24 }}>
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

      {/* Create Exhibit A Modal */}
      {showCreateEa && (
        <div style={S.overlay} onClick={() => setShowCreateEa(false)}>
          <div style={{ ...S.modal, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>New Exhibit A — Staffing Rate & Scope Agreement</h3>
              <button style={S.modalClose} onClick={() => setShowCreateEa(false)}>×</button>
            </div>
            <div style={{ ...S.modalBody, maxHeight: '65vh', overflowY: 'auto' }}>
              {createEaError && <div style={S.error}>{createEaError}</div>}

              <div style={S.editSectionLabel}>Agreement</div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Title / Description</label>
                <input style={S.formInput} value={newEaTitle} onChange={(e) => setNewEaTitle(e.target.value)} placeholder="e.g., Refinery Turnaround Q3 2026" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Effective Date</label>
                  <input style={S.formInput} type="date" value={newEaEffectiveDate} onChange={(e) => setNewEaEffectiveDate(e.target.value)} />
                </div>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Expiration Date *</label>
                  <input style={S.formInput} type="date" value={newEaExpiresAt} onChange={(e) => setNewEaExpiresAt(e.target.value)} />
                </div>
              </div>

              <div style={S.editSectionLabel}>Project / Site</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Project Name</label>
                  <input style={S.formInput} value={newEaProject} onChange={(e) => setNewEaProject(e.target.value)} placeholder="e.g., Unit 5 Overhaul" />
                </div>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Site Name</label>
                  <input style={S.formInput} value={newEaSite} onChange={(e) => setNewEaSite(e.target.value)} placeholder="e.g., Houston Refinery" />
                </div>
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Site Address</label>
                <input style={S.formInput} value={newEaSiteAddress} onChange={(e) => setNewEaSiteAddress(e.target.value)} placeholder="Full street address" />
              </div>

              <div style={S.editSectionLabel}>Customer Contact</div>
              {contacts.length > 0 && (
                <div style={S.formRow}>
                  <label style={S.formLabel}>Select from Customer Contacts</label>
                  <select style={S.formInput} value={newEaContactId} onChange={(e) => {
                    const c = contacts.find(x => x.id === e.target.value);
                    setNewEaContactId(e.target.value);
                    if (c) {
                      setNewEaContactName(`${c.firstName} ${c.lastName}`.trim());
                      setNewEaContactPhone(c.officePhone || c.cellPhone || '');
                      setNewEaContactEmail(c.email || '');
                    }
                  }}>
                    <option value="">— Manual entry —</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.jobTitle ? ` (${c.jobTitle})` : ''}</option>)}
                  </select>
                </div>
              )}
              <div style={S.formRow}>
                <label style={S.formLabel}>Contact Name</label>
                <input style={S.formInput} value={newEaContactName} onChange={(e) => setNewEaContactName(e.target.value)} placeholder="e.g., John Smith" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Phone</label>
                  <input style={S.formInput} value={newEaContactPhone} onChange={(e) => setNewEaContactPhone(e.target.value)} placeholder="(555) 123-4567" />
                </div>
                <div style={S.formRow}>
                  <label style={S.formLabel}>Email</label>
                  <input style={S.formInput} type="email" value={newEaContactEmail} onChange={(e) => setNewEaContactEmail(e.target.value)} placeholder="contact@company.com" />
                </div>
              </div>

              <div style={S.formRow}>
                <label style={S.formLabel}>Notes</label>
                <textarea style={{ ...S.formInput, resize: 'vertical' as const, fontFamily: 'inherit' }} rows={2} value={newEaNotes} onChange={(e) => setNewEaNotes(e.target.value)} placeholder="Optional notes" />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
                Commercial terms, labor categories, and rates can be added after creation.
              </p>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowCreateEa(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: (!newEaExpiresAt || creatingEa) ? 0.5 : 1 }} disabled={!newEaExpiresAt || creatingEa} onClick={handleCreateExhibitA}>
                {creatingEa ? 'Creating...' : 'Create Exhibit A'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create MSA Modal */}
      {showCreateMsa && (
        <div style={S.overlay} onClick={() => setShowCreateMsa(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>New Master Service Agreement</h3>
              <button style={S.modalClose} onClick={() => setShowCreateMsa(false)}>×</button>
            </div>
            <div style={S.modalBody}>
              {createMsaError && <div style={S.error}>{createMsaError}</div>}
              <div style={S.formRow}>
                <label style={S.formLabel}>Agreement Type</label>
                <select style={S.formInput} value={newMsaType} onChange={(e) => setNewMsaType(e.target.value)}>
                  <option value="MW4H_STANDARD">MW4H Standard</option>
                  <option value="MW4H_MODIFIED">MW4H Modified</option>
                  <option value="CUSTOMER_PROVIDED">Customer Provided</option>
                </select>
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Title (optional)</label>
                <input style={S.formInput} value={newMsaTitle} onChange={(e) => setNewMsaTitle(e.target.value)} placeholder="e.g., Master Agreement 2026" />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Expires (optional)</label>
                <input style={S.formInput} type="date" value={newMsaExpiresAt} onChange={(e) => setNewMsaExpiresAt(e.target.value)} />
              </div>
              <div style={S.formRow}>
                <label style={S.formLabel}>Notes</label>
                <textarea style={{ ...S.formInput, resize: 'vertical' as const, fontFamily: 'inherit' }} rows={2} value={newMsaNotes} onChange={(e) => setNewMsaNotes(e.target.value)} placeholder="Optional notes" />
              </div>
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setShowCreateMsa(false)}>Cancel</button>
              <button style={{ ...S.btnPrimary, opacity: creatingMsa ? 0.5 : 1 }} disabled={creatingMsa} onClick={handleCreateMsa}>
                {creatingMsa ? 'Creating...' : 'Create MSA'}
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
  editSectionLabel: {
    fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '0.8px',
    borderBottom: '1px solid #dbeafe', paddingBottom: 4, marginTop: 8,
  } as React.CSSProperties,
};
