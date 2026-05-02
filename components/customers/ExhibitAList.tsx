'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

interface ExhibitASummary {
  id: string;
  exhibitANumber: string | null;
  status: string;
  title: string | null;
  projectName: string | null;
  expiresAt: string | null;
  createdAt: string;
  _count?: { lines: number };
}

interface Props {
  customerId: string;
  onSelect: (id: string) => void;
  refreshKey?: number;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  DRAFT: { color: '#d97706', bg: '#fffbeb' },
  APPROVED: { color: '#16a34a', bg: '#f0fdf4' },
  EXPIRED: { color: '#6b7280', bg: '#f3f4f6' },
  SUPERSEDED: { color: '#6b7280', bg: '#f3f4f6' },
};

export default function ExhibitAList({ customerId, onSelect, refreshKey }: Props) {
  const [items, setItems] = useState<ExhibitASummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<ExhibitASummary[]>(
          `/commercial/customers/${customerId}/exhibit-as`
        );
        if (!alive) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? 'Failed to load Exhibit As');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId, refreshKey]);

  if (loading) return <div style={S.loading}>Loading Exhibit As...</div>;
  if (error) return <div style={S.error}>{error}</div>;
  if (items.length === 0) return <div style={S.empty}>No Exhibit As yet.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={S.table}>
        <thead>
          <tr>
            {['Number', 'Status', 'Title', 'Project', 'Valid Until', 'Lines', 'Created'].map(h => (
              <th key={h} style={S.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((ea) => {
            const st = STATUS_STYLES[ea.status] ?? STATUS_STYLES.EXPIRED;
            return (
              <tr key={ea.id} onClick={() => onSelect(ea.id)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ ...S.td, fontWeight: 600, color: '#111827' }}>{ea.exhibitANumber ?? '—'}</td>
                <td style={S.td}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, color: st.color, background: st.bg }}>
                    {ea.status}
                  </span>
                </td>
                <td style={{ ...S.td, color: '#374151' }}>{ea.title || '—'}</td>
                <td style={{ ...S.td, color: '#374151' }}>{ea.projectName || '—'}</td>
                <td style={{ ...S.td, color: '#6b7280' }}>
                  {ea.expiresAt ? new Date(ea.expiresAt).toLocaleDateString('en-US') : '—'}
                </td>
                <td style={{ ...S.td, textAlign: 'center', color: '#374151' }}>{ea._count?.lines ?? 0}</td>
                <td style={{ ...S.td, color: '#6b7280' }}>
                  {new Date(ea.createdAt).toLocaleDateString('en-US')}
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
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '10px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: '#6b7280', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' },
  td: { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151', fontSize: 13 },
};
