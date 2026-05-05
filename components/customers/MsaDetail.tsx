'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, API_BASE, getAccessToken } from '@/lib/api';

interface MsaVersionSummary {
  id: string;
  versionNumber: number;
  generatedAt: string;
  templateRevision: string;
  notes: string | null;
  pdfPath: string | null;
  generatedBy: { id: string; fullName: string | null; email: string } | null;
}

interface MsaDocumentSummary {
  id: string;
  documentRole: string;
  originalFilename: string;
  mimeType: string;
  uploadedAt: string;
  notes: string | null;
  uploadedBy: { id: string; fullName: string | null; email: string } | null;
}

interface MsaHealthResult {
  health: string;
  daysUntilExpiration: number | null;
  reviewDueAt: string | null;
  lastReviewedAt: string | null;
  isReviewOverdue: boolean;
}

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
  sentToEmail: string | null;
  sendNotes: string | null;
  countersignedAt: string | null;
  customerSignedAt: string | null;
  fullyExecutedAt: string | null;
  supersededAt: string | null;
  supersededByMsaId: string | null;
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
  sentBy: { id: string; fullName: string | null; email: string } | null;
  fullyExecutedBy: { id: string; fullName: string | null; email: string } | null;
  exhibitAs: Array<{
    id: string;
    exhibitANumber: string | null;
    title: string | null;
    status: string;
    createdAt: string;
  }>;
  documents: MsaDocumentSummary[];
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

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER_SOURCE: 'Customer Source',
  CUSTOMER_SIGNED: 'Customer Signed',
  MW4H_COUNTERSIGNED: 'MW4H Countersigned',
  SUPPORTING_ATTACHMENT: 'Attachment',
};

const ROLE_BADGE_STYLES: Record<string, { color: string; background: string }> = {
  CUSTOMER_SOURCE: { color: '#6b21a8', background: '#f3e8ff' },
  CUSTOMER_SIGNED: { color: '#16a34a', background: '#f0fdf4' },
  MW4H_COUNTERSIGNED: { color: '#1e40af', background: '#dbeafe' },
  SUPPORTING_ATTACHMENT: { color: '#6b7280', background: '#f3f4f6' },
};

const UPLOAD_ROLE_OPTIONS = [
  { value: 'CUSTOMER_SOURCE', label: 'Customer Source Agreement' },
  { value: 'CUSTOMER_SIGNED', label: 'Customer Signed Copy' },
  { value: 'MW4H_COUNTERSIGNED', label: 'MW4H Countersigned Copy' },
  { value: 'SUPPORTING_ATTACHMENT', label: 'Supporting Attachment' },
];

const HEALTH_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  ACTIVE: { color: '#16a34a', bg: '#f0fdf4', label: 'Active' },
  EXPIRING_SOON: { color: '#d97706', bg: '#fffbeb', label: 'Expiring Soon' },
  NEEDS_REVIEW: { color: '#9333ea', bg: '#faf5ff', label: 'Needs Review' },
  EXPIRED: { color: '#dc2626', bg: '#fef2f2', label: 'Expired' },
  NO_MSA: { color: '#6b7280', bg: '#f3f4f6', label: 'No MSA' },
  DRAFT_ONLY: { color: '#d97706', bg: '#fffbeb', label: 'Draft Only' },
  SUPERSEDED: { color: '#6b7280', bg: '#f3f4f6', label: 'Superseded' },
};

export default function MsaDetail({ msaId, onBack, onChanged }: Props) {
  const [msa, setMsa] = useState<MsaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [versions, setVersions] = useState<MsaVersionSummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [health, setHealth] = useState<MsaHealthResult | null>(null);
  const [lifecycleModal, setLifecycleModal] = useState<{ action: string; title: string } | null>(null);

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

  const loadVersions = useCallback(async () => {
    try {
      const data = await apiFetch<MsaVersionSummary[]>(`/commercial/msas/${msaId}/versions`);
      setVersions(data);
    } catch {
      // non-critical
    }
  }, [msaId]);

  const loadHealth = useCallback(async () => {
    try {
      const data = await apiFetch<MsaHealthResult>(`/commercial/msas/${msaId}/health`);
      setHealth(data);
    } catch {
      // non-critical
    }
  }, [msaId]);

  useEffect(() => { loadMsa(); loadVersions(); loadHealth(); }, [loadMsa, loadVersions, loadHealth]);

  const handleGeneratePdf = async () => {
    setGenerating(true);
    setGenError('');
    try {
      await apiFetch(`/commercial/msas/${msaId}/generate-pdf`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadVersions();
    } catch (e: any) {
      setGenError(e?.message ?? 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async (versionId: string, filename: string) => {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/commercial/msa-versions/${versionId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocument = async (docId: string, filename: string) => {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE}/commercial/msa-documents/${docId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleApprove = async () => {
    try {
      await apiFetch(`/commercial/msas/${msaId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadMsa();
      await loadHealth();
      onChanged?.();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to approve');
    }
  };

  const handleLifecycleAction = async (action: string, note?: string, extra?: Record<string, any>) => {
    try {
      await apiFetch(`/commercial/msas/${msaId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ note, ...extra }),
      });
      await loadMsa();
      await loadHealth();
      onChanged?.();
    } catch (e: any) {
      throw new Error(e?.message ?? `Action failed`);
    }
  };

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
          {health && (
            <span style={{ ...S.badge, color: HEALTH_STYLES[health.health]?.color ?? '#6b7280', background: HEALTH_STYLES[health.health]?.bg ?? '#f3f4f6' }}>
              {HEALTH_STYLES[health.health]?.label ?? health.health}
            </span>
          )}
        </div>
        <div style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
          {msa.title && <span style={{ color: '#374151', fontWeight: 500 }}>{msa.title}</span>}
          {msa.title && ' — '}
          {msa.customer.name}
        </div>
        {health && health.daysUntilExpiration !== null && health.daysUntilExpiration <= 90 && health.daysUntilExpiration > 0 && (
          <div style={{ marginTop: 8, padding: '6px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
            Expires in {health.daysUntilExpiration} day{health.daysUntilExpiration !== 1 ? 's' : ''}
          </div>
        )}
        {health && health.isReviewOverdue && (
          <div style={{ marginTop: 8, padding: '6px 12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 6, fontSize: 12, color: '#7c3aed' }}>
            Review overdue {health.reviewDueAt ? `(due ${new Date(health.reviewDueAt).toLocaleDateString('en-US')})` : ''}
          </div>
        )}
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
          {msa.customerSignedAt && <DetailField label="Customer Signed" value={new Date(msa.customerSignedAt).toLocaleDateString('en-US')} />}
          {msa.fullyExecutedAt && <DetailField label="Fully Executed" value={new Date(msa.fullyExecutedAt).toLocaleDateString('en-US')} />}
          {msa.lastReviewedAt && <DetailField label="Last Reviewed" value={new Date(msa.lastReviewedAt).toLocaleDateString('en-US')} />}
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
              Upload the customer&apos;s agreement using the Documents section below.
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

      {/* PDF Actions */}
      {msa.agreementType !== 'CUSTOMER_PROVIDED' && (
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <h3 style={S.sectionTitle}>Document Generation</h3>
            <button
              style={{ ...S.btnPrimary, opacity: generating ? 0.5 : 1 }}
              disabled={generating}
              onClick={handleGeneratePdf}
            >
              {generating ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>
          {genError && <div style={S.error}>{genError}</div>}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
            Generates an immutable PDF snapshot of the current MSA state. Previous versions are preserved.
          </p>
        </div>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <div style={S.section}>
          <h3 style={S.sectionTitle}>Version History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
            <thead>
              <tr>
                {['Version', 'Generated', 'Generated By', 'Template', 'Notes', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versions.map(v => (
                <tr key={v.id}>
                  <td style={{ ...S.td, fontWeight: 600 }}>v{v.versionNumber}</td>
                  <td style={S.td}>{new Date(v.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td style={S.td}>{v.generatedBy?.fullName ?? v.generatedBy?.email ?? '—'}</td>
                  <td style={{ ...S.td, color: '#6b7280' }}>Rev {v.templateRevision}</td>
                  <td style={{ ...S.td, color: '#6b7280', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || '—'}</td>
                  <td style={S.td}>
                    {v.pdfPath && (
                      <button
                        style={S.btnSecondarySmall}
                        onClick={() => handleDownloadPdf(v.id, `${msa.msaNumber ?? 'MSA'}_v${v.versionNumber}.pdf`)}
                      >
                        Download
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Agreement Documents */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Agreement Documents</h3>
          <button style={S.btnSecondarySmall} onClick={() => setShowUpload(true)}>Upload Document</button>
        </div>
        {msa.documents.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic', margin: '8px 0 0' }}>
            No documents uploaded yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
            <thead>
              <tr>
                {['Role', 'Filename', 'Uploaded', 'By', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {msa.documents.map(doc => (
                <tr key={doc.id}>
                  <td style={S.td}>
                    <span style={{ ...S.badge, ...ROLE_BADGE_STYLES[doc.documentRole] }}>
                      {ROLE_LABELS[doc.documentRole] ?? doc.documentRole}
                    </span>
                  </td>
                  <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.originalFilename}
                  </td>
                  <td style={{ ...S.td, color: '#6b7280' }}>
                    {new Date(doc.uploadedAt).toLocaleDateString('en-US')}
                  </td>
                  <td style={{ ...S.td, color: '#6b7280' }}>
                    {doc.uploadedBy?.fullName ?? doc.uploadedBy?.email ?? '—'}
                  </td>
                  <td style={S.td}>
                    <button
                      style={S.btnSecondarySmall}
                      onClick={() => handleDownloadDocument(doc.id, doc.originalFilename)}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Send Actions */}
      <div style={S.section}>
        <div style={S.sectionHeader}>
          <h3 style={S.sectionTitle}>Send Agreement</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {!msa.approvedAt && (msa.agreementType === 'MW4H_MODIFIED' || msa.agreementType === 'CUSTOMER_PROVIDED') && (
              <button style={{ ...S.btnSecondarySmall, color: '#16a34a', borderColor: '#86efac' }} onClick={handleApprove}>
                Approve
              </button>
            )}
            <button
              style={{ ...S.btnPrimary, opacity: (msa.status === 'EXPIRED' || msa.status === 'SUPERSEDED') ? 0.4 : 1 }}
              disabled={msa.status === 'EXPIRED' || msa.status === 'SUPERSEDED'}
              onClick={() => setShowSend(true)}
            >
              Send Agreement
            </button>
          </div>
        </div>
        {msa.sentAt && (
          <div style={{ marginTop: 4, fontSize: 13, color: '#374151' }}>
            <span style={S.fieldLabel}>Last Sent</span>
            <p style={{ margin: '4px 0 0' }}>
              {new Date(msa.sentAt).toLocaleDateString('en-US')}
              {msa.sentBy && ` by ${msa.sentBy.fullName ?? msa.sentBy.email}`}
              {msa.sentToEmail && ` to ${msa.sentToEmail}`}
            </p>
            {msa.sendNotes && (
              <p style={{ margin: '4px 0 0', color: '#6b7280', fontStyle: 'italic' }}>{msa.sendNotes}</p>
            )}
          </div>
        )}
        {msa.countersignedAt && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>COUNTERSIGNED</span>
            <span style={{ fontSize: 12, color: '#15803d', marginLeft: 8 }}>
              {new Date(msa.countersignedAt).toLocaleDateString('en-US')}
            </span>
          </div>
        )}
        {!msa.approvedAt && (msa.agreementType === 'MW4H_MODIFIED' || msa.agreementType === 'CUSTOMER_PROVIDED') && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#d97706' }}>
            This agreement type requires approval before it can be sent.
          </p>
        )}
      </div>

      {/* Lifecycle Actions */}
      <div style={S.section}>
        <h3 style={S.sectionTitle}>Lifecycle Actions</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {msa.status !== 'EXPIRED' && msa.status !== 'SUPERSEDED' && (
            <button
              style={S.btnSecondarySmall}
              onClick={() => setLifecycleModal({ action: 'record-review', title: 'Record Review Complete' })}
            >
              Record Review Complete
            </button>
          )}
          {(msa.status === 'SENT' || msa.status === 'SIGNED' || msa.status === 'VIEWED') && !msa.customerSignedAt && (
            <button
              style={S.btnSecondarySmall}
              onClick={() => setLifecycleModal({ action: 'record-customer-signed', title: 'Record Customer Signed' })}
            >
              Record Customer Signed
            </button>
          )}
          {msa.status !== 'EXPIRED' && msa.status !== 'SUPERSEDED' && msa.status !== 'DRAFT' && !msa.fullyExecutedAt && (
            <button
              style={{ ...S.btnSecondarySmall, color: '#16a34a', borderColor: '#86efac' }}
              onClick={() => setLifecycleModal({ action: 'record-final-approval', title: 'Record Final Approval / Fully Executed' })}
            >
              Record Final Approval
            </button>
          )}
          {msa.status !== 'EXPIRED' && msa.status !== 'SUPERSEDED' && (
            <button
              style={{ ...S.btnSecondarySmall, color: '#dc2626', borderColor: '#fecaca' }}
              onClick={() => setLifecycleModal({ action: 'expire', title: 'Expire MSA' })}
            >
              Expire
            </button>
          )}
          {msa.status !== 'EXPIRED' && msa.status !== 'SUPERSEDED' && (
            <button
              style={{ ...S.btnSecondarySmall, color: '#6b7280', borderColor: '#d1d5db' }}
              onClick={() => setLifecycleModal({ action: 'supersede', title: 'Supersede MSA' })}
            >
              Supersede
            </button>
          )}
        </div>
        {msa.supersededAt && (
          <div style={{ marginTop: 10, padding: '6px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, color: '#6b7280' }}>
            Superseded on {new Date(msa.supersededAt).toLocaleDateString('en-US')}
            {msa.supersededByMsaId && ` (replacement MSA available)`}
          </div>
        )}
        {msa.fullyExecutedAt && (
          <div style={{ marginTop: 8, padding: '6px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, color: '#166534' }}>
            Fully Executed on {new Date(msa.fullyExecutedAt).toLocaleDateString('en-US')}
            {msa.fullyExecutedBy && ` by ${msa.fullyExecutedBy.fullName ?? msa.fullyExecutedBy.email}`}
          </div>
        )}
      </div>

      {/* Lifecycle Confirmation Modal */}
      {lifecycleModal && (
        <LifecycleModal
          title={lifecycleModal.title}
          action={lifecycleModal.action}
          msaId={msa.id}
          customerId={msa.customer.id}
          onClose={() => setLifecycleModal(null)}
          onExecute={handleLifecycleAction}
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadDocumentModal
          msaId={msa.id}
          agreementType={msa.agreementType}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); loadMsa(); onChanged?.(); }}
        />
      )}

      {/* Send Modal */}
      {showSend && (
        <SendMsaModal
          msaId={msa.id}
          onClose={() => setShowSend(false)}
          onSent={() => { setShowSend(false); loadMsa(); onChanged?.(); }}
        />
      )}

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

// ——— Upload Modal ———

function UploadDocumentModal({ msaId, agreementType, onClose, onUploaded }: {
  msaId: string;
  agreementType: string | null;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [documentRole, setDocumentRole] = useState(
    agreementType === 'CUSTOMER_PROVIDED' ? 'CUSTOMER_SOURCE' : 'CUSTOMER_SIGNED'
  );
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const token = getAccessToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentRole', documentRole);
      if (notes.trim()) formData.append('notes', notes.trim());

      const res = await fetch(`${API_BASE}/commercial/msas/${msaId}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }
      onUploaded();
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Upload Document</h3>
          <button style={S.modalClose} onClick={onClose}>×</button>
        </div>
        <div style={S.modalBody}>
          {error && <div style={S.error}>{error}</div>}
          <div style={S.formRow}>
            <label style={S.formLabel}>Document Role</label>
            <select style={S.formInput} value={documentRole} onChange={e => setDocumentRole(e.target.value)}>
              {UPLOAD_ROLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={S.formRow}>
            <label style={S.formLabel}>File (PDF or DOCX)</label>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13 }}
            />
          </div>
          <div style={S.formRow}>
            <label style={S.formLabel}>Notes (optional)</label>
            <input style={S.formInput} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Received via email 5/5" />
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
          <button
            style={{ ...S.btnPrimary, opacity: (!file || uploading) ? 0.5 : 1 }}
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ——— Send Modal ———

function SendMsaModal({ msaId, onClose, onSent }: {
  msaId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!recipientEmail.trim()) return;
    setSending(true);
    setError('');
    try {
      await apiFetch(`/commercial/msas/${msaId}/send`, {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          ccEmail: ccEmail.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      onSent();
    } catch (e: any) {
      setError(e?.message ?? 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Send Agreement</h3>
          <button style={S.modalClose} onClick={onClose}>×</button>
        </div>
        <div style={S.modalBody}>
          {error && <div style={S.error}>{error}</div>}
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
            This will mark the MSA as SENT and record the send details. Attach the latest generated PDF when emailing.
          </p>
          <div style={S.formRow}>
            <label style={S.formLabel}>Recipient Email *</label>
            <input
              style={S.formInput}
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              placeholder="client@company.com"
            />
          </div>
          <div style={S.formRow}>
            <label style={S.formLabel}>CC Email (optional)</label>
            <input
              style={S.formInput}
              type="email"
              value={ccEmail}
              onChange={e => setCcEmail(e.target.value)}
              placeholder="cc@company.com"
            />
          </div>
          <div style={S.formRow}>
            <label style={S.formLabel}>Notes (optional)</label>
            <textarea
              style={{ ...S.formInput, resize: 'vertical', fontFamily: 'inherit' }}
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes about this send"
            />
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
          <button
            style={{ ...S.btnPrimary, opacity: (!recipientEmail.trim() || sending) ? 0.5 : 1 }}
            disabled={!recipientEmail.trim() || sending}
            onClick={handleSend}
          >
            {sending ? 'Sending...' : 'Mark as Sent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ——— Lifecycle Action Modal ———

function LifecycleModal({ title, action, msaId, customerId, onClose, onExecute }: {
  title: string;
  action: string;
  msaId: string;
  customerId: string;
  onClose: () => void;
  onExecute: (action: string, note?: string, extra?: Record<string, any>) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [replacementMsaId, setReplacementMsaId] = useState('');
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [eligibleMsas, setEligibleMsas] = useState<Array<{ id: string; msaNumber: string | null; title: string | null; status: string }>>([]);
  const [loadingMsas, setLoadingMsas] = useState(false);

  useEffect(() => {
    if (action !== 'supersede') return;
    let alive = true;
    setLoadingMsas(true);
    (async () => {
      try {
        const all = await apiFetch<Array<{ id: string; msaNumber: string | null; title: string | null; status: string }>>(`/commercial/customers/${customerId}/msas`);
        if (!alive) return;
        const filtered = all.filter(m => m.id !== msaId && m.status !== 'SUPERSEDED');
        setEligibleMsas(filtered);
      } catch { /* ignore */ }
      finally { if (alive) setLoadingMsas(false); }
    })();
    return () => { alive = false; };
  }, [action, customerId, msaId]);

  const handleExecute = async () => {
    setExecuting(true);
    setError('');
    try {
      const extra: Record<string, any> = {};
      if (action === 'supersede' && replacementMsaId) {
        extra.replacementMsaId = replacementMsaId;
      }
      if (action === 'record-final-approval') {
        extra.approvalNote = note.trim() || undefined;
      }
      await onExecute(action, note.trim() || undefined, extra);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Action failed');
    } finally {
      setExecuting(false);
    }
  };

  const noEligibleReplacements = action === 'supersede' && !loadingMsas && eligibleMsas.length === 0;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h3>
          <button style={S.modalClose} onClick={onClose}>×</button>
        </div>
        <div style={S.modalBody}>
          {error && <div style={S.error}>{error}</div>}
          <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
            {action === 'expire' && 'This will mark the MSA as expired. This action cannot be undone.'}
            {action === 'supersede' && 'This will mark the MSA as superseded (replaced by a new agreement).'}
            {action === 'record-customer-signed' && 'Record that the customer has returned a signed copy of this agreement.'}
            {action === 'record-final-approval' && 'Record final internal approval / fully executed status for this agreement.'}
            {action === 'record-review' && 'Record that the commercial review has been completed for this agreement.'}
          </p>
          {action === 'supersede' && (
            <div style={S.formRow}>
              <label style={S.formLabel}>Replacement Agreement (optional)</label>
              {loadingMsas ? (
                <span style={{ fontSize: 12, color: '#6b7280' }}>Loading agreements...</span>
              ) : noEligibleReplacements ? (
                <p style={{ margin: 0, fontSize: 12, color: '#d97706' }}>
                  No eligible replacement agreements available. Create another MSA first.
                </p>
              ) : (
                <select
                  style={S.formInput}
                  value={replacementMsaId}
                  onChange={e => setReplacementMsaId(e.target.value)}
                >
                  <option value="">— None (supersede without linking) —</option>
                  {eligibleMsas.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.msaNumber ?? m.id} {m.title ? `— ${m.title}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          <div style={S.formRow}>
            <label style={S.formLabel}>Note (optional)</label>
            <textarea
              style={{ ...S.formInput, resize: 'vertical', fontFamily: 'inherit' }}
              rows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional note for the audit trail"
            />
          </div>
        </div>
        <div style={S.modalFooter}>
          <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
          <button
            style={{
              ...S.btnPrimary,
              opacity: (executing || noEligibleReplacements) ? 0.5 : 1,
              background: action === 'expire' ? '#dc2626' : action === 'supersede' ? '#6b7280' : '#2563eb',
            }}
            disabled={executing || noEligibleReplacements}
            onClick={handleExecute}
          >
            {executing ? 'Processing...' : 'Confirm'}
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
