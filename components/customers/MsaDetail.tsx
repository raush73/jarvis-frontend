'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface MsaFull {
  id: string;
  msaNumber: string | null;
  status: string;
  title: string | null;
  notes: string | null;
  agreementType: string | null;
  modificationNotes: string | null;
  customerSignerName: string | null;
  customerSignerTitle: string | null;
  mw4hSignerName: string | null;
  mw4hSignerTitle: string | null;
  expiresAt: string | null;
  sentAt: string | null;
  signedAt: string | null;
  reviewDueAt: string | null;
  lastReviewedAt: string | null;
  reviewCadenceMonths: number | null;
  approvedAt: string | null;
  approvalNote: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string };
  createdBy: { id: string; fullName: string | null; email: string } | null;
  approvedBy: { id: string; fullName: string | null; email: string } | null;
  exhibitAs: Array<{
    id: string;
    exhibitANumber: string | null;
    title: string | null;
    status: string;
    createdAt: string;
  }>;
}

interface Props {
  msaId: string;
  onBack: () => void;
  onChanged?: () => void;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: '#d97706', bg: '#fffbeb' },
  SENT: { color: '#2563eb', bg: '#eff6ff' },
  VIEWED: { color: '#7c3aed', bg: '#f5f3ff' },
  SIGNED: { color: '#16a34a', bg: '#f0fdf4' },
  EXPIRED: { color: '#6b7280', bg: '#f3f4f6' },
  SUPERSEDED: { color: '#6b7280', bg: '#f3f4f6' },
};

const TYPE_LABELS: Record<string, string> = {
  MW4H_STANDARD: 'MW4H Standard Agreement',
  MW4H_MODIFIED: 'MW4H Modified Agreement',
  CUSTOMER_PROVIDED: 'Customer-Provided Agreement',
};

const TYPE_BADGE_STYLES: Record<string, { color: string; bg: string }> = {
  MW4H_STANDARD: { color: '#1e40af', bg: '#dbeafe' },
  MW4H_MODIFIED: { color: '#92400e', bg: '#fef3c7' },
  CUSTOMER_PROVIDED: { color: '#6b21a8', bg: '#f3e8ff' },
};

const AGREEMENT_TYPE_OPTIONS = [
  { value: 'MW4H_STANDARD', label: 'MW4H Standard' },
  { value: 'MW4H_MODIFIED', label: 'MW4H Modified' },
  { value: 'CUSTOMER_PROVIDED', label: 'Customer Provided' },
];

export default function MsaDetail({ msaId, onBack, onChanged }: Props) {
  const [msa, setMsa] = useState<MsaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  const loadMsa = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<MsaFull>(`/commercial/msas/${msaId}`);
      setMsa(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load MSA');
    } finally {
      setLoading(false);
    }
  }, [msaId]);

  useEffect(() => { loadMsa(); }, [loadMsa]);

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>Loading MSA...</div>;
  if (error) return <div style={{ padding: 16 }}><div style={S.error}>{error}</div><button style={S.backBtn} onClick={onBack}>Back</button></div>;
  if (!msa) return null;

  const isDraft = msa.status === 'DRAFT';
  const st = STATUS_STYLES[msa.status] ?? STATUS_STYLES.EXPIRED;
  const typeBadge = TYPE_BADGE_STYLES[msa.agreementType ?? ''] ?? TYPE_BADGE_STYLES.MW4H_STANDARD;

  return (
    <div style={{ color: '#111827' }}>
      {/* Back navigation */}
      <button style={S.backBtn} onClick={onBack}>← Back to Commercial</button>

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
            {msa.msaNumber ?? 'MSA'}
          </h2>
          <span style={{ ...S.badge, color: st.color, background: st.bg }}>{msa.status}</span>
          <span style={{ ...S.badge, color: typeBadge.color, background: typeBadge.bg }}>
            {TYPE_LABELS[msa.agreementType ?? ''] ?? 'Unknown Type'}
          </span>
        </div>
        <div style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
          {msa.title && <span style={{ color: '#374151', fontWeight: 500 }}>{msa.title}</span>}
          {msa.title && ' — '}
          {msa.customer.name}
        </div>
      </div>

      {/* Details Section */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Agreement Details</h3>
          {isDraft && (
            <button style={S.btnSecondarySmall} onClick={() => setShowEdit(true)}>Edit Details</button>
          )}
        </div>
        <div style={S.detailGrid}>
          <DetailField label="Effective Date" value={msa.createdAt ? new Date(msa.createdAt).toLocaleDateString('en-US') : '—'} />
          <DetailField label="Expiration Date" value={msa.expiresAt ? new Date(msa.expiresAt).toLocaleDateString('en-US') : '—'} />
          <DetailField label="Review Due" value={msa.reviewDueAt ? new Date(msa.reviewDueAt).toLocaleDateString('en-US') : '—'} />
          <DetailField label="Review Cadence" value={msa.reviewCadenceMonths ? `${msa.reviewCadenceMonths} months` : '—'} />
          <DetailField label="Customer Signer" value={formatSigner(msa.customerSignerName, msa.customerSignerTitle)} />
          <DetailField label="MW4H Signer" value={formatSigner(msa.mw4hSignerName, msa.mw4hSignerTitle)} />
          {msa.sentAt && <DetailField label="Sent" value={new Date(msa.sentAt).toLocaleDateString('en-US')} />}
          {msa.signedAt && <DetailField label="Signed" value={new Date(msa.signedAt).toLocaleDateString('en-US')} />}
          <DetailField label="Created By" value={msa.createdBy?.fullName ?? msa.createdBy?.email ?? '—'} />
        </div>
        {msa.notes && (
          <div style={{ marginTop: 12 }}>
            <span style={S.fieldLabel}>Notes</span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{msa.notes}</p>
          </div>
        )}
        {msa.agreementType === 'MW4H_MODIFIED' && msa.modificationNotes && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
            <span style={{ ...S.fieldLabel, color: '#92400e' }}>Modification Notes</span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#78350f', whiteSpace: 'pre-wrap' }}>{msa.modificationNotes}</p>
          </div>
        )}
        {msa.agreementType === 'CUSTOMER_PROVIDED' && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b21a8' }}>Customer-Provided Agreement</span>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#7c3aed' }}>
              Upload and lifecycle management will be available in a future phase.
            </p>
          </div>
        )}
        {msa.approvedAt && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
            <span style={{ ...S.fieldLabel, color: '#166534' }}>Approved</span>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#15803d' }}>
              {new Date(msa.approvedAt).toLocaleDateString('en-US')}
              {msa.approvedBy && ` by ${msa.approvedBy.fullName ?? msa.approvedBy.email}`}
              {msa.approvalNote && ` — ${msa.approvalNote}`}
            </p>
          </div>
        )}
      </div>

      {/* Linked Exhibit As */}
      <div style={S.section}>
        <h3 style={S.sectionTitle}>Linked Exhibit As</h3>
        {msa.exhibitAs.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic', margin: '8px 0 0' }}>
            No Exhibit As linked to this MSA.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
            <thead>
              <tr>
                {['Number', 'Status', 'Title', 'Created'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {msa.exhibitAs.map(ea => {
                const east = STATUS_STYLES[ea.status] ?? STATUS_STYLES.EXPIRED;
                return (
                  <tr key={ea.id}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{ea.exhibitANumber ?? '—'}</td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, color: east.color, background: east.bg, fontSize: 10 }}>{ea.status}</span>
                    </td>
                    <td style={S.td}>{ea.title || '—'}</td>
                    <td style={{ ...S.td, color: '#6b7280' }}>{new Date(ea.createdAt).toLocaleDateString('en-US')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditMsaModal
          msa={msa}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); loadMsa(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={S.fieldLabel}>{label}</span>
      <div style={{ fontSize: 13, color: '#111827', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function formatSigner(name: string | null, title: string | null): string {
  if (!name && !title) return '—';
  if (name && title) return `${name}, ${title}`;
  return name || title || '—';
}

// ——— Edit Modal ———

interface EditModalProps {
  msa: MsaFull;
  onClose: () => void;
  onSaved: () => void;
}

function EditMsaModal({ msa, onClose, onSaved }: EditModalProps) {
  const [title, setTitle] = useState(msa.title ?? '');
  const [notes, setNotes] = useState(msa.notes ?? '');
  const [agreementType, setAgreementType] = useState(msa.agreementType ?? 'MW4H_STANDARD');
  const [modificationNotes, setModificationNotes] = useState(msa.modificationNotes ?? '');
  const [customerSignerName, setCustomerSignerName] = useState(msa.customerSignerName ?? '');
  const [customerSignerTitle, setCustomerSignerTitle] = useState(msa.customerSignerTitle ?? '');
  const [mw4hSignerName, setMw4hSignerName] = useState(msa.mw4hSignerName ?? '');
  const [mw4hSignerTitle, setMw4hSignerTitle] = useState(msa.mw4hSignerTitle ?? '');
  const [expiresAt, setExpiresAt] = useState(msa.expiresAt ? msa.expiresAt.slice(0, 10) : '');
  const [reviewDueAt, setReviewDueAt] = useState(msa.reviewDueAt ? msa.reviewDueAt.slice(0, 10) : '');
  const [reviewCadenceMonths, setReviewCadenceMonths] = useState(msa.reviewCadenceMonths?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/commercial/msas/${msa.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim() || null,
          notes: notes.trim() || null,
          agreementType,
          modificationNotes: modificationNotes.trim() || null,
          customerSignerName: customerSignerName.trim() || null,
          customerSignerTitle: customerSignerTitle.trim() || null,
          mw4hSignerName: mw4hSignerName.trim() || null,
          mw4hSignerTitle: mw4hSignerTitle.trim() || null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          reviewDueAt: reviewDueAt ? new Date(reviewDueAt).toISOString() : null,
          reviewCadenceMonths: reviewCadenceMonths ? parseInt(reviewCadenceMonths, 10) : null,
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Edit MSA Details</h3>
          <button style={S.modalClose} onClick={onClose}>×</button>
        </div>
        <div style={{ ...S.modalBody, maxHeight: '70vh', overflowY: 'auto' }}>
          {error && <div style={S.error}>{error}</div>}

          <div style={S.editSection}>Agreement</div>
          <div style={S.formRow}>
            <label style={S.formLabel}>Title</label>
            <input style={S.formInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Master Agreement 2026" />
          </div>
          <div style={S.formRow}>
            <label style={S.formLabel}>Agreement Type</label>
            <select style={S.formInput} value={agreementType} onChange={e => setAgreementType(e.target.value)}>
              {AGREEMENT_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {agreementType === 'MW4H_MODIFIED' && (
            <div style={S.formRow}>
              <label style={S.formLabel}>Modification Notes</label>
              <textarea
                style={{ ...S.formInput, resize: 'vertical', fontFamily: 'inherit' }}
                rows={3}
                value={modificationNotes}
                onChange={e => setModificationNotes(e.target.value)}
                placeholder="Describe negotiated changes (e.g., conversion fee reduced to 15%)"
              />
            </div>
          )}

          {agreementType === 'CUSTOMER_PROVIDED' && (
            <div style={{ padding: '10px 14px', background: '#f3e8ff', border: '1px solid #e9d5ff', borderRadius: 8, marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#7c3aed' }}>
                Customer-provided agreement upload will be available in a future phase.
              </p>
            </div>
          )}

          <div style={S.formRow}>
            <label style={S.formLabel}>Notes</label>
            <textarea style={{ ...S.formInput, resize: 'vertical', fontFamily: 'inherit' }} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes" />
          </div>

          <div style={S.editSection}>Dates</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={S.formRow}>
              <label style={S.formLabel}>Expiration Date</label>
              <input style={S.formInput} type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </div>
            <div style={S.formRow}>
              <label style={S.formLabel}>Review Due Date</label>
              <input style={S.formInput} type="date" value={reviewDueAt} onChange={e => setReviewDueAt(e.target.value)} />
            </div>
          </div>
          <div style={S.formRow}>
            <label style={S.formLabel}>Review Cadence (months)</label>
            <input
              style={{ ...S.formInput, maxWidth: 120 }}
              type="number"
              min="1"
              value={reviewCadenceMonths}
              onChange={e => setReviewCadenceMonths(e.target.value)}
              placeholder="12"
            />
          </div>

          <div style={S.editSection}>Signers</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={S.formRow}>
              <label style={S.formLabel}>Customer Signer Name</label>
              <input style={S.formInput} value={customerSignerName} onChange={e => setCustomerSignerName(e.target.value)} placeholder="e.g., John Smith" />
            </div>
            <div style={S.formRow}>
              <label style={S.formLabel}>Customer Signer Title</label>
              <input style={S.formInput} value={customerSignerTitle} onChange={e => setCustomerSignerTitle(e.target.value)} placeholder="e.g., VP Operations" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={S.formRow}>
              <label style={S.formLabel}>MW4H Signer Name</label>
              <input style={S.formInput} value={mw4hSignerName} onChange={e => setMw4hSignerName(e.target.value)} placeholder="e.g., Michael Ward" />
            </div>
            <div style={S.formRow}>
              <label style={S.formLabel}>MW4H Signer Title</label>
              <input style={S.formInput} value={mw4hSignerTitle} onChange={e => setMw4hSignerTitle(e.target.value)} placeholder="e.g., President" />
            </div>
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={{ ...S.btnPrimary, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: '4px 0', marginBottom: 12 } as React.CSSProperties,
  header: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 16 },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 } as React.CSSProperties,
  section: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 16 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } as React.CSSProperties,
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' } as React.CSSProperties,
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 20px' } as React.CSSProperties,
  fieldLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '8px 10px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: 13 },
  error: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 8 },
  btnSecondarySmall: { padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  btnPrimary: { padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  btnSecondary: { padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' } as React.CSSProperties,
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 12, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } as React.CSSProperties,
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' } as React.CSSProperties,
  modalClose: { background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1, padding: '2px 6px' } as React.CSSProperties,
  modalBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 12 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #e5e7eb' } as React.CSSProperties,
  formRow: { display: 'flex' as const, flexDirection: 'column' as const, gap: 4 },
  formLabel: { fontSize: 12, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  formInput: { padding: '7px 10px', fontSize: 13, color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' } as React.CSSProperties,
  editSection: { fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' as const, letterSpacing: '0.8px', borderBottom: '1px solid #dbeafe', paddingBottom: 4, marginTop: 8 } as React.CSSProperties,
};
