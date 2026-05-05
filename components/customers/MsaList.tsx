'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface MsaSummary {
  id: string;
  msaNumber: string | null;
  status: string;
  title: string | null;
  agreementType: string | null;
  notes: string | null;
  expiresAt: string | null;
  signedAt: string | null;
  createdAt: string;
  _count?: { exhibitAs: number };
}

interface Props {
  customerId: string;
  refreshKey?: number;
  onCreateNew: () => void;
  onSelect?: (id: string) => void;
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
  MW4H_STANDARD: 'MW4H Standard',
  MW4H_MODIFIED: 'MW4H Modified',
  CUSTOMER_PROVIDED: 'Customer Provided',
};

export default function MsaList({ customerId, refreshKey, onCreateNew, onSelect }: Props) {
  const [msas, setMsas] = useState<MsaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<MsaSummary[]>(
          `/commercial/customers/${customerId}/msas`
        );
        if (!alive) return;
        setMsas(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? 'Failed to load MSAs');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId, refreshKey]);

  if (loading) return <div style={S.loading}>Loading MSAs...</div>;
  if (error) return <div style={S.error}>{error}</div>;
  if (msas.length === 0) return (
    <div style={S.empty}>
      No MSAs yet.{' '}
      <button style={S.linkBtn} onClick={onCreateNew}>Create one</button>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead>
          <tr>
            {['Number', 'Status', 'Type', 'Title', 'Expires', 'Exhibit As', 'Created'].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {msas.map((m) => {
            const st = STATUS_STYLES[m.status] ?? STATUS_STYLES.EXPIRED;
            return (
              <tr
                key={m.id}
                style={S.row}
                onClick={() => onSelect?.(m.id)}
              >
                <td style={{ ...S.td, fontWeight: 600, color: '#111827' }}>{m.msaNumber ?? '—'}</td>
                <td style={S.td}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg }}>
                    {m.status}
                  </span>
                </td>
                <td style={{ ...S.td, color: '#6b7280', fontSize: 12 }}>
                  {TYPE_LABELS[m.agreementType ?? ''] ?? '—'}
                </td>
                <td style={{ ...S.td, color: '#374151' }}>{m.title || '—'}</td>
                <td style={{ ...S.td, color: '#6b7280' }}>
                  {m.expiresAt ? new Date(m.expiresAt).toLocaleDateString('en-US') : '—'}
                </td>
                <td style={{ ...S.td, textAlign: 'center', color: '#374151' }}>{m._count?.exhibitAs ?? 0}</td>
                <td style={{ ...S.td, color: '#6b7280' }}>
                  {new Date(m.createdAt).toLocaleDateString('en-US')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const S = {
  loading: { padding: '24px 0', textAlign: 'center' as const, color: '#6b7280', fontSize: 14 },
  error: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 },
  empty: { padding: '24px 0', textAlign: 'center' as const, color: '#9ca3af', fontSize: 14, fontStyle: 'italic' as const },
  linkBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 500 } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: 13 },
  row: { cursor: 'pointer', transition: 'background 0.1s' } as React.CSSProperties,
};
